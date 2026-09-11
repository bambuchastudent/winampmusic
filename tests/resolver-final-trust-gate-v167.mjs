import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const trustSource = readFileSync(new URL('../resolver-trust-v167.js', import.meta.url), 'utf8');
const diagnosticsSource = readFileSync(new URL('../track-diagnostics-v164.js', import.meta.url), 'utf8');
const prefetchSource = readFileSync(new URL('../playback-prefetch-v165.js', import.meta.url), 'utf8');
const spotifySource = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const TRUST = 'music-only-v1.6.7';
const LIBRARY_KEY = 'winampmusic.library.v1';
const dom = new JSDOM('<!doctype html><body></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;

window.localStorage.setItem(LIBRARY_KEY, JSON.stringify([
  {
    id: 'vuJwrcKQ7Sg',
    title: 'The News',
    artist: 'Madigan',
    duration: 279,
    spotifyTrackId: '7e6JhLyQ0HalkvkW0qKr65',
    badges: ['Spotify', 'Origin', 'YouTube match'],
    youtubeMatchResolverVersion: 'music-only-v1.6.4',
  },
  { id: 'abcdefghijk', title: 'Local', artist: 'Local Artist' },
]));

window.ampulaPlaybackMiss173 = {
  metadataWithRejected: (metadata) => ({ ...metadata, excludeYoutubeIds: ['vuJwrcKQ7Sg'] }),
};
window.eval(trustSource);
const gate = window.ampulaResolverTrust167;
assert.ok(gate, 'shared final trust gate must install');
assert.equal(gate.version, TRUST);

const migrated = JSON.parse(window.localStorage.getItem(LIBRARY_KEY) || '[]');
assert.equal(migrated[0].youtubeMatchResolverVersion, undefined, 'legacy trusted Spotify rows must be forced through current-track revalidation');
assert.equal(migrated[0].id, 'vuJwrcKQ7Sg', 'migration keeps previous id only as diagnostic/revalidation input');
assert.equal(migrated[1].id, 'abcdefghijk', 'unrelated local rows must not be changed');

const madigan = { title: 'The News', artist: 'Madigan', duration: 279 };
const productionFalsePositive = {
  id: 'vuJwrcKQ7Sg',
  title: 'News in the Past: Kathleen Madigan',
  artist: 'Laugh Society - Ladies First',
  duration: 262,
};
const rejected = gate.validate(productionFalsePositive, madigan);
assert.equal(rejected.ok, false, 'captured production false positive must be rejected');
assert.match(rejected.reason, /duration delta 17s > 15s|title identity mismatch/);

const correctCandidate = {
  id: 's1b8Q5avQZs',
  title: 'Madigan - The News',
  artist: 'Madigan - Topic',
  duration: 279,
  musicTracks: [{ song: 'The News', artist: 'Madigan' }],
};
const correct = gate.validate(correctCandidate, madigan);
assert.equal(correct.ok, true, 'correct Topic recording must pass final trust gate');

const missingDuration = gate.validate({
  id: 's1b8Q5avQZs',
  title: 'Madigan - The News',
  artist: 'Madigan - Topic',
  duration: 0,
}, madigan);
assert.equal(missingDuration.ok, false);
assert.match(missingDuration.reason, /missing candidate duration/);

const wrongArtist = gate.validate({
  id: 'abcdefghijk',
  title: 'The News',
  artist: 'Random Comedy Channel',
  duration: 279,
}, madigan);
assert.equal(wrongArtist.ok, false);
assert.match(wrongArtist.reason, /artist identity mismatch/);

let guardedMetadata = null;
window.winampMusicAppleImport = {
  findYouTubeMatch: async (metadata) => {
    guardedMetadata = metadata;
    return productionFalsePositive;
  },
};
await assert.rejects(
  () => window.winampMusicAppleImport.findYouTubeMatch({ title: 'The News', artist: 'Madigan', durationMs: 279000 }),
  /Final trust gate rejected: (?:duration delta 17s > 15s|title identity mismatch)/,
);
assert.deepEqual(guardedMetadata.excludeYoutubeIds, ['vuJwrcKQ7Sg'], 'final trust guard must forward locally rejected IDs to the matcher');

window.winampMusicAppleImport = {
  findYouTubeMatch: async () => correctCandidate,
};
const guardedCorrect = await window.winampMusicAppleImport.findYouTubeMatch({ title: 'The News', artist: 'Madigan', durationMs: 279000 });
assert.equal(guardedCorrect.id, 's1b8Q5avQZs');
assert.equal(guardedCorrect.finalTrustVersion, TRUST);

for (const [name, source] of [
  ['diagnostics', diagnosticsSource],
  ['prefetch', prefetchSource],
  ['spotify compatibility resolver', spotifySource],
]) {
  assert.match(source, /findYouTubeMatch/, `${name} must consume the guarded public matcher API`);
}

assert.match(headerSource, /apple-music-import-v064\.js\?v=175/);
assert.match(headerSource, /playback-miss-v173\.js\?v=175/);
assert.match(headerSource, /resolver-trust-v167\.js\?v=175/);
assert.match(headerSource, /resolver-music-recall-v174\.js\?v=175/);
assert.match(headerSource, /track-diagnostics-v164\.js\?v=175/);
assert.match(headerSource, /diagnostics-download-v171\.js\?v=175/);
assert.match(headerSource, /playback-prefetch-v165\.js\?v=175/);
assert.match(headerSource, /playback-queue-v170\.js\?v=176/);
assert.ok(
  headerSource.indexOf('loadMatcherCore();') < headerSource.indexOf("const spectrum"),
  'fresh matcher/MISS/trust/recall loader chain must start before optional header behavior',
);
assert.match(headerSource, /script\.addEventListener\('load', loadResolverMusicRecall/);
assert.match(headerSource, /script\.addEventListener\('load', loadTrackDiagnostics/);
assert.match(swSource, /resolver-trust-v167\.js/);
assert.match(swSource, /resolver-music-recall-v174\.js/);
assert.match(swSource, /winampmusic-shell-v178-deterministic-navigation/);
assert.match(swSource, /ampmusic-v1\.7\.8/);
assert.match(swSource, /playback-navigation-v178\.js/);
assert.match(swSource, /playback-queue-v170\.js/);
assert.match(swSource, /playback-miss-v173\.js/);
assert.match(swSource, /ad-indicator-v170\.js/);
assert.match(swSource, /diagnostics-download-v171\.js/);

console.log('resolver final trust gate v1.6.7 + queue runtime v1.7.8: ok');
dom.window.close();
