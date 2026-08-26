import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('playback-continuity-v160.js', 'utf8');
const release = fs.readFileSync('fast-release-v150.js', 'utf8');

assert.match(release, /playback-continuity-v160\.js\?v=160/, 'release adapter must lazy-load continuity runtime');
assert.match(code, /winampmusic\.playback\.checkpoints\.v1/, 'checkpoint storage must be versioned');
assert.doesNotMatch(code, /24 \* 60 \* 60|expires|expiry/i, 'continuity must not silently expire by age');

function shell(url = 'https://example.test/winampmusic/') {
  return new JSDOM(`<!doctype html><html><body>
    <div id="status">READY · FAST</div>
    <div id="elapsed">00:00</div>
    <input id="seek" type="range" min="0" max="1000" value="0">
    <div id="duration">00:00</div>
    <button id="prevButton">prev</button>
    <button id="playButton">play</button>
    <button id="nextButton">next</button>
    <button id="shuffleButton">shuffle</button>
    <button id="radioButton">radio</button>
    <button class="track-main" data-index="0">A</button>
    <button class="track-main" data-index="1">B</button>
    <button class="track-main" data-index="2">C</button>
  </body></html>`, { runScripts: 'outside-only', url, pretendToBeVisual: true });
}

const dom = shell();
const { window } = dom;
const library = [
  { id: 'ccccccccccc', title: 'Track C', artist: 'Artist' },
  { id: 'bbbbbbbbbbb', title: 'Track B', artist: 'Artist' },
  { id: 'aaaaaaaaaaa', title: 'Track A', artist: 'Artist' },
];
window.ampMusicRecordingId = (title, artist) => `recording:${title.toLowerCase()}|${artist.toLowerCase()}`;
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
window.localStorage.setItem('winampmusic.fast.current.v1', '0'); // stale numeric index from the old order
window.localStorage.setItem('winampmusic.playback.active-context.v1', JSON.stringify({ kind: 'library', id: 'local' }));
window.localStorage.setItem('winampmusic.playback.checkpoints.v1', JSON.stringify({
  v: 1,
  checkpoints: {
    'library:local': {
      v: 1,
      context: { kind: 'library', id: 'local' },
      track: { key: 'recording:track b|artist', title: 'Track B', artist: 'Artist' },
      positionMs: 197000,
      durationMs: 240000,
      wasPlaying: true,
      updatedAt: '2026-08-26T12:00:00.000Z',
    },
  },
}));

let playedIndex = null;
let seekChanges = 0;
window.playIndex = async (index) => {
  playedIndex = index;
  window.localStorage.setItem('winampmusic.fast.current.v1', String(index));
  window.document.getElementById('status').textContent = 'PLAYING';
  return true;
};
window.document.getElementById('seek').addEventListener('change', () => { seekChanges += 1; });

window.eval(code);
await new Promise((resolve) => setTimeout(resolve, 10));

assert.equal(window.localStorage.getItem('winampmusic.fast.current.v1'), '1', 'restore must find Track B by stable identity after reorder');
assert.equal(window.document.getElementById('elapsed').textContent, '3:17', 'restore paints the saved position');
assert.equal(window.document.getElementById('duration').textContent, '4:00');
assert.match(window.document.getElementById('status').textContent, /READY · RESUME 3:17/);
assert.equal(playedIndex, null, 'reload restore must remain paused and must not autoplay');
assert.equal(window.ampMusicPlaybackContinuity.pending().index, 1, 'stable restored index is armed for the next gesture');

window.document.getElementById('playButton').click();
await new Promise((resolve) => setTimeout(resolve, 520));
assert.equal(playedIndex, 1, 'first explicit Play must start the stable restored track, not stale numeric index 0');
assert.ok(seekChanges >= 1, 'resume must drive the shared seek control after playback starts');
const seekValue = Number(window.document.getElementById('seek').value);
assert.ok(Math.abs(seekValue - Math.round((197 / 240) * 1000)) <= 2, `seek should restore ~03:17, got ${seekValue}`);
assert.equal(window.ampMusicPlaybackContinuity.pending(), null, 'resume checkpoint is consumed after seeking');

window.document.getElementById('elapsed').textContent = '3:20';
window.document.getElementById('duration').textContent = '4:00';
window.document.getElementById('status').textContent = 'PAUSED';
window.ampMusicPlaybackContinuity.save();
const saved = JSON.parse(window.localStorage.getItem('winampmusic.playback.checkpoints.v1'));
assert.equal(saved.checkpoints['library:local'].track.key, 'recording:track b|artist');
assert.equal(saved.checkpoints['library:local'].positionMs, 200000);
assert.equal(saved.checkpoints['library:local'].context.kind, 'library');

// Opening a Received Ámpula must not let a stale Library checkpoint seize the session.
const receivedDom = shell('https://example.test/winampmusic/?a=j.example');
receivedDom.window.ampMusicRecordingId = window.ampMusicRecordingId;
receivedDom.window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
receivedDom.window.localStorage.setItem('winampmusic.fast.current.v1', '0');
receivedDom.window.localStorage.setItem('winampmusic.playback.checkpoints.v1', JSON.stringify(saved));
receivedDom.window.eval(code);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(receivedDom.window.localStorage.getItem('winampmusic.fast.current.v1'), '0', 'Received Ámpula URL keeps Library continuity dormant');
assert.equal(receivedDom.window.ampMusicPlaybackContinuity.pending(), null);

console.log('Local playback continuity v1.6 first slice passed');
process.exit(0);
