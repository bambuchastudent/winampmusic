import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

const compactShareCode = fs.readFileSync('compact-share.js', 'utf8');
const shortLinkCode = fs.readFileSync('ampula-short-link-v163.js', 'utf8');

const library = [
  { id: 'abcdefghijk', title: 'Teardrop', artist: 'Massive Attack', duration: '5:31' },
  { id: 'lmnopqrstuv', title: 'Roads', artist: 'Portishead', sourceUrl: 'https://music.apple.com/tr/album/example/123?i=456' },
  { id: 'wxyz01234_-', title: 'Glory Box', artist: 'Portishead' },
];

const dom = new JSDOM('<!doctype html><body><div id="status">READY</div></body>', {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
const dialogProto = window.HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
  dialogProto.close = function close() { this.removeAttribute('open'); };
}
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));

const calls = [];
let handler = () => { throw new Error('no fetch handler installed'); };
window.fetch = (input, options = {}) => {
  const url = String(input?.url || input);
  calls.push({ url, options });
  const signal = options.signal;
  if (signal?.aborted) return Promise.reject(new Error('aborted'));
  // Mirror real fetch: an aborted request rejects.
  const aborted = new Promise((_, reject) => {
    signal?.addEventListener?.('abort', () => reject(new Error('aborted')), { once: true });
  });
  return Promise.race([Promise.resolve().then(() => handler(url, options)), aborted]);
};
const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const resetCalls = () => { calls.length = 0; };

window.eval(compactShareCode);
window.eval(shortLinkCode);

const share = window.winampMusicCompactShare;
const shortLink = window.ampulaShortLink;
assert.ok(share, 'canonical share module must load');
assert.ok(shortLink, 'short-link module must load');
for (const method of ['isEnabled', 'create', 'apply', 'resolve', 'receive']) {
  assert.equal(typeof shortLink[method], 'function', `short-link API must expose ${method}()`);
}

const libraryBefore = window.localStorage.getItem('winampmusic.library.v1');
const canonicalUrl = await share.share();
assert.ok(canonicalUrl, 'canonical share must produce a link');
const canonicalPayload = new window.URL(canonicalUrl).searchParams.get('a');
assert.ok(canonicalPayload, 'canonical link must carry a self-contained payload');
const canonicalAmpula = await share.decode(canonicalPayload);
assert.equal(canonicalAmpula.tracks.length, 3);

const shareInput = window.document.getElementById('winampShareUrl');
assert.ok(shareInput, 'Share dialog must exist');
assert.equal(shareInput.value, canonicalUrl, 'the Share dialog must hold the canonical link before any alias attempt');
const restoreDialog = () => { shareInput.value = canonicalUrl; };

// --- No write backend configured: inert, no network, canonical link retained. --------------------
resetCalls();
assert.equal(shortLink.isEnabled(), false, 'no relay configured must mean no write backend');
assert.equal(await shortLink.apply(canonicalUrl), null, 'unconfigured alias must not produce a short link');
assert.equal(calls.length, 0, 'unconfigured alias must make no network request');
assert.equal(shareInput.value, canonicalUrl, 'unconfigured alias must leave the canonical link in place');

// --- A public third-party shortener must be refused as a backend. --------------------------------
for (const blocked of ['https://bit.ly', 'https://tinyurl.com', 'https://t.co', 'https://is.gd/x']) {
  window.AMPULA_SHORT_LINK_RELAY = blocked;
  resetCalls();
  assert.equal(shortLink.isEnabled(), false, `${blocked} must be refused as an alias backend`);
  assert.equal(await shortLink.apply(canonicalUrl), null, `${blocked} must not be used`);
  assert.equal(calls.length, 0, `${blocked} must not be contacted`);
}

// --- Insecure or malformed configuration must be refused. ----------------------------------------
for (const bad of ['http://relay.test', 'not a url', '', 'javascript:alert(1)']) {
  window.AMPULA_SHORT_LINK_RELAY = bad;
  assert.equal(shortLink.isEnabled(), false, `configuration ${JSON.stringify(bad)} must be refused`);
}

// --- Configured and reachable: a short link is produced. -----------------------------------------
window.AMPULA_SHORT_LINK_RELAY = 'https://relay.test';
assert.equal(shortLink.isEnabled(), true, 'a valid https backend must enable alias creation');
resetCalls();
handler = () => jsonResponse(201, {
  v: 1,
  token: 'Ab3Xk9pQ2',
  url: 'https://relay.test/a/Ab3Xk9pQ2',
  expiresAt: '2027-01-01T00:00:00.000Z',
});
const shortUrl = await shortLink.apply(canonicalUrl);
assert.equal(shortUrl, 'https://relay.test/a/Ab3Xk9pQ2', 'a reachable backend must yield the short alias');
assert.equal(shareInput.value, shortUrl, 'the Share dialog must display the short link');
assert.equal(calls.length, 1, 'alias creation must be a single request');
assert.equal(calls[0].options.method, 'POST');
assert.ok(calls[0].options.signal, 'alias creation must be bounded by an abort signal');

