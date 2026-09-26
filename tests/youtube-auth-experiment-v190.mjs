import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createExperiment, makeTvFetch } from '../experiments/youtube-auth/experiment.mjs';
import worker from '../relay/youtube-auth/worker.js';

const origin = 'https://operator.example';
const base = 'https://isolated-relay.example';
const sentinel = {
  clientId: 'operator.apps.googleusercontent.com', secret: 'own-secret',
  device: 'DEVICE_CODE_PRIVATE', user: 'USER-CODE', access: 'ACCESS_TOKEN_PRIVATE',
  refresh: 'REFRESH_TOKEN_PRIVATE', media: 'https://signed.googlevideo.com/videoplayback?sig=PRIVATE',
};
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const deviceResponse = { device_code: sentinel.device, user_code: sentinel.user, verification_url: 'https://www.google.com/device', interval: 5, expires_in: 600 };
const tokenResponse = { access_token: sentinel.access, refresh_token: sentinel.refresh, expires_in: 3600, token_type: 'Bearer' };
const calls = [];
let tokenReply = response({ error: 'authorization_pending' }, 428);
const mockFetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith('/oauth/device')) return response(deviceResponse);
  if (String(url).endsWith('/oauth/token')) return typeof tokenReply === 'function' ? tokenReply() : tokenReply;
  if (String(url).endsWith('/oauth/revoke')) return response({ revoked: true });
  throw Error('unexpected transport');
};
let clock = 100_000;
const make = (overrides = {}) => createExperiment({ base, clientId: sentinel.clientId, clientSecret: sentinel.secret, fetchImpl: mockFetch, now: () => clock, ...overrides });

const first = make();
assert.equal(first.report().oauth, 'not_started');
assert.equal((await first.start()).user_code, sentinel.user);
assert.equal(first.report().oauth, 'pending');
assert.equal((await first.pollOnce()).oauth, 'pending');
assert.equal(calls.filter((call) => call.url.endsWith('/oauth/token')).length, 0, 'poll respects provider interval');
clock += 5000;
assert.equal((await first.pollOnce()).oauth, 'pending');
first.cancel();
assert.equal(first.report().oauth, 'canceled');

let completePoll;
tokenReply = new Promise((resolve) => { completePoll = resolve; });
const delayed = make();
await delayed.start();
clock += 5000;
const pending = delayed.pollOnce();
delayed.cancel();
completePoll(response(tokenResponse));
await pending;
assert.equal(delayed.report().oauth, 'canceled', 'late poll cannot resurrect authorization');

tokenReply = () => response(tokenResponse);
const another = make();
await another.start();
clock += 5000;
await another.pollOnce();
assert.equal(another.report().oauth, 'authorized');
assert.equal(first.report().oauth, 'canceled', 'two controllers never share tokens');
assert.deepEqual(another.pending(), null, 'user code is removed after authorization');
const probeCalls = [];
const compared = make({ probe: async (id, credentials) => {
  probeCalls.push({ id, credentials });
  return credentials
    ? { provider: 'rejected', playability: 'LOGIN_REQUIRED', audioFormats: 0, stream: 'unavailable' }
    : { provider: 'anonymous', playability: 'LOGIN_REQUIRED', audioFormats: 0, stream: 'unavailable' };
} });
await compared.start();
clock += 5000;
await compared.pollOnce();
const report = await compared.compare('dQw4w9WgXcQ');
assert.equal(report.oauth, 'authorized');
assert.equal(report.authorized.provider, 'rejected', 'Google OAuth success is independent from TV acceptance');
assert.equal(probeCalls[0].credentials, null);
assert.equal(probeCalls[1].credentials.access_token, sentinel.access);
assert.equal(probeCalls[1].credentials.client.client_id, sentinel.clientId);
assert.equal(report.authorized.stream, 'untested', 'metadata result cannot claim media availability');
assert.rejects(() => compared.compare('https://youtube.com/watch?v=dQw4w9WgXcQ'), /invalid_video_id/);
const serialized = JSON.stringify(report);
for (const value of [sentinel.access, sentinel.refresh, sentinel.secret, sentinel.device, sentinel.user, sentinel.media]) assert.ok(!serialized.includes(value), 'report contains no secrets');

let releaseRefresh;
tokenReply = new Promise((resolve) => { releaseRefresh = resolve; });
const refreshPending = compared.refresh();
const logoutPending = compared.logout();
releaseRefresh(response({ access_token: 'LATE_ACCESS', expires_in: 3600 }));
await refreshPending;
await logoutPending;
assert.equal(compared.report().oauth, 'signed_out');
assert.ok(!JSON.stringify(compared.report()).includes('LATE_ACCESS'));

