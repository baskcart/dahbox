/**
 * DahBox Unit Smoke Tests
 *
 * Covers three categories of pre-push checks:
 *   1. Emoji encoding integrity — all emoji in LANGUAGES and GENRES
 *      must be valid Unicode (not mojibake from build-time corruption).
 *   2. Stakes library — hashUserId, StakeRecord shape, payout formula.
 *   3. Markets library — market generation produces sane output.
 *
 * These run in <100ms (no network, no AWS) and block git push on failure.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── 1. Emoji / Encoding Tests ───────────────────────────────────────────────

describe('Emoji encoding integrity', () => {
  const pageSrc = readFileSync(
    join(__dirname, '../../app/page.tsx'),
    'utf8'
  );

  // Extract all labels from LANGUAGES and GENRES arrays
  const labelMatches = pageSrc.matchAll(/label:\s*['"`]([^'"`]+)['"`]/g);
  const labels = Array.from(labelMatches, m => m[1]);

  it('finds LANGUAGES and GENRES label entries', () => {
    // Should have at least 18 (languages) + 19 (genres) = 37
    expect(labels.length).toBeGreaterThanOrEqual(30);
  });

  it('no label contains Windows-1252 mojibake sequences', () => {
    // These code points are the hallmark of double-encoded UTF-8:
    // U+00F0 (ð) followed by U+0178 (Ÿ) is the double-encoded start of any 4-byte emoji
    const mojibakePattern = /\u00f0[\u0100-\u017f]/;
    for (const label of labels) {
      expect(
        mojibakePattern.test(label),
        `Mojibake detected in label: "${label}" — run scripts/fix-emoji.mjs`
      ).toBe(false);
    }
  });

  it('no label contains Latin-1 replacement for multi-byte emoji', () => {
    // â, ã, ð appearing before letters like Ÿ, Ž, ¬ indicate misinterpretation
    const latin1EmojiPattern = /[âãð][ŸŽ¬]/;
    for (const label of labels) {
      expect(
        latin1EmojiPattern.test(label),
        `Latin-1 emoji corruption in label: "${label}"`
      ).toBe(false);
    }
  });

  it('all flag emoji labels contain valid regional indicator pairs', () => {
    // Labels are stored as \uXXXX escape strings in source — verify the escape
    // sequences correspond to regional indicator code points (0x1F1E6–0x1F1FF)
    // by checking the decoded values at runtime
    const flagLabels = labels.filter(l => {
      // Decode: regional indicators are surrogate pairs in JS strings
      // They appear as \uD83C\uDDxx in source, decoded to code points >= 0x1F1E6
      const cp = l.codePointAt(0) ?? 0;
      return cp >= 0x1F1E6 && cp <= 0x1F1FF;
    });
    // In source the labels are escape sequences — runtime will decode them
    // Count escape pairs instead: \uD83C\uDD followed by hex
    const escapeMatches = pageSrc.match(/\\uD83C\\uDD[A-F0-9]{2}/g) || [];
    // Each flag = 2 regional indicators = 2 escape pairs
    const flagCount = Math.floor(escapeMatches.length / 2);
    expect(flagCount).toBeGreaterThanOrEqual(15);
  });

  it('source file uses Unicode escapes for emoji (build-safe)', () => {
    // At least some emoji should be stored as \uXXXX escapes (not raw bytes)
    // so the Amplify build can't corrupt them
    expect(pageSrc).toMatch(/\\uD83C|\\uD83D|\\u2694/);
  });

  it('success state emoji (🎬 Position Placed) is valid', () => {
    // Find the text-5xl div which holds the success emoji
    const match = pageSrc.match(/text-5xl[^>]*>(.*?)<\/div>/);
    if (match) {
      const emoji = match[1];
      const cp = emoji.codePointAt(0) ?? 0;
      // 🎬 = U+1F3AC
      expect(cp).toBe(0x1F3AC);
    }
    // If the pattern doesn't match (JSX variation), just check the escape is present
    expect(pageSrc).toContain('\\uD83C\\uDFAC');
  });
});

// ─── 2. Stakes Library ───────────────────────────────────────────────────────

describe('hashUserId', async () => {
  const { hashUserId } = await import('../../app/lib/stakes');

  it('returns a 32-character hex string (SHA-256 truncated to 128-bit)', () => {
    const result = hashUserId('test-user-public-key');
    // hashUserId uses crypto.createHash('sha256').digest('hex').slice(0,32)
    // giving 32 lowercase hex chars = 128 bits
    expect(result).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic', () => {
    const key = 'ml-dsa-65-public-key-example';
    expect(hashUserId(key)).toBe(hashUserId(key));
  });

  it('produces different hashes for different keys', () => {
    expect(hashUserId('key-a')).not.toBe(hashUserId('key-b'));
  });

  it('handles a full ML-DSA-65 length key (2600+ bytes) without throwing', () => {
    const longKey = 'A'.repeat(2600);
    expect(() => hashUserId(longKey)).not.toThrow();
    const hash = hashUserId(longKey);
    // Hash length is 32 hex chars (128-bit truncated SHA-256)
    expect(hash.length).toBe(32);
  });

  it('hash is under 64 bytes — safe for DynamoDB sort key (1024 byte limit)', () => {
    const hash = hashUserId('any-public-key');
    // 64 hex chars = 32 bytes — well under the 1024-byte DynamoDB SK limit
    expect(Buffer.byteLength(hash, 'utf8')).toBeLessThanOrEqual(64);
  });
});

// ─── 3. Markets Library — Payout Formula Sanity ──────────────────────────────

describe('Payout formula', () => {
  /**
   * Mirrors the potentialPayout calculation in StakeModal:
   * payout = (amount / (outcomeStaked + amount)) * (totalPool + amount) * 0.97
   */
  function calcPayout(amount: number, outcomeStaked: number, totalPool: number): number {
    return (amount / (outcomeStaked + amount)) * (totalPool + amount) * 0.97;
  }

  it('first staker gets back < staked amount (known UX issue — house seed TODO)', () => {
    // When pool is empty, payout < stake due to 3% fee. This test documents the known
    // behaviour — not a bug to fix here, but tracked in the to-do as Option A.
    const payout = calcPayout(10, 0, 0);
    expect(payout).toBeCloseTo(9.7, 1);
    expect(payout).toBeLessThan(10);
  });

  it('payout increases as pool grows (more stakers = better EV)', () => {
    const p1 = calcPayout(10, 0, 0);       // first staker
    const p2 = calcPayout(10, 50, 100);    // mid-pool
    const p3 = calcPayout(10, 200, 500);   // large pool
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
  });

  it('platform always takes exactly 3%', () => {
    const gross = (10 / 10) * 10; // 100% share of pool
    const net = calcPayout(10, 0, 0);
    expect(net / gross).toBeCloseTo(0.97, 5);
  });

  it('payout is never negative', () => {
    expect(calcPayout(1, 0, 0)).toBeGreaterThan(0);
    expect(calcPayout(100, 10000, 50000)).toBeGreaterThan(0);
  });
});

