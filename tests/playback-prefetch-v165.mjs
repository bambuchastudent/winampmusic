import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../playback-prefetch-v165.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const spotify = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');

assert.match(header, /apple-music-import-v064\.js\?v=175/);
assert.match(header, /resolver-music-recall-v174\.js\?v=175/);
assert.match(header, /playback-prefetch-v165\.js\?v=175/);
assert.match(header, /playback-queue-v170\.js\?v=1711/);
assert.match(header, /playback-bridge-guard-v1711\.js\?v=1711/);
assert.match(spotify, /strategy: 'background-all\+on-demand'/);
assert.doesNotMatch(spotify, /resolve on playback · 2 ahead/);
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
  { id: 'U-one', title: 'One', artist: 'Artist 1', spotifyTrackId: 's1', duration: 201, badges: ['Spotify', 'Origin'] },
  { id: 'U-two', title: 'Two', artist: 'Artist 2', appleTrackId: 'a2', duration: 202, badges: ['Apple Music', 'Origin'] },
  { id: 'U-three', title: 'Three', artist: 'Artist 3', spotifyTrackId: 's3', duration: 203, badges: ['Spotify', 'Origin'] },
  { id: 'eeeeeeeeeee', title: 'Four', artist: 'Artist 4', spotifyTrackId: 's4', duration: 204, badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: RESOLVER },
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
    else rows.push(item);
  }
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  return { added: incoming.length, total: rows.length };
};

const ids = new Map([
  ['One', 'bbbbbbbbbbb'],
  ['Two', 'ccccccccccc'],
  ['Three', 'ddddddddddd'],
  ['Four', 'fffffffffff'],
  ['Five', 'ggggggggggg'],
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
assert.equal(window.ampulaPlaybackPrefetch165.mode, 'full-library');
assert.equal(window.ampulaPlaybackPrefetch165.workerCount, 4);
assert.equal(window.ampulaPlaybackPrefetch165.resolveTimeoutMs, 120000);
assert.equal(window.ampulaPlaybackPrefetch165.needsPrefetchResolution(library[4]), true, 'legacy cached ids must be revalidated until final trust is cached');

const immediate = window.playIndex(0);
assert.equal(immediate, 'played:0', 'background resolution must not block the current playback call');
assert.deepEqual(played, [0]);
await new Promise((resolve) => setTimeout(resolve, 60));

assert.deepEqual(
  new Set(matcherCalls.map((call) => call.title)),
  new Set(['One', 'Two', 'Three', 'Four']),
  'all unresolved origin tracks must be scheduled, not only two ahead',
);
let saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(saved[1].id, 'bbbbbbbbbbb');
assert.equal(saved[2].id, 'ccccccccccc');
assert.equal(saved[3].id, 'ddddddddddd');
assert.equal(saved[4].id, 'fffffffffff');
for (const row of saved.slice(1)) assert.equal(row.youtubeMatchFinalTrustVersion, FINAL);
assert.equal(saved[1].title, 'One', 'canonical origin title must not be replaced by YouTube metadata');
assert.equal(saved[1].artist, 'Artist 1', 'canonical origin artist must not be replaced by YouTube metadata');

window.importTracks([{ id: 'U-five', title: 'Five', artist: 'Artist 5', spotifyTrackId: 's5', duration: 205, badges: ['Spotify', 'Origin'] }]);
await new Promise((resolve) => setTimeout(resolve, 60));
assert.ok(matcherCalls.some((call) => call.title === 'Five'), 'newly imported unresolved rows must trigger another full-library pass');
saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
assert.equal(saved.find((row) => row.spotifyTrackId === 's5')?.id, 'ggggggggggg');

console.log('full-library background playback resolver v1.7.11: ok');
dom.window.close();
