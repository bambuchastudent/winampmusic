import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const trustSource = readFileSync(new URL('../resolver-trust-v167.js', import.meta.url), 'utf8');
const diagnosticsSource = readFileSync(new URL('../track-diagnostics-v164.js', import.meta.url), 'utf8');
const prefetchSource = readFileSync(new URL('../playback-prefetch-v165.js', import.meta.url), 'utf8');
const spotifySource = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const TRUST = 'music-only-v1.6.7';
const dom = new JSDOM('<!doctype html><body></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;
window.eval(trustSource);
const gate = window.ampulaResolverTrust167;
assert.ok(gate, 'shared final trust gate must install');
assert.equal(gate.version, TRUST);

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

const correct = gate.validate({
  id: 's1b8Q5avQZs',
  title: 'Madigan - The News',
  artist: 'Madigan - Topic',
  duration: 279,
  musicTracks: [{ song: 'The News', artist: 'Madigan' }],
}, madigan);
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

for (const [name, source] of [
  ['diagnostics', diagnosticsSource],
  ['prefetch', prefetchSource],
  ['spotify compatibility resolver', spotifySource],
]) {
  assert.match(source, /music-only-v1\.6\.7/, `${name} must use the v1.6.7 trust marker`);
  assert.match(source, /ampulaResolverTrust167/, `${name} must consult the independent final trust gate`);
}

assert.match(headerSource, /resolver-trust-v167\.js\?v=167/);
assert.ok(
  headerSource.indexOf('resolver-trust-v167.js?v=167') < headerSource.indexOf('track-diagnostics-v164.js?v=167'),
  'trust gate must be loaded before diagnostics bridge',
);
assert.match(headerSource, /playback-prefetch-v165\.js\?v=167/);
assert.match(indexSource, /header-visualizer-v159\.js\?v=167/);
assert.match(swSource, /resolver-trust-v167\.js/);
assert.match(swSource, /winampmusic-shell-v168-resolver-trust/);

console.log('resolver final trust gate v1.6.7: ok');
dom.window.close();
