import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('compact-share.js', 'utf8');
const fileOpenCode = fs.readFileSync('ampula-file-open-v1.js', 'utf8');
assert.ok(!code.includes('pastepile'));
assert.ok(!code.includes('parseCompactIds'));
assert.match(code, /const AMPULA_PARAM = 'a'/);
assert.match(code, /application\/vnd\.ampula\+json/);
assert.match(fileOpenCode, /openObject/);
assert.match(fileOpenCode, /openFile/);

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
window.eval(fileOpenCode);

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
const normalizedTrackNames = JSON.parse(JSON.stringify(decoded.tracks.map((track) => [track.title, track.artists[0]])));
assert.deepEqual(normalizedTrackNames, [
  ['Teardrop', 'Massive Attack'],
  ['Roads', 'Portishead'],
]);

const before = window.localStorage.getItem('winampmusic.library.v1');
window.history.replaceState({}, '', `/?a=${encodeURIComponent(encoded)}`);
await api.load();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), before, 'opening a received Ámpula must not mutate Your library');
const receivedDialog = window.document.getElementById('ampulaReceivedDialog');
assert.ok(receivedDialog, 'received Ámpula must have a distinct context');
assert.match(receivedDialog.textContent, /Teardrop/);
assert.match(receivedDialog.textContent, /Roads/);

api.save(decoded);
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), before, 'saving Ámpula must stay separate from Your library');
const saved = JSON.parse(window.localStorage.getItem('winampmusic.ampulas.v1'));
assert.equal(saved.length, 1);
assert.equal(saved[0].ampula.tracks.length, 2);

// Saved Ámpula reopens from local saved storage without the original URL.
window.history.replaceState({}, '', '/');
receivedDialog.close();
api.showSaved();
const savedDialog = window.document.getElementById('ampulaSavedDialog');
assert.ok(savedDialog);
const savedButton = savedDialog.querySelector('button:not(#ampulaSavedClose)');
assert.ok(savedButton);
savedButton.click();
assert.match(receivedDialog.textContent, /Teardrop/);
assert.equal(window.location.search, '', 'reopening a saved Ámpula must not require its original share URL');

// An empty receiver stays empty, and an unresolved track still renders its preserved metadata.
window.localStorage.removeItem('winampmusic.library.v1');
const unresolved = {
  format: 'ampula',
  version: '1',
  tracks: [{ title: 'Future Track', artists: ['Unknown Artist'] }],
};
await window.ampulaFileOpen.openObject(unresolved);
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), null, 'opening .ampula must keep an empty library empty');
assert.match(receivedDialog.textContent, /Future Track/);
assert.match(receivedDialog.textContent, /Unknown Artist/);
assert.ok(!receivedDialog.textContent.includes('YouTube undefined'), 'unresolved metadata must not degrade to a provider placeholder');

// Invalid transport fails non-destructively.
window.history.replaceState({}, '', '/?a=not-an-ampula');
await api.load();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), null);
assert.equal(window.document.getElementById('status').textContent, 'INVALID OR UNSUPPORTED ÁMPULA');

console.log('Ámpula v1 round-trip, save/reopen, file-open and non-destructive receive contracts passed');
process.exit(0);
