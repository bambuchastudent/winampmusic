import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = `<!doctype html><body>
  <div id="status">READY · FAST</div>
  <div id="nowTitle"></div><div id="nowArtist"></div>
  <span id="elapsed">00:00</span><span id="duration">00:00</span>
  <input id="seek" value="0"><input id="volume" value="75">
  <button id="prevButton"></button><button id="playButton">▶</button><button id="nextButton"></button>
  <button id="shuffleButton"></button><button id="radioButton">📻</button>
  <ol id="trackList"><li class="track" data-index="0"><button class="track-main" data-index="0"></button><span class="track-play">▶</span></li></ol>
</body>`;
const dom = new JSDOM(html, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;
window.console = console;

class FakeAudio extends window.EventTarget {
  constructor() {
    super();
    this.src = '';
    this.preload = '';
    this.playsInline = false;
    this.volume = 0.75;
    this.currentTime = 0;
    this.duration = 204;
    this.paused = true;
    this.ended = false;
  }
  async play() {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new window.Event('play'));
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new window.Event('pause'));
  }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() {}
}
window.Audio = FakeAudio;

const correctId = 'bbbbbbbbbbb';
const adId = 'aaaaaaaaaaa';
const radioId = 'ccccccccccc';
const searchPayload = {
  items: [
    { type: 'stream', url: `/watch?v=${adId}`, title: 'Реклама банка — Когда ты грустишь', uploaderName: 'Sponsor Channel', duration: 30 },
    { type: 'stream', url: `/watch?v=${correctId}`, title: 'Когда ты грустишь', uploaderName: 'Flëur - Topic', uploaderVerified: true, duration: 204, thumbnail: 'correct.jpg' },
  ],
};

window.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/search?')) {
    return { ok: true, status: 200, json: async () => searchPayload };
  }
  if (url.includes(`/streams/${correctId}`)) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        title: 'Когда ты грустишь',
        uploader: 'Flëur - Topic',
        duration: 204,
        audioStreams: [{ url: 'https://audio.example/correct.m4a', mimeType: 'audio/mp4', bitrate: 128000, videoOnly: false }],
        relatedStreams: [{ url: `/watch?v=${radioId}`, title: 'Тёплые коты', uploader: 'Flëur', duration: 221, thumbnail: 'radio.jpg' }],
      }),
    };
  }
  if (url.includes(`/streams/${radioId}`)) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        title: 'Тёплые коты',
        uploader: 'Flëur',
        duration: 221,
        audioStreams: [{ url: 'https://audio.example/radio.m4a', mimeType: 'audio/mp4', bitrate: 128000, videoOnly: false }],
        relatedStreams: [],
      }),
    };
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const imported = [];
window.importTracks = (tracks) => {
  const library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  for (const track of tracks) {
    imported.push(track);
    if (!library.some((item) => item.id === track.id)) library.push(track);
  }
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
  return { added: tracks.length, total: library.length };
};
window.renderLibrary = () => {};
let youtubeFallbacks = 0;
window.playIndex = () => { youtubeFallbacks += 1; };

const strictSource = fs.readFileSync('apple-match-strict-v150.js', 'utf8');
window.eval(strictSource);
assert.ok(window.ampMusicStrictMatcher150, 'strict matcher API must be exposed');
assert.equal(window.ampMusicStrictMatcher150.normalize('Когда ты грустишь'), 'когда ты грустишь', 'Cyrillic title must survive normalization');

window.winampMusicAppleImport = {
  parseUrl(value) {
    if (!String(value).includes('music.apple.com')) return null;
    return { href: String(value), trackId: '123', storefront: 'TR' };
  },
  async lookup() {
    return {
      trackId: '123',
      title: 'Когда ты грустишь',
      artist: 'Flëur',
      album: 'Волшебство',
      durationMs: 204000,
      artwork: 'apple.jpg',
      appleUrl: 'https://music.apple.com/tr/song/test/123',
    };
  },
  async findYouTubeMatch() { return { id: adId }; },
  async handleUrl() { throw new Error('legacy handle must be replaced'); },
};
assert.equal(window.winampMusicAppleImport.__ampStrict150, true, 'lazy Apple API must be patched synchronously');

const match = await window.winampMusicAppleImport.findYouTubeMatch({
  title: 'Когда ты грустишь', artist: 'Flëur', durationMs: 204000,
}, new window.AbortController().signal);
assert.equal(match.id, correctId, 'strict matcher must reject the ad-like result and choose the real-duration song');

const cleanSource = fs.readFileSync('clean-playback-v150.js', 'utf8');
window.eval(cleanSource);
assert.ok(window.ampMusicPlayDirectIndex, 'direct playback API must be exposed');
assert.ok(window.ampMusicRadio150, 'Radio API must be exposed');

const input = window.document.createElement('input');
input.value = 'https://music.apple.com/tr/song/test/123';
const handled = await window.winampMusicAppleImport.handleUrl(input.value, { input, play: true });
assert.equal(handled, true);
assert.equal(input.value, '');
let library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
assert.equal(library.length, 1);
assert.equal(library[0].id, correctId);
assert.ok(library[0].badges.includes('Strict match'));

await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(window.document.getElementById('status').textContent, 'PLAYING · DIRECT');
assert.equal(window.localStorage.getItem('winampmusic.fast.current.v1'), '0');
assert.equal(youtubeFallbacks, 0, 'direct stream should avoid YouTube iframe fallback when Piped audio is available');

await window.ampMusicRadio150.start();
library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
const radioTrack = library.find((track) => track.id === radioId);
assert.ok(radioTrack, 'Radio must save a related track');
assert.ok(radioTrack.badges.includes('Radio'));
assert.equal(window.document.getElementById('status').textContent, 'RADIO · PLAYING');
assert.equal(youtubeFallbacks, 0);

const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.match(indexHtml, /id="radioButton"[^>]*>📻<\/button>/);
assert.match(indexHtml, /apple-match-strict-v150\.js\?v=150/);
assert.match(indexHtml, /clean-playback-v150\.js\?v=150/);
assert.ok(indexHtml.indexOf('apple-match-strict-v150.js?v=150') < indexHtml.indexOf('fast-import-v150.js?v=150'), 'strict matcher must install before lazy Apple import');
assert.ok(indexHtml.indexOf('clean-playback-v150.js?v=150') < indexHtml.indexOf('fast-import-v150.js?v=150'), 'direct playlist wrapper must install before lazy Apple playlist import');
assert.match(indexHtml, /<title>AmpMusic 1\.5<\/title>/);

console.log('AmpMusic 1.5 strict real-track playback + Radio: OK');
