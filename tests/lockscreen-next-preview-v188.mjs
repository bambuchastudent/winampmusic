import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const navigation = fs.readFileSync('playback-navigation-v178.js', 'utf8');
const queue = fs.readFileSync('playback-queue-v170.js', 'utf8');
const background = fs.readFileSync('fast-background-v150.js', 'utf8');
const dom = new JSDOM(`<!doctype html><html><body><section class="screen">
  <div id="status">PLAYING</div><div id="nowTitle">One</div><div id="nowArtist">Artist</div>
  <div id="nowSource">Origin · Spotify · Playback · YouTube</div>
  <span id="elapsed">00:10</span><span id="duration">03:00</span><input id="seek" value="0">
  </section><button id="playButton">⏸</button><button id="prevButton">Previous</button>
  <button id="nextButton">Next</button><button id="shuffleButton">Shuffle</button>
  <ol id="trackList"></ol></body></html>`, {
  url: 'https://example.test/winampmusic/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
const rows = [
  { id: 'aaaaaaaaaaa', title: 'One', artist: 'Artist' },
  { id: 'pending', title: 'Unresolved', artist: 'Artist' },
  { id: 'ccccccccccc', title: 'Three', artist: 'Artist' },
  { id: 'ddddddddddd', title: 'Four', artist: 'Artist' },
];
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(rows));
window.localStorage.setItem('winampmusic.fast.current.v1', '0');
window.Math.random = () => 0.99;
window.setInterval = () => 0;
const timers = [];
window.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
window.clearTimeout = () => {};
const actions = {};
const session = { metadata: null, playbackState: 'none', setActionHandler: (name, fn) => { actions[name] = fn; }, setPositionState() {} };
Object.defineProperty(window.navigator, 'mediaSession', { value: session });
window.MediaMetadata = class { constructor(data) { Object.assign(this, data); } };
let hidden = false;
Object.defineProperty(window.document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
let playClicks = 0;
window.document.getElementById('playButton').addEventListener('click', () => { playClicks++; });
const played = [];
window.playIndex = async (index) => { played.push(index); window.localStorage.setItem('winampmusic.fast.current.v1', String(index)); return true; };
window.eval(navigation);
window.eval(queue);
window.eval(background);

assert.match(window.document.getElementById('nextTrackStatus')?.textContent || '', /#3.*Three/);
assert.match(session.metadata?.album || '', /Next #3.*Three/);
assert.equal(typeof actions.nexttrack, 'function');
assert.equal(typeof actions.previoustrack, 'function');
window.document.getElementById('shuffleButton').click();
await Promise.resolve();
assert.match(window.document.getElementById('nextTrackStatus')?.textContent || '', /#4.*Four/);
assert.match(session.metadata?.album || '', /Shuffle on/);
await window.playIndex(1);
assert.deepEqual(played, [3], 'shuffle continuation consumes the displayed reserved row');

hidden = true;
window.document.dispatchEvent(new window.Event('visibilitychange'));
window.document.getElementById('status').textContent = 'PAUSED';
await new Promise((resolve) => setImmediate(resolve));
for (const timer of timers.splice(0)) if (timer.ms <= 1000) timer.fn();
assert.equal(playClicks, 1, 'one accidental lock pause requests a resume');

hidden = false;
window.document.getElementById('status').textContent = 'PLAYING';
await new Promise((resolve) => setImmediate(resolve));
hidden = true;
window.document.dispatchEvent(new window.Event('visibilitychange'));
actions.pause();
window.document.getElementById('status').textContent = 'PAUSED';
await new Promise((resolve) => setImmediate(resolve));
for (const timer of timers.splice(0)) if (timer.ms <= 1000) timer.fn();
assert.equal(playClicks, 2, 'only explicit Pause clicks; lock recovery must not undo it');
dom.window.close();
console.log('Lockscreen continuity and next preview v1.8.8 OK');