tokenReply = () => response(tokenResponse);
let finishAuthorized;
const racing = make({ probe: async (_id, credentials) => credentials
  ? new Promise((resolve) => { finishAuthorized = resolve; })
  : { provider: 'anonymous', playability: 'OK', audioFormats: 1, stream: 'untested' } });
await racing.start(); clock += 5000; await racing.pollOnce();
const racingProbe = racing.compare('dQw4w9WgXcQ');
while (!finishAuthorized) await Promise.resolve();
await racing.logout();
finishAuthorized({ provider: 'accepted', playability: 'OK', audioFormats: 1, stream: 'untested' });
await racingProbe;
assert.equal(racing.report().authorized, null, 'late authorized probe cannot overwrite logout');

let releaseBeforeFetch;
let lateFetches = 0;
const canceling = make({ probe: async (_id, credentials, relay, _fetch, signal) => {
  if (!credentials) return { provider: 'anonymous', playability: 'OK', audioFormats: 1 };
  await new Promise((resolve) => { releaseBeforeFetch = resolve; });
  await makeTvFetch(relay, async () => { ++lateFetches; return response({}); }, signal)(
    'https://www.youtube.com/youtubei/v1/player', { method: 'POST', body: '{}' });
  return { provider: 'unknown', playability: 'OK', audioFormats: 1 };
} });
await canceling.start(); clock += 5000; await canceling.pollOnce();
const cancelProbe = canceling.compare('dQw4w9WgXcQ');
while (!releaseBeforeFetch) await Promise.resolve();
canceling.cancel(); releaseBeforeFetch(); await cancelProbe;
assert.equal(lateFetches, 0, 'canceled probe cannot start a TV fetch after delayed setup');
assert.equal(canceling.report().authorizedBearerSent, false);

let slowPolls = 0;
const slow = make({ fetchImpl: async (url) => String(url).endsWith('/oauth/device')
  ? response({ ...deviceResponse, interval: 120 })
  : (slowPolls++, response(tokenResponse)) });
await slow.start();
clock += 60_000;
await slow.pollOnce();
assert.equal(slowPolls, 0, 'interval above one minute is not shortened');
clock += 60_000;
await slow.pollOnce();
assert.equal(slowPolls, 1);
const failing = make({ probe: async () => { throw Error(`opaque ${sentinel.media}`); } });
assert.equal((await failing.compare('dQw4w9WgXcQ')).anonymous.error, 'probe_failed');
assert.ok(!JSON.stringify(failing.report()).includes(sentinel.media));

const tvSent = [];
const tvFetch = makeTvFetch(base, async (url, init) => { tvSent.push({ url, init }); return response({ playabilityStatus: { status: 'OK' } }); });
await tvFetch('https://www.youtube.com/youtubei/v1/player?key=ABC123', { method: 'POST', headers: { authorization: `Bearer ${sentinel.access}`, cookie: 'BAD', 'x-youtube-client-name': '7' }, body: '{}' });
assert.equal(tvSent.length, 1);
assert.equal(new URL(tvSent[0].url).pathname, '/tv/player');
assert.equal(tvSent[0].init.headers.get('authorization'), `Bearer ${sentinel.access}`);
assert.equal(tvSent[0].init.headers.get('cookie'), null);
await assert.rejects(() => tvFetch('https://example.com/youtubei/v1/player', { method: 'POST' }), /disallowed_tv_target/);
await assert.rejects(() => tvFetch('https://www.youtube.com/youtubei/v1/browse', { method: 'POST' }), /disallowed_tv_target/);

