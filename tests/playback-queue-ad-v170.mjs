import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const queueSource = readFileSync(new URL('../playback-queue-v170.js', import.meta.url), 'utf8');
const adSource = readFileSync(new URL('../ad-indicator-v170.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(header, /playback-bridge-guard-v1711\.js\?v=1711/);
assert.match(header, /ad-indicator-v170\.js\?v=1711/);
assert.match(header, /playback-queue-v170\.js\?v=1711/);
assert.match(header, /resolver-music-recall-v174\.js\?v=175/);
assert.match(sw, /ampmusic-v1\.7\.11/);
assert.match(sw, /playback-navigation-v178\.js/);
assert.match(sw, /playback-bridge-guard-v1711\.js/);
assert.match(sw, /resolver-music-recall-v174\.js/);
assert.match(sw, /playback-queue-v170\.js/);

const queueDom = new JSDOM(`<!doctype html><body>
  <div id="status">PLAYING</div>
  <button id="playButton">▶</button>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = queueDom;
const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';
const RESOLVER = 'music-only-v1.6.4';
const FINAL = 'music-only-v1.6.7';
const library = [
  { id: 'aaaaaaaaaaa', title: 'Current', artist: 'Artist 0', spotifyTrackId: 's0', duration: 200, badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: RESOLVER, youtubeMatchFinalTrustVersion: FINAL },
  { id: 'U-blocked', title: 'God Shaped Hole', artist: 'Youri Lentjes', spotifyTrackId: 's1', duration: 180, badges: ['Spotify', 'Origin'] },
  { id: 'bbbbbbbbbbb', title: 'Playable Two', artist: 'Artist 2', spotifyTrackId: 's2', duration: 202, badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: RESOLVER, youtubeMatchFinalTrustVersion: FINAL },
  { id: 'ccccccccccc', title: 'Playable Three', artist: 'Artist 3', spotifyTrackId: 's3', duration: 203, badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: RESOLVER, youtubeMatchFinalTrustVersion: FINAL },
];
window.localStorage.setItem(KEY, JSON.stringify(library));
window.localStorage.setItem(CURRENT, '0');

const innerCalls = [];
window.playIndex = async (index) => {
  innerCalls.push(index);
  window.localStorage.setItem(CURRENT, String(index));
  return `played:${index}`;
};
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
window.importTracks = () => ({ added: 0, total: library.length });
const resolverCalls = [];
window.ampulaPlaybackPrefetch165 = {
  resolveAhead: async (_index, track) => {
    resolverCalls.push(track.title);
    return null;
  },
  resolveAll: async () => [],
};
window.ampulaTrackDiagnostics164 = { resolveTrusted: async () => null };

window.eval(queueSource);
assert.equal(window.ampulaPlaybackQueue170.mode, 'full-library');
assert.equal(Number.isFinite(window.ampulaPlaybackQueue170.scanLimit), false, 'queue recovery must not stop after a fixed row count');
assert.equal(window.ampulaPlaybackQueue170.finalTrustVersion, FINAL);

const automaticResult = await window.playIndex(1);
assert.equal(automaticResult, 'played:2', 'an unresolved requested row must continue to the next playable track');
assert.deepEqual(innerCalls, [2]);
assert.ok(resolverCalls.includes('God Shaped Hole'), 'the unresolved row should still be offered to background resolution');

window.document.getElementById('status').textContent = 'PAUSED';
window.document.getElementById('playButton').textContent = '▶';
window.localStorage.setItem(CURRENT, '0');
const manualResult = await window.playIndex(1);
assert.equal(manualResult, 'played:2', 'direct queue continuation without a track-click intent still skips an unresolved row');
assert.deepEqual(innerCalls, [2, 2]);
queueDom.window.close();

const farDom = new JSDOM('<!doctype html><body><div id="status">PAUSED</div><button id="playButton">▶</button></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const fw = farDom.window;
const farRows = [
  { id: 'zzzzzzzzzzz', title: 'Current', artist: 'Artist', spotifyTrackId: 's0', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `U-miss-${index + 1}`,
    title: `Miss ${index + 1}`,
    artist: 'Artist',
    spotifyTrackId: `s${index + 1}`,
    badges: ['Spotify', 'Origin'],
  })),
  { id: 'yyyyyyyyyyy', title: 'Far Ready', artist: 'Artist', spotifyTrackId: 's13', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
];
fw.localStorage.setItem(KEY, JSON.stringify(farRows));
fw.localStorage.setItem(CURRENT, '0');
const farCalls = [];
fw.playIndex = async (index) => { farCalls.push(index); return `played:${index}`; };
fw.renderLibrary = () => {};
fw.ampMusicOriginPlayback151 = { refresh() {} };
fw.ampulaPlaybackPrefetch165 = { resolveAhead: async () => null, resolveAll: async () => [] };
fw.ampulaTrackDiagnostics164 = { resolveTrusted: async () => null };
fw.eval(queueSource);
const farResult = await fw.playIndex(1);
assert.equal(farResult, 'played:13', 'recovery must scan beyond twelve unresolved rows');
assert.deepEqual(farCalls, [13]);
farDom.window.close();

const adDom = new JSDOM(`<!doctype html><head></head><body>
  <section class="screen">
    <div id="status" class="status">PLAYING</div>
    <div id="elapsed">0:05</div>
    <div id="duration">0:30</div>
  </section>
  <button id="playButton">⏸</button>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const adWindow = adDom.window;
adWindow.localStorage.setItem(KEY, JSON.stringify([
  { id: 'abcdefghijk', youtubeMatchId: 'abcdefghijk', title: 'Song', artist: 'Artist', duration: 180, spotifyTrackId: 'spotify-1', badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: RESOLVER, youtubeMatchFinalTrustVersion: FINAL },
]));
adWindow.localStorage.setItem(CURRENT, '0');
adWindow.eval(adSource);
assert.equal(adWindow.ampulaAdIndicator170.sync(), true);
const indicator = adWindow.document.getElementById('ampulaAdIndicator');
assert.ok(indicator);
assert.equal(indicator.hidden, false);
assert.equal(indicator.textContent, 'AD 0:25');
assert.equal(adWindow.document.getElementById('status').textContent, 'AD');
assert.ok(indicator.parentElement.classList.contains('screen-status-row'));

adWindow.document.getElementById('duration').textContent = '3:00';
adWindow.document.getElementById('elapsed').textContent = '0:10';
assert.equal(adWindow.ampulaAdIndicator170.sync(), false);
assert.equal(indicator.hidden, true);
adWindow.ampulaAdIndicator170.stop();
adDom.window.close();

console.log('full-library queue continuation + compact ad timer v1.7.11: ok');
