import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const worker = fs.readFileSync('relay/short-link/worker.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/background-media-session-v114.yml', 'utf8');

assert.match(runtime, /AMPULA_SHORT_LINK_RELAY/);
assert.match(runtime, /\/youtubejs\//);
assert.match(runtime, /first-party/i);
assert.match(runtime, /url:\s*format\.url/);
assert.doesNotMatch(runtime, /track\.(title|artist|origin|sourceUrl)\s*=/);

assert.match(worker, /\/youtubejs\//);
assert.match(worker, /__host/);
assert.match(worker, /youtubei\.googleapis\.com/);
assert.match(worker, /googlevideo\.com/);
assert.match(worker, /authorization/i);
assert.match(worker, /cookie/i);
assert.match(worker, /proxy-authorization/i);
assert.match(worker, /status:\s*403/);
assert.match(worker, /GET,POST,HEAD,OPTIONS/);

assert.match(workflow, /youtubejs-first-party-relay-v185\.mjs/);

console.log('YouTube.js first-party relay v1.8.5 contract OK');
