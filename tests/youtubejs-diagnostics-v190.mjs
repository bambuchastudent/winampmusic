import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const dom = new JSDOM(`<!doctype html><html><body><section class="screen">
  <div id="status">READY</div><div id="nowTitle">Song</div><div id="nowArtist">Artist</div>
</section></body></html>`, {
  url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
window.Request = Request;
window.Response = Response;
window.AMPULA_YOUTUBEJS_RELAY = 'https://relay-secret.example/path/';
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const bodyValue = init?.body || (input instanceof Request ? await input.clone().text() : '');
  const body = bodyValue instanceof ArrayBuffer ? new TextDecoder().decode(bodyValue) : String(bodyValue);
  const id = JSON.parse(body || '{}').videoId;
  if (url.hostname === 'relay-secret.example') {
    if (id === 'BBBBBBBBBBB' || id === 'CCCCCCCCCCC') return new Response('unavailable', { status: 502 });
    if (id === 'AAAAAAAAAAA') await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response('{}', { status: 200 });
  }
  if (url.hostname === 'www.youtube.com') return new Response('{}', { status: 200 });
  return new Response('unavailable', { status: 502 });
};
window.Audio = class { addEventListener() {} play() { return Promise.resolve(); } pause() {} load() {} removeAttribute() {} };
window.playIndex = () => 'iframe';
window.eval(source);
const adapter = window.ampulaYouTubeJsAudio181;

function denied(id, reason, status = 'LOGIN_REQUIRED') {
  return {
    async getStreamingData() { throw new Error('Streaming data not available'); },
    async getBasicInfo() {
      await adapter.relayFetch('https://www.youtube.com/youtubei/v1/player?key=URL_SECRET', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'HEADER_SECRET' },
        body: JSON.stringify({ videoId: id, cookie: 'BODY_SECRET' }),
      });
      return { playability_status: { status, reason, error_screen: { reason } }, streaming_data: null };
    },
  };
}

for (const [id, reason, expected, status] of [
  ['AAAAAAAAAAA', "Sign in to confirm you're not a bot", 'BOT_CONFIRMATION_REQUIRED'],
  ['BBBBBBBBBBB', 'This video is age-restricted. Confirm your age.', 'AGE_CONFIRMATION_REQUIRED'],
  ['DDDDDDDDDDD', 'Sign in to continue', 'SIGN_IN_REQUIRED'],
  ['EEEEEEEEEEE', 'Confirmez votre âge: UPSTREAM_SECRET', 'UNKNOWN', 'UNPLAYABLE'],
]) {
  await assert.rejects(adapter.resolveAudio(id, denied(id, reason, status)), /Streaming data not available/);
  const report = adapter.diagnostics();
  assert.equal(report.restrictionCategory, expected);
  assert.ok(Number.isFinite(Date.parse(report.checkedAt)), 'diagnostic timestamp is valid');
  assert.doesNotMatch(JSON.stringify(report), /UPSTREAM_SECRET|HEADER_SECRET|BODY_SECRET|URL_SECRET|relay-secret|youtube\.com|reason/);
}
assert.equal(adapter.diagnostics().playerTransport, 'first-party', 'the actual first-party transport is reported');

// The latest report must retain its own route when distinct player lookups overlap and finish out of order.
const overlap = await Promise.allSettled([
  adapter.resolveAudio('AAAAAAAAAAA', denied('AAAAAAAAAAA', 'Sign in to continue')),
  adapter.resolveAudio('BBBBBBBBBBB', denied('BBBBBBBBBBB', 'Sign in to continue')),
]);
assert.ok(overlap.every((result) => result.status === 'rejected'));
assert.equal(adapter.diagnostics().videoId, 'BBBBBBBBBBB');
assert.equal(adapter.diagnostics().playerTransport, 'direct');