// Self-sufficiency invariant: the alias record carries the complete canonical payload,
// never a reference that would make the backend a source of truth.
const posted = JSON.parse(calls[0].options.body);
assert.equal(posted.v, 1);
assert.equal(posted.payload, canonicalPayload, 'the alias must store the complete canonical payload');

// --- Every backend failure falls back to the canonical link, without reporting failure. ----------
const originalTimeout = shortLink.timeoutMs;
shortLink.timeoutMs = 25;
const failures = [
  ['relay 500', () => jsonResponse(500, { error: 'boom' })],
  ['relay 404', () => jsonResponse(404, { error: 'not_found' })],
  ['relay 413', () => jsonResponse(413, { error: 'payload_too_large' })],
  ['relay 429', () => jsonResponse(429, { error: 'rate_limited' })],
  ['malformed body', () => ({ ok: true, status: 201, json: async () => ({ nope: true }) })],
  ['non-json body', () => ({ ok: true, status: 201, json: async () => { throw new Error('bad json'); } })],
  ['token from a foreign origin', () => jsonResponse(201, { v: 1, token: 'Ab3Xk9pQ2', url: 'https://evil.test/a/Ab3Xk9pQ2' })],
  ['network failure', () => { throw new Error('offline'); }],
  ['hang until the deadline', () => new Promise(() => {})],
];
for (const [label, response] of failures) {
  restoreDialog();
  resetCalls();
  handler = response;
  const status = window.document.getElementById('status').textContent;
  assert.equal(await shortLink.apply(canonicalUrl), null, `${label} must not produce a short link`);
  assert.equal(shareInput.value, canonicalUrl, `${label} must leave the canonical link in the Share dialog`);
  assert.doesNotMatch(
    window.document.getElementById('status').textContent,
    /FAIL|ERROR|UNAVAILABLE · TRY AGAIN/i,
    `${label} must not be reported as a share failure`,
  );
  assert.ok(status !== undefined);
}
shortLink.timeoutMs = originalTimeout;

// --- An oversized payload is skipped locally, before any request. --------------------------------
resetCalls();
handler = () => { throw new Error('must not be called'); };
const oversized = `https://example.test/winampmusic/?a=j.${'A'.repeat(shortLink.maxPayloadBytes + 10)}`;
assert.equal(await shortLink.create(oversized), null, 'an oversized payload must be skipped');
assert.equal(calls.length, 0, 'an oversized payload must not reach the backend');

// --- A stale alias parameter must never survive into a rebuilt canonical link. -------------------
window.history.replaceState({}, '', '/winampmusic/?al=Stale123');
const rebuiltUrl = new window.URL(await share.share());
assert.ok(!rebuiltUrl.searchParams.has('al'), 'rebuilt share links must not carry an alias token');
const rebuiltAmpula = await share.decode(rebuiltUrl.searchParams.get('a'));
assert.equal(rebuiltAmpula.tracks.length, 3, 'a rebuilt share must still be a complete self-contained Ámpula');

// --- Receiving a static, same-origin alias reaches the canonical receive flow. -------------------
delete window.AMPULA_SHORT_LINK_RELAY;
window.history.replaceState({}, '', '/winampmusic/?al=Static123');
resetCalls();
handler = (url) => {
  assert.equal(url, 'https://example.test/winampmusic/a/Static123.json', 'static aliases must resolve same-origin');
  return jsonResponse(200, { v: 1, payload: canonicalPayload, expiresAt: null });
};
assert.equal(await shortLink.receive(), true, 'an alias URL must be handled');
assert.equal(
  window.location.search,
  `?a=${canonicalPayload}`,
  'a resolved alias must leave the receiver holding the canonical self-contained link',
);
assert.ok(!window.location.search.includes('al='), 'the alias token must not survive in the URL');

const receivedDialog = window.document.getElementById('ampulaReceivedDialog');
assert.ok(receivedDialog, 'a received alias must render the canonical Shared music UI');
for (const title of ['Teardrop', 'Roads', 'Glory Box']) {
  assert.match(receivedDialog.textContent, new RegExp(title), `${title} must be visible in the received UI`);
}
assert.equal(
  window.localStorage.getItem('winampmusic.library.v1'),
  libraryBefore,
  'opening a short link must not mutate the local library',
);

