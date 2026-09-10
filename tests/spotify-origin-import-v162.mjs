import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><body>
  <div id="status">READY</div>
  <div id="nowTitle"></div><div id="nowArtist"></div>
  <div id="fastImportHint"></div>
  <form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton">Search</button></form>
  <ol id="trackList"></ol>
</body>`, { url: 'https://bambuchastudent.github.io/winampmusic/', runScripts: 'outside-only' });
const { window } = dom;
const STORAGE_KEY = 'winampmusic.library.v1';

function localId(title, artist) {
  return `U-${String(title).toLowerCase()}-${String(artist).toLowerCase()}`;
}

window.importTracks = (incoming) => {
  const library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  let added = 0;
  for (const item of incoming) {
    const known = library.findIndex((track) =>
      (item.spotifyTrackId && track.spotifyTrackId === item.spotifyTrackId)
      || `${track.title}\0${track.artist}` === `${item.title}\0${item.artist}`);
    if (known >= 0) {
      if (/^[A-Za-z0-9_-]{11}$/.test(String(item.id || ''))) library[known].id = item.id;
      continue;
    }
    library.push({ ...item, id: /^[A-Za-z0-9_-]{11}$/.test(String(item.id || '')) ? item.id : localId(item.title, item.artist) });
    added += 1;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  return { added, total: library.length };
};
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
const candidates = new Map([
  ['Better Call Saul Main Title', 'abcdefghijk'],
  ['Address Unknown', 'lmnopqrstuv'],
]);
window.winampMusicAppleImport = {
  findYouTubeMatch: async ({ title, artist, durationMs }) => ({
    id: candidates.get(title), title, artist, duration: Math.round(durationMs / 1000),
  }),
};
window.fetch = async (url) => {
  assert.match(String(url), /spotify\.xwolf\.space\/api\/playlist\/3A4l0emm89zzee5bzE7E0L$/);
  return {
    ok: true,
    json: async () => ({
      success: true,
      source: 'embed',
      playlist: {
        id: '3A4l0emm89zzee5bzE7E0L',
        name: 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)',
        owner: 'your own kind of music',
        tracks: [
          { id: '4cOdK2wGLETKBW3PvgPWqT', title: 'Better Call Saul Main Title', artist: 'Dave Porter', duration_ms: 18000, preview_url: 'https://preview.invalid/one.mp3' },
          { id: '11dFghVXANMlKmJXsNCbNl', title: 'Address Unknown', artist: 'The Ink Spots', duration_ms: 173000, preview_url: 'https://preview.invalid/two.mp3' },
        ],
      },
    }),
  };
};

window.eval(source);
const api = window.ampulaSpotifyOrigin162;
assert.ok(api, 'Spotify origin import API should be exposed');
assert.equal(api.parsePlaylist('https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L?si=abc')?.playlistId, '3A4l0emm89zzee5bzE7E0L');
assert.equal(api.parsePlaylist('https://share.google/T0seuEuCz8Wdpksp3')?.playlistId, '3A4l0emm89zzee5bzE7E0L');

const states = [];
const result = await api.importPlaylist('https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L', {
  play: false,
  onStatus: (state) => states.push(state),
});
assert.equal(result.handled, true);
let library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, 2, 'playlist metadata must become two Ámpula library rows');
assert.equal(library[0].title, 'Better Call Saul Main Title');
assert.equal(library[0].artist, 'Dave Porter');
assert.equal(library[0].spotifyTrackId, '4cOdK2wGLETKBW3PvgPWqT');
assert.equal(library[0].spotifyTrackUrl, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
assert.equal(library[0].spotifyPlaylistUrl, 'https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L');
assert.equal(library[0].spotifyPlaylistTitle, 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)');
assert.equal(library[0].spotifyPlaylistOwner, 'your own kind of music');
assert.equal('preview_url' in library[0], false, 'Spotify preview URLs are metadata noise, not playback');
assert.equal(window.document.querySelector('#spotifySourcePanel'), null, 'Spotify must not create a visible panel');
assert.equal(window.document.querySelector('iframe[src*="spotify"]'), null, 'Spotify must not render an iframe');

const resolution = await result.resolution;
assert.equal(resolution.matched, 2);
assert.equal(resolution.total, 2);
library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library[0].id, 'abcdefghijk');
assert.equal(library[0].youtubeMatchId, 'abcdefghijk');
assert.equal(library[0].playbackProvider, 'youtube');
assert.equal(library[0].title, 'Better Call Saul Main Title', 'Spotify title must survive YouTube resolution');
assert.equal(library[0].artist, 'Dave Porter', 'Spotify artist must survive YouTube resolution');
assert.equal(library[1].id, 'lmnopqrstuv');
assert.ok(states.some((state) => state.phase === 'imported'));
assert.ok(states.some((state) => state.phase === 'done'));

const again = await api.importPlaylist('https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L', { play: false });
await again.resolution;
library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, 2, 're-import must not duplicate Spotify-origin tracks');

console.log('spotify metadata-only origin import contract: ok');
dom.window.close();
