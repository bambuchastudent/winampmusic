import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../unified-entry-v152.js', import.meta.url), 'utf8');

assert.match(html, /id="fastImportInput"[^>]+type="search"/);
assert.match(html, /Song, artist, or YouTube \/ Apple Music link/);
assert.match(html, /id="search"[^>]+hidden/);
assert.doesNotMatch(html, /<section[^>]+song-search-bar/);

assert.match(adapter, /if \(isSpotifyLike\(value\)\)/);
assert.match(adapter, /ensureSpotifyAdapter/);
assert.match(adapter, /spotify-playlist-core-v160\.js\?v=160/);
assert.match(adapter, /spotify-playlist-embed-v160\.js\?v=160/);
assert.match(adapter, /YouTube \/ Apple Music \/ Spotify link/);
assert.match(adapter, /if \(isUrlLike\(value\)\) return;/);
assert.match(adapter, /event\.stopImmediatePropagation\(\)/);
assert.match(adapter, /script\.src = '\.\/v059\.js\?v=152'/);
assert.match(adapter, /results\.id = 'unifiedSearchResults'/);
assert.match(adapter, /toggle\.textContent = '🔍'/);
assert.match(adapter, /libraryFilter\.dispatchEvent\(new Event\('input'/);

console.log('unified music entry contract: ok');
