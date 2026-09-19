/**
 * Ámpula short-link relay — reference implementation of the `relay` adapter in
 * openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md
 *
 * STATUS: deployable source. NOT DEPLOYED by this repository.
 * See ./README.md for what an operator must do before a short link exists.
 *
 * The relay is a pointer service. It stores an opaque compact Ámpula transport
 * payload and gives it back. It never decodes, interprets, enriches or indexes
 * the musical content, and it stores no identity.
 */

export const LIMITS = Object.freeze({
  maxPayloadBytes: 64 * 1024,
  tokenLength: 9, // 62^9 ≈ 2^53.6, above the required 48 bits of entropy
  createsPerHour: 30,
  windowSeconds: 3600,
  retentionDays: 180,
});

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAYLOAD_RE = /^[gj]\.[A-Za-z0-9_-]{8,}$/;
const TOKEN_RE = /^[A-Za-z0-9]{6,32}$/;
const YOUTUBE_PROXY_PREFIX = '/youtubejs/';
const YOUTUBE_PROXY_METHODS = new Set(['GET', 'POST', 'HEAD']);
const YOUTUBE_PROXY_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'range',
  'user-agent',
  'x-goog-api-format-version',
  'x-goog-api-key',
  'x-goog-visitor-id',
  'x-origin',
  'x-user-agent',
  'x-youtube-client-name',
  'x-youtube-client-version',
];

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=utf-8', ...extraHeaders },
  });
}

/**
 * `APP_URL` is a full URL including the application path, because the relay
 * redirects browsers to the app itself. A browser `Origin` header, however, is
 * only scheme + host + port and never carries a path, so the CORS header must
 * be derived from `APP_URL` rather than echoing it.
 */
export function appOrigin(env) {
  const raw = String(env?.APP_URL || '');
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function corsHeaders(env) {
  const origin = appOrigin(env);
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
}

function youtubeCorsHeaders(env) {
  const origin = appOrigin(env);
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
    'access-control-allow-headers': YOUTUBE_PROXY_HEADERS.join(','),
    'access-control-expose-headers': 'content-length,content-type,accept-ranges,content-range',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function isAllowedYouTubeProxyHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'youtubei.googleapis.com'
    || host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'ytimg.com'
    || host.endsWith('.ytimg.com')
    || host === 'googlevideo.com'
    || host.endsWith('.googlevideo.com');
}

function youtubeProxyTarget(requestUrl) {
  const incoming = new URL(requestUrl);
  const rawHost = String(incoming.searchParams.get('__host') || '').trim();
  if (!rawHost || rawHost.includes('@') || rawHost.includes('/') || rawHost.includes('\\')) {
    return { error: 'invalid_host', status: 400 };
  }

  let parsedHost;
  try {
    parsedHost = new URL(`https://${rawHost}`);
  } catch {
    return { error: 'invalid_host', status: 400 };
  }
  if (parsedHost.username || parsedHost.password || (parsedHost.port && parsedHost.port !== '443')) {
    return { error: 'invalid_host', status: 400 };
  }
  if (!isAllowedYouTubeProxyHost(parsedHost.hostname)) {
    return { error: 'host_not_allowed', status: 403 };
  }

  const target = new URL('https://youtube.invalid/');
  target.hostname = parsedHost.hostname;
  target.pathname = incoming.pathname.slice(YOUTUBE_PROXY_PREFIX.length - 1) || '/';
  target.search = incoming.search;
  target.searchParams.delete('__host');
  return { target };
}

function copyAllowedYouTubeRequestHeaders(from) {
  const headers = new Headers();
  for (const name of YOUTUBE_PROXY_HEADERS) {
    const value = from.get(name);
    if (value) headers.set(name, value);
  }
  headers.delete('authorization');
  headers.delete('cookie');
  headers.delete('proxy-authorization');
  return headers;
}

function copyYouTubeResponseHeaders(from, env) {
  const headers = new Headers(youtubeCorsHeaders(env));
  for (const name of [
    'content-length',
    'content-type',
    'content-disposition',
    'accept-ranges',
    'content-range',
    'cache-control',
    'etag',
    'last-modified',
  ]) {
    const value = from.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function handleYouTubeProxy(request, env) {
  if (!YOUTUBE_PROXY_METHODS.has(request.method)) {
    return json({ error: 'method_not_allowed' }, 405, youtubeCorsHeaders(env));
  }

  const resolved = youtubeProxyTarget(request.url);
  if (!resolved.target) return json({ error: resolved.error }, resolved.status, youtubeCorsHeaders(env));

  const init = {
    method: request.method,
    headers: copyAllowedYouTubeRequestHeaders(request.headers),
    redirect: 'follow',
  };
  if (request.method === 'POST') init.body = await request.arrayBuffer();

  try {
    const response = await fetch(resolved.target, init);
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: copyYouTubeResponseHeaders(response.headers, env),
    });
  } catch {
    return json({ error: 'upstream_unavailable' }, 502, youtubeCorsHeaders(env));
  }
}

export function mintToken(random = crypto) {
  const bytes = new Uint8Array(LIMITS.tokenLength);
  random.getRandomValues(bytes);
  let token = '';
  for (const byte of bytes) token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return token;
}

export function isValidPayload(value) {
  return typeof value === 'string'
    && PAYLOAD_RE.test(value)
    && new TextEncoder().encode(value).length <= LIMITS.maxPayloadBytes;
}

function appUrlFor(env, payload) {
  const raw = String(env?.APP_URL || '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.searchParams.set('a', payload);
    return url.toString();
  } catch {
    return '';
  }
}

async function clientBucket(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const salted = new TextEncoder().encode(`${env?.RATE_SALT || 'ampula'}:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', salted));
  // Salted with a deployment secret, so a bucket name is not reversible to an
  // address. It only names a counter and is never stored beside a payload.
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Durable Object rate limiter.
 *
 * Cloudflare KV is eventually consistent and has no compare-and-set, so a
 * `get(counter) -> put(counter + 1)` pair cannot enforce a limit: concurrent
 * requests all read the same stale value and all pass. A Durable Object
 * serialises requests per object, which makes this read-modify-write atomic.
 *
 * It holds a counter and nothing else. It never sees a payload.
 */
export class ShortLinkRateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get('limit')) || LIMITS.createsPerHour;
    const windowSeconds = Number(params.get('windowSeconds')) || LIMITS.windowSeconds;
    const now = Date.now();

    const current = await this.state.storage.get('window');
    let count = 0;
    let resetAt = now + windowSeconds * 1000;
    if (current && Number(current.resetAt) > now) {
      count = Number(current.count) || 0;
      resetAt = Number(current.resetAt);
    }

    if (count >= limit) return json({ allowed: false, remaining: 0, resetAt }, 200);

    await this.state.storage.put('window', { count: count + 1, resetAt });
    // Self-cleaning: the counter is dropped when the window closes.
    await this.state.storage.setAlarm?.(resetAt);
    return json({ allowed: true, remaining: limit - count - 1, resetAt }, 200);
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}

/**
 * Fails closed. A missing or broken limiter must never silently become
 * unlimited creation. The client treats any non-2xx as "alias unavailable" and
 * keeps the canonical self-contained link, so failing closed costs link length
 * and nothing else.
 */
async function reserveCreateSlot(request, env) {
  const namespace = env?.RATE_LIMITER;
  if (!namespace) return { ok: false, status: 503, error: 'rate_limiter_unavailable' };
  try {
    const bucket = await clientBucket(request, env);
    const stub = namespace.get(namespace.idFromName(bucket));
    const url = `https://ampula-rate-limiter.invalid/reserve?limit=${LIMITS.createsPerHour}&windowSeconds=${LIMITS.windowSeconds}`;
    const response = await stub.fetch(new Request(url, { method: 'POST' }));
    if (!response?.ok) return { ok: false, status: 503, error: 'rate_limiter_unavailable' };
    const verdict = await response.json();
    if (verdict?.allowed === true) return { ok: true };
    return { ok: false, status: 429, error: 'rate_limited' };
  } catch {
    return { ok: false, status: 503, error: 'rate_limiter_unavailable' };
  }
}

async function handleCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, corsHeaders(env));
  }
  if (!body || body.v !== 1 || typeof body.payload !== 'string') {
    return json({ error: 'invalid_request' }, 400, corsHeaders(env));
  }
  if (new TextEncoder().encode(body.payload).length > LIMITS.maxPayloadBytes) {
    return json({ error: 'payload_too_large' }, 413, corsHeaders(env));
  }
  if (!isValidPayload(body.payload)) {
    return json({ error: 'invalid_payload' }, 400, corsHeaders(env));
  }
  if (!env?.AMPULA_LINKS) {
    return json({ error: 'storage_unavailable' }, 503, corsHeaders(env));
  }

  const slot = await reserveCreateSlot(request, env);
  if (!slot.ok) return json({ error: slot.error }, slot.status, corsHeaders(env));

  const now = Date.now();
  const ttlSeconds = LIMITS.retentionDays * 24 * 60 * 60;
  const record = {
    payload: body.payload,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
  };

  let token = '';
  for (let attempt = 0; attempt < 5 && !token; attempt += 1) {
    const candidate = mintToken();
    if (await env.AMPULA_LINKS.get(`a:${candidate}`)) continue;
    token = candidate;
  }
  if (!token) return json({ error: 'token_exhausted' }, 503, corsHeaders(env));

  await env.AMPULA_LINKS.put(`a:${token}`, JSON.stringify(record), { expirationTtl: ttlSeconds });

  return json({
    v: 1,
    token,
    url: new URL(`/a/${token}`, new URL(request.url).origin).toString(),
    expiresAt: record.expiresAt,
  }, 201, corsHeaders(env));
}

