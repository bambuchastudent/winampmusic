import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

import worker, { LIMITS, ShortLinkRateLimiter, appOrigin, isValidPayload, mintToken } from '../relay/short-link/worker.js';
import {
  PAYLOAD_RE,
  aliasRecord,
  payloadFromShareUrl,
  redirectDocument,
  writeAlias,
} from '../scripts/create-short-link.mjs';

// The app is served from a path; a browser Origin never carries one.
const APP_URL = 'https://example.test/winampmusic/';
const BROWSER_ORIGIN = 'https://example.test';
const workerSource = fs.readFileSync('relay/short-link/worker.js', 'utf8');
const relayReadme = fs.readFileSync('relay/short-link/README.md', 'utf8');
const wranglerConfig = fs.readFileSync('relay/short-link/wrangler.toml', 'utf8');

// ---------------------------------------------------------------------------------------------
// A canonical payload produced by the real encoder, so the alias contract is tested against
// real data rather than a hand-written fixture.
// ---------------------------------------------------------------------------------------------
const dom = new JSDOM('<!doctype html><body><div id="status">READY</div></body>', {
  runScripts: 'outside-only',
  url: APP_URL,
  pretendToBeVisual: true,
});
const { window } = dom;
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
// Committed aliases hold real gzip payloads, so the canonical codec must run its compressed path.
window.Blob = globalThis.Blob;
window.Response = globalThis.Response;
window.CompressionStream = globalThis.CompressionStream;
window.DecompressionStream = globalThis.DecompressionStream;
const dialogProto = window.HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
  dialogProto.close = function close() { this.removeAttribute('open'); };
}
window.eval(fs.readFileSync('compact-share.js', 'utf8'));

const sourceAmpula = window.winampMusicCompactShare.toAmpula([
  { id: 'abcdefghijk', title: 'Teardrop', artist: 'Massive Attack', duration: '5:31' },
  { id: 'lmnopqrstuv', title: 'Roads', artist: 'Portishead' },
]);
const payload = await window.winampMusicCompactShare.encode(sourceAmpula);
const shareUrl = `${APP_URL}?a=${payload}`;
assert.match(payload, PAYLOAD_RE, 'the encoder must produce a recognised compact transport string');

// =============================================================================================
// static adapter — GitHub Pages, no service required
// =============================================================================================
assert.equal(payloadFromShareUrl(shareUrl), payload, 'the static adapter must copy the canonical payload verbatim');
assert.throws(() => payloadFromShareUrl(`${APP_URL}?a=nope`), /compact Ámpula transport/);
assert.throws(() => payloadFromShareUrl(APP_URL), /no \?a= payload/);

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ampula-alias-'));
const written = writeAlias({ payload, token: 'Ab3Xk9', outDir });
const indexHtml = fs.readFileSync(written.indexPath, 'utf8');
const record = JSON.parse(fs.readFileSync(written.jsonPath, 'utf8'));

assert.deepEqual(record, { v: 1, payload, expiresAt: null }, 'a static alias record must hold the whole payload');
assert.deepEqual(aliasRecord(payload), record);
assert.ok(indexHtml.includes(`../../?a=${payload}`), 'the redirect document must target the canonical ?a= URL');
assert.match(indexHtml, /http-equiv="refresh"/, 'the redirect must work without the player bundle');
assert.match(indexHtml, /noindex/, 'static aliases must not be indexed');
assert.doesNotMatch(indexHtml, /<script[^>]+src=/i, 'the redirect document must not load any script');
assert.doesNotMatch(indexHtml, /https?:\/\//, 'the redirect document must not reference a third-party origin');

// The alias must be self-sufficient: its payload alone rebuilds the canonical Ámpula.
const fromAlias = await window.winampMusicCompactShare.decode(record.payload);
assert.deepEqual(
  JSON.parse(JSON.stringify(fromAlias)),
  JSON.parse(JSON.stringify(await window.winampMusicCompactShare.decode(payload))),
  'a static alias must decode to the canonical Ámpula with no backend involved',
);

assert.throws(() => writeAlias({ payload: 'not-an-ampula', token: 'Zz9', outDir }), /non-Ámpula payload/);
assert.throws(() => writeAlias({ payload, token: '../escape', outDir }), /Invalid alias token/);
assert.throws(() => writeAlias({ payload, token: 'Ab3Xk9', outDir }), /already exists/);
fs.rmSync(outDir, { recursive: true, force: true });

// The alias directory must be excluded from indexing at the site level too.
assert.match(fs.readFileSync('robots.txt', 'utf8'), /Disallow:\s*\/winampmusic\/a\//, 'robots.txt must exclude static aliases');

// =============================================================================================
// relay adapter — executable API contract
// =============================================================================================
/**
 * Durable Object namespace stub. Requests to one object are serialised, which is
 * the property the production limiter relies on.
 */
function fakeDurableObjects(ClassRef) {
  const instances = new Map();
  const gates = new Map();
  return {
    idFromName: (name) => ({ name }),
    get(id) {
      const name = String(id?.name ?? id);
      if (!instances.has(name)) {
        const storage = new Map();
        instances.set(name, new ClassRef({
          storage: {
            async get(key) { return storage.get(key); },
            async put(key, value) { storage.set(key, value); },
            async deleteAll() { storage.clear(); },
            async setAlarm() {},
          },
        }));
      }
      const instance = instances.get(name);
      return {
        fetch(request) {
          const previous = gates.get(name) || Promise.resolve();
          const next = previous.then(() => instance.fetch(request));
          gates.set(name, next.then(() => {}, () => {}));
          return next;
        },
      };
    },
  };
}

/**
 * Models Cloudflare KV: every operation yields to the event loop, so concurrent
 * read-modify-write sequences interleave and do not see each other's writes.
 * This is what makes a KV counter unusable as a rate limiter.
 */
function eventuallyConsistentKv() {
  const store = new Map();
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    store,
    async get(key) {
      await settle();
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry && entry.expiry <= Date.now()) { store.delete(key); return null; }
      return entry.value;
    },
    async put(key, value, options = {}) {
      await settle();
      store.set(key, { value, expiry: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : 0 });
    },
  };
}