const upstream = [];
const previousFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { upstream.push({ url: String(url), init }); return response({ device_code: sentinel.device, user_code: sentinel.user, verification_url: 'https://www.google.com/device', expires_in: 600, interval: 5 }); };
try {
  const env = { APP_ORIGIN: origin };
  const request = (path, body, headers = {}, method = 'POST') => worker.fetch(new Request(`${base}${path}`, {
    method, headers: { origin, 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  }), env);
  const good = await request('/oauth/device', { client_id: sentinel.clientId });
  assert.equal(good.status, 200);
  assert.equal(upstream[0].url, 'https://oauth2.googleapis.com/device/code');
  assert.equal(upstream[0].init.redirect, 'manual');
  assert.equal(upstream[0].init.headers.get('authorization'), null);
  assert.equal(upstream[0].init.headers.get('cookie'), null);
  assert.equal(upstream[0].init.body.get('scope'), 'https://www.googleapis.com/auth/youtube.readonly');
  globalThis.fetch = async (url, init) => { upstream.push({ url: String(url), init }); return response({ ...deviceResponse, interval: 120 }); };
  assert.equal((await (await request('/oauth/device', { client_id: sentinel.clientId })).json()).interval, 120);
  const before = upstream.length;
  for (const [path, body, headers] of [
    ['/oauth/device', { client_id: sentinel.clientId }, { origin: 'https://evil.example' }],
    ['/oauth/device', { client_id: sentinel.clientId }, { origin: '' }],
    ['/oauth/device', { client_id: sentinel.clientId, token: sentinel.access }, {}],
    ['/oauth/token', { client_id: sentinel.clientId, grant_type: 'password', password: sentinel.secret }, {}],
    ['/tv/other', {}, {}], ['/tv/player?token=PRIVATE', {}, {}],
    ['/tv/player', {}, { cookie: 'PRIVATE' }],
  ]) {
    const rejected = await request(path, body, headers);
    assert.ok(rejected.status >= 400);
    assert.ok(!JSON.stringify(await rejected.json()).includes('PRIVATE'));
  }
  assert.equal(upstream.length, before, 'rejected requests never reach upstream');
  globalThis.fetch = async (url, init) => { upstream.push({ url: String(url), init }); return response({ access_token: 'REFRESH_ACCESS', expires_in: 3600 }); };
  const refreshed = await request('/oauth/token', { client_id: sentinel.clientId, client_secret: sentinel.secret, grant_type: 'refresh_token', refresh_token: sentinel.refresh });
  assert.equal(refreshed.status, 200, 'refresh response need not rotate refresh token');
  assert.equal((await refreshed.json()).refresh_token, undefined);
  const missingToken = await request('/oauth/token', { client_id: sentinel.clientId, client_secret: sentinel.secret, grant_type: 'refresh_token', refresh_token: undefined });
  assert.ok(missingToken.status >= 400);
  globalThis.fetch = async (url, init) => { upstream.push({ url: String(url), init }); return new Response('', { status: 200 }); };
  assert.equal((await request('/oauth/revoke', { token: sentinel.refresh })).status, 200, 'empty successful revoke response is valid');
  globalThis.fetch = async (url, init) => { upstream.push({ url: String(url), init }); return response({ playabilityStatus: { status: 'LOGIN_REQUIRED' }, streamingData: { adaptiveFormats: [{ url: sentinel.media }] } }); };
  const tv = await request('/tv/player?key=ABC123', { videoId: 'dQw4w9WgXcQ' }, { authorization: `Bearer ${sentinel.access}`, 'x-youtube-client-name': '7' });
  assert.equal(tv.status, 200);
  assert.equal(upstream.at(-1).url, 'https://www.youtube.com/youtubei/v1/player?key=ABC123');
  assert.equal(upstream.at(-1).init.headers.get('authorization'), `Bearer ${sentinel.access}`);
  assert.equal(upstream.at(-1).init.headers.get('cookie'), null);
  assert.equal(tv.headers.get('cache-control'), 'no-store');
} finally { globalThis.fetch = previousFetch; }

const html = fs.readFileSync(new URL('../experiments/youtube-auth/index.html', import.meta.url), 'utf8');
assert.match(html, /type="module"/);
assert.doesNotMatch(html, /localStorage|sessionStorage|fallback proxy|cookie input/i);
const dom = new JSDOM(html, { url: origin, runScripts: 'outside-only' });
const created = [];
dom.window.createExperimentMock = (settings) => {
  const instance = {
    canceled: false,
    state: { oauth: 'not_started', stage: 'idle', playback: 'untested' },
    report() { return this.state; }, pending() { return null; },
    async start() { this.state = { ...this.state, oauth: 'pending' }; return null; },
    cancel() { this.canceled = true; this.state = { ...this.state, oauth: 'canceled' }; },
    async logout() {}, async pollOnce() {}, async compare() { this.state = { ...this.state, stage: 'complete' }; },
  };
  created.push({ settings, instance });
  return instance;
};
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
dom.window.eval(script.replace("import { createExperiment } from './experiment.mjs';", 'const createExperiment = window.createExperimentMock;'));
const field = (id) => dom.window.document.getElementById(id);
field('relay').value = base;
field('client').value = sentinel.clientId;
field('secret').value = sentinel.secret;
field('start').click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(created[0].settings.clientSecret, sentinel.secret, 'UI sends entered secret to controller');
assert.equal(field('secret').value, '', 'UI clears secret input');
field('start').click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(created[0].instance.canceled, true, 'starting over discards previous controller');
field('cancel').click();
assert.equal(created[1].instance.canceled, true);
assert.equal(field('code').textContent, '');
assert.equal(field('export').disabled, true);
dom.window.close();
console.log('youtube-auth-experiment-v190: behavior contracts passed');
