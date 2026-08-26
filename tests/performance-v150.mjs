import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { performance } from 'node:perf_hooks';

const index = fs.readFileSync('index.html', 'utf8');
const core = fs.readFileSync('fast-player-v141.js', 'utf8');

assert.match(index, /<script src="\.\/fast-player-v141\.js\?v=150"><\/script>/, 'core must be the only synchronous runtime');
assert.match(index, /fast-release-v150\.js\?v=150" defer/);
assert.match(index, /fast-import-v150\.js\?v=150" defer/);
assert.match(index, /fast-actions-v143\.js\?v=150" defer/);
assert.ok(!index.includes('compact-share.js'), 'share implementation must stay out of initial HTML');
assert.ok(!index.includes('qr-share-v1.js'), 'QR implementation must stay out of initial HTML');
assert.ok(!index.includes('apple-music-import-v064.js'), 'Apple provider code must stay lazy');
assert.ok(!index.includes('fast-background-v150.js'), 'background provider code must stay lazy');
assert.ok(Buffer.byteLength(core, 'utf8') < 19000, 'synchronous core JS exceeded its source budget');

const stripped = index
  .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
  .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-actions-v143.js?v=150" defer></script>', '');
const dom = new JSDOM(stripped, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/', pretendToBeVisual: true });
const { window } = dom;
const idle = [];
window.requestIdleCallback = (cb) => { idle.push(cb); return idle.length; };
window.YT = { PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 }, Player: class {} };
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(Array.from({ length: 183 }, (_, i) => ({
  id: `vid${String(i).padStart(8, '0')}`, title: `Song ${i}`, artist: `Artist ${i % 10}`,
}))));

const start = performance.now();
window.eval(core);
const syncMs = performance.now() - start;
assert.equal(window.document.querySelectorAll('.track').length, 30);
assert.ok(syncMs < 250, `183-track synchronous startup ${syncMs.toFixed(1)} ms exceeds 250 ms budget`);
assert.ok(idle.length > 0, 'remaining work must be deferred to idle time');

console.log(`AmpMusic 1.5 performance gate passed: ${syncMs.toFixed(1)} ms synchronous startup`);
process.exit(0);
