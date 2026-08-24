import assert from 'node:assert/strict';
import fs from 'node:fs';

const playback = fs.readFileSync('clean-playback-v150.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const visualizer = fs.readFileSync('header-visualizer-v159.js', 'utf8');

const resolvePos = playback.indexOf('const payload = await fetchStreamPayload(videoId)');
const pausePos = playback.indexOf('pauseLegacyIfPlaying();', playback.indexOf('async function playDirectIndex'));
const updatePos = playback.indexOf('updateNow(track, safeIndex)', playback.indexOf('async function playDirectIndex'));
assert.ok(resolvePos >= 0, 'direct playback still resolves a stream payload');
assert.ok(pausePos > resolvePos, 'existing playback is paused only after a replacement stream is resolved');
assert.ok(updatePos > resolvePos, 'Now Playing switches only after a replacement stream is resolved');

assert.match(html, /class="brand-bottle-link"[^>]+href="https:\/\/github\.com\/bambuchastudent\/winampmusic"/);
assert.match(html, /brand-bottle-link[\s\S]*?bottle15[\s\S]*?<h1>Ámpula MP<\/h1>/);
assert.doesNotMatch(html, /class="brand-github"/);
assert.match(html, /class="app-version-link"[^>]+href="https:\/\/github\.com\/bambuchastudent\/winampmusic"[^>]*>1\.5<\/a>/);
assert.match(html, /id="headerSpectrum"/);
assert.match(html, /header-visualizer-v159\.js\?v=159/);
assert.match(visualizer, /MutationObserver/);
assert.match(visualizer, /data-playing/);

console.log('Now Playing + header polish v1.5.9 contract: OK');
