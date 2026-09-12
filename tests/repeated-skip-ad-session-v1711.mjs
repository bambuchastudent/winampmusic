import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const guardSource = fs.readFileSync('playback-bridge-guard-v1711.js', 'utf8');
const diagnosticsSource = fs.readFileSync('track-diagnostics-v164.js', 'utf8');
const queueSource = fs.readFileSync('playback-queue-v170.js', 'utf8');
const adSource = fs.readFileSync('ad-indicator-v170.js', 'utf8');
const fastPlayerSource = fs.readFileSync('fast-player-v141.js', 'utf8');

const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';
const FINAL = 'music-only-v1.6.7';
const TRUST = 'music-only-v1.6.4';

function ready(id, title, spotifyTrackId) {
  return {
    id,
    title,
    artist: 'Artist',
    spotifyTrackId,
    duration: 180,
    badges: ['Spotify', 'Origin'],
    youtubeMatchResolverVersion: TRUST,
    youtubeMatchFinalTrustVersion: FINAL,
  };
}
function unresolved(title, spotifyTrackId) {
  return {
    id: `U-${spotifyTrackId}`,
    title,
    artist: 'Artist',
    spotifyTrackId,
    duration: 180,
    badges: ['Spotify', 'Origin'],
  };
}
function countMarker(fn, marker) {
  let count = 0;
  const seen = new Set();
  let current = fn;
  while (typeof current === 'function' && !seen.has(current)) {
    seen.add(current);
    if (current[marker]) count += 1;
    current = current.__ampulaWrappedPlayIndex;
  }
  return count;
}

// Production order: bridge guard attaches to playIndex first, diagnostics installs,
// another playback adapter wraps it, queue installs outermost, then diagnostics refreshes.
const navDom = new JSDOM(`<!doctype html><head></head><body>
  <section class="screen"><div id="status" class="status">PLAYING</div></section>
  <button id="playButton">⏸</button>
  <ol id="trackList"></ol>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const nw = navDom.window;
const rows = [
  ready('aaaaaaaaaaa', 'Five', 's5'),
  unresolved('Six', 's6'),
  ready('ccccccccccc', 'Seven', 's7'),
];
nw.localStorage.setItem(KEY, JSON.stringify(rows));
nw.localStorage.setItem(CURRENT, '0');
nw.renderLibrary = () => {};
nw.ampMusicOriginPlayback151 = { refresh() {} };
nw.importTracks = () => ({ added: 0, total: rows.length });
nw.ampMusicRecordingId = (title, artist) => `U-${String(title).length}-${String(artist).length}`;

const baseCalls = [];
nw.playIndex = async (index) => {
  baseCalls.push(index);
  nw.localStorage.setItem(CURRENT, String(index));
  return `played:${index}`;
};

nw.eval(guardSource);
nw.eval(diagnosticsSource);
const diagnosticsWrapped = nw.playIndex;
const adapter = async (index) => diagnosticsWrapped(index);
Object.defineProperty(adapter, '__ampulaPrefetch165', { value: true });
Object.defineProperty(adapter, '__ampulaWrappedPlayIndex', { value: diagnosticsWrapped });
nw.playIndex = adapter;

nw.ampulaPlaybackPrefetch165 = {
  resolveAhead: async () => null,
  resolveAll: async () => [],
};
nw.eval(queueSource);
assert.equal(nw.playIndex.__ampulaPlaybackQueue170, true, 'queue must initially own the outer playback bridge');
assert.equal(countMarker(nw.playIndex, '__ampulaPlaybackQueue170'), 1);
assert.equal(countMarker(nw.playIndex, '__ampulaTrustedResolver164'), 1);

// This is the point where production v1.7.10 drifted: diagnostics wrapped outside
// queue after the page had already settled, so unresolved Next stopped reaching skip logic.
nw.dispatchEvent(new nw.Event('pageshow'));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(nw.playIndex.__ampulaPlaybackQueue170, true, 'delayed diagnostics refresh must not move outside the queue bridge');
nw.ampulaPlaybackQueue170.installQueueBridge();
assert.equal(countMarker(nw.playIndex, '__ampulaPlaybackQueue170'), 1, 'queue bridge must not stack duplicates');
assert.equal(countMarker(nw.playIndex, '__ampulaTrustedResolver164'), 1, 'trusted resolver bridge must not stack duplicates');

const skipResult = await nw.playIndex(1);
assert.equal(skipResult, 'played:2', 'skip must still work after delayed bridge refresh');
assert.deepEqual(baseCalls, [2]);
navDom.window.close();

// YouTube can keep content state PAUSED while an ad is actively playing.
// Wire data must win over that misleading content state.
const adDom = new JSDOM(`<!doctype html><head></head><body>
  <section class="screen">
    <div id="status" class="status">PAUSED</div>
    <div id="elapsed">0:05</div>
    <div id="duration">3:00</div>
  </section>
  <button id="playButton">▶</button>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const aw = adDom.window;
aw.localStorage.setItem(KEY, JSON.stringify([
  ready('abcdefghijk', 'Song', 'spotify-1'),
]));
aw.localStorage.setItem(CURRENT, '0');
aw.eval(adSource);

aw.dispatchEvent(new aw.MessageEvent('message', {
  origin: 'https://www.youtube.com',
  data: JSON.stringify({
    event: 'infoDelivery',
    info: {
      videoData: { video_id: 'zzzzzzzzzzz', title: 'Advertisement', author: 'Advertiser' },
      playerState: 1,
      currentTime: 5,
      duration: 30,
    },
  }),
}));
assert.equal(aw.ampulaAdIndicator170.sync(), true, 'active YouTube ad wire state must be detected even while content says PAUSED');
const indicator = aw.document.getElementById('ampulaAdIndicator');
assert.equal(indicator.hidden, false);
assert.equal(indicator.textContent, 'AD 0:25');
assert.equal(aw.document.getElementById('status').textContent, 'AD', 'main playback status must say AD instead of PAUSED');
aw.ampulaAdIndicator170.stop();
adDom.window.close();

// Session invariant: one iframe/player object per page; each track reuses it.
assert.equal((fastPlayerSource.match(/new YT\.Player\(/g) || []).length, 1, 'there must be one YT.Player constructor in the runtime');
assert.match(fastPlayerSource, /if \(playerPromise\) return playerPromise;/, 'ensurePlayer must reuse the existing player promise');
assert.match(fastPlayerSource, /ready\.loadVideoById\(safeId\)/, 'track changes reuse the player via loadVideoById');
assert.doesNotMatch(fastPlayerSource, /\.destroy\s*\(/, 'normal playback must not destroy/recreate the YouTube iframe');

console.log('repeated skip + AD state + single YouTube session v1.7.11: ok');
