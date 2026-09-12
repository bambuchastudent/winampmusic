import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../spotify-origin-import-v162.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><body>
  <div id="status">READY</div>
  <div id="fastImportHint"></div>
  <form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton">Search</button></form>
  <ol id="trackList"></ol>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});

const { window } = dom;
const STORAGE_KEY = 'winampmusic.library.v1';
const PLAYLIST_ID = '3A4l0emm89zzee5bzE7E0L';
const TOTAL = 160;

function apiTrack(index) {
  const n = index + 1;
  const id = `SP${String(n).padStart(20, '0')}`;
  return {
    id,
    name: `Track ${n}`,
    artists: [{ name: `Artist ${n}` }],
    duration_ms: 180000 + n,
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
  };
}

function primaryTrack(index) {
  const track = apiTrack(index);
  return {
    id: track.id,
    title: track.name,
    artist: track.artists[0].name,
    duration_ms: track.duration_ms,
    url: track.external_urls.spotify,
  };
}

window.importTracks = (incoming) => {
  const library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  let added = 0;
  for (const item of incoming) {
    const known = library.findIndex((row) => row.spotifyTrackId === item.spotifyTrackId);
    if (known >= 0) {
      library[known] = { ...library[known], ...item, id: library[known].id };
      continue;
    }
    library.push({ ...item, id: `U-${String(library.length + 1).padStart(10, '0')}` });
    added += 1;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  return { added, total: library.length };
};
window.renderLibrary = () => {};
window.ampMusicOriginPlayback151 = { refresh() {} };
window.ampulaPlaybackPrefetch165 = { resolveAll: async () => [] };

const requests = [];
window.fetch = async (input) => {
  const url = new URL(String(input));
  requests.push(url.toString());

  if (url.hostname === 'spotify.xwolf.space' && url.pathname === `/api/playlist/${PLAYLIST_ID}`) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        source: 'embed',
        playlist: {
          id: PLAYLIST_ID,
          name: 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)',
          owner: 'your own kind of music',
          tracks: Array.from({ length: 100 }, (_, index) => primaryTrack(index)),
        },
      }),
    };
  }

  if (url.hostname === 'spotify.xwolf.space' && url.pathname === '/api/token') {
    return { ok: true, json: async () => ({ access_token: 'anonymous-test-token' }) };
  }

  if (url.hostname === 'api.spotify.com' && url.pathname === `/v1/playlists/${PLAYLIST_ID}`) {
    return {
      ok: true,
      json: async () => ({
        id: PLAYLIST_ID,
        name: 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)',
        owner: { display_name: 'your own kind of music' },
      }),
    };
  }

  if (url.hostname === 'api.spotify.com' && url.pathname === `/v1/playlists/${PLAYLIST_ID}/tracks`) {
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 50);
    const remaining = Math.max(0, TOTAL - offset);
    const count = Math.min(limit, remaining);
    const items = Array.from({ length: count }, (_, index) => ({ track: apiTrack(offset + index) }));
    const nextOffset = offset + count;
    return {
      ok: true,
      json: async () => ({
        items,
        total: TOTAL,
        next: nextOffset < TOTAL ? `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?offset=${nextOffset}` : null,
      }),
    };
  }

  throw new Error(`unexpected request: ${url}`);
};

window.eval(source);
const api = window.ampulaSpotifyOrigin162;
assert.ok(api, 'Spotify origin importer must install');

const states = [];
const result = await api.importPlaylist(`https://open.spotify.com/playlist/${PLAYLIST_ID}`, {
  play: false,
  onStatus: (state) => states.push(state),
});
assert.equal(result.handled, true);
assert.equal(result.error, undefined);
assert.equal(result.metadata.tracks.length, TOTAL, 'a successful 100-row primary response must be completed to all 160 tracks');
await result.resolution;

const library = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
assert.equal(library.length, TOTAL, 'all Spotify-origin recordings must be imported');
assert.equal(library[0].title, 'Track 1');
assert.equal(library[99].title, 'Track 100');
assert.equal(library[100].title, 'Track 101');
assert.equal(library[159].title, 'Track 160');
assert.equal(library[159].artist, 'Artist 160');
assert.equal(library[159].spotifyPlaylistId, PLAYLIST_ID);
assert.deepEqual(library[159].badges, ['Spotify', 'Origin']);
assert.equal(library[159].youtubeMatchId, undefined, 'metadata completion must not inject playback identity');

const pageOffsets = requests
  .filter((value) => value.includes(`api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks`))
  .map((value) => Number(new URL(value).searchParams.get('offset')));
assert.deepEqual(pageOffsets, [0, 50, 100, 150], 'completion must paginate through the full Spotify track set');
assert.ok(requests.some((value) => value === 'https://spotify.xwolf.space/api/token'), 'capped primary metadata must trigger completion path');
assert.ok(states.some((state) => state.phase === 'imported' && /160 tracks imported/.test(state.message)));

console.log('Spotify complete playlist v1.7.12: 100-row primary -> 160 rows imported');
dom.window.close();