async function handleResolve(request, env, token, wantsJson) {
  if (!TOKEN_RE.test(token)) return json({ error: 'invalid_token' }, 400, corsHeaders(env));

  const raw = env?.AMPULA_LINKS ? await env.AMPULA_LINKS.get(`a:${token}`) : null;
  if (!raw) return json({ error: 'not_found' }, 404, corsHeaders(env));

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return json({ error: 'not_found' }, 404, corsHeaders(env));
  }
  if (record?.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    return json({ error: 'gone' }, 410, corsHeaders(env));
  }
  if (!isValidPayload(record?.payload)) {
    return json({ error: 'not_found' }, 404, corsHeaders(env));
  }

  if (wantsJson) {
    return json({ v: 1, payload: record.payload, expiresAt: record.expiresAt || null }, 200, {
      ...corsHeaders(env),
      'cache-control': 'public, max-age=300',
    });
  }

  const target = appUrlFor(env, record.payload);
  if (!target) return json({ error: 'app_url_unset' }, 500, corsHeaders(env));
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      const headers = url.pathname.startsWith(YOUTUBE_PROXY_PREFIX)
        ? youtubeCorsHeaders(env)
        : corsHeaders(env);
      return new Response(null, { status: 204, headers });
    }
    if (url.pathname.startsWith(YOUTUBE_PROXY_PREFIX)) {
      return handleYouTubeProxy(request, env);
    }
    if (url.pathname === '/healthz') {
      return json({ ok: true, v: 1 }, 200, corsHeaders(env));
    }
    if (url.pathname === '/a' && request.method === 'POST') {
      return handleCreate(request, env);
    }

    const match = url.pathname.match(/^\/a\/([^/]+)\/?$/);
    if (match && request.method === 'GET') {
      return handleResolve(request, env, match[1], url.searchParams.get('format') === 'json');
    }

    return json({ error: 'not_found' }, 404, corsHeaders(env));
  },
};
