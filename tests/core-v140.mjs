import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const boot = fs.readFileSync('boot-v140.js', 'utf8');
const search = fs.readFileSync('v059.js', 'utf8');
const worker = fs.readFileSync('sw.js', 'utf8');

assert.match(index, /__WINAMP_HTML_RUNTIME__='1\.4\.0-core'/);
assert.match(index, /app\.js\?v=1\.4\.0/);
assert.match(index, /boot-v140\.js\?v=1\.4\.0/);
assert.match(index, /v059\.js\?v=1\.4\.0/);
for (const legacy of ['metadata-refresh.js', 'activity-ticker-v1.js', 'controls-failsafe', 'lyrics.js', 'comments.js', 'production-polish-v12.js', 'core-interactions-v13.js']) {
  assert.ok(!index.includes(legacy), `core boot must not load ${legacy}`);
}
assert.ok(!boot.includes('stopImmediatePropagation'), 'core boot must never stop native clicks');
assert.ok(!worker.includes('controls-failsafe'), 'worker must not inject interaction scripts');
assert.ok(!worker.includes('playerNavigation'), 'worker must not rewrite HTML');

const html = `<!doctype html><html><head></head><body>
<main class="app-shell">
<header class="topbar"><div></div><div class="top-actions"><button id="installButton" hidden></button><a id="openYoutubeButton"></a></div></header>
<section class="player">
<div class="screen"><div id="status">READY</div><div id="nowTitle"></div><div id="nowArtist"></div><span id="elapsed">00:00</span><input id="seek" type="range" min="0" max="1000" value="0"><span id="duration">00:00</span></div>
<div class="controls"><button id="prevButton">prev</button><button id="playButton">play</button><button id="nextButton">next</button><button id="shuffleButton">shuffle</button></div>
<input id="volume" type="range" min="0" max="100" value="75"><div id="youtubePlayer"></div>
</section>
<section class="library-panel"><div class="library-header"><span id="trackCount"></span><div class="header-actions"><button id="importHelpButton">import</button><button id="sharePlaylistButton">share</button><button id="clearButton">clear</button></div></div><input id="search"><ol id="trackList"></ol><div id="emptyState"><button id="emptyImportButton">empty</button></div></section>
<footer class="app-version"></footer></main>
<dialog id="importDialog"><textarea id="importScript"></textarea><button id="copyScriptButton"></button><button id="copyBookmarkletButton"></button><textarea id="bookmarkletScript"></textarea></dialog>
<a id="openYoutubeButtonLibrary"></a>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
const { window } = dom;
window.confirm = () => false;
window.prompt = () => null;
window.navigator.serviceWorker = undefined;
window.navigator.share = undefined;
window.navigator.clipboard = { writeText: async () => {} };
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([
  { id: 'aaaaaa11111', title: 'First song', artist: 'One' },
  { id: 'bbbbbb22222', title: 'Second song', artist: 'Two' },
]));

let currentId = null;
let playerState = 2;
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: class FakePlayer {
    constructor(_id, options) {
      this.options = options;
      setTimeout(() => options.events.onReady?.(), 0);
    }
    setVolume() {}
    loadVideoById(id) {
      currentId = id;
      playerState = 1;
      this.options.events.onStateChange?.({ data: 1 });
    }
    getPlayerState() { return playerState; }
    playVideo() { playerState = 1; this.options.events.onStateChange?.({ data: 1 }); }
    pauseVideo() { playerState = 2; this.options.events.onStateChange?.({ data: 2 }); }
    getDuration() { return 180; }
    getCurrentTime() { return 0; }
    getVideoData() { return { video_id: currentId, title: '', author: '' }; }
    seekTo() {}
    stopVideo() {}
  },
};

window.eval(app);
window.eval(boot);
window.eval(search);
await new Promise((resolve) => setTimeout(resolve, 10));

assert.equal(window.__WINAMP_MUSIC_RUNTIME__, '1.4.0-core');
assert.equal(window.document.querySelectorAll('.track-main').length, 2, 'saved library must render');
assert.ok(window.document.getElementById('songSearchButton'), 'song search button must mount');

window.document.getElementById('playButton').click();
assert.equal(currentId, 'aaaaaa11111', 'Play must start first saved track');
assert.equal(window.document.getElementById('status').textContent, 'PLAYING');

window.document.getElementById('nextButton').click();
assert.equal(currentId, 'bbbbbb22222', 'Next must start second track');

window.document.querySelector('.track[data-index="0"] .track-main').click();
assert.equal(currentId, 'aaaaaa11111', 'Track tap must select and play requested track');

const filter = window.document.getElementById('search');
filter.value = 'Second';
filter.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelectorAll('.track-main').length, 1, 'library filter must react to input');

const songInput = window.document.getElementById('songSearchInput');
songInput.value = '';
window.document.getElementById('songSearchButton').click();
assert.equal(window.document.getElementById('songSearchStatus').textContent, 'Enter at least 2 characters', 'Search button must receive native click/submit');

console.log('v1.4.0 core interaction test: passed');
