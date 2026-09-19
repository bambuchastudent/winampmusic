import assert from 'node:assert/strict';
import fs from 'node:fs';

const shortWorker = fs.readFileSync('relay/short-link/worker.js', 'utf8');
const playbackWorker = fs.readFileSync('relay/youtubejs/worker.js', 'utf8');
const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const loader = fs.readFileSync('fast-release-v150.js', 'utf8');
const config = fs.readFileSync('youtubejs-relay-config.js', 'utf8');
const generator = fs.readFileSync('scripts/generate-youtubejs-relay-config.mjs', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

assert.doesNotMatch(shortWorker, /youtube/i, 'short-link relay must stay provider-agnostic');
assert.doesNotMatch(shortWorker, /googlevideo/i, 'short-link relay must stay provider-agnostic');

assert.match(playbackWorker, /\/youtubejs\//);
assert.match(playbackWorker, /youtubei\.googleapis\.com/);
assert.match(playbackWorker, /googlevideo\.com/);
assert.match(playbackWorker, /GET,POST,HEAD,OPTIONS/);
assert.match(playbackWorker, /authorization/i);
assert.match(playbackWorker, /cookie/i);
assert.match(playbackWorker, /status:\s*403/);

assert.match(config, /AMPULA_YOUTUBEJS_RELAY/);
assert.match(generator, /AMPULA_YOUTUBEJS_RELAY/);
assert.match(runtime, /AMPULA_YOUTUBEJS_RELAY/);
assert.doesNotMatch(runtime, /AMPULA_SHORT_LINK_RELAY/);
assert.match(loader, /youtubejs-relay-config\.js/);

assert.match(loader, /config\.src = '\.\/youtubejs-relay-config\.js\?v=186'/);
assert.match(loader, /config\.addEventListener\('load', ready[\s\S]*document\.head\.appendChild\(config\)/);
assert.match(loader, /const ready = \(\) => \{[\s\S]*start\(\); \}/);
assert.match(loader, /if \(window\.__AMPULA_YOUTUBEJS_RELAY_CONFIG_READY__\) return start\(\)/);

assert.match(pages, /workingDirectory:\s*relay\/youtubejs/);
assert.match(pages, /generate-youtubejs-relay-config\.mjs/);
assert.match(pages, /youtubejs-relay-config\.js/);

const moduleUrl = `data:text/javascript;base64,${Buffer.from(playbackWorker).toString('base64')}`;
const worker = (await import(moduleUrl)).default;
const env = { APP_URL: 'https://bambuchastudent.github.io/winampmusic/' };
const originalFetch = globalThis.fetch;
let upstream = null;
let upstreamInit = null;

try {
  globalThis.fetch = async (input, init) => {
    upstream = input instanceof URL ? input : new URL(String(input));
    upstreamInit = init;
    return new Response('{"status":"OK"}', { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'no=1' } });
  };

  const response = await worker.fetch(new Request(
    'https://relay.example/youtubejs/youtubei/v1/player?prettyPrint=false&__host=www.youtube.com',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': 'key',
        authorization: 'Bearer no',
        cookie: 'SID=no',
      },
      body: '{"videoId":"M7lc1UVf-VE"}',
    },
  ), env);

  assert.equal(response.status, 200);
  assert.equal(upstream.hostname, 'www.youtube.com');
  assert.equal(upstream.pathname, '/youtubei/v1/player');
  assert.equal(upstream.searchParams.has('__host'), false);
  assert.equal(upstreamInit.headers.get('x-goog-api-key'), 'key');
  assert.equal(upstreamInit.headers.get('authorization'), null);
  assert.equal(upstreamInit.headers.get('cookie'), null);
  assert.equal(response.headers.get('set-cookie'), null);

  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not fetch'); };
  const blocked = await worker.fetch(new Request('https://relay.example/youtubejs/x?__host=example.com'), env);
  assert.equal(blocked.status, 403);
  assert.equal(called, false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('YouTube.js dedicated relay v1.8.6 contract OK');
