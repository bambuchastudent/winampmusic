import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('fast-import-v150.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
assert.match(index, /id="fastImportForm"/);
assert.match(index, /Search or paste a track, album, or playlist/);
assert.match(index, /fast-import-v150\.js\?v=150/);
assert.ok(!code.includes('stopImmediatePropagation'));
assert.ok(!code.includes("addEventListener('pointer"));

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton" type="submit">Add & Play</button></form>
  <span id="fastImportHint"></span>
</body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
const { window } = dom;

const library = [{ id: 'aaaaaaaaaaa', title: 'Existing', artist: 'Test' }];
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
const played = [];
window.importTracks = (items) => {
  const saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  let added = 0;
  for (const item of items) {
    if (!saved.some((track) => track.id === item.id)) { saved.push(item); added += 1; }
  }
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(saved));
  return { added, total: saved.length };
};
window.playIndex = (trackIndex) => played.push(trackIndex);
window.fetch = async () => ({ ok: false });

const playlistIds = ['bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd'];
window.YT = {
  Player: class {
    constructor(_id, options) {
      this.options = options;
      queueMicrotask(() => options.events.onReady?.({ target: this }));
    }
    cuePlaylist() { queueMicrotask(() => this.options.events.onStateChange?.({ data: 5 })); }
    getPlaylist() { return playlistIds; }
    destroy() {}
  },
};
window.winampMusicLoadYouTubeApi = async () => window.YT;

for (const marker of ['apple-track-import', 'apple-playlist-import']) {
  const script = window.document.createElement('script');
  script.dataset.ampModule = marker;
  script.dataset.loaded = '1';
  window.document.head.appendChild(script);
}
let applePlaylistHandled = '';
window.ampMusicApplePlaylist150 = {
  async importPlaylistUrl(url, options) {
    applePlaylistHandled = url;
    options.onStatus?.({ message: '5 tracks · 5 matched · 5 new' });
    options.input.value = '';
    return { handled: true, tracks: new Array(5), added: 5 };
  },
};

window.eval(code);

async function submit(value, waitMs = 5) {
  const input = window.document.getElementById('fastImportInput');
  input.value = value;
  window.document.getElementById('fastImportForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

await submit('https://youtu.be/dQw4w9WgXcQ');
let saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.at(-1).id, 'dQw4w9WgXcQ');
assert.equal(played.at(-1), 1);

const playlistUrl = 'https://www.youtube.com/watch?v=9bZkp7q19f0&list=PL1234567890ABCDE';
const parsedPlaylist = window.ampMusicImport150.parseYouTube(playlistUrl);
assert.equal(parsedPlaylist?.type, 'playlist');
assert.equal(parsedPlaylist?.playlistId, 'PL1234567890ABCDE');
await submit(playlistUrl, 20);
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.deepEqual(saved.slice(2, 5).map((track) => track.id), playlistIds);
assert.equal(played.at(-1), 2, 'playlist import should start its first track');
assert.match(window.document.getElementById('fastImportHint').textContent, /3 tracks/);
assert.equal(window.document.getElementById('fastImportButton').textContent, 'Add & Play');
assert.equal(window.document.querySelector('[id^="amp-playlist-probe-"]'), null, 'temporary playlist player must be removed');

await submit('https://youtube.com/shorts/aqz-KE-bpKQ');
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.at(-1).id, 'aqz-KE-bpKQ');
assert.equal(played.at(-1), 5);

const appleTrack = window.ampMusicImport150.parseApple('https://music.apple.com/tr/album/mantis-lords/1263341718?i=1263341726');
assert.equal(appleTrack?.type, 'track');
const applePlaylist = window.ampMusicImport150.parseApple('https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl');
assert.equal(applePlaylist?.type, 'playlist');
await submit(applePlaylist.url);
assert.equal(applePlaylistHandled, applePlaylist.url);
assert.match(window.document.getElementById('fastImportHint').textContent, /5 tracks · 5 matched/);
assert.doesNotMatch(window.document.getElementById('fastImportHint').textContent, /MusicKit connection/);

await submit('not a music link');
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.length, 6);
assert.match(window.document.getElementById('fastImportHint').textContent, /YouTube or Apple Music track\/playlist link/);

console.log('AmpMusic 1.5 fast track/album/playlist import routing test passed');
process.exit(0);