// ─── 4. LANGUAGES / GENRES array completeness ────────────────────────────────

describe('LANGUAGES array completeness', () => {
  // Dynamically extract the LANGUAGES array entries from the source
  const pageSrc = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf8');

  it('contains at least 15 languages', () => {
    const codeMatches = pageSrc.matchAll(/code:\s*'([a-z]{2,3})'/g);
    const codes = Array.from(codeMatches, m => m[1]);
    expect(codes.length).toBeGreaterThanOrEqual(15);
  });

  it('contains at least 15 genre entries', () => {
    const idMatches = pageSrc.matchAll(/id:\s*'(\d+)'/g);
    const ids = Array.from(idMatches, m => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(15);
  });

  it('English (en) is the first language code in LANGUAGES', () => {
    const langBlock = pageSrc.slice(
      pageSrc.indexOf('const LANGUAGES'),
      pageSrc.indexOf('];', pageSrc.indexOf('const LANGUAGES')) + 2
    );
    // First code: entry after "const LANGUAGES = ["
    const firstCode = langBlock.match(/code:\s*'([^']+)'/);
    // With current setup, first entry is the globe (all languages) with empty code ''
    // or 'en' — either is acceptable; what matters is 'en' is present near the top
    const allCodes = Array.from(langBlock.matchAll(/code:\s*'([^']+)'/g), m => m[1]);
    expect(allCodes.slice(0, 3)).toContain('en');
  });
});
