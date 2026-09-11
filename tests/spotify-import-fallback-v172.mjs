import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><body>
  <div id="fastImportHint"></div>
  <form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton">Search</button></form>
  <ol id="trackList"></ol>
</body>`, { url: 'https://bambuchastudent.github.io/winampmusic/', runScripts: 'outside-only' });
const { window } = dom;
const STORAGE_KEY = 'winampmusic.library.v1';
const PLAYLIST_ID = '3A4l0emm89zzee5bzE7E0L';
const calls = [];
const states = [];
let matcherCalls = 0;

window.ampMusicRecordingId = (title, artist) => `U-${String(title).toLowerCase()}-${String(artist).toLowerCase()}`;
window.importTracks = (incoming) => {
  const library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  for (const item of incoming) {
    const known = library.findIndex((track) => track.spotifyTrackId && track.spotifyTrackId === item.spotifyTrackId);
    if (known >= 0) continue;
    library.push({ ...item, id: window.ampMusicRecordingId(item.title, item.artist) });
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  return { added: incoming.length, total: library.length };
};
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
window.winampMusicAppleImport = { findYouTubeMatch: async () => { matcherCalls += 1; return null; } };

const spotifyTracks = Array.from({ length: 51 }, (_, index) => ({
  id: `spotify-track-${String(index + 1).padStart(2, '0')}`,
  name: `Fallback Track ${index + 1}`,
  artists: [{ name: `Artist ${index + 1}` }],
  duration_ms: 180000 + index * 1000,
  external_urls: { spotify: `https://open.spotify.com/track/spotify-track-${String(index + 1).padStart(2, '0')}` },
}));

window.fetch = async (rawUrl, options = {}) => {
  const url = new URL(String(rawUrl));
  calls.push({ url: url.toString(), authorization: options.headers?.Authorization || options.headers?.authorization || '' });

  if (url.hostname === 'spotify.xwolf.space' && url.pathname.startsWith('/api/playlist/')) {
    throw new window.DOMException('primary adapter stalled', 'AbortError');
  }
  if (url.hostname === 'spotify.xwolf.space' && url.pathname === '/api/token') {
    return { ok: true, status: 200, json: async () => ({ success: true, access_token: 'anonymous-token' }) };
  }
  if (url.hostname === 'api.spotify.com' && url.pathname === `/v1/playlists/${PLAYLIST_ID}`) {
    assert.equal(options.headers?.Authorization, 'Bearer anonymous-token');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: PLAYLIST_ID,
        name: 'Fallback Playlist',
        owner: { display_name: 'Fallback Owner', id: 'fallback-owner' },
      }),
    };
  }
  if (url.hostname === 'api.spotify.com' && url.pathname === `/v1/playlists/${PLAYLIST_ID}/tracks`) {
    assert.equal(options.headers?.Authorization, 'Bearer anonymous-token');
    const offset = Number(url.searchParams.get('offset') || 0);
    const page = offset === 0 ? spotifyTracks.slice(0, 50) : spotifyTracks.slice(50);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: page.map((track) => ({ track })),
        total: spotifyTracks.length,
        next: offset === 0 ? 'next-page' : null,
      }),
    };
  }
  throw new Error(`unexpected fetch ${url}`);
};

window.eval(source);
const api = window.ampulaSpotifyOrigin162;
assert.ok(api, 'Spotify origin API should install');
const result = await api.importPlaylist(`https://open.spotify.com/playlist/${PLAYLIST_ID}`, {
  play: false,
  onStatus: (state) => states.push(state),
});

assert.equal(result.handled, true);
assert.ok(!result.error, 'fallback should recover a failed primary request');
let library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, 51, 'fallback must paginate beyond the first 50 Spotify items');
assert.equal(library[0].title, 'Fallback Track 1');
assert.equal(library[0].artist, 'Artist 1');
assert.equal(library[0].spotifyTrackId, 'spotify-track-01');
assert.equal(library[50].spotifyTrackId, 'spotify-track-51');
assert.equal(library[0].spotifyPlaylistId, PLAYLIST_ID);
assert.equal(library[0].spotifyPlaylistTitle, 'Fallback Playlist');
assert.equal(library[0].spotifyPlaylistOwner, 'Fallback Owner');
assert.ok(states.some((state) => state.phase === 'retrying' && state.message === 'Spotify metadata retry…'));
assert.ok(calls.some((call) => call.url === 'https://spotify.xwolf.space/api/token'));
assert.equal(calls.filter((call) => call.url.includes('/tracks?')).length, 2, 'fallback must request the second page');

const resolution = await result.resolution;
assert.equal(resolution.matched, 0, 'unmatched rows stay unresolved instead of accepting weak playback');
assert.equal(resolution.total, 51);
assert.equal(resolution.strategy, 'background-all+on-demand');
assert.equal(matcherCalls, 51, 'background resolver must attempt every unresolved imported track');
library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, 51);
assert.match(library[0].id, /^U-/, 'failed playback resolution preserves the unresolved recording id');
assert.equal(library[0].title, 'Fallback Track 1');
assert.equal(library[0].artist, 'Artist 1');
assert.equal(library[0].youtubeMatchId, undefined);

console.log('Spotify playlist metadata fallback + full-library resolution v1.7.5: ok');
dom.window.close();