/**
 * AMPULAMP YouTube.js browser relay.
 *
 * Stateless playback infrastructure for browser YouTube.js. It is deliberately
 * separate from Ámpula Core and from the short-link alias Worker.
 */
const PREFIX = '/youtubejs/';
const METHODS = new Set(['GET', 'POST', 'HEAD']);
const REQUEST_HEADERS = [
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

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=utf-8', ...headers },
  });
}

function appOrigin(env) {
  try {
    return new URL(String(env?.APP_URL || '')).origin;
  } catch {
    return '';
  }
}

function corsHeaders(env) {
  return {
    'access-control-allow-origin': appOrigin(env) || '*',
    'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
    'access-control-allow-headers': REQUEST_HEADERS.join(','),
    'access-control-expose-headers': 'content-length,content-type,accept-ranges,content-range',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'youtubei.googleapis.com'
    || host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'ytimg.com'
    || host.endsWith('.ytimg.com')
    || host === 'googlevideo.com'
    || host.endsWith('.googlevideo.com');
}

function resolveTarget(requestUrl) {
  const incoming = new URL(requestUrl);
  const rawHost = String(incoming.searchParams.get('__host') || '').trim();
  if (!rawHost || rawHost.includes('@') || rawHost.includes('/') || rawHost.includes('\\')) {
    return { error: 'invalid_host', status: 400 };
  }

  let parsed;
  try {
    parsed = new URL(`https://${rawHost}`);
  } catch {
    return { error: 'invalid_host', status: 400 };
  }

  if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    return { error: 'invalid_host', status: 400 };
  }
  if (!isAllowedHost(parsed.hostname)) {
    return { error: 'host_not_allowed', status: 403 };
  }

  const target = new URL('https://youtube.invalid/');
  target.hostname = parsed.hostname;
  target.pathname = incoming.pathname.slice(PREFIX.length - 1) || '/';
  target.search = incoming.search;
  target.searchParams.delete('__host');
  return { target };
}

function requestHeaders(from) {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = from.get(name);
    if (value) headers.set(name, value);
  }
  headers.delete('authorization');
  headers.delete('cookie');
  headers.delete('proxy-authorization');
  return headers;
}

function responseHeaders(from, env) {
  const headers = new Headers(corsHeaders(env));
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

async function proxy(request, env) {
  if (!METHODS.has(request.method)) {
    return json({ error: 'method_not_allowed' }, 405, corsHeaders(env));
  }

  const resolved = resolveTarget(request.url);
  if (!resolved.target) return json({ error: resolved.error }, resolved.status, corsHeaders(env));

  const init = {
    method: request.method,
    headers: requestHeaders(request.headers),
    redirect: 'follow',
  };
  if (request.method === 'POST') init.body = await request.arrayBuffer();

  try {
    const upstream = await fetch(resolved.target, init);
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream.headers, env),
    });
  } catch {
    return json({ error: 'upstream_unavailable' }, 502, corsHeaders(env));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz' && request.method === 'GET') {
      return json({ ok: true, v: 1, service: 'youtubejs-relay' }, 200, corsHeaders(env));
    }
    if (url.pathname.startsWith(PREFIX) && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (url.pathname.startsWith(PREFIX)) {
      return proxy(request, env);
    }

    return json({ error: 'not_found' }, 404, corsHeaders(env));
  },
};
