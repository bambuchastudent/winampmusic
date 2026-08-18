import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const canonical = fs.readFileSync('index.html', 'utf8');
const fallback = fs.readFileSync('fast-141.html', 'utf8');
const code = fs.readFileSync('fast-player-v141.js', 'utf8');

for (const page of [canonical, fallback]) {
  assert.ok(!page.includes('app.js'), 'fast entry must not load legacy app.js');
  assert.ok(!page.includes('boot-v140.js'), 'fast entry must not load legacy boot');
  assert.ok(!page.includes('controls-failsafe'), 'fast entry must not load interaction failsafes');
  assert.ok(!page.includes('sw.js'), 'fast entry must not register a service worker');
}
assert.match(canonical, /fast-player-v141\.js\?v=142/);
assert.match(fallback, /fast-player-v141\.js\?v=141/);
assert.match(canonical, /FAST 1\.4\.2/);
assert.ok(!code.includes('stopImmediatePropagation'));
assert.ok(!code.includes("addEventListener('pointer"));

const stripped = canonical
  .replace('<script src="./fast-player-v141.js?v=142"></script>', '')
  .replace('<script src="./fast-import-v142.js?v=142" defer></script>', '');
const dom = new JSDOM(stripped, {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;

const idle = [];
window.requestIdleCallback = (callback) => {
  idle.push(callback);
  return idle.length;
};
window.cancelIdleCallback = () => {};

const tracks = Array.from({ length: 183 }, (_, index) => ({
  id: `vid${String(index).padStart(8, '0')}`,
  title: `Song ${String(index + 1).padStart(3, '0')}`,
  artist: `Artist ${index % 12}`,
}));
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(tracks));

let currentId = null;
let state = 2;
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: class FakePlayer {
    constructor(_id, options) {
      this.options = options;
      queueMicrotask(() => options.events.onReady?.());
    }
    setVolume() {}
    loadVideoById(id) {
      currentId = id;
      state = 1;
      this.options.events.onStateChange?.({ data: 1 });
    }
    getPlayerState() { return state; }
    playVideo() { state = 1; this.options.events.onStateChange?.({ data: 1 }); }
    pauseVideo() { state = 2; this.options.events.onStateChange?.({ data: 2 }); }
    getDuration() { return 240; }
    getCurrentTime() { return 12; }
    seekTo() {}
  },
};

const started = performance.now();
window.eval(code);
const synchronousStartupMs = performance.now() - started;

assert.equal(window.__WINAMP_MUSIC_RUNTIME__, '1.4.1-fast');
assert.equal(window.document.getElementById('trackCount').textContent, '183');
assert.equal(window.document.querySelectorAll('.track').length, 30, 'only first 30 rows may render synchronously');
assert.equal(window.document.getElementById('status').textContent, 'READY · FAST');
assert.ok(synchronousStartupMs < 500, `synchronous startup should stay small, got ${synchronousStartupMs.toFixed(1)}ms`);

window.document.getElementById('playButton').click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(currentId, tracks[0].id, 'Play must work before deferred library chunks render');
assert.equal(window.document.getElementById('status').textContent, 'PLAYING');

window.document.getElementById('nextButton').click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(currentId, tracks[1].id, 'Next must immediately select second track');

window.document.querySelector('.track[data-index="5"] .track-main').click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(currentId, tracks[5].id, 'track tap must immediately play selected track');

while (idle.length) idle.shift()({ didTimeout: false, timeRemaining: () => 50 });
assert.equal(window.document.querySelectorAll('.track').length, 183, 'remaining rows must render in idle chunks');

const search = window.document.getElementById('search');
search.value = 'Song 150';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelectorAll('.track').length, 1, 'filter must be interactive');
assert.equal(window.document.querySelector('.track-title')?.textContent, 'Song 150');

console.log(`v1.4 fast player test passed; synchronous startup ${synchronousStartupMs.toFixed(1)}ms`);
process.exit(0);
