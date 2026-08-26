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
  retentionDays: 180,
});

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAYLOAD_RE = /^[gj]\.[A-Za-z0-9_-]{8,}$/;
const TOKEN_RE = /^[A-Za-z0-9]{6,32}$/;

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=utf-8', ...extraHeaders },
  });
}

function corsHeaders(env) {
  const origin = String(env?.APP_ORIGIN || '');
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
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
  const base = String(env?.APP_ORIGIN || '');
  if (!base) return '';
  const url = new URL(base);
  url.searchParams.set('a', payload);
  return url.toString();
}

async function clientBucket(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const salted = new TextEncoder().encode(`${env?.RATE_SALT || 'ampula'}:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', salted));
  // Truncated, salted and never persisted alongside a payload: it only keys an
  // ephemeral counter that expires within the rate-limit window.
  return Array.from(digest.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function rateLimited(request, env) {
  if (!env?.AMPULA_LINKS) return false;
  const key = `rl:${await clientBucket(request, env)}`;
  const used = Number(await env.AMPULA_LINKS.get(key)) || 0;
  if (used >= LIMITS.createsPerHour) return true;
  await env.AMPULA_LINKS.put(key, String(used + 1), { expirationTtl: 3600 });
  return false;
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
  if (await rateLimited(request, env)) {
    return json({ error: 'rate_limited' }, 429, corsHeaders(env));
  }

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
  if (!target) return json({ error: 'app_origin_unset' }, 500, corsHeaders(env));
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
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
