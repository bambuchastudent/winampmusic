import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const matcherSource = readFileSync(new URL('../apple-music-import-v064.js', import.meta.url), 'utf8');
const trustSource = readFileSync(new URL('../resolver-trust-v167.js', import.meta.url), 'utf8');
const recallSource = readFileSync(new URL('../resolver-music-recall-v174.js', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../header-visualizer-v159.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(headerSource, /apple-music-import-v064\.js\?v=175/);
assert.match(headerSource, /resolver-music-recall-v174\.js\?v=175/);
assert.match(swSource, /ampmusic-v1\.7\.11/);
assert.match(swSource, /playback-navigation-v178\.js/);
assert.match(swSource, /playback-bridge-guard-v1711\.js/);
assert.match(recallSource, /TRACK_SEARCH_BUDGET_MS\s*=\s*120000/);
assert.match(recallSource, /REQUEST_TIMEOUT_MS\s*=\s*12000/);
assert.match(recallSource, /\/nextpage\/search/);

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
const requests = [];
window.console = console;
window.fetch = async (input) => {
  const url = new URL(String(input));
  requests.push(`${url.pathname}?${url.searchParams.toString()}`);

  if (url.pathname === '/search') {
    const filter = url.searchParams.get('filter');
    if (filter === 'music_songs') {
      return response({
        items: [{
          type: 'stream',
          url: 'https://www.youtube.com/watch?v=vuJwrcKQ7Sg',
          title: 'News in the Past: Kathleen Madigan',
          uploaderName: 'Laugh Society - Ladies First',
          duration: 262,
          thumbnail: '',
        }],
        nextpage: 'page-two-token',
      });
    }
    return response({
      items: [{
        type: 'stream',
        url: 'https://www.youtube.com/watch?v=vuJwrcKQ7Sg',
        title: 'News in the Past: Kathleen Madigan',
        uploaderName: 'Laugh Society - Ladies First',
        duration: 262,
        thumbnail: '',
      }],
      nextpage: null,
    });
  }

  if (url.pathname === '/nextpage/search' && url.searchParams.get('nextpage') === 'page-two-token') {
    return response({
      items: [{
        type: 'stream',
        url: 'https://www.youtube.com/watch?v=s1b8Q5avQZs',
        title: 'Madigan - The News',
        uploaderName: 'Madigan - Topic',
        duration: 279,
        thumbnail: '',
      }],
      nextpage: null,
    });
  }

  if (url.pathname === '/api/v1/search') return response([]);
  return response({ error: 'not found' }, 404);
};

window.eval(matcherSource);
window.eval(trustSource);
window.eval(recallSource);

const metadata = { title: 'The News', artist: 'Madigan', durationMs: 279000 };
const candidate = await window.winampMusicAppleImport.findYouTubeMatch(
  metadata,
  new window.AbortController().signal,
);

assert.equal(candidate.id, 's1b8Q5avQZs', 'later search pages must recover the exact Madigan recording');
assert.equal(candidate.finalTrustVersion, 'music-only-v1.6.7', 'deeper recall must still pass final trust');
assert.ok(requests.some((value) => value.startsWith('/search?') && value.includes('filter=music_songs')), 'YouTube Music songs search must run');
assert.ok(requests.some((value) => value.startsWith('/nextpage/search?') && value.includes('page-two-token')), 'resolver must follow Piped search pagination');
assert.ok(requests.some((value) => value.startsWith('/search?') && value.includes('filter=videos')), 'generic video discovery remains available');

dom.window.close();
console.log('deep YouTube music recall + queue runtime v1.7.11: OK');
