import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const fast = fs.readFileSync('fast-player-v141.js', 'utf8');
const loader = fs.readFileSync('fast-release-v150.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

for (const source of [runtime, loader]) {
  assert.match(source, /playback/);
  assert.match(source, /youtubejs/);
}

assert.match(index, /__AMPULA_YOUTUBEJS_ONLY__=new URLSearchParams\(location\.search\)/);
assert.match(fast, /if\(window\.__AMPULA_YOUTUBEJS_ONLY__\)return false/);
assert.match(fast, /if\(!window\.__AMPULA_YOUTUBEJS_ONLY__\)scheduleIdle/);

assert.match(runtime, /YOUTUBEJS_ONLY/);
assert.match(runtime, /YOUTUBEJS ERROR/);
assert.match(runtime, /test\.cors\.workers\.dev/);
assert.match(runtime, /corsproxy\.io/);
assert.match(runtime, /seep\.eu\.org/);
assert.match(runtime, /youtubei\.googleapis\.com/);
assert.match(runtime, /url:\s*format\.url/);
assert.doesNotMatch(runtime, /audio\.crossOrigin/);
assert.match(runtime, /if \(YOUTUBEJS_ONLY\)[\s\S]*return false/);
assert.match(runtime, /stopImmediatePropagation/);
assert.doesNotMatch(runtime, /track\.(title|artist|origin|sourceUrl)\s*=/);

assert.match(loader, /if \(YOUTUBEJS_ONLY\)[\s\S]*loadYoutubeJsAudioFirst\(\)/);
assert.match(loader, /if \(!YOUTUBEJS_ONLY\)[\s\S]*loadYoutubeEmbedRetry\(\)/);
assert.match(loader, /youtubejs-audio-first-v181\.js\?v=184/);

console.log('YouTube.js-only v1.8.4 contract OK');