const env = () => ({
  APP_URL,
  RATE_SALT: 'test',
  AMPULA_LINKS: eventuallyConsistentKv(),
  RATE_LIMITER: fakeDurableObjects(ShortLinkRateLimiter),
});
const post = (body, e, headers = {}) => worker.fetch(new Request('https://relay.test/a', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}), e);

assert.match(mintToken(), /^[A-Za-z0-9]{9}$/, 'relay tokens must be 9 base62 characters (≈53.6 bits)');
assert.ok(LIMITS.tokenLength * Math.log2(62) >= 48, 'relay token entropy must be at least 48 bits');
assert.notEqual(mintToken(), mintToken(), 'relay tokens must be random');
assert.ok(isValidPayload(payload));
assert.ok(!isValidPayload('nope'));
assert.ok(!isValidPayload(`j.${'A'.repeat(LIMITS.maxPayloadBytes + 1)}`));

const health = await worker.fetch(new Request('https://relay.test/healthz'), env());
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true, v: 1 });

const live = env();
const created = await post({ v: 1, payload }, live);
assert.equal(created.status, 201, 'a valid payload must be accepted');
const createdBody = await created.json();
assert.equal(createdBody.v, 1);
assert.match(createdBody.token, /^[A-Za-z0-9]{9}$/);
assert.equal(createdBody.url, `https://relay.test/a/${createdBody.token}`);
assert.ok(Date.parse(createdBody.expiresAt) > Date.now(), 'a relay alias must declare an expiry');

// A relay record stores the payload and nothing that identifies anybody.
const stored = JSON.parse(live.AMPULA_LINKS.store.get(`a:${createdBody.token}`).value);
assert.deepEqual(Object.keys(stored).sort(), ['createdAt', 'expiresAt', 'payload']);
assert.equal(stored.payload, payload, 'the relay must store the complete canonical payload');
assert.ok(!JSON.stringify(stored).includes('203.0.113.9'), 'a relay record must not contain a client address');

const asJson = await worker.fetch(new Request(`https://relay.test/a/${createdBody.token}?format=json`), live);
assert.equal(asJson.status, 200);
const resolved = await asJson.json();
assert.equal(resolved.payload, payload, 'resolution must return a byte-identical payload');
assert.deepEqual(
  JSON.parse(JSON.stringify(await window.winampMusicCompactShare.decode(resolved.payload))),
  JSON.parse(JSON.stringify(fromAlias)),
  'a relay alias must resolve to the same canonical Ámpula as a static alias',
);

const redirect = await worker.fetch(new Request(`https://relay.test/a/${createdBody.token}`), live);
assert.equal(redirect.status, 302, 'a browser hit must redirect');
assert.equal(redirect.headers.get('location'), `${APP_URL}?a=${payload}`, 'the relay must redirect to the app, not render its own UI');

assert.equal((await worker.fetch(new Request('https://relay.test/a/ZZZnotreal?format=json'), live)).status, 404);
assert.equal((await worker.fetch(new Request('https://relay.test/a/bad%20token?format=json'), live)).status, 400);

