// Standalone operator-only OAuth / TV metadata experiment. No storage or general proxy.
const CLIENT_ID = /^[A-Za-z0-9_.-]{8,256}\.apps\.googleusercontent\.com$/;
const SECRET = /^[\x20-\x7e]{0,512}$/;
const TOKEN = /^[A-Za-z0-9._~+\/-]{1,4096}$/;
const CODE = /^[\x20-\x7e]{1,2048}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const OAUTH_ERRORS = new Set(['authorization_pending', 'slow_down', 'access_denied', 'expired_token', 'invalid_client', 'invalid_grant', 'admin_policy_enforced']);
const TV_HEADERS = ['authorization', 'x-goog-api-key', 'x-goog-visitor-id', 'x-youtube-client-name', 'x-youtube-client-version', 'x-goog-api-format-version', 'x-user-agent'];
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
const ROUTES = new Map([
  ['/oauth/device', 'https://oauth2.googleapis.com/device/code'],
  ['/oauth/token', 'https://oauth2.googleapis.com/token'],
  ['/oauth/revoke', 'https://oauth2.googleapis.com/revoke'],
  ['/tv/player', 'https://www.youtube.com/youtubei/v1/player'],
  ['/tv/next', 'https://www.youtube.com/youtubei/v1/next'],
]);

