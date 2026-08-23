import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const exactUrl = 'https://music.apple.com/tr/album/last-october/1445697454';
const dom = new JSDOM(`<!doctype html><body>
  <div id="status"></div><button id="playButton">▶</button>
  <form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton">Add & Play</button></form>
  <div id="fastImportHint"></div>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;
window.console = console;

const matchIds = {
  'Unexpected Song': 'aaaaaaaaaaa',
  'An Angel\'s Touch': 'bbbbbbbbbbb',
};
window.winampMusicAppleImport = {
  __ampStrict150: true,
  async findYouTubeMatch(meta) {
    return { id: matchIds[meta.title], title: meta.title, artist: meta.artist, duration: Math.round(meta.durationMs / 1000), source: 'piped' };
  },
};

let imported = [];
window.importTracks = (tracks) => {
  imported = tracks;
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(tracks));
  return { added: tracks.length, total: tracks.length };
};
let directPlayed = -1;
window.ampMusicPlayDirectIndex = (index) => { directPlayed = index; return true; };

const originalAppend = window.document.head.appendChild.bind(window.document.head);
window.document.head.appendChild = (node) => {
  const result = originalAppend(node);
  if (node.tagName === 'SCRIPT' && /itunes\.apple\.com\/lookup/.test(node.src)) {
    const src = new URL(node.src);
    const callback = src.searchParams.get('callback');
    assert.equal(src.searchParams.get('id'), '1445697454');
    assert.equal(src.searchParams.get('entity'), 'song');
    assert.equal(src.searchParams.get('country'), 'TR');
    queueMicrotask(() => window[callback]({
      results: [
        { wrapperType: 'collection', collectionId: 1445697454, collectionName: 'Last October', artistName: 'Last October' },
        { wrapperType: 'track', kind: 'song', collectionId: 1445697454, trackId: 1445697455, trackNumber: 1, trackName: 'Unexpected Song', artistName: 'Last October', collectionName: 'Last October', trackTimeMillis: 180000, trackViewUrl: 'https://music.apple.com/tr/song/1445697455' },
        { wrapperType: 'track', kind: 'song', collectionId: 1445697454, trackId: 1445697456, trackNumber: 2, trackName: "An Angel's Touch", artistName: 'Last October', collectionName: 'Last October', trackTimeMillis: 210000, trackViewUrl: 'https://music.apple.com/tr/song/1445697456' },
      ],
    }));
  }
  return result;
};

window.eval(fs.readFileSync('apple-album-import-v150.js', 'utf8'));
const albumApi = window.ampMusicAppleAlbum150;
assert.ok(albumApi);
const parsed = albumApi.parseAlbumUrl(exactUrl);
assert.equal(parsed?.albumId, '1445697454');
assert.equal(parsed?.storefront, 'TR');
assert.equal(albumApi.parseAlbumUrl(`${exactUrl}?i=1445697455`), null, 'album URL with ?i= is a track link, not whole album');

const input = window.document.getElementById('fastImportInput');
input.value = exactUrl;
const statuses = [];
const importedResult = await albumApi.importAlbumUrl(exactUrl, {
  input,
  play: true,
  onStatus: (state) => statuses.push(state.message),
});
assert.equal(importedResult.handled, true);
assert.equal(importedResult.album.name, 'Last October');
assert.deepEqual(Array.from(imported, (track) => track.title), ['Unexpected Song', "An Angel's Touch"]);
assert.deepEqual(Array.from(imported, (track) => track.artist), ['Last October', 'Last October']);
assert.ok(Array.from(imported).every((track) => track.sourceUrl === exactUrl));
assert.ok(Array.from(imported).every((track) => Array.from(track.badges).includes('Album') && Array.from(track.badges).includes('Strict match')));
assert.equal(directPlayed, 0, 'album starts through direct playback, not legacy YouTube iframe');
assert.equal(input.value, '');
assert.ok(statuses.some((text) => /2 tracks · 2 matched · 2 new/.test(text)));

window.eval(fs.readFileSync('apple-album-route-v150.js', 'utf8'));
assert.equal(window.ampMusicAppleAlbumRoute150.parseAlbum(exactUrl)?.albumId, '1445697454');
assert.equal(window.ampMusicAppleAlbumRoute150.parseAlbum(`${exactUrl}?i=1445697455`), null);

let legacyCalls = 0;
window.playIndex = () => { legacyCalls += 1; return true; };
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'aaaaaaaaaaa', title: 'Unexpected Song', artist: 'Last October', sourceUrl: exactUrl, badges: ['Apple Music', 'Album'] }]));
window.eval(fs.readFileSync('apple-no-ad-fallback-v150.js', 'utf8'));
const blocked = window.playIndex(0);
assert.equal(blocked, false);
assert.equal(legacyCalls, 0, 'Apple direct failure must not fall through to YouTube iframe advertising');
assert.match(window.document.getElementById('status').textContent, /NO AD FALLBACK/);

const index = fs.readFileSync('index.html', 'utf8');
assert.match(index, /apple-no-ad-fallback-v150\.js\?v=150/);
assert.match(index, /apple-album-route-v150\.js\?v=150/);

console.log('Apple album source routing + no-ad fallback: OK');
