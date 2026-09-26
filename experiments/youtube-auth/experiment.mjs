const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const OAUTH_ERRORS = new Set(['authorization_pending', 'slow_down', 'access_denied', 'expired_token', 'invalid_client', 'invalid_grant', 'admin_policy_enforced']);
const PLAYABILITY = new Set(['OK', 'LOGIN_REQUIRED', 'UNPLAYABLE', 'ERROR', 'AGE_CHECK_REQUIRED', 'CONTENT_CHECK_REQUIRED', 'LIVE_STREAM_OFFLINE']);
const PROVIDER = new Set(['accepted', 'rejected', 'unknown', 'anonymous']);

function fixed(value, allowed, fallback) { return allowed.has(value) ? value : fallback; }
function urlBase(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('invalid_relay_url');
  return parsed.origin;
}
function resultView(value) {
  if (!value) return null;
  return {
    provider: fixed(value.provider, PROVIDER, 'unknown'),
    playability: fixed(value.playability, PLAYABILITY, 'UNKNOWN'),
    audioFormats: Number.isInteger(value.audioFormats) ? Math.max(0, Math.min(999, value.audioFormats)) : 0,
    stream: 'untested',
    error: value.error === 'probe_failed' ? 'probe_failed' : null,
  };
}

/** Fixed-target transport for the standalone Google OAuth / TV experiment. */
export function makeTvFetch(base, fetchImpl = fetch, signal = undefined, onBearer = () => {}) {
  const relay = urlBase(base);
  return async (input, init = {}) => {
    if (signal?.aborted) throw Error('probe_canceled');
    const request = new Request(input, init);
    const target = new URL(request.url);
    if (target.protocol !== 'https:' || target.hostname !== 'www.youtube.com' || target.port ||
        !/^\/youtubei\/v1\/(player|next)$/.test(target.pathname) || request.method !== 'POST') throw Error('disallowed_tv_target');
    for (const key of target.searchParams.keys()) if (!['key', 'prettyPrint', 'alt'].includes(key)) throw Error('disallowed_tv_target');
    const headers = new Headers();
    for (const name of ['authorization', 'x-goog-api-key', 'x-goog-visitor-id', 'x-youtube-client-name', 'x-youtube-client-version', 'x-goog-api-format-version', 'x-user-agent']) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    headers.set('content-type', 'application/json');
    const body = await request.text();
    if (signal?.aborted) throw Error('probe_canceled');
    if (headers.has('authorization')) onBearer();
    return fetchImpl(`${relay}/tv/${target.pathname.split('/').at(-1)}${target.search}`, {
      method: 'POST', headers, body, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal,
    });
  };
}

