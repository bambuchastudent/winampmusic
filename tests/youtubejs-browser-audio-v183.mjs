import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const loader = fs.readFileSync('fast-release-v150.js', 'utf8');

assert.match(loader, /youtubejs-audio-first-v181\.js\?v=183/);
assert.match(runtime, /youtubei\.js@18\.0\.0\/web/);
assert.match(runtime, /corsproxy\.io/);
assert.match(runtime, /Innertube\.create\(\{[\s\S]*fetch:/);
assert.match(runtime, /generate_session_locally:\s*true/);
assert.match(runtime, /type:\s*['"]audio['"]/);
assert.match(runtime, /quality:\s*['"]best['"]/);
assert.match(runtime, /authorization/i);
assert.match(runtime, /cookie/i);
assert.match(runtime, /primeAudio/i);
assert.match(runtime, /PLAYING · YOUTUBEJS · AUDIO/);
assert.match(runtime, /YOUTUBE · FALLBACK/);
assert.doesNotMatch(runtime, /track\.(title|artist|origin|sourceUrl)\s*=/);

const primeAt = runtime.indexOf('primeAudio');
const resolveAt = runtime.indexOf('await resolveAudio');
assert.ok(primeAt >= 0 && resolveAt > primeAt, 'audio priming must happen before asynchronous resolution');

console.log('YouTube.js browser audio v1.8.3 contract OK');
