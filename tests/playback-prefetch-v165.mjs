import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../playback-prefetch-v165.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const spotify = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');

assert.match(header, /apple-music-import-v064\.js\?v=173/);
assert.match(header, /playback-miss-v173\.js\?v=173/);
assert.match(header, /resolver-trust-v167\.js\?v=173/);
assert.match(header, /track-diagnostics-v164\.js\?v=173/);
assert.match(header, /diagnostics-download-v171\.js\?v=173/);
assert.match(header, /playback-prefetch-v165\.js\?v=173/);
assert.ok(header.indexOf("script.addEventListener('load', loadTrackDiagnostics") >= 0, 'diagnostics must load after resolver trust gate');
assert.ok(header.indexOf("script.addEventListener('load', loadDiagnosticsDownload") >= 0, 'diagnostics download must load after diagnostics');
assert.ok(header.indexOf("script.addEventListener('load', loadPlaybackPrefetch") >= 0, 'prefetch must load after diagnostics actions');
assert.match(spotify, /strategy: 'on-demand\+2-ahead'/);
assert.doesNotMatch(spotify, /const resolution = resolveInBackground\(metadata\.tracks/);
assert.match(source, /youtubeMatchFinalTrustVersion/);

const dom = new JSDOM('<!doctype html><body></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;
const KEY = 'winampmusic.library.v1';
const RESOLVER = 'music-only-v1.6.4';
const FINAL = 'music-only-v1.6.7';
const library = [
  { id: 'aaaaaaaaaaa', title: 'Current', artist: 'Artist 0', spotifyTrackId: 's0', youtubeMatchResolverVersion: RESOLVER, youtubeMatchFinalTrustVersion: FINAL },
  { id: 'U-next-one', title: 'Next One', artist: 'Artist 1', spotifyTrackId: 's1', duration: 201, badges: ['Spotify', 'Origin'] },
  { id: 'U-next-two', title: 'Next Two', artist: 'Artist 2', appleTrackId: 'a2', duration: 202, badges: ['Apple Music', 'Origin'] },
  { id: 'U-next-three', title: 'Next Three', artist: 'Artist 3', spotifyTrackId: 's3', duration: 203, badges: ['Spotify', 'Origin'] },
  { id: 'eeeeeeeeeee', title: 'Stale Valid', artist: 'Artist 4', spotifyTrackId: 's4', duration: 204, badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: RESOLVER },
];
window.localStorage.setItem(KEY, JSON.stringify(library));

const played = [];
window.playIndex = (index) => {
  played.push(index);
  return `played:${index}`;
};
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
window.importTracks = (incoming) => {
  const rows = JSON.parse(window.localStorage.getItem(KEY) || '[]');
  for (const item of incoming) {
    let index = rows.findIndex((row) => item.spotifyTrackId && row.spotifyTrackId === item.spotifyTrackId);
    if (index < 0) index = rows.findIndex((row) => item.appleTrackId && row.appleTrackId === item.appleTrackId);
    if (index < 0) index = rows.findIndex((row) => row.title === item.title && row.artist === item.artist);
    if (index >= 0) rows[index] = { ...rows[index], ...item };
  }
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  return { added: 0, total: rows.length };
};

const ids = new Map([
  ['Next One', 'bbbbbbbbbbb'],
  ['Next Two', 'ccccccccccc'],
  ['Next Three', 'ddddddddddd'],
  ['Stale Valid', 'fffffffffff'],
]);
const matcherCalls = [];
window.winampMusicAppleImport = {
  findYouTubeMatch: async ({ title, artist, durationMs }) => {
    matcherCalls.push({ title, artist, durationMs });
    await new Promise((resolve) => setTimeout(resolve, 1));
    return {
      id: ids.get(title),
      title: `YouTube ${title}`,
      artist: `Uploader ${artist}`,
      duration: durationMs / 1000,
      finalTrustVersion: FINAL,
    };
  },
};

window.eval(source);
assert.equal(window.ampulaPlaybackPrefetch165.count, 2);
assert.equal(window.ampulaPlaybackPrefetch165.needsPrefetchResolution(library[4]), true, 'valid-looking legacy ids must be revalidated until final trust is cached');

const immediate = window.playIndex(0);
assert.equal(immediate, 'played:0', 'prefetch must not block the current playback call');
assert.deepEqual(played, [0]);
await new Promise((resolve) => setTimeout(resolve, 30));

assert.deepEqual(matcherCalls.map((call) => call.title), ['Next One', 'Next Two'], 'only the next two tracks should be warmed');
let saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(saved[1].id, 'bbbbbbbbbbb');
assert.equal(saved[2].id, 'ccccccccccc');
assert.equal(saved[3].id, 'U-next-three', 'third track must remain unresolved until it enters the two-track window');
assert.equal(saved[1].youtubeMatchResolverVersion, RESOLVER);
assert.equal(saved[2].youtubeMatchResolverVersion, RESOLVER);
assert.equal(saved[1].youtubeMatchFinalTrustVersion, FINAL);
assert.equal(saved[2].youtubeMatchFinalTrustVersion, FINAL);
assert.equal(saved[1].title, 'Next One', 'canonical origin title must not be replaced by YouTube metadata');
assert.equal(saved[1].artist, 'Artist 1', 'canonical origin artist must not be replaced by YouTube metadata');

window.playIndex(1);
await new Promise((resolve) => setTimeout(resolve, 30));
assert.deepEqual(matcherCalls.map((call) => call.title), ['Next One', 'Next Two', 'Next Three']);
saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(saved[3].id, 'ddddddddddd', 'moving playback forward should warm the newly-entered second-ahead track');
assert.equal(saved[3].youtubeMatchFinalTrustVersion, FINAL);

window.playIndex(2);
await new Promise((resolve) => setTimeout(resolve, 30));
assert.deepEqual(matcherCalls.map((call) => call.title), ['Next One', 'Next Two', 'Next Three', 'Stale Valid'], 'legacy cached ids must be revalidated when they enter the prefetch window');
saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(saved[4].id, 'fffffffffff');
assert.equal(saved[4].youtubeMatchFinalTrustVersion, FINAL);

console.log('on-demand playback resolver + two-track prefetch final-trust contract: ok');
dom.window.close();