// The alias and the canonical link must produce the same object, field for field.
const viaAlias = await share.decode(new window.URLSearchParams(window.location.search).get('a'));
assert.deepEqual(
  JSON.parse(JSON.stringify(viaAlias)),
  JSON.parse(JSON.stringify(canonicalAmpula)),
  'a short link must decode to the same canonical Ámpula as its long equivalent',
);

// --- The alias token is transport only: it is never persisted. -----------------------------------
share.save(viaAlias);
const saved = window.localStorage.getItem('winampmusic.ampulas.v1');
assert.ok(saved, 'saving must still work after an alias receive');
assert.ok(!saved.includes('Static123'), 'an alias token must never be persisted as Ámpula data');
assert.ok(!saved.includes('relay.test'), 'an alias backend must never be persisted as Ámpula data');
assert.equal(
  window.localStorage.getItem('winampmusic.library.v1'),
  libraryBefore,
  'saving a received alias must not mutate the local library',
);

// --- A relay-hosted alias resolves only after the same-origin static attempt. --------------------
window.AMPULA_SHORT_LINK_RELAY = 'https://relay.test/';
window.history.replaceState({}, '', '/winampmusic/?al=Relay456');
resetCalls();
handler = (url) => {
  if (url.startsWith('https://example.test/')) return jsonResponse(404, { error: 'not_found' });
  return jsonResponse(200, { v: 1, payload: canonicalPayload, expiresAt: '2027-01-01T00:00:00.000Z' });
};
assert.equal(await shortLink.receive(), true);
assert.equal(calls.length, 2, 'resolution must try the same-origin static alias before the relay');
assert.equal(calls[0].url, 'https://example.test/winampmusic/a/Relay456.json');
assert.equal(calls[1].url, 'https://relay.test/a/Relay456?format=json');
assert.equal(window.location.search, `?a=${canonicalPayload}`);
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), libraryBefore);

// --- A dead alias fails non-destructively. -------------------------------------------------------
for (const [label, response] of [
  ['expired token', () => jsonResponse(410, { error: 'gone' })],
  ['unknown token', () => jsonResponse(404, { error: 'not_found' })],
  ['backend offline', () => { throw new Error('offline'); }],
  ['payload that is not an Ámpula transport string', () => jsonResponse(200, { v: 1, payload: 'nope' })],
]) {
  window.history.replaceState({}, '', '/winampmusic/?al=Dead789');
  handler = response;
  assert.equal(await shortLink.receive(), true, `${label} must still be handled`);
  assert.equal(
    window.localStorage.getItem('winampmusic.library.v1'),
    libraryBefore,
    `${label} must not mutate the local library`,
  );
  assert.match(
    window.document.getElementById('status').textContent,
    /SHORT LINK/i,
    `${label} must report a non-destructive short-link status`,
  );
  assert.ok(window.location.search.includes('al='), `${label} must not fabricate a canonical link`);
}

// --- A malformed token is refused without any request. -------------------------------------------
resetCalls();
handler = () => { throw new Error('must not be called'); };
for (const bad of ['', '../../etc/passwd', 'a'.repeat(80), 'has space', 'x']) {
  assert.equal(await shortLink.resolve(bad), '', `token ${JSON.stringify(bad)} must be refused`);
}
assert.equal(calls.length, 0, 'a malformed token must not reach any backend');

// --- Legacy and canonical transports are untouched by the alias module. --------------------------
resetCalls();
window.history.replaceState({}, '', '/winampmusic/?p=abcdefghijk.lmnopqrstuv');
assert.equal(await shortLink.receive(), false, 'legacy ?p= recovery must not be intercepted');
window.history.replaceState({}, '', '/winampmusic/?s=some-slug');
assert.equal(await shortLink.receive(), false, 'legacy ?s= recovery must not be intercepted');
window.history.replaceState({}, '', `/winampmusic/?a=${canonicalPayload}`);
assert.equal(await shortLink.receive(), false, 'canonical ?a= receive must not be intercepted');
assert.equal(calls.length, 0, 'non-alias URLs must not trigger an alias request');

// A pre-existing self-contained link still opens with no backend of any kind.
delete window.AMPULA_SHORT_LINK_RELAY;
window.fetch = () => { throw new Error('no network is available'); };
window.document.getElementById('ampulaReceivedDialog').close();
await share.load();
assert.match(receivedDialog.textContent, /Teardrop/, 'old self-contained links must keep working without any alias backend');
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), libraryBefore);

console.log('short-link alias: optional creation, bounded failure fallback, canonical receive and non-destructive semantics passed');
process.exit(0);