/** No globals or storage: create a separate closure for every open experiment page. */
export function createExperiment({ base, clientId, clientSecret = '', fetchImpl = fetch, probe = probeTv, now = Date.now }) {
  const relay = urlBase(base);
  if (!/^[A-Za-z0-9_.-]{8,256}\.apps\.googleusercontent\.com$/.test(clientId)) throw Error('invalid_client_id');
  if (typeof clientSecret !== 'string' || clientSecret.length > 512) throw Error('invalid_client_secret');
  const client = { client_id: clientId, client_secret: clientSecret };
  let epoch = 0;
  let probeEpoch = 0;
  let pollingEpoch = -1;
  let refreshingEpoch = -1;
  let probeAbort = null;
  let oauth = 'not_started';
  let pendingCode = null;
  let credentials = null;
  let pollAt = 0;
  let deadline = 0;
  let intervalMs = 5000;
  let videoId = null;
  let anonymous = null;
  let authorized = null;
  let authorizedBearerSent = false;
  let stage = 'idle';
  let error = null;

  const report = () => ({ version: 1, oauth, stage, error, videoId, anonymous: resultView(anonymous), authorized: resultView(authorized), authorizedBearerSent, playback: 'untested' });
  const pending = () => pendingCode ? { user_code: pendingCode.user_code, verification_url: pendingCode.verification_url, expires_in: Math.max(0, Math.ceil((deadline - now()) / 1000)) } : null;
  async function post(path, data) {
    const response = await fetchImpl(`${relay}/oauth/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data), credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    });
    const json = await response.json();
    // Never include provider response text in exceptions, reports or console output.
    if (!response.ok && !OAUTH_ERRORS.has(json?.error)) throw Error('oauth_transport_failed');
    return json;
  }
  function reset(next) {
    ++epoch;
    ++probeEpoch;
    probeAbort?.abort(); probeAbort = null;
    pendingCode = credentials = null;
    oauth = next;
    stage = 'idle'; error = null;
    authorized = null;
    authorizedBearerSent = false;
    videoId = anonymous = null;
  }
  async function start() {
    reset('starting');
    const current = epoch;
    try {
      const data = await post('device', { client_id: client.client_id });
      if (current !== epoch) return null;
      if (typeof data.device_code !== 'string' || typeof data.user_code !== 'string' ||
          data.verification_url !== 'https://www.google.com/device') throw Error('invalid_device_response');
      intervalMs = Math.max(5000, Number(data.interval || 5) * 1000);
      deadline = now() + Math.max(1, Math.min(1800, Number(data.expires_in || 600))) * 1000;
      pollAt = now() + intervalMs;
      pendingCode = { device_code: data.device_code, user_code: data.user_code, verification_url: data.verification_url };
      oauth = 'pending';
      return pending();
    } catch {
      if (current === epoch) { reset('failed'); error = 'device_start_failed'; }
      return null;
    }
  }
  async function pollOnce() {
    if (oauth !== 'pending') return report();
    if (now() >= deadline) { reset('expired'); return report(); }
    if (now() < pollAt || pollingEpoch === epoch) return report();
    const current = epoch;
    pollingEpoch = current;
    pollAt = now() + intervalMs;
    try {
      const data = await post('token', { client_id: client.client_id, client_secret: client.client_secret,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: pendingCode.device_code });
      if (current !== epoch) return report();
      if (data.error === 'authorization_pending') return report();
      if (data.error === 'slow_down') { intervalMs += 5000; pollAt = now() + intervalMs; return report(); }
      if (data.error) { reset(data.error === 'expired_token' ? 'expired' : 'failed'); error = fixed(data.error, OAUTH_ERRORS, 'oauth_failed'); return report(); }
      if (!data.access_token || !data.refresh_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) < 60) throw Error('invalid_token_response');
      credentials = { access_token: data.access_token, refresh_token: data.refresh_token, expiry_date: new Date(now() + Number(data.expires_in) * 1000).toISOString(), client: { ...client } };
      pendingCode = null;
      oauth = 'authorized';
    } catch {
      if (current === epoch) { reset('failed'); error = 'token_exchange_failed'; }
    } finally { if (pollingEpoch === current) pollingEpoch = -1; }
    return report();
  }
  async function refresh() {
    if (oauth !== 'authorized' || !credentials || refreshingEpoch === epoch) return report();
    const current = epoch;
    refreshingEpoch = current;
    const old = credentials;
    try {
      const data = await post('token', { client_id: client.client_id, client_secret: client.client_secret,
        grant_type: 'refresh_token', refresh_token: old.refresh_token });
      if (current !== epoch) return report();
      if (!data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) < 60) throw Error('invalid_refresh_response');
      credentials = { ...old, access_token: data.access_token, refresh_token: data.refresh_token || old.refresh_token,
        expiry_date: new Date(now() + Number(data.expires_in) * 1000).toISOString() };
    } catch {
      if (current === epoch) { error = 'refresh_failed'; oauth = 'failed'; credentials = null; authorized = null; }
    } finally { if (refreshingEpoch === current) refreshingEpoch = -1; }
    return report();
  }
  function cancel() { reset('canceled'); return report(); }
  async function logout() {
    const token = credentials?.refresh_token;
    reset('signed_out');
    const current = epoch;
    if (token) {
      try { await post('revoke', { token }); }
      catch { if (current === epoch) error = 'revoke_failed'; }
    }
    return report();
  }
  async function compare(id) {
    if (!VIDEO_ID.test(id)) throw Error('invalid_video_id');
    probeAbort?.abort();
    probeAbort = new AbortController();
    const signal = probeAbort.signal;
    videoId = id; anonymous = authorized = null; authorizedBearerSent = false; error = null; stage = 'probing';
    const current = epoch;
    const probeId = ++probeEpoch;
    const safeProbe = async (tokens) => {
      try { return resultView(await probe(id, tokens, relay, fetchImpl, signal, () => {
        if (current === epoch && probeId === probeEpoch) authorizedBearerSent = true;
      })); }
      catch { return resultView({ provider: 'unknown', playability: 'UNKNOWN', error: 'probe_failed' }); }
    };
    const anon = await safeProbe(null);
    if (current !== epoch || probeId !== probeEpoch) return report();
    anonymous = anon;
    if (credentials && oauth === 'authorized') {
      // Refresh outside YouTube.js before it can attempt its own upstream refresh.
      if (new Date(credentials.expiry_date).getTime() - now() < 60000) await refresh();
      if (current !== epoch || probeId !== probeEpoch) return report();
      if (credentials && oauth === 'authorized') {
        const result = await safeProbe({ ...credentials, client: { ...client } });
        if (current !== epoch || probeId !== probeEpoch) return report();
        authorized = result;
      }
    }
    if (current === epoch && probeId === probeEpoch) stage = 'complete';
    return report();
  }
  return { start, pollOnce, cancel, logout, refresh, compare, report, pending };
}

async function probeTv(id, tokens, relay, fetchImpl, signal, onBearer) {
  if (signal.aborted) throw Error('probe_canceled');
  // Import only on explicit Probe; no player decipher/eval and no session cache.
  const { Innertube, ClientType } = await import('https://esm.sh/youtubei.js@18.0.0/web?bundle');
  if (signal.aborted) throw Error('probe_canceled');
  const yt = await Innertube.create({ client_type: ClientType.TV_EMBEDDED, fetch: makeTvFetch(relay, fetchImpl, signal, onBearer),
    generate_session_locally: true, retrieve_player: false, enable_session_cache: false });
  if (signal.aborted) throw Error('probe_canceled');
  if (tokens) await yt.session.signIn(tokens); // Always provide own-client credentials; never invoke built-in TV identity discovery.
  if (signal.aborted) throw Error('probe_canceled');
  const info = await yt.getBasicInfo(id, { client: 'TV' });
  if (signal.aborted) throw Error('probe_canceled');
  const playability = fixed(info?.playability_status?.status, PLAYABILITY, 'UNKNOWN');
  const formats = [...(info?.streaming_data?.adaptive_formats || []), ...(info?.streaming_data?.formats || [])];
  const audioFormats = formats.filter((x) => x?.has_audio || /^audio\//i.test(x?.mime_type || '')).length;
  return { provider: tokens ? 'unknown' : 'anonymous',
    playability, audioFormats, stream: 'untested' };
}