function origin(env) {
  try {
    const url = new URL(env?.APP_ORIGIN);
    return url.protocol === 'https:' && url.origin === env.APP_ORIGIN && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' ? url.origin : null;
  } catch { return null; }
}
function headers(allowed) {
  return { 'access-control-allow-origin': allowed, 'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': `content-type,${TV_HEADERS.join(',')}`, 'cache-control': 'no-store', vary: 'Origin' };
}
function json(body, status, allowed) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(allowed), 'content-type': 'application/json; charset=utf-8' } });
}
const reject = (allowed, status = 400) => json({ error: 'request_rejected' }, status, allowed);
function exactKeys(obj, required, optional = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}
async function bodyOf(request) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) throw Error('content_type');
  const text = await request.text();
  if (text.length > 32768) throw Error('body_size');
  return JSON.parse(text);
}
function oauthForm(path, body) {
  if (path === '/oauth/device') {
    if (!exactKeys(body, ['client_id']) || !matches(CLIENT_ID, body.client_id)) return null;
    return new URLSearchParams({ client_id: body.client_id, scope: 'https://www.googleapis.com/auth/youtube.readonly' });
  }
  if (path === '/oauth/revoke') {
    if (!exactKeys(body, ['token']) || !matches(TOKEN, body.token)) return null;
    return new URLSearchParams({ token: body.token });
  }
  if (!exactKeys(body, ['client_id', 'client_secret', 'grant_type'], ['device_code', 'refresh_token']) ||
      !matches(CLIENT_ID, body.client_id) || !matches(SECRET, body.client_secret)) return null;
  if (body.grant_type === 'urn:ietf:params:oauth:grant-type:device_code' &&
      exactKeys(body, ['client_id', 'client_secret', 'grant_type', 'device_code']) && matches(CODE, body.device_code)) return new URLSearchParams(body);
  if (body.grant_type === 'refresh_token' &&
      exactKeys(body, ['client_id', 'client_secret', 'grant_type', 'refresh_token']) && matches(TOKEN, body.refresh_token)) return new URLSearchParams(body);
  return null;
}
function oauthReply(path, value, status) {
  if (path === '/oauth/revoke') return { body: { revoked: status >= 200 && status < 300 }, status: status >= 200 && status < 300 ? 200 : 502 };
  if (value?.error) return { body: { error: OAUTH_ERRORS.has(value.error) ? value.error : 'oauth_failed' }, status: value.error === 'authorization_pending' || value.error === 'slow_down' ? 428 : 400 };
  if (status < 200 || status >= 300) return { body: { error: 'oauth_failed' }, status: 502 };
  if (path === '/oauth/device') {
    const { device_code, user_code, verification_url, interval, expires_in } = value || {};
    if (!matches(CODE, device_code) || !matches(CODE, user_code) || !['https://www.google.com/device', 'https://google.com/device'].includes(verification_url)) return { body: { error: 'oauth_failed' }, status: 502 };
    const seconds = interval === undefined ? 5 : Number(interval);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) return { body: { error: 'oauth_failed' }, status: 502 };
    return { body: { device_code, user_code, verification_url: 'https://www.google.com/device', interval: Math.max(5, seconds), expires_in: Math.max(1, Math.min(1800, Number(expires_in) || 600)) }, status: 200 };
  }
  if (!matches(TOKEN, value?.access_token) ||
      (value?.refresh_token !== undefined && !matches(TOKEN, value.refresh_token)) ||
      !Number.isFinite(Number(value?.expires_in)) || Number(value.expires_in) < 60) return { body: { error: 'oauth_failed' }, status: 502 };
  return { body: { access_token: value.access_token, refresh_token: value.refresh_token, expires_in: Math.max(0, Math.min(86400, Number(value.expires_in))), token_type: 'Bearer' }, status: 200 };
}
function tvTarget(path, search) {
  const params = new URLSearchParams(search);
  for (const [key, value] of params) {
    if (!['key', 'prettyPrint', 'alt'].includes(key) || value.length > 256 || /[^A-Za-z0-9_.-]/.test(value)) return null;
  }
  return `${ROUTES.get(path)}${search}`;
}
export default {
  async fetch(request, env) {
    const allowed = origin(env);
    // No wildcard, missing Origin, cross-origin request, or deployment without explicit setting.
    if (!allowed || request.headers.get('origin') !== allowed) return reject(allowed || 'null', 403);
    const url = new URL(request.url);
    if (!ROUTES.has(url.pathname) || url.hash || (url.search && !url.pathname.startsWith('/tv/'))) return reject(allowed, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(allowed) });
    if (request.method !== 'POST' || request.headers.has('cookie') || request.headers.has('proxy-authorization') ||
        request.headers.has('x-forwarded-authorization')) return reject(allowed, 405);
    const tv = url.pathname.startsWith('/tv/');
    if (!tv && request.headers.has('authorization')) return reject(allowed);
    if (tv && request.headers.has('authorization') && !/^Bearer [A-Za-z0-9._~+\/-]{1,4096}$/.test(request.headers.get('authorization'))) return reject(allowed);
    try {
      const body = await bodyOf(request);
      let target, upstreamBody, forwarded;
      if (tv) {
        target = tvTarget(url.pathname, url.search);
        if (!target || !body || typeof body !== 'object' || Array.isArray(body) || !matches(VIDEO_ID, body.videoId)) return reject(allowed);
        upstreamBody = JSON.stringify(body);
        forwarded = new Headers({ 'content-type': 'application/json' });
        for (const name of TV_HEADERS) if (request.headers.has(name)) forwarded.set(name, request.headers.get(name));
      } else {
        const form = oauthForm(url.pathname, body);
        if (!form) return reject(allowed);
        target = ROUTES.get(url.pathname);
        upstreamBody = form;
        forwarded = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
      }
      const upstream = await fetch(target, { method: 'POST', headers: forwarded, body: upstreamBody, redirect: 'manual', cache: 'no-store' });
      if (upstream.status >= 300 && upstream.status < 400) return reject(allowed, 502);
      const data = await upstream.text();
      if (data.length > 1_000_000) return reject(allowed, 502);
      let parsed;
      if (url.pathname === '/oauth/revoke' && upstream.ok && !data.trim()) parsed = {};
      else try { parsed = JSON.parse(data); } catch { return reject(allowed, 502); }
      if (tv) return json(parsed, upstream.ok ? 200 : 502, allowed);
      const result = oauthReply(url.pathname, parsed, upstream.status);
      return json(result.body, result.status, allowed);
    } catch { return reject(allowed, 502); }
  },
};
