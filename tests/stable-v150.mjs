import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const index = fs.readFileSync('index.html', 'utf8');
const playerSource = fs.readFileSync('fast-player-v141.js', 'utf8');
const stableSource = fs.readFileSync('stable-v150.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(index, /stable-v150\.js\?v=150/);
assert.match(sw, /ampmusic-v1\.5-stable/);
assert.match(sw, /fast-player-v141\.js/);
assert.match(sw, /stable-v150\.js/);

const stripped = index
  .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
  .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
  .replace('<script src="./stable-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-actions-v143.js?v=150" defer></script>', '');

const dom = new JSDOM(stripped, {
  runScripts: 'outside-only',
  url: 'https://bambuchastudent.github.io/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;

const idle = [];
window.requestIdleCallback = (callback) => { idle.push(callback); return idle.length; };
window.cancelIdleCallback = () => {};

window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: class {
    constructor(_id, options) { this.options = options; queueMicrotask(() => options.events.onReady?.()); }
    setVolume() {}
    loadVideoById() {}
    getPlayerState() { return 2; }
    playVideo() {}
    pauseVideo() {}
    getDuration() { return 200; }
    getCurrentTime() { return 0; }
    seekTo() {}
  },
};

const registrations = [];
Object.defineProperty(window.navigator, 'serviceWorker', {
  configurable: true,
  value: {
    register: async (url, options) => {
      registrations.push({ url, options });
      return { scope: 'https://bambuchastudent.github.io/winampmusic/' };
    },
    getRegistrations: async () => [],
  },
});

window.eval(playerSource);
window.eval(stableSource);

const ack = [];
const source = { postMessage: (message, origin) => ack.push({ message, origin }) };
const playlist = [
  { id: 'abcdefghijk', title: 'Track One', artist: 'Artist A', playlist: 'Road Trip' },
  { id: 'lmnopqrstuv', title: 'Track Two', artist: 'Artist B', playlist: 'Road Trip' },
  { id: 'wxyzABCDE12', title: 'Track Three', artist: 'Artist C', playlist: 'Road Trip' },
];

window.dispatchEvent(new window.MessageEvent('message', {
  origin: 'https://www.youtube.com',
  source,
  data: { type: 'WINAMP_MUSIC_IMPORT', version: 1, tracks: playlist },
}));

const saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
assert.equal(saved.length, 3, 'whole multi-track playlist must be persisted by the FAST import API');
assert.deepEqual(saved.map((track) => track.id), playlist.map((track) => track.id));
assert.equal(window.document.getElementById('trackCount').textContent, '3', 'imported playlist must render');
assert.equal(ack.length, 1, 'playlist importer must receive exactly one ACK');
assert.equal(ack[0].origin, 'https://www.youtube.com');
assert.deepEqual(ack[0].message, {
  type: 'WINAMP_MUSIC_IMPORT_ACK', version: 1, added: 3, total: 3,
});

window.dispatchEvent(new window.MessageEvent('message', {
  origin: 'https://evil.example',
  source,
  data: { type: 'WINAMP_MUSIC_IMPORT', version: 1, tracks: [{ id: 'BADBADBAD12' }] },
}));
assert.equal(JSON.parse(window.localStorage.getItem('winampmusic.library.v1')).length, 3, 'untrusted origins must be ignored');

window.dispatchEvent(new window.Event('load'));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(registrations.some(({ url, options }) => url === './sw.js?v=150' && options?.updateViaCache === 'none'), 'PWA worker must register after startup');

console.log('AmpMusic 1.5 stable PWA + multi-track playlist import contract passed');
dom.window.close();
process.exit(0);
