import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const navigationSource = fs.readFileSync('playback-navigation-v178.js', 'utf8');
const queueSource = fs.readFileSync('playback-queue-v170.js', 'utf8');

const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';
const FINAL = 'music-only-v1.6.7';

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="status">READY</div>
  <div id="nowTitle">Current</div>
  <div id="nowArtist">Artist</div>
  <div id="nowSource">ORIGIN · SPOTIFY · PLAYBACK · YOUTUBE CANDIDATE</div>
  <button id="prevButton">Prev</button>
  <button id="playButton">Play</button>
  <button id="nextButton">Next</button>
  <button id="shuffleButton">Shuffle</button>
  <ol id="trackList">
    <li><button class="track-main" data-index="2">Three unresolved</button></li>
    <li><button class="track-main" data-index="4">Five ready</button></li>
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
  { id: 'U-three', title: 'Three', artist: 'Artist', spotifyTrackId: 's3', badges: ['Spotify', 'Origin'] },
  { id: 'ddddddddddd', title: 'Four', artist: 'Artist', spotifyTrackId: 's4', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'eeeeeeeeeee', title: 'Five', artist: 'Artist', spotifyTrackId: 's5', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'U-six', title: 'Six', artist: 'Artist', spotifyTrackId: 's6', badges: ['Spotify', 'Origin'] },
  { id: 'ggggggggggg', title: 'Seven', artist: 'Artist', spotifyTrackId: 's7', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
];
window.localStorage.setItem(KEY, JSON.stringify(library));
window.localStorage.setItem(CURRENT, '1');
window.localStorage.setItem('winampmusic.playback.shuffle.v1', '0');
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
window.importTracks = (items) => {
  const incoming = Array.isArray(items) ? items : [];
  const rows = JSON.parse(window.localStorage.getItem(KEY) || '[]');
  for (const item of incoming) {
    const index = rows.findIndex((row) => row.spotifyTrackId && row.spotifyTrackId === item.spotifyTrackId);
    if (index >= 0 && item.id) rows[index].id = item.id;
  }
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  return { added: 0, total: rows.length };
};

let releaseThree;
const threeResolved = new Promise((resolve) => { releaseThree = resolve; });
window.ampulaPlaybackPrefetch165 = {
  resolveAhead: async (index) => {
    if (index === 2) return threeResolved;
    return null;
  },
  resolveAll: async () => [],
};
window.ampulaTrackDiagnostics164 = { resolveTrusted: async () => null };

const played = [];
window.playIndex = async (index) => {
  played.push(index);
  window.localStorage.setItem(CURRENT, String(index));
  return `played:${index}`;
};

let suspendCalls = 0;
window.ampMusicYouTube150 = { suspend() { suspendCalls += 1; } };

window.eval(navigationSource);
window.eval(queueSource);

const rowThree = window.document.querySelector('.track-main[data-index="2"]');
const rowFive = window.document.querySelector('.track-main[data-index="4"]');
const nextButton = window.document.getElementById('nextButton');
const playButton = window.document.getElementById('playButton');
const status = window.document.getElementById('status');

rowThree.addEventListener('click', () => { void window.playIndex(2); });
rowFive.addEventListener('click', () => { void window.playIndex(4); });
nextButton.addEventListener('click', () => { void window.playIndex(5); });

// Start a slow explicit resolve for row 3, then immediately choose row 5.
rowThree.click();
await new Promise((resolve) => setTimeout(resolve, 0));
rowFive.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(played, [4], 'newer explicit row 5 must start immediately');

// Complete the old row-3 resolver. It may cache the trusted handle, but it must not steal playback.
releaseThree({
  id: 'ccccccccccc', title: 'Wrong playback metadata must not replace Three', artist: 'Playback candidate',
  spotifyTrackId: 's3', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL,
});
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(played, [4], 'stale explicit resolver must not start row 3 after row 5 was selected');
assert.equal(window.localStorage.getItem(CURRENT), '4', 'row 5 remains current after stale resolution completes');
const rowsAfterResolve = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(rowsAfterResolve[2].title, 'Three', 'playback resolution must preserve canonical title');
assert.equal(rowsAfterResolve[2].artist, 'Artist', 'playback resolution must preserve canonical artist');

// Next from row 5 skips unresolved row 6 and lands on row 7 in sequential mode.
nextButton.click();
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(played, [4, 6], 'row 5 -> unresolved row 6 -> row 7 must be deterministic with Shuffle OFF');
assert.equal(window.localStorage.getItem(CURRENT), '6');

// Base player may briefly emit an ellipsis while loading; navigation must normalize it to a real Pause affordance.
status.textContent = 'LOADING PLAYER…';
playButton.textContent = '…';
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(playButton.textContent, '⏸', 'pending playback must display Pause, not an ellipsis-only control');
assert.equal(window.ampulaPlaybackNavigation178.isPendingPlaybackIntent(), true);
playButton.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(suspendCalls, 1, 'Pause during startup cancels the pending provider request');
assert.equal(playButton.textContent, '▶');
assert.equal(status.textContent, 'PAUSED');
assert.equal(window.ampulaPlaybackNavigation178.isPendingPlaybackIntent(), false);

// Let MutationObserver microtasks drain before process exit; closing jsdom here races a queued render.
await new Promise((resolve) => setTimeout(resolve, 0));
console.log('latest playback intent v1.7.9: ok');
