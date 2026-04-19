const fs = require('fs');
// Read .env.local manually
try {
  const env = fs.readFileSync('.env.local', 'utf8');
  env.split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
} catch(e) { console.log('No .env.local found'); }

const k = process.env.FOOTBALL_API_KEY;
console.log('Key set:', k ? 'YES' : 'NO');
if (k) console.log('Key prefix:', k.substring(0, 10) + '...');

// Test date-based queries — free plan allows date= parameter
const https = require('https');
// Try today and next few days
const today = new Date();
const dates = [0, 1, 2, 3].map(d => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
});
const tests = [
  ...dates.map(date => ({ label: `Fixtures ${date}`, path: `/fixtures?date=${date}&timezone=America/New_York` })),
  { label: 'FIFA WC 2026 (season 2026)', path: '/fixtures?league=1&season=2026&date=' + dates[0] },
];

async function testEndpoint(label, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      path,
      headers: { 'x-apisports-key': k || '' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors && Object.keys(parsed.errors).length > 0) {
            console.log(`${label}: ERROR -`, JSON.stringify(parsed.errors));
          } else {
            console.log(`${label}: ${parsed.results} results`);
            if (parsed.response && parsed.response.length > 0) {
              const f = parsed.response[0];
              if (f.teams) {
                console.log(`  -> ${f.teams.home.name} vs ${f.teams.away.name} [${f.fixture.status.short}] ${f.fixture.date}`);
              } else {
                console.log('  ->', JSON.stringify(parsed.response[0]).substring(0, 100));
              }
            }
          }
        } catch(e) {
          console.log(`${label}: Parse error`, e.message);
        }
        resolve();
      });
    }).on('error', e => { console.log(`${label}: Request error`, e.message); resolve(); });
  });
}

(async () => {
  for (const t of tests) {
    await testEndpoint(t.label, t.path);
    await new Promise(r => setTimeout(r, 500)); // avoid rate limit
  }
})();
