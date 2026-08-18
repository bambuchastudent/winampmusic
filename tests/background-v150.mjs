import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const background = fs.readFileSync('fast-background-v150.js', 'utf8');
const release = fs.readFileSync('fast-release-v150.js', 'utf8');
assert.ok(!background.includes('stopImmediatePropagation'));
assert.ok(!background.includes("addEventListener('pointer"));
assert.ok(!release.includes('stopImmediatePropagation'));

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="status">PLAYING</div><span id="elapsed">00:10</span><span id="duration">03:00</span>
  <input id="seek" type="range" min="0" max="1000" value="0">
  <button id="playButton">▶</button><button id="prevButton">Prev</button><button id="nextButton">Next</button>
  <ol id="trackList"></ol>
</body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/', pretendToBeVisual: true });
const { window } = dom;

window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk', title: 'Test song', artist: 'Tester' }]));
window.localStorage.setItem('winampmusic.fast.current.v1', '0');
const actions = {};
const session = {
  metadata: null,
  playbackState: 'none',
  setActionHandler(name, handler) { actions[name] = handler; },
  setPositionState() {},
};
Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: session });
window.MediaMetadata = class { constructor(value) { Object.assign(this, value); } };
window.setInterval = () => 1;
window.clearInterval = () => {};

let playClicks = 0;
let prevClicks = 0;
let nextClicks = 0;
window.document.getElementById('playButton').addEventListener('click', () => { playClicks += 1; });
window.document.getElementById('prevButton').addEventListener('click', () => { prevClicks += 1; });
window.document.getElementById('nextButton').addEventListener('click', () => { nextClicks += 1; });

window.eval(background);
assert.equal(typeof actions.play, 'function');
assert.equal(typeof actions.pause, 'function');
assert.equal(typeof actions.nexttrack, 'function');
assert.equal(typeof actions.previoustrack, 'function');
assert.equal(session.metadata?.title, 'Test song');

// Idempotent system actions: play while already playing must not toggle to pause.
actions.play();
assert.equal(playClicks, 0, 'system Play must not click an already-playing toggle');
actions.pause();
assert.equal(playClicks, 1, 'system Pause must click the toggle while playing');

window.document.getElementById('status').textContent = 'PAUSED';
await new Promise((resolve) => setTimeout(resolve, 0));
actions.pause();
assert.equal(playClicks, 1, 'system Pause must not click an already-paused toggle');
actions.play();
assert.equal(playClicks, 2, 'system Play must click the toggle while paused');
actions.nexttrack();
actions.previoustrack();
assert.equal(nextClicks, 1);
assert.equal(prevClicks, 1);

dom.window.close();

// Release adapter must keep background outside the synchronous critical path.
const shell = new JSDOM(`<!doctype html><html><head></head><body><div id="status">READY · FAST</div><ol id="trackList"></ol></body></html>`, {
  runScripts: 'outside-only', url: 'https://example.test/winampmusic/'
});
const idle = [];
shell.window.requestIdleCallback = (cb) => { idle.push(cb); return idle.length; };
shell.window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk' }]));
shell.window.localStorage.setItem('winampmusic.fast.current.v1', '0');
shell.window.eval(release);
assert.equal(shell.window.document.querySelector('script[data-amp-background-150]'), null, 'background must not load synchronously');
assert.equal(shell.window.__AMP_MUSIC_RELEASE__, '1.5.0');
idle.shift()?.({ didTimeout: false, timeRemaining: () => 50 });
assert.ok(shell.window.document.querySelector('script[data-amp-background-150]'), 'background must load lazily after core');
const state = JSON.parse(shell.window.localStorage.getItem('winampmusic.player.v1') || '{}');
assert.equal(state.currentId, 'abcdefghijk');
shell.window.close();

console.log('AmpMusic 1.5 background/media-session test passed');
process.exit(0);