// Expired records are reported as gone, never silently served.
const expired = env();
await expired.AMPULA_LINKS.put('a:ExpiredAA', JSON.stringify({
  payload,
  createdAt: '2020-01-01T00:00:00.000Z',
  expiresAt: '2020-06-01T00:00:00.000Z',
}));
assert.equal((await worker.fetch(new Request('https://relay.test/a/ExpiredAA?format=json'), expired)).status, 410);

assert.equal((await post('{not json', env())).status, 400);
assert.equal((await post({ v: 2, payload }, env())).status, 400);
assert.equal((await post({ v: 1, payload: 'plain-text-playlist' }, env())).status, 400);
assert.equal((await post({ v: 1, payload: `j.${'A'.repeat(LIMITS.maxPayloadBytes + 1)}` }, env())).status, 413);

// ---------------------------------------------------------------------------------------------
// Rate limiting must hold under concurrency, not only when requests arrive one at a time.
// ---------------------------------------------------------------------------------------------
const burstSize = LIMITS.createsPerHour + 12;
const burst = env();
const burstResults = await Promise.all(
  Array.from({ length: burstSize }, () => post({ v: 1, payload }, burst)),
);
const burstAccepted = burstResults.filter((r) => r.status === 201).length;
const burstRefused = burstResults.filter((r) => r.status === 429).length;
assert.equal(burstAccepted, LIMITS.createsPerHour, 'a concurrent burst must not exceed the declared limit');
assert.equal(burstRefused, burstSize - LIMITS.createsPerHour, 'every excess concurrent request must be refused with 429');

/**
 * Control: the same concurrent burst against the naive KV counter this relay used
 * to ship. If this ever stops over-admitting, the burst assertion above has become
 * meaningless and the whole check must be re-examined.
 */
async function naiveKvLimiterAdmissions(attempts) {
  const kv = eventuallyConsistentKv();
  const verdicts = await Promise.all(Array.from({ length: attempts }, async () => {
    const used = Number(await kv.get('rl:bucket')) || 0;
    if (used >= LIMITS.createsPerHour) return false;
    await kv.put('rl:bucket', String(used + 1), { expirationTtl: LIMITS.windowSeconds });
    return true;
  }));
  return verdicts.filter(Boolean).length;
}
const naiveAdmitted = await naiveKvLimiterAdmissions(burstSize);
assert.ok(
  naiveAdmitted > LIMITS.createsPerHour,
  `the concurrency check must be able to fail: a naive KV counter admitted ${naiveAdmitted} of ${burstSize}`,
);

// Sequential enforcement still holds, and independent clients are not coupled.
const limited = env();
for (let i = 0; i < LIMITS.createsPerHour; i += 1) {
  assert.equal((await post({ v: 1, payload }, limited)).status, 201, `create ${i + 1} must succeed`);
}
assert.equal((await post({ v: 1, payload }, limited)).status, 429, 'creation beyond the declared rate must be refused');
assert.equal(
  (await post({ v: 1, payload }, limited, { 'cf-connecting-ip': '198.51.100.4' })).status,
  201,
  'one exhausted client must not rate limit another',
);

// The limiter fails closed: unavailable must never mean unlimited.
const noLimiter = env();
delete noLimiter.RATE_LIMITER;
assert.equal((await post({ v: 1, payload }, noLimiter)).status, 503, 'an unbound rate limiter must refuse creation');

const brokenLimiter = env();
brokenLimiter.RATE_LIMITER = {
  idFromName: (name) => ({ name }),
  get: () => ({ fetch: () => { throw new Error('durable object unavailable'); } }),
};
assert.equal((await post({ v: 1, payload }, brokenLimiter)).status, 503, 'a failing rate limiter must refuse creation');

const noStorage = env();
delete noStorage.AMPULA_LINKS;
assert.equal((await post({ v: 1, payload }, noStorage)).status, 503, 'missing payload storage must refuse creation');

// The limiter is isolated from Ámpula storage: it never receives a payload.
const isolation = env();
await post({ v: 1, payload }, isolation);
for (const [, value] of isolation.AMPULA_LINKS.store) {
  assert.ok(!String(value.value).includes('rl:'), 'a rate-limit counter must not live in Ámpula storage');
}
assert.ok(
  ![...isolation.AMPULA_LINKS.store.keys()].some((key) => key.startsWith('rl:')),
  'Ámpula storage must contain no rate-limit keys',
);
assert.ok(!/AMPULA_LINKS/.test(String(ShortLinkRateLimiter)), 'the limiter must not reference payload storage');