// Concurrent requests for the same video cannot be distinguished safely and must report UNKNOWN.
const sameVideo = await Promise.allSettled([
  adapter.resolveAudio('CCCCCCCCCCC', denied('CCCCCCCCCCC', 'Sign in to continue')),
  adapter.resolveAudio('CCCCCCCCCCC', denied('CCCCCCCCCCC', 'Sign in to continue')),
]);
assert.ok(sameVideo.every((result) => result.status === 'rejected'));
assert.equal(adapter.diagnostics().videoId, 'CCCCCCCCCCC');
assert.equal(adapter.diagnostics().playerTransport, 'UNKNOWN');
assert.equal(adapter.diagnostics().restrictionCategory, 'SIGN_IN_REQUIRED');

// A same-video lookup overlap is ambiguous even when only one lookup emits a player request.
let releaseCachedLookup;
const cachedLookupGate = new Promise((resolve) => { releaseCachedLookup = resolve; });
const cachedLookup = {
  async getStreamingData() { throw new Error('Streaming data not available'); },
  async getBasicInfo() {
    await cachedLookupGate;
    return { playability_status: { status: 'LOGIN_REQUIRED', reason: 'Sign in to continue' }, streaming_data: null };
  },
};
const requestedLookup = {
  async getStreamingData() { throw new Error('Streaming data not available'); },
  async getBasicInfo() {
    await adapter.relayFetch('https://www.youtube.com/youtubei/v1/player?key=URL_SECRET', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId: 'FFFFFFFFFFF' }),
    });
    return { playability_status: { status: 'LOGIN_REQUIRED', reason: 'Sign in to continue' }, streaming_data: null };
  },
};
const cachedResolution = adapter.resolveAudio('FFFFFFFFFFF', cachedLookup);
await new Promise((resolve) => setTimeout(resolve, 0));
await assert.rejects(adapter.resolveAudio('FFFFFFFFFFF', requestedLookup), /Streaming data not available/);
assert.equal(adapter.diagnostics().playerTransport, 'UNKNOWN');
releaseCachedLookup();
await assert.rejects(cachedResolution, /Streaming data not available/);

// A request can finish before overlap begins; that later overlap still invalidates attribution.
let markFirstRequestDone;
let releaseFirstInfo;
let markSecondLookupStarted;
let releaseSecondInfo;
const firstRequestDone = new Promise((resolve) => { markFirstRequestDone = resolve; });
const firstInfoGate = new Promise((resolve) => { releaseFirstInfo = resolve; });
const secondLookupStarted = new Promise((resolve) => { markSecondLookupStarted = resolve; });
const secondInfoGate = new Promise((resolve) => { releaseSecondInfo = resolve; });
const overlapId = 'GGGGGGGGGGG';
const earlyRequestLookup = {
  async getStreamingData() { throw new Error('Streaming data not available'); },
  async getBasicInfo() {
    await adapter.relayFetch('https://www.youtube.com/youtubei/v1/player?key=URL_SECRET', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId: overlapId }),
    });
    markFirstRequestDone();
    await firstInfoGate;
    return { playability_status: { status: 'LOGIN_REQUIRED', reason: 'Sign in to continue' }, streaming_data: null };
  },
};
const laterRequestLookup = {
  async getStreamingData() { throw new Error('Streaming data not available'); },
  async getBasicInfo() {
    markSecondLookupStarted();
    await secondInfoGate;
    await adapter.relayFetch('https://www.youtube.com/youtubei/v1/player?key=URL_SECRET', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId: overlapId }),
    });
    return { playability_status: { status: 'LOGIN_REQUIRED', reason: 'Sign in to continue' }, streaming_data: null };
  },
};
const earlyResolution = adapter.resolveAudio(overlapId, earlyRequestLookup);
await firstRequestDone;
const laterResolution = adapter.resolveAudio(overlapId, laterRequestLookup);
await secondLookupStarted;
releaseFirstInfo();
await assert.rejects(earlyResolution, /Streaming data not available/);
releaseSecondInfo();
await assert.rejects(laterResolution, /Streaming data not available/);
assert.equal(adapter.diagnostics().videoId, overlapId);
assert.equal(adapter.diagnostics().playerTransport, 'UNKNOWN', 'overlap invalidates earlier and later transport evidence');

dom.window.close();
console.log('YouTube.js safe restriction and correlated transport diagnostics v1.9.0 OK');
