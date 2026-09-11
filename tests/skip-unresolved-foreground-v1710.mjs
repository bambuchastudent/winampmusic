import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const queueSource = fs.readFileSync('playback-queue-v170.js', 'utf8');
const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';
const FINAL = 'music-only-v1.6.7';

const dom = new JSDOM('<!doctype html><body><div id="status">PLAYING</div><button id="playButton">⏸</button></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;

const rows = [
  { id: 'aaaaaaaaaaa', title: 'Five', artist: 'Artist', spotifyTrackId: 's5', badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL },
  { id: 'U-six', title: 'Six', artist: 'Artist', spotifyTrackId: 's6', badges: ['Spotify', 'Origin'] },
  { id: 'U-seven', title: 'Seven', artist: 'Artist', spotifyTrackId: 's7', badges: ['Spotify', 'Origin'] },
];
window.localStorage.setItem(KEY, JSON.stringify(rows));
window.localStorage.setItem(CURRENT, '0');
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
window.importTracks = () => ({ added: 0, total: rows.length });

const never = new Promise(() => {});
const resolverCalls = [];
window.ampulaPlaybackPrefetch165 = {
  resolveAhead: async (index) => {
    resolverCalls.push(index);
    if (index === 1) return never;
    if (index === 2) {
      return {
        id: 'ggggggggggg',
        title: 'Wrong playback title',
        artist: 'Wrong playback artist',
        spotifyTrackId: 's7',
        badges: ['Spotify', 'Origin'],
        youtubeMatchFinalTrustVersion: FINAL,
      };
    }
    return null;
  },
  resolveAll: async () => [],
};
window.ampulaTrackDiagnostics164 = { resolveTrusted: async () => null };

const played = [];
window.playIndex = async (index) => {
  played.push(index);
  window.localStorage.setItem(CURRENT, String(index));
  return `played:${index}`;
};

window.eval(queueSource);
void window.playIndex(1);

// Row 6 never resolves. Queue recovery must stop waiting on that one row,
// actively try row 7, and start it within the foreground-skip budget.
await new Promise((resolve) => setTimeout(resolve, 1900));
const playedSnapshot = [...played];
const resolverSnapshot = [...resolverCalls];
const saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
dom.window.close();

assert.deepEqual(playedSnapshot, [2], 'row 5 -> stuck row 6 -> resolvable row 7 must continue automatically');
assert.ok(resolverSnapshot.includes(1), 'stuck row 6 must still be offered to the trusted resolver');
assert.ok(resolverSnapshot.includes(2), 'queue must actively try row 7 instead of waiting only for full-library prefetch');
assert.equal(saved[2].title, 'Seven', 'playback candidate must not replace canonical title');
assert.equal(saved[2].artist, 'Artist', 'playback candidate must not replace canonical artist');
assert.equal(saved[2].youtubeMatchFinalTrustVersion, FINAL, 'row 7 still requires the final-trust marker');

console.log('foreground unresolved skip v1.7.10: ok');