// ---------------------------------------------------------------------------------------------
// CORS: a browser Origin has no path, so the allow-origin header must not have one either.
// ---------------------------------------------------------------------------------------------
assert.equal(appOrigin({ APP_URL }), BROWSER_ORIGIN, 'the CORS origin must be derived from the app URL');
assert.equal(appOrigin({ APP_URL: 'not a url' }), '');
assert.equal(appOrigin({}), '');

const corsEnv = env();
const preflight = await worker.fetch(new Request('https://relay.test/a', {
  method: 'OPTIONS',
  headers: { origin: BROWSER_ORIGIN },
}), corsEnv);
assert.equal(preflight.status, 204);
assert.equal(
  preflight.headers.get('access-control-allow-origin'),
  BROWSER_ORIGIN,
  'the preflight allow-origin must be exactly the browser origin',
);

const corsCreate = await post({ v: 1, payload }, corsEnv, { origin: BROWSER_ORIGIN });
assert.equal(corsCreate.status, 201);
assert.equal(corsCreate.headers.get('access-control-allow-origin'), BROWSER_ORIGIN);
const corsToken = (await corsCreate.json()).token;

const corsResolve = await worker.fetch(
  new Request(`https://relay.test/a/${corsToken}?format=json`, { headers: { origin: BROWSER_ORIGIN } }),
  corsEnv,
);
assert.equal(corsResolve.headers.get('access-control-allow-origin'), BROWSER_ORIGIN);

for (const response of [preflight, corsCreate, corsResolve]) {
  const header = response.headers.get('access-control-allow-origin');
  assert.ok(!header.includes('/winampmusic'), 'allow-origin must not carry the application path');
  assert.equal(header, new URL(header).origin, 'allow-origin must be a bare origin');
}

// The redirect target, unlike the CORS header, must keep the full application path.
const corsRedirect = await worker.fetch(new Request(`https://relay.test/a/${corsToken}`), corsEnv);
assert.equal(corsRedirect.status, 302);
assert.equal(
  corsRedirect.headers.get('location'),
  `${APP_URL}?a=${payload}`,
  'the redirect must point at the app path, not merely at its origin',
);

assert.match(wranglerConfig, /APP_URL\s*=/, 'the deployment config must define APP_URL');
assert.doesNotMatch(wranglerConfig, /APP_ORIGIN\s*=/, 'APP_ORIGIN was renamed and must not linger');
assert.match(wranglerConfig, /class_name\s*=\s*"ShortLinkRateLimiter"/, 'the limiter must be a bound Durable Object');
assert.match(relayReadme, /Durable Object/, 'the relay README must document the limiter primitive');

// =============================================================================================
// Every alias committed to this repository must be a valid, self-sufficient Ámpula.
// =============================================================================================
const committedDir = 'a';
const committed = fs.existsSync(committedDir)
  ? fs.readdirSync(committedDir).filter((name) => name.endsWith('.json'))
  : [];
for (const file of committed) {
  const token = file.replace(/\.json$/, '');
  const entry = JSON.parse(fs.readFileSync(path.join(committedDir, file), 'utf8'));
  assert.equal(entry.v, 1, `${file} must declare alias version 1`);
  assert.match(entry.payload, PAYLOAD_RE, `${file} must hold a compact Ámpula transport payload`);

  const decoded = await window.winampMusicCompactShare.decode(entry.payload);
  assert.equal(decoded.format, 'ampula');
  assert.equal(decoded.version, '1');
  assert.ok(decoded.tracks.length > 0, `${file} must resolve to at least one track`);
  for (const track of decoded.tracks) {
    assert.ok(track.title, `${file} must preserve every track title`);
    assert.ok(track.artists?.length, `${file} must preserve every track artist`);
  }

  const page = fs.readFileSync(path.join(committedDir, token, 'index.html'), 'utf8');
  assert.ok(page.includes(`../../?a=${entry.payload}`), `${token}/index.html must redirect to its own canonical payload`);
  assert.doesNotMatch(page, /<script[^>]+src=/i, `${token}/index.html must not load any script`);
}
console.log(`committed static aliases validated: ${committed.length}`);


for (const forbidden of ['DecompressionStream', 'gunzip', 'atob', 'youtube', 'apple-music', 'importTracks']) {
  assert.ok(!workerSource.includes(forbidden), `the relay must not interpret musical content (${forbidden})`);
}
assert.match(workerSource, /NOT DEPLOYED/, 'the relay source must state its deployment status');
assert.match(relayReadme, /Status: NOT DEPLOYED/, 'the relay README must not imply a running production service');
assert.match(relayReadme, /wrangler deploy/, 'the relay README must document what deployment actually requires');

console.log('short-link alias adapters: static Pages artifacts and relay API contract, limits, privacy and durability passed');
process.exit(0);
