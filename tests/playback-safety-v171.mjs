import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const queueSource = readFileSync(new URL('../playback-queue-v170.js', import.meta.url), 'utf8');
const prefetchSource = readFileSync(new URL('../playback-prefetch-v165.js', import.meta.url), 'utf8');
const adSource = readFileSync(new URL('../ad-indicator-v170.js', import.meta.url), 'utf8');
const downloadSource = readFileSync(new URL('../diagnostics-download-v171.js', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const LEGACY = 'music-only-v1.6.4';
const FINAL = 'music-only-v1.6.7';
const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';

assert.match(queueSource, /youtubeMatchFinalTrustVersion/);
assert.match(prefetchSource, /finalTrustVersion/);
assert.match(headerSource, /diagnostics-download-v171\.js\?v=173/);
assert.match(headerSource, /ad-indicator-v170\.js\?v=173/);
assert.match(headerSource, /playback-queue-v170\.js\?v=173/);
assert.match(headerSource, /playback-miss-v173\.js\?v=173/);
assert.match(swSource, /ampmusic-v1\.7\.3/);
assert.match(swSource, /playback-miss-v173\.js/);
assert.match(swSource, /diagnostics-download-v171\.js/);

// A legacy v1.6.4 marker alone must not make a canonical-origin row playable.
const queueDom = new JSDOM('<!doctype html><body><div id="status">PAUSED</div><button id="playButton">▶</button></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const q = queueDom.window;
q.localStorage.setItem(KEY, JSON.stringify([
  {
    id: 'vuJwrcKQ7Sg',
    title: 'The News',
    artist: 'Madigan',
    duration: 279,
    spotifyTrackId: '7e6JhLyQ0HalkvkW0qKr65',
    badges: ['Spotify', 'Origin'],
    youtubeMatchResolverVersion: LEGACY,
  },
]));
q.localStorage.setItem(CURRENT, '0');
const played = [];
q.playIndex = async (index) => { played.push(index); return true; };
q.renderLibrary = () => {};
q.ampMusicOriginPlayback151 = { refresh() {} };
q.importTracks = () => ({ added: 0, total: 1 });
q.ampulaPlaybackPrefetch165 = { resolveAhead: async () => null };
let resolverCalls = 0;
q.ampulaTrackDiagnostics164 = {
  resolveTrusted: async () => {
    resolverCalls += 1;
    return {
      ...JSON.parse(q.localStorage.getItem(KEY))[0],
      id: 's1b8Q5avQZs',
      youtubeMatchId: 's1b8Q5avQZs',
      youtubeMatchResolverVersion: LEGACY,
      playbackProvider: 'youtube',
    };
  },
};
q.eval(queueSource);
assert.equal(q.ampulaPlaybackQueue170.isReady(JSON.parse(q.localStorage.getItem(KEY))[0]), false,
  'legacy resolver marker alone must not authorize canonical-origin playback');
await q.playIndex(0);
assert.equal(resolverCalls, 1, 'stale cached id must be re-resolved');
assert.deepEqual(played, [0], 'playback starts only after trusted re-resolution');
let saved = JSON.parse(q.localStorage.getItem(KEY));
assert.equal(saved[0].id, 's1b8Q5avQZs');
assert.equal(saved[0].youtubeMatchFinalTrustVersion, FINAL, 'successful guarded resolution must persist final trust');

const callsBefore = resolverCalls;
await q.playIndex(0);
assert.equal(resolverCalls, callsBefore, 'final-trusted cached match must be reused without another search');
queueDom.window.close();

// YouTube iframe telemetry must drive the pre-roll badge even when rendered duration still looks canonical.
const adDom = new JSDOM(`<!doctype html><head></head><body>
  <section class="screen"><div id="status" class="status">PLAYING</div><div id="elapsed">0:00</div><div id="duration">3:00</div></section>
  <button id="playButton">⏸</button>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const a = adDom.window;
a.localStorage.setItem(KEY, JSON.stringify([
  {
    id: 'abcdefghijk', youtubeMatchId: 'abcdefghijk', title: 'Song', artist: 'Artist', duration: 180,
    spotifyTrackId: 'spotify-1', badges: ['Spotify', 'Origin'], youtubeMatchResolverVersion: LEGACY,
    youtubeMatchFinalTrustVersion: FINAL,
  },
]));
a.localStorage.setItem(CURRENT, '0');
let wire = { videoId: 'zzzzzzzzzzz', currentTime: 5, duration: 30, playerState: 1 };
a.ampulaTrackDiagnostics164 = {
  payloadForIndex: () => ({ playback: { youtubeWire: wire } }),
};
a.eval(adSource);
assert.equal(a.ampulaAdIndicator170.sync(), true, 'different actively-playing iframe video must be shown as an ad');
const indicator = a.document.getElementById('ampulaAdIndicator');
assert.equal(indicator.textContent, 'AD 0:25');
assert.equal(indicator.hidden, false);
wire = { videoId: 'abcdefghijk', currentTime: 10, duration: 180, playerState: 1 };
assert.equal(a.ampulaAdIndicator170.sync(), false, 'badge must hide when expected trusted track resumes');
a.ampulaAdIndicator170.stop();
adDom.window.close();

// Diagnostics menu gains a second downloadable JSON action.
const downloadDom = new JSDOM(`<!doctype html><head></head><body>
  <ol id="trackList"><li class="track" data-index="4"><button class="track-more">⋮</button><div class="track-more-menu"><button>Copy diagnostics<small>resolver + stored/actual playback</small></button></div></li></ol>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const d = downloadDom.window;
d.ampulaTrackDiagnostics164 = {
  payloadForIndex: (index) => ({ schema: 'ampula-track-diagnostics-v1', capturedAt: '2026-09-11T04:58:08.854Z', selectedRow: { index } }),
};
d.eval(downloadSource);
d.ampulaDiagnosticsDownload171.decorate();
const menuButtons = [...d.document.querySelectorAll('.track-more-menu > button')];
assert.equal(menuButtons.length, 2);
assert.match(menuButtons[0].textContent, /Copy diagnostics/);
assert.match(menuButtons[1].textContent, /Download diagnostics/);
assert.equal(menuButtons[1].dataset.downloadDiagnostics, '1');
d.ampulaDiagnosticsDownload171.stop();
downloadDom.window.close();

console.log('final trust cache + iframe ad badge + diagnostics download v1.7.1: ok');