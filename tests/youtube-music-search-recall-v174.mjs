import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../apple-music-import-v064.js', import.meta.url), 'utf8');

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="status"></div><div id="songSearchStatus"></div><div id="songSearchResults"></div>
  <form id="songSearchForm"><input id="songSearchInput"></form>
</body></html>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});

const { window } = dom;
const filters = [];
window.console = console;
window.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname === '/search') {
    const filter = url.searchParams.get('filter');
    filters.push(filter);
    const rows = filter === 'music_songs'
      ? [{
          type: 'stream',
          url: 'https://www.youtube.com/watch?v=s1b8Q5avQZs',
          title: 'Madigan - The News',
          uploaderName: 'Madigan - Topic',
          duration: 279,
          thumbnail: '',
        }]
      : [{
          type: 'stream',
          url: 'https://www.youtube.com/watch?v=vuJwrcKQ7Sg',
          title: 'News in the Past: Kathleen Madigan',
          uploaderName: 'Laugh Society - Ladies First',
          duration: 262,
          thumbnail: '',
        }];
    return response({ items: rows });
  }
  if (url.pathname === '/api/v1/search') return response([]);
  const match = url.pathname.match(/^\/api\/v1\/videos\/([A-Za-z0-9_-]{11})$/);
  if (match?.[1] === 's1b8Q5avQZs') {
    return response({
      videoId: match[1],
      title: 'Madigan - The News',
      author: 'Madigan - Topic',
      genre: 'Music',
      description: 'Provided to YouTube by the rights holder',
      keywords: ['music', 'Madigan', 'The News'],
      lengthSeconds: 279,
      liveNow: false,
      musicTracks: [{ song: 'The News', artist: 'Madigan' }],
    });
  }
  return response({ error: 'not found' }, 404);
};

window.eval(source);
const metadata = { title: 'The News', artist: 'Madigan', durationMs: 279000 };
const candidate = await window.winampMusicAppleImport.findYouTubeMatch(
  metadata,
  new window.AbortController().signal,
);

assert.equal(candidate.id, 's1b8Q5avQZs', 'YouTube Music song search must recover the exact music recording');
assert.ok(filters.includes('videos'), 'ordinary video search remains part of discovery');
assert.ok(filters.includes('music_songs'), 'resolver must also query the YouTube Music songs surface');

dom.window.close();
console.log('YouTube music search recall v1.7.4: OK');
