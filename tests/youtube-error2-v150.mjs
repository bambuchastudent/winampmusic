import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('fast-player-v141.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const html = index
  .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
  .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
  .replace('<script src="./stable-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-actions-v143.js?v=150" defer></script>', '');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'https://bambuchastudent.github.io/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.requestIdleCallback = () => 1;
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([
  { id: 'legacy-bad-id', title: 'ГУФ - Новости', artist: 'Alligator Di' },
]));

const loaded = [];
window.fetch = async (url) => {
  assert.match(String(url), /\/api\/v1\/search/);
  return {
    ok: true,
    json: async () => [{ type: 'video', videoId: 'dQw4w9WgXcQ', title: 'ГУФ - Новости', author: 'Alligator Di' }],
  };
};
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: class {
    constructor(_id, options) {
      this.options = options;
      queueMicrotask(() => options.events.onReady?.());
    }
    setVolume() {}
    loadVideoById(id) {
      loaded.push(id);
      this.options.events.onStateChange?.({ data: 1 });
    }
    getPlayerState() { return 2; }
    playVideo() {}
    pauseVideo() {}
    getDuration() { return 120; }
    getCurrentTime() { return 1; }
    seekTo() {}
  },
};

window.eval(source);
window.document.getElementById('playButton').click();
await new Promise((resolve) => setTimeout(resolve, 10));

assert.equal(loaded.at(-1), 'dQw4w9WgXcQ', 'malformed legacy ID should be repaired before playback');
let saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved[0].id, 'dQw4w9WgXcQ', 'repaired ID should persist');
assert.equal(window.document.getElementById('status').textContent, 'PLAYING');

const kept = window.importTracks([{ id: 'not-11', title: 'Bad', artist: 'Bad' }]);
assert.equal(kept.added, 1, 'a malformed provider ID must discard the ID, not the recording');
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.notEqual(saved.at(-1).id, 'not-11', 'a malformed provider ID must never be stored');
assert.ok(!/^[A-Za-z0-9_-]{11}$/.test(saved.at(-1).id), 'an unresolved track must not hold a provider-shaped ID');
assert.equal(saved.at(-1).title, 'Bad', 'the recording metadata must survive');
assert.ok(!loaded.includes(saved.at(-1).id), 'an unresolved ID must never reach provider playback');
const normalized = window.importTracks([{ id: 'https://youtu.be/9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY' }]);
assert.equal(normalized.added, 1, 'legacy URL-shaped ID should normalize to a video ID');
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.at(-1).id, '9bZkp7q19f0');

assert.equal(window.ampMusicVideoIdFromValue('https://www.youtube.com/watch?v=aqz-KE-bpKQ'), 'aqz-KE-bpKQ');
assert.equal(window.ampMusicVideoIdFromValue('broken'), '');

dom.window.close();
console.log('AmpMusic 1.5 YouTube error 2 recovery test passed');
process.exit(0);
