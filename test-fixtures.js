const http = require('http');

// Try ports 3000, 3001, 3002 in order
const PORTS = [3000, 3001, 3002, 3003];

function tryPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/fixtures`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          if (d.success !== undefined) {
            console.log(`\n=== DahBox on port ${port} ===`);
            console.log('success:', d.success);
            console.log('fixture count:', d.fixtures ? d.fixtures.length : 0);
            console.log('error:', d.error || 'none');
            if (d.fixtures && d.fixtures.length > 0) {
              console.log('\nFirst 5 upcoming fixtures:');
              d.fixtures.slice(0, 5).forEach(f => {
                console.log(`  ${f.homeFlag || '⚽'} ${f.homeTeam} vs ${f.awayFlag || '⚽'} ${f.awayTeam}`);
                console.log(`     ${f.competition} | ${f.kickoff}`);
              });
            } else {
              console.log('No fixtures returned (API may have returned empty response)');
            }
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  for (const port of PORTS) {
    const found = await tryPort(port);
    if (found) break;
  }
})();
