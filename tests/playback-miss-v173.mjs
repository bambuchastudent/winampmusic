import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const missSource = readFileSync(new URL('../playback-miss-v173.js', import.meta.url), 'utf8');
const matcherSource = readFileSync(new URL('../apple-music-import-v064.js', import.meta.url), 'utf8');
const trustSource = readFileSync(new URL('../resolver-trust-v167.js', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const LIBRARY_KEY = 'winampmusic.library.v1';
const CURRENT_KEY = 'winampmusic.fast.current.v1';
const REJECTED_KEY = 'ampula.playbackRejectedMatches.v1';
const BAD_ID = 'vuJwrcKQ7Sg';

assert.match(matcherSource, /excludeYoutubeIds/, 'matcher must accept excluded playback IDs');
assert.match(matcherSource, /excludedIds\.has\(candidate\.id\)/, 'excluded IDs must be removed before ranking');
assert.match(trustSource, /metadataWithRejected/, 'final trust wrapper must inject local rejection metadata');
assert.match(headerSource, /playback-miss-v173\.js\?v=175/, 'runtime must load MISS control');
assert.match(headerSource, /resolver-music-recall-v174\.js\?v=175/, 'MISS recovery must hand off to deep music recall after final trust');
assert.match(swSource, /ampmusic-v1\.7\.8/);
assert.match(swSource, /playback-navigation-v178\.js/);
assert.match(swSource, /resolver-music-recall-v174\.js/);
assert.match(swSource, /playback-miss-v173\.js/);

const dom = new JSDOM(`<!doctype html><head></head><body>
  <section class="screen"><div id="status" class="status">PLAYING</div><div id="elapsed">0:20</div><div id="duration">4:39</div></section>
  <button id="playButton">⏸</button>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const w = dom.window;

w.localStorage.setItem(LIBRARY_KEY, JSON.stringify([
  {
    id: BAD_ID,
    youtubeMatchId: BAD_ID,
    youtubeMatchResolverVersion: 'music-only-v1.6.4',
    title: 'The News',
    artist: 'Madigan',
    duration: 279,
    playlist: 'Better Call Saul soundtrack',
    spotifyTrackId: '7e6JhLyQ0HalkvkW0qKr65',
    spotifyTrackUrl: 'https://open.spotify.com/track/7e6JhLyQ0HalkvkW0qKr65',
    badges: ['Spotify', 'Origin', 'YouTube match'],
    playbackProvider: 'youtube',
  },
  {
    id: 'abcdefghijk',
    title: 'Next playable',
    artist: 'Artist',
    duration: 200,
    badges: ['YouTube'],
  },
]));
w.localStorage.setItem(CURRENT_KEY, '0');

let suspended = 0;
w.ampMusicYouTube150 = {
  isActive: () => true,
  suspend() { suspended += 1; },
};
w.ampMusicRecordingId = () => 'U-localrecord';
w.renderLibrary = () => {};
w.ampMusicOriginPlayback151 = { refresh() {} };
w.ampulaTrackDiagnostics164 = {
  payloadForIndex: () => ({ playback: { actualYoutubeId: BAD_ID, youtubeWire: { videoId: BAD_ID, playerState: 1 } } }),
};
const playCalls = [];
w.playIndex = async (index) => {
  playCalls.push(index);
  return index === 0 ? false : true;
};

w.eval(missSource);
assert.ok(w.ampulaPlaybackMiss173, 'MISS API must be installed');
const button = w.document.getElementById('ampulaPlaybackMiss');
assert.ok(button, 'MISS button must be rendered in the player status row');
assert.equal(button.textContent, 'MISS');

const recovered = await w.ampulaPlaybackMiss173.rejectCurrentAndRetry();
assert.equal(recovered, true, 'recovery should continue to the next playable row when current retry is exhausted');
assert.equal(suspended, 1, 'wrong YouTube audio must stop before retry');
assert.deepEqual(playCalls, [0, 1], 'retry current recording first, then continue to next playable row');

const rows = JSON.parse(w.localStorage.getItem(LIBRARY_KEY));
assert.equal(rows[0].id, 'U-localrecord', 'rejected playback ID must be replaced by the unresolved local recording ID');
assert.equal(rows[0].title, 'The News');
assert.equal(rows[0].artist, 'Madigan');
assert.equal(rows[0].spotifyTrackId, '7e6JhLyQ0HalkvkW0qKr65');
assert.equal(rows[0].youtubeMatchId, undefined);
assert.equal(rows[0].youtubeMatchResolverVersion, undefined);
assert.equal(rows[0].youtubeMatchFinalTrustVersion, undefined);
assert.equal(rows[0].playbackProvider, undefined);
assert.deepEqual(rows[0].badges, ['Spotify', 'Origin']);

const rejectedStore = JSON.parse(w.localStorage.getItem(REJECTED_KEY));
assert.equal(Object.values(rejectedStore)[0].ids[0], BAD_ID, 'rejected candidate must persist locally');
const metadata = w.ampulaPlaybackMiss173.metadataWithRejected({
  title: 'The News', artist: 'Madigan', durationMs: 279000,
});
assert.deepEqual(Array.from(metadata.excludeYoutubeIds), [BAD_ID], 'subsequent matcher calls must receive rejected IDs');

const replacementRows = JSON.parse(w.localStorage.getItem(LIBRARY_KEY));
replacementRows[0] = {
  ...replacementRows[0],
  id: 's1b8Q5avQZs',
  youtubeMatchId: 's1b8Q5avQZs',
  youtubeMatchResolverVersion: 'music-only-v1.6.4',
  youtubeMatchFinalTrustVersion: 'music-only-v1.6.7',
  playbackProvider: 'youtube',
  badges: [...replacementRows[0].badges, 'YouTube match'],
};
w.localStorage.setItem(LIBRARY_KEY, JSON.stringify(replacementRows));
w.localStorage.setItem(CURRENT_KEY, '0');
w.ampulaPlaybackMiss173.sync();
assert.equal(button.textContent, 'MISS · 1', 'replacement playback should show prior rejection count');

w.ampulaPlaybackMiss173.stop();
dom.window.close();

console.log('manual playback MISS + v1.7.8 queue/deep recall contract: ok');
