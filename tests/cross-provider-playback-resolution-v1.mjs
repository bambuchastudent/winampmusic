import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = `<!doctype html><body>
  <div id="status">STARTING…</div>
  <div id="nowTitle"></div><div id="nowArtist"></div>
  <span id="elapsed">00:00</span><span id="duration">00:00</span>
  <input id="seek" type="range" value="0"><input id="volume" type="range" value="75">
  <button id="prevButton"></button><button id="playButton">▶</button><button id="nextButton"></button>
  <button id="shuffleButton"></button><button id="radioButton">📻</button>
  <input id="search"><ol id="trackList"></ol><span id="trackCount"></span><div id="emptyState"></div>
  <div id="youtubePlayer"></div>
</body>`;

const dom = new JSDOM(html, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
window.console = console;
window.requestIdleCallback = () => 1;
window.cancelIdleCallback = () => {};

const appleUrl = 'https://music.apple.com/tr/album/200-po-vstrechnoy/1440815119?i=1440815236';
const unresolvedId = 'U-applelocal';
const youtubeId = 'abcdefghijk';
const original = {
  id: unresolvedId,
  title: 'Клоуны',
  artist: 't.A.T.u.',
  duration: 209,
  sourceUrl: appleUrl,
  appleTrackId: '1440815236',
  originStorefront: 'TR',
  badges: ['Apple Music', 'Unresolved'],
};
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([original]));
window.localStorage.setItem('winampmusic.fast.current.v1', '0');

let iframeVideoId = '';
let playerState = 2;
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: class FakePlayer {
    constructor(_id, options) {
      this.options = options;
      queueMicrotask(() => options.events.onReady?.());
    }
    setVolume() {}
    loadVideoById(id) {
      iframeVideoId = id;
      playerState = 1;
      this.options.events.onStateChange?.({ data: 1 });
    }
    getPlayerState() { return playerState; }
    playVideo() { playerState = 1; this.options.events.onStateChange?.({ data: 1 }); }
    pauseVideo() { playerState = 2; this.options.events.onStateChange?.({ data: 2 }); }
    getDuration() { return 209; }
    getCurrentTime() { return 0; }
    seekTo() {}
  },
};

// All direct Piped stream requests fail. The already-resolved YouTube id must
// therefore be used by the iframe fallback, without a stale second lookup.
window.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });

window.eval(fs.readFileSync('fast-player-v141.js', 'utf8'));
assert.equal(typeof window.ampMusicAdoptPlaybackSource, 'function', 'core must expose authoritative source adoption');

const beforeInvalid = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'))[0];
assert.equal(window.ampMusicAdoptPlaybackSource(0, { id: 'not-a-youtube-id', title: 'WRONG' }), '');
assert.deepEqual(
  JSON.parse(window.localStorage.getItem('winampmusic.library.v1'))[0],
  beforeInvalid,
  'invalid resolver results must not mutate the recording',
);

window.winampMusicAppleImport = {
  __ampStrict150: true,
  async findYouTubeMatch(metadata) {
    assert.equal(metadata.title, 'Клоуны');
    assert.equal(metadata.artist, 't.A.T.u.');
    return { id: youtubeId, thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' };
  },
};

window.eval(fs.readFileSync('clean-playback-v150.js', 'utf8'));
await window.ampMusicPlayDirectIndex(0);
await new Promise((resolve) => setTimeout(resolve, 0));

assert.equal(iframeVideoId, youtubeId, 'Piped failure must fall back to iframe with the already-resolved YouTube id');
assert.equal(window.document.getElementById('status').textContent, 'PLAYING');

const stored = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'))[0];
assert.equal(stored.id, youtubeId, 'resolved playback handle must be persisted');
assert.equal(stored.title, original.title, 'resolution must preserve recording title');
assert.equal(stored.artist, original.artist, 'resolution must preserve recording artist');
assert.equal(stored.sourceUrl, appleUrl, 'resolution must preserve Apple origin URL');
assert.equal(stored.appleTrackId, original.appleTrackId, 'resolution must preserve Apple track evidence');
assert.equal(stored.originStorefront, 'TR', 'resolution must preserve storefront provenance');
assert.deepEqual(stored.badges, original.badges, 'resolution must not rewrite provenance badges');
assert.ok(stored.strictMatchedAt, 'local resolution timestamp should be retained');

console.log('Cross-provider playback resolution v1: OK');
process.exit(0);
