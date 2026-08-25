import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('compact-share.js', 'utf8');
assert.ok(!code.includes('pastepile'));
assert.ok(!code.includes('parseCompactIds'));
assert.match(code, /const AMPULA_PARAM = 'a'/);
assert.match(code, /application\/vnd\.ampula\+json/);

const originalLibrary = [
  { id: 'abcdefghijk', title: 'Teardrop', artist: 'Massive Attack', duration: '5:31' },
  { id: 'lmnopqrstuv', title: 'Roads', artist: 'Portishead', sourceUrl: 'https://music.apple.com/tr/album/example/123?i=456' },
];

const dom = new JSDOM('<!doctype html><body><div id="status">READY</div></body>', {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
const dialogProto = window.HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
  dialogProto.close = function close() { this.removeAttribute('open'); };
}
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(originalLibrary));
window.localStorage.setItem('winampmusic.fast.current.v1', '1');
window.eval(code);

const api = window.winampMusicCompactShare;
assert.ok(api);
const ampula = api.toAmpula(originalLibrary);
assert.equal(ampula.format, 'ampula');
assert.equal(ampula.version, '1');
assert.equal(ampula.startTrack, 1);
assert.equal(ampula.tracks.length, 2);
assert.equal(ampula.tracks[0].title, 'Teardrop');
assert.equal(ampula.tracks[0].artists[0], 'Massive Attack');
assert.ok(ampula.tracks[0].observations.some((obs) => obs.service === 'youtube' && obs.itemId === 'abcdefghijk'));
assert.ok(ampula.tracks[1].observations.some((obs) => obs.service === 'apple-music'));

const encoded = await api.encode(ampula);
assert.match(encoded, /^[gj]\./);
const decoded = await api.decode(encoded);
// Values created inside JSDOM have a different realm/prototype. Normalize through JSON before strict comparison.
const normalizedTrackNames = JSON.parse(JSON.stringify(decoded.tracks.map((track) => [track.title, track.artists[0]])));
assert.deepEqual(normalizedTrackNames, [
  ['Teardrop', 'Massive Attack'],
  ['Roads', 'Portishead'],
]);

const before = window.localStorage.getItem('winampmusic.library.v1');
window.history.replaceState({}, '', `/?a=${encodeURIComponent(encoded)}`);
await api.load();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), before, 'opening a received Ámpula must not mutate Your library');
assert.ok(window.document.getElementById('ampulaReceivedDialog'), 'received Ámpula must have a distinct context');

api.save(decoded);
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), before, 'saving Ámpula must stay separate from Your library');
const saved = JSON.parse(window.localStorage.getItem('winampmusic.ampulas.v1'));
assert.equal(saved.length, 1);
assert.equal(saved[0].ampula.tracks.length, 2);

console.log('Ámpula v1 round-trip and non-destructive receive contract passed');
process.exit(0);
