import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const navigationSource = fs.readFileSync('playback-navigation-v178.js', 'utf8');
const queueSource = fs.readFileSync('playback-queue-v170.js', 'utf8');
const backgroundSource = fs.readFileSync('fast-background-v150.js', 'utf8');
const releaseSource = fs.readFileSync('fast-release-v150.js', 'utf8');
const swSource = fs.readFileSync('sw.js', 'utf8');

assert.match(releaseSource, /playback-navigation-v178\.js\?v=178/, 'release adapter must load deterministic navigation runtime');
assert.match(swSource, /ampmusic-v1\.7\.8/, 'service worker build must advance for navigation semantics');
assert.match(swSource, /playback-navigation-v178\.js/, 'navigation runtime must be available offline');

const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';
const FINAL = 'music-only-v1.6.7';
const SHUFFLE = 'winampmusic.playback.shuffle.v1';

const dom = new JSDOM(`<!doctype html><html><body>
  <section class="screen">
    <div id="status">PLAYING</div>
    <div id="nowTitle">Current</div>
    <div id="nowArtist">Artist</div>
    <div id="nowSource">Origin · Spotify · Playback · YouTube candidate</div>
  </section>
  <button id="prevButton">Prev</button>
  <button id="playButton">Play</button>
  <button id="nextButton">Next</button>
  <button id="shuffleButton">Shuffle</button>
  <ol id="trackList">
    <li><button class="track-main" data-index="3">Fourth unresolved</button></li>
    <li><button class="track-main" data-index="4">Fifth playable</button></li>
  </ol>
</body></html>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const library = [
  { id: 'aaaaaaaaaaa', title: 'One', artist: 'Artist', spotifyTrackId: 's1', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'bbbbbbbbbbb', title: 'Two', artist: 'Artist', spotifyTrackId: 's2', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'ccccccccccc', title: 'Three', artist: 'Artist', spotifyTrackId: 's3', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'U-four', title: 'Four', artist: 'Artist', spotifyTrackId: 's4', badges: ['Spotify', 'Origin'] },
  { id: 'eeeeeeeeeee', title: 'Five', artist: 'Artist', spotifyTrackId: 's5', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'fffffffffff', title: 'Six', artist: 'Artist', spotifyTrackId: 's6', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
];
window.localStorage.setItem(KEY, JSON.stringify(library));
window.localStorage.setItem(CURRENT, '2');
window.localStorage.removeItem(SHUFFLE);
window.renderLibrary = () => {};
window.importTracks = () => ({ added: 0, total: library.length });
window.ampMusicOriginPlayback151 = { refresh() {} };
const resolverCalls = [];
window.ampulaPlaybackPrefetch165 = {
  resolveAhead: async (_index, track) => { resolverCalls.push(track?.title); return null; },
  resolveAll: async () => [],
};
window.ampulaTrackDiagnostics164 = { resolveTrusted: async () => null };
const played = [];
window.playIndex = async (index) => {
  played.push(index);
  window.localStorage.setItem(CURRENT, String(index));
  return `played:${index}`;
};
window.Math.random = () => 0.99;

window.eval(navigationSource);
window.eval(queueSource);

const shuffleButton = window.document.getElementById('shuffleButton');
const modeLine = window.document.getElementById('playbackModeStatus');
assert.equal(shuffleButton.getAttribute('aria-pressed'), 'false', 'shuffle defaults to OFF');
assert.equal(modeLine?.textContent, 'SHUFFLE · OFF · ORDER · SEQUENTIAL');
assert.equal(modeLine?.previousElementSibling?.id, 'nowSource', 'mode line belongs directly below origin/playback provenance');

shuffleButton.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(shuffleButton.getAttribute('aria-pressed'), 'true', 'shuffle button exposes ON state');
assert.equal(modeLine?.textContent, 'SHUFFLE · ON · NEXT · RANDOM');
assert.deepEqual(played, [], 'toggling shuffle must not immediately replace the current track');

// Shuffle ON affects automatic/Next continuation, but an explicit track click must always win.
window.localStorage.setItem(CURRENT, '2');
const automaticShuffle = await window.playIndex(3);
assert.equal(automaticShuffle, 'played:5');
assert.deepEqual(played, [5], 'automatic continuation may choose a random ready row while shuffle is ON');

window.localStorage.setItem(CURRENT, '2');
window.document.querySelector('.track-main[data-index="4"]').addEventListener('click', () => { void window.playIndex(4); }, { once: true });
window.document.querySelector('.track-main[data-index="4"]').click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(played, [5, 4], 'manual click on row 5 must play row 5 even while shuffle is ON');

// Turn shuffle off: default continuation is deterministic and skips only unresolved rows in order.
shuffleButton.click();
assert.equal(shuffleButton.getAttribute('aria-pressed'), 'false');
window.localStorage.setItem(CURRENT, '2');
const sequential = await window.playIndex(3);
assert.equal(sequential, 'played:4', 'row 3 -> unresolved row 4 -> row 5 must preserve library order');
assert.deepEqual(played, [5, 4, 4]);

// Manual unresolved selection is not an invitation to substitute some other recording.
window.localStorage.setItem(CURRENT, '2');
window.document.querySelector('.track-main[data-index="3"]').addEventListener('click', () => { void window.playIndex(3); }, { once: true });
window.document.querySelector('.track-main[data-index="3"]').click();
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(played, [5, 4, 4], 'manual unresolved selection must not fall through to row 5 or any random recording');
assert.ok(resolverCalls.includes('Four'), 'the selected unresolved recording should still be resolved in place');
assert.match(window.document.getElementById('status').textContent, /SELECTED TRACK UNRESOLVED/i);

dom.window.close();

// Browser/OS suspension while hidden must not rewrite a playing snapshot into paused.
const backgroundDom = new JSDOM(`<!doctype html><html><body>
  <div id="status">PLAYING</div><span id="elapsed">00:42</span><span id="duration">03:00</span>
  <input id="seek" type="range" min="0" max="1000" value="233">
  <button id="playButton">Play</button><button id="prevButton">Prev</button><button id="nextButton">Next</button>
</body></html>`, {
  url: 'https://example.test/winampmusic/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const bw = backgroundDom.window;
let visibility = 'visible';
Object.defineProperty(bw.document, 'visibilityState', { configurable: true, get: () => visibility });
bw.setInterval = () => 1;
bw.clearInterval = () => {};
bw.localStorage.setItem(KEY, JSON.stringify([{ id: 'abcdefghijk', title: 'Track', artist: 'Artist' }]));
bw.localStorage.setItem(CURRENT, '0');
let resumeClicks = 0;
bw.document.getElementById('playButton').addEventListener('click', () => {
  resumeClicks += 1;
  bw.document.getElementById('status').textContent = 'PLAYING';
});
bw.eval(backgroundSource);

visibility = 'hidden';
bw.document.dispatchEvent(new bw.Event('visibilitychange'));
let snapshot = JSON.parse(bw.localStorage.getItem('winampmusic.background.v1'));
assert.equal(snapshot.wasPlaying, true, 'hiding a playing tab records playback intent');

// Simulate the embedded provider being paused by the browser while the tab is hidden.
bw.document.getElementById('status').textContent = 'PAUSED';
await new Promise((resolve) => setTimeout(resolve, 0));
bw.dispatchEvent(new bw.Event('pagehide'));
snapshot = JSON.parse(bw.localStorage.getItem('winampmusic.background.v1'));
assert.equal(snapshot.wasPlaying, true, 'browser-induced hidden PAUSED must not erase intended playback');

visibility = 'visible';
bw.document.dispatchEvent(new bw.Event('visibilitychange'));
await new Promise((resolve) => setTimeout(resolve, 320));
assert.equal(resumeClicks, 1, 'returning to the tab resumes the same intended playback instead of staying stopped');
backgroundDom.window.close();

console.log('playback order + shuffle state + tab continuity v1.7.8: ok');
