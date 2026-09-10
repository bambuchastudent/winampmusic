import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../apple-resolution-v162.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="status"></div><div id="songSearchStatus"></div>
</body></html>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;
const STORAGE_KEY = 'winampmusic.library.v1';
const appleUrl = 'https://music.apple.com/us/album/the-news/123456789?i=987654321';

window.console = console;
window.ampMusicRecordingId = (title, artist) => `U-${String(title).toLowerCase()}-${String(artist).toLowerCase()}`;
window.importTracks = (tracks) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  return { added: tracks.length, total: tracks.length };
};
window.renderLibrary = () => {};
window.winampMusicAppleImport = {
  parseUrl(value) {
    return value === appleUrl ? { href: value, trackId: '987654321', storefront: 'US' } : null;
  },
  async lookup() {
    return {
      trackId: '987654321',
      title: 'The News',
      artist: 'Madigan',
      album: 'The News',
      durationMs: 279000,
      artwork: 'https://example.test/apple.jpg',
      appleUrl,
    };
  },
  async findYouTubeMatch(metadata) {
    assert.equal(metadata.title, 'The News');
    assert.equal(metadata.artist, 'Madigan');
    assert.equal(metadata.durationMs, 279000);
    return {
      id: 's1b8Q5avQZs',
      title: 'WRONG YOUTUBE TITLE',
      artist: 'WRONG YOUTUBE UPLOADER',
      duration: 279,
      thumbnail: 'https://example.test/youtube.jpg',
    };
  },
};

window.eval(source);
assert.equal(window.winampMusicAppleImport.__ampFullResolver162, true);
const handled = await window.winampMusicAppleImport.handleUrl(appleUrl, { play: false });
assert.equal(handled, true);

const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(saved.length, 1);
assert.equal(saved[0].id, 's1b8Q5avQZs');
assert.equal(saved[0].title, 'The News', 'Apple title must remain canonical after YouTube resolution');
assert.equal(saved[0].artist, 'Madigan', 'Apple artist must remain canonical after YouTube resolution');
assert.equal(saved[0].appleTrackId, '987654321');
assert.equal(saved[0].appleTrackUrl, appleUrl);

console.log('Apple canonical metadata preservation 1.6.3: OK');
dom.window.close();
