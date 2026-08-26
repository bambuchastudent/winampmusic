import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

import worker, { LIMITS, isValidPayload, mintToken } from '../relay/short-link/worker.js';
import {
  PAYLOAD_RE,
  aliasRecord,
  payloadFromShareUrl,
  redirectDocument,
  writeAlias,
} from '../scripts/create-short-link.mjs';

const APP_ORIGIN = 'https://example.test/winampmusic/';
const workerSource = fs.readFileSync('relay/short-link/worker.js', 'utf8');
const relayReadme = fs.readFileSync('relay/short-link/README.md', 'utf8');

// ---------------------------------------------------------------------------------------------
// A canonical payload produced by the real encoder, so the alias contract is tested against
// real data rather than a hand-written fixture.
// ---------------------------------------------------------------------------------------------
const dom = new JSDOM('<!doctype html><body><div id="status">READY</div></body>', {
  runScripts: 'outside-only',
  url: APP_ORIGIN,
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
const shareUrl = `${APP_ORIGIN}?a=${payload}`;
assert.match(payload, PAYLOAD_RE, 'the encoder must produce a recognised compact transport string');

// =============================================================================================
// static adapter — GitHub Pages, no service required
// =============================================================================================
assert.equal(payloadFromShareUrl(shareUrl), payload, 'the static adapter must copy the canonical payload verbatim');
assert.throws(() => payloadFromShareUrl(`${APP_ORIGIN}?a=nope`), /compact Ámpula transport/);
assert.throws(() => payloadFromShareUrl(APP_ORIGIN), /no \?a= payload/);

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
function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry && entry.expiry <= Date.now()) { store.delete(key); return null; }
      return entry.value;
    },
    async put(key, value, options = {}) {
      store.set(key, { value, expiry: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : 0 });
    },
  };
}
const env = () => ({ APP_ORIGIN, RATE_SALT: 'test', AMPULA_LINKS: fakeKv() });
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
assert.equal(redirect.headers.get('location'), `${APP_ORIGIN}?a=${payload}`, 'the relay must redirect to the app, not render its own UI');

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

// Declared creation rate limit is enforced.
const limited = env();
for (let i = 0; i < LIMITS.createsPerHour; i += 1) {
  assert.equal((await post({ v: 1, payload }, limited)).status, 201, `create ${i + 1} must succeed`);
}
assert.equal((await post({ v: 1, payload }, limited)).status, 429, 'creation beyond the declared rate must be refused');

// A different client bucket is unaffected by another client's rate limit.
assert.equal((await post({ v: 1, payload }, limited, { 'cf-connecting-ip': '198.51.100.4' })).status, 201);

// CORS must allow the app origin.
const preflight = await worker.fetch(new Request('https://relay.test/a', { method: 'OPTIONS' }), env());
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), APP_ORIGIN);

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
