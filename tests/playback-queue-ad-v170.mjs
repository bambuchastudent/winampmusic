import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const queueSource = readFileSync(new URL('../playback-queue-v170.js', import.meta.url), 'utf8');
const adSource = readFileSync(new URL('../ad-indicator-v170.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(header, /ad-indicator-v170\.js\?v=173/);
assert.match(header, /playback-queue-v170\.js\?v=173/);
assert.match(header, /playback-miss-v173\.js\?v=173/);
assert.ok(header.indexOf("script.addEventListener('load', loadPlaybackQueue") >= 0, 'rolling queue must load after prefetch');
assert.match(sw, /ampmusic-v1\.7\.3/);
assert.match(sw, /playback-queue-v170\.js/);
assert.match(sw, /playback-miss-v173\.js/);
assert.match(sw, /ad-indicator-v170\.js/);
assert.match(sw, /diagnostics-download-v171\.js/);

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
  { id: 'U-two', title: 'Playable Two', artist: 'Artist 2', spotifyTrackId: 's2', duration: 202, badges: ['Spotify', 'Origin'] },
  { id: 'U-three', title: 'Playable Three', artist: 'Artist 3', spotifyTrackId: 's3', duration: 203, badges: ['Spotify', 'Origin'] },
  { id: 'U-four', title: 'Playable Four', artist: 'Artist 4', spotifyTrackId: 's4', duration: 204, badges: ['Spotify', 'Origin'] },
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
window.importTracks = (incoming) => {
  const rows = JSON.parse(window.localStorage.getItem(KEY) || '[]');
  for (const item of incoming) {
    const index = rows.findIndex((row) => row.spotifyTrackId && row.spotifyTrackId === item.spotifyTrackId);
    if (index >= 0) rows[index].id = item.id;
  }
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  return { added: 0, total: rows.length };
};

const ids = new Map([
  ['Playable Two', 'bbbbbbbbbbb'],
  ['Playable Three', 'ccccccccccc'],
  ['Playable Four', 'ddddddddddd'],
]);
const resolverCalls = [];
window.ampulaPlaybackPrefetch165 = {
  resolveAhead: async (_index, track) => {
    resolverCalls.push(`prefetch:${track.title}`);
    const id = ids.get(track.title);
    if (!id) return null;
    return { ...track, id, youtubeMatchId: id, youtubeMatchResolverVersion: RESOLVER, youtubeMatchFinalTrustVersion: FINAL, playbackProvider: 'youtube', badges: [...track.badges, 'YouTube match'] };
  },
};
window.ampulaTrackDiagnostics164 = {
  trustVersion: RESOLVER,
  resolveTrusted: async (_index, track) => {
    resolverCalls.push(`trusted:${track.title}`);
    const id = ids.get(track.title);
    return id ? { ...track, id, youtubeMatchId: id, youtubeMatchResolverVersion: RESOLVER, playbackProvider: 'youtube' } : null;
  },
};

window.eval(queueSource);
assert.equal(window.ampulaPlaybackQueue170.playableAhead, 2);
assert.equal(window.ampulaPlaybackQueue170.scanLimit, 12);
assert.equal(window.ampulaPlaybackQueue170.finalTrustVersion, FINAL);

const automaticResult = await window.playIndex(1);
assert.equal(automaticResult, 'played:2', 'ended playback must skip an unresolved row and continue to the next playable track');
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(innerCalls, [2]);
let saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(saved[1].id, 'U-blocked', 'failed origin row must remain unresolved instead of accepting a weak match');
assert.equal(saved[2].id, 'bbbbbbbbbbb');
assert.equal(saved[3].id, 'ccccccccccc');
assert.equal(saved[4].id, 'ddddddddddd');
assert.equal(saved[2].youtubeMatchFinalTrustVersion, FINAL, 'resolved playback must stay final-trusted in persistent cache');
assert.equal(saved[3].youtubeMatchFinalTrustVersion, FINAL);
assert.equal(saved[4].youtubeMatchFinalTrustVersion, FINAL);

const callsBeforeCachedPlay = resolverCalls.filter((call) => call.includes('Playable Three')).length;
window.document.getElementById('status').textContent = 'PAUSED';
window.document.getElementById('playButton').textContent = '▶';
await window.playIndex(3);
const callsAfterCachedPlay = resolverCalls.filter((call) => call.includes('Playable Three')).length;
assert.equal(callsAfterCachedPlay, callsBeforeCachedPlay, 'final-trusted cached rows must not be resolved again');

window.localStorage.setItem(CURRENT, '0');
const callsBeforeManualFailure = innerCalls.length;
const manualFailure = await window.playIndex(1);
assert.equal(manualFailure, false, 'manual selection of an unresolved row must fail closed');
assert.equal(innerCalls.length, callsBeforeManualFailure, 'manual failure must not silently jump to another song');
queueDom.window.close();

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
assert.ok(indicator.parentElement.classList.contains('screen-status-row'), 'ad timer must sit on the same top row as PLAYING');
assert.equal(indicator.previousElementSibling.id, 'status', 'ad timer must be on the right side of PLAYING');

adWindow.document.getElementById('duration').textContent = '3:00';
adWindow.document.getElementById('elapsed').textContent = '0:10';
assert.equal(adWindow.ampulaAdIndicator170.sync(), false, 'indicator must disappear when canonical track playback is active');
assert.equal(indicator.hidden, true);
adWindow.ampulaAdIndicator170.stop();
adDom.window.close();

console.log('rolling resolver queue + compact ad timer v1.7.1: ok');