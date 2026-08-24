import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const guard = fs.readFileSync('import-playback-guard-v159.js', 'utf8');
const visualizer = fs.readFileSync('header-visualizer-v159.js', 'utf8');

assert.match(guard, /isPlaybackActive/);
assert.match(guard, /play:\s*preserveCurrentPlayback\s*\?\s*false\s*:\s*requestedPlay/);
assert.match(guard, /handleUrl/);
assert.match(guard, /importAlbumUrl/);
assert.match(guard, /importPlaylistUrl/);

assert.match(html, /class="brand-bottle-link"[^>]+href="https:\/\/github\.com\/bambuchastudent\/winampmusic"/);
assert.match(html, /brand-bottle-link[\s\S]*?bottle15[\s\S]*?<h1>Ámpula MP<\/h1>/);
assert.doesNotMatch(html, /class="brand-github"/);
assert.match(html, /class="app-version-link"[^>]+href="https:\/\/github\.com\/bambuchastudent\/winampmusic"[^>]*>1\.5<\/a>/);
assert.match(html, /id="headerSpectrum"/);
assert.match(html, /import-playback-guard-v159\.js\?v=159/);
assert.match(html, /header-visualizer-v159\.js\?v=159/);
assert.match(visualizer, /MutationObserver/);
assert.match(visualizer, /dataset\.playing/);

console.log('Now Playing + header polish v1.5.9 contract: OK');
