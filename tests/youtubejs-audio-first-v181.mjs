import fs from 'node:fs';
import assert from 'node:assert/strict';

const loader = fs.readFileSync('fast-release-v150.js', 'utf8');
const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');

assert.match(loader, /youtubejs-audio-first-v181\.js/);
assert.match(runtime, /type:\s*['"]audio['"]/);
assert.match(runtime, /quality:\s*['"]best['"]/);
assert.match(runtime, /YOUTUBEJS/);
assert.match(runtime, /new Audio\(\)/);
assert.match(runtime, /navigator\.mediaSession/);
assert.match(runtime, /fallback/i);
assert.doesNotMatch(runtime, /track\.(title|artist|origin)\s*=/);

console.log('YouTube.js audio-first contract OK');
