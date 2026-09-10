import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../spotify-played-library-v161.js', import.meta.url), 'utf8');
const embed = readFileSync(new URL('../spotify-playlist-embed-v160.js', import.meta.url), 'utf8');

assert.match(embed, /ampula:spotify-playback-started/);
assert.match(embed, /ampula:spotify-playback-update/);
assert.match(embed, /playingURI/);

const dom = new JSDOM(`<!doctype html><body>
  <div id="spotifySourceStatus"></div>
  <ol id="trackList"></ol>
</body>`, { url: 'https://bambuchastudent.github.io/winampmusic/', runScripts: 'outside-only' });
const { window } = dom;
const STORAGE_KEY = 'winampmusic.library.v1';
let importCalls = 0;

window.importTracks = (items) => {
  importCalls += 1;
  const library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  for (const item of items) {
    if (library.some((track) => track.spotifyTrackId === item.spotifyTrackId)) continue;
    library.push({ ...item, id: item.id || `U-test-${library.length}` });
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  return { added: items.length, total: library.length };
};
window.renderLibrary = () => {};
window.updateTrackMetadata = () => true;
window.winampMusicAppleImport = {
  findYouTubeMatch: async () => ({
    id: 'abcdefghijk',
    title: 'Better Call Saul Main Title',
    artist: 'Dave Porter - Topic',
    duration: 18,
    thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
  }),
};
window.fetch = async (url) => {
  const href = String(url);
  if (href.includes('/oembed') && href.includes('open.spotify.com%2Ftrack') || href.includes('/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack')) {
    return { ok: true, json: async () => ({ title: 'Better Call Saul Main Title', thumbnail_url: 'https://i.scdn.co/cover.jpg' }) };
  }
  if (href.includes('/oembed')) {
    return { ok: true, json: async () => ({ title: 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)' }) };
  }
  throw new Error(`Unexpected fetch ${href}`);
};

window.eval(source);
const api = window.ampulaSpotifyPlayedLibrary161;
assert.ok(api, 'retention API should be exposed');

const detail = {
  playingURI: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
  durationMs: 18000,
  playlist: {
    playlistId: '3A4l0emm89zzee5bzE7E0L',
    canonicalUrl: 'https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L',
    title: 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)',
    owner: 'your own kind of music',
  },
};

await api.handleStarted(detail);
let library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, 1, 'first real play should save one row');
assert.equal(library[0].spotifyTrackId, '4cOdK2wGLETKBW3PvgPWqT');
assert.equal(library[0].spotifyTrackUrl, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
assert.equal(library[0].spotifyPlaylistId, '3A4l0emm89zzee5bzE7E0L');
assert.equal(library[0].spotifyPlaylistUrl, 'https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L');
assert.equal(library[0].spotifyPlaylistTitle, 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)');
assert.equal(library[0].spotifyPlaylistOwner, 'your own kind of music');
assert.equal(library[0].title, 'Better Call Saul Main Title');
assert.equal(library[0].artist, 'Dave Porter');
assert.equal(library[0].id, 'abcdefghijk', 'resolved YouTube id is only a future fallback');
assert.ok(library[0].spotifyPlayedAt);

await api.handleStarted({ ...detail, durationMs: 19000 });
library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, 1, 'replaying the same Spotify id must not duplicate');
assert.equal(library[0].duration, 19, 'replay/update may enrich duration');
assert.equal(importCalls, 1, 'duplicate replay should not call core import again');

await api.handleUpdate({ ...detail, durationMs: 20000 });
library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library[0].duration, 20);

const beforeFailure = library.length;
window.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
await api.handleStarted({
  ...detail,
  playingURI: 'spotify:track:11dFghVXANMlKmJXsNCbNl',
});
library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, beforeFailure, 'metadata failure must not create a malformed row');

console.log('spotify played-track library contract: ok');
