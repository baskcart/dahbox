/**
 * fix-emoji.mjs  v3  — fully generic
 * Fixes double-encoded UTF-8 emoji in DahBox source files.
 *
 * Root cause: the file was edited with an editor that read it as Windows-1252,
 * then saved it as UTF-8. Each 4-byte emoji (e.g. F0 9F 8E AC for 🎬) was
 * decoded as 4 separate Windows-1252 chars, then re-encoded as UTF-8, leaving
 * sequences like C3B0 C5B8 C5BD C2AC on disk instead of F0 9F 8E AC.
 *
 * Fix: scan the file for every occurrence of C3B0 C5B8 (the double-encoded
 * form of 0xF0 0x9F, the start of any 4-byte emoji), decode the next few
 * UTF-8 code units back through the Windows-1252 mapping to recover the
 * original UTF-8 bytes, and replace in-place.
 */
import { readFileSync, writeFileSync } from 'fs';

// Windows-1252 special mappings (0x80–0x9F range only; rest is Latin-1)
const WIN1252_SPECIAL = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
]);

/** Read one UTF-8 code point from buf at pos; returns [codepoint, bytesConsumed] */
function readCodePoint(buf, pos) {
  const b = buf[pos];
  if (b < 0x80) return [b, 1];
  if (b < 0xE0) return [((b & 0x1F) << 6) | (buf[pos+1] & 0x3F), 2];
  if (b < 0xF0) return [((b & 0x0F) << 12) | ((buf[pos+1] & 0x3F) << 6) | (buf[pos+2] & 0x3F), 3];
  return [
    ((b & 0x07) << 18) | ((buf[pos+1] & 0x3F) << 12) | ((buf[pos+2] & 0x3F) << 6) | (buf[pos+3] & 0x3F),
    4,
  ];
}

/** Reverse the Windows-1252 misinterpretation: Unicode codepoint → original byte */
function cpToWin1252Byte(cp) {
  if (WIN1252_SPECIAL.has(cp)) return WIN1252_SPECIAL.get(cp);
  return cp; // straight Latin-1
}

/**
 * Given a buffer position where we detected the start of a double-encoded emoji
 * (C3B0 C5B8 = double-encoded 0xF0 0x9F), decode the next 4 windows-1252-then-utf8
 * code units back to their original bytes.
 * Returns [originalBytes: Buffer, totalEncodedBytesConsumed: number] or null if invalid.
 */
function decodeMojibakeEmoji(buf, pos) {
  const origBytes = [];
  let p = pos;
  for (let i = 0; i < 4; i++) {
    if (p >= buf.length) return null;
    const [cp, len] = readCodePoint(buf, p);
    origBytes.push(cpToWin1252Byte(cp));
    p += len;
  }
  // Sanity check: original bytes should form a valid 4-byte UTF-8 sequence
  // (starts with F0–F4, followed by 3 continuation bytes 80–BF)
  if (origBytes[0] < 0xF0 || origBytes[0] > 0xF4) return null;
  for (let i = 1; i < 4; i++) {
    if (origBytes[i] < 0x80 || origBytes[i] > 0xBF) return null;
  }
  return [Buffer.from(origBytes), p - pos];
}

// The on-disk double-encoded prefix for 0xF0 0x9F (start of every >=U+1F000 emoji)
const EMOJI_PREFIX = Buffer.from('c3b0c5b8', 'hex');

function fixFile(absPath) {
  let buf = readFileSync(absPath);
  const parts = [];
  let pos = 0;
  let fixes = 0;

  while (pos < buf.length) {
    const found = buf.indexOf(EMOJI_PREFIX, pos);
    if (found === -1) {
      parts.push(buf.slice(pos));
      break;
    }
    parts.push(buf.slice(pos, found));
    const result = decodeMojibakeEmoji(buf, found);
    if (result) {
      const [correct, consumed] = result;
      parts.push(correct);
      pos = found + consumed;
      fixes++;
    } else {
      // Not a valid emoji sequence — keep the bytes as-is
      parts.push(buf.slice(found, found + 4));
      pos = found + 4;
    }
  }

  if (fixes === 0) {
    console.log(`No changes needed in ${absPath}`);
    return;
  }

  const fixed = Buffer.concat(parts);
  writeFileSync(absPath, fixed);
  console.log(`Fixed ${fixes} emoji sequences in ${absPath}`);
}

const FILES = [
  'src/app/page.tsx',
  'src/app/movie/[slug]/MoviePageClient.tsx',
];

const base = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
for (const f of FILES) {
  try {
    fixFile(base + f);
  } catch (e) {
    console.log(`Skipping ${f}: ${e.message}`);
  }
}
console.log('Done.');
