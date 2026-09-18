import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const fast = fs.readFileSync('fast-player-v141.js', 'utf8');
const loader = fs.readFileSync('fast-release-v150.js', 'utf8');

for (const source of [runtime, fast, loader]) {
  assert.match(source, /playback/);
  assert.match(source, /youtubejs/);
}

assert.match(fast, /YOUTUBEJS_ONLY/);
assert.match(fast, /YOUTUBEJS ONLY · WAITING FOR ADAPTER/);
assert.match(fast, /if \(YOUTUBEJS_ONLY\)[\s\S]*return window\.playIndex/);
assert.match(fast, /if \(!YOUTUBEJS_ONLY\)[\s\S]*ensurePlayer\(\)/);

assert.match(runtime, /YOUTUBEJS_ONLY/);
assert.match(runtime, /YOUTUBEJS ERROR/);
assert.match(runtime, /if \(YOUTUBEJS_ONLY\)[\s\S]*return false/);
assert.match(runtime, /stopImmediatePropagation/);
assert.doesNotMatch(runtime, /track\.(title|artist|origin|sourceUrl)\s*=/);

assert.match(loader, /if \(YOUTUBEJS_ONLY\)[\s\S]*loadYoutubeJsAudioFirst\(\)/);
assert.match(loader, /if \(!YOUTUBEJS_ONLY\)[\s\S]*loadYoutubeEmbedRetry\(\)/);
assert.match(loader, /youtubejs-audio-first-v181\.js\?v=184/);

console.log('YouTube.js-only v1.8.4 contract OK');
