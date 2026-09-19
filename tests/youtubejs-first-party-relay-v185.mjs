import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const workerSource = fs.readFileSync('relay/short-link/worker.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/background-media-session-v114.yml', 'utf8');

assert.match(runtime, /AMPULA_SHORT_LINK_RELAY/);
assert.match(runtime, /youtubejs/);
assert.match(runtime, /first-party/i);
assert.match(runtime, /url:\s*format\.url/);
assert.doesNotMatch(runtime, /track\.(title|artist|origin|sourceUrl)\s*=/);

assert.match(workerSource, /\/youtubejs\//);
assert.match(workerSource, /__host/);
assert.match(workerSource, /youtubei\.googleapis\.com/);
assert.match(workerSource, /googlevideo\.com/);
assert.match(workerSource, /authorization/i);
assert.match(workerSource, /cookie/i);
assert.match(workerSource, /proxy-authorization/i);
assert.match(workerSource, /status:\s*403/);
assert.match(workerSource, /GET,POST,HEAD,OPTIONS/);

assert.match(workflow, /youtubejs-first-party-relay-v185\.mjs/);

const workerModuleUrl = `data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`;
const worker = (await import(workerModuleUrl)).default;
const env = { APP_URL: 'https://bambuchastudent.github.io/winampmusic/' };
const originalFetch = globalThis.fetch;
let upstream = null;
let upstreamInit = null;

try {
  globalThis.fetch = async (input, init) => {
    upstream = input instanceof URL ? input : new URL(String(input));
    upstreamInit = init;
    return new Response('{"playabilityStatus":{"status":"OK"}}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '37',
        'set-cookie': 'must-not-leak=1',
      },
    });
  };

  const request = new Request(
    'https://ampula-relay.example/youtubejs/youtubei/v1/player?prettyPrint=false&__host=www.youtube.com',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': 'test-api-key',
        'x-youtube-client-name': '1',
        authorization: 'Bearer must-not-forward',
        cookie: 'SID=must-not-forward',
        'proxy-authorization': 'Basic must-not-forward',
      },
      body: '{"videoId":"M7lc1UVf-VE"}',
    },
  );

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  assert.equal(upstream?.protocol, 'https:');
  assert.equal(upstream?.hostname, 'www.youtube.com');
  assert.equal(upstream?.pathname, '/youtubei/v1/player');
  assert.equal(upstream?.searchParams.get('prettyPrint'), 'false');
  assert.equal(upstream?.searchParams.has('__host'), false);
  assert.equal(upstreamInit?.method, 'POST');
  assert.equal(upstreamInit?.headers.get('x-goog-api-key'), 'test-api-key');
  assert.equal(upstreamInit?.headers.get('authorization'), null);
  assert.equal(upstreamInit?.headers.get('cookie'), null);
  assert.equal(upstreamInit?.headers.get('proxy-authorization'), null);
  assert.equal(new TextDecoder().decode(upstreamInit?.body), '{"videoId":"M7lc1UVf-VE"}');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://bambuchastudent.github.io');
  assert.equal(response.headers.get('set-cookie'), null);

  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not fetch'); };
  const blocked = await worker.fetch(
    new Request('https://ampula-relay.example/youtubejs/private?__host=example.com'),
    env,
  );
  assert.equal(blocked.status, 403);
  assert.equal(called, false);

  const preflight = await worker.fetch(
    new Request('https://ampula-relay.example/youtubejs/youtubei/v1/player?__host=www.youtube.com', { method: 'OPTIONS' }),
    env,
  );
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET,POST,HEAD,OPTIONS/);
  assert.match(preflight.headers.get('access-control-allow-headers') || '', /x-goog-api-key/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('YouTube.js first-party relay v1.8.5 contract OK');
