(() => {
  'use strict';
  if (window.__AMPULA_SHORT_LINK_V163__) return;
  window.__AMPULA_SHORT_LINK_V163__ = true;

  // Optional transport alias for Ámpula share links.
  //
  // The canonical self-contained `?a=` link is built first and always remains valid. This module
  // may shorten it, and may dereference a short token back into that same canonical link. It never
  // owns the musical moment: every alias record carries the complete payload, so resolving one
  // rebuilds the canonical URL locally.
  //
  // Spec: openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md

  const ALIAS_PARAM = 'al';
  const AMPULA_PARAM = 'a';
  const PAYLOAD_RE = /^[gj]\.[A-Za-z0-9_-]{8,}$/;
  const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
  const MAX_PAYLOAD_BYTES = 64 * 1024;
  const TIMEOUT_MS = 2500;

  // A public shortener would move the musical moment to an operator with unrelated privacy,
  // retention and availability guarantees. It is never a valid Ámpula alias backend.
  const BLOCKED_HOSTS = [
    'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'is.gd', 'goo.gl', 'ow.ly',
    'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 'v.gd', 't.ly',
  ];

  const STATUS = document.getElementById('status');
  const setStatus = (text) => { if (STATUS) STATUS.textContent = text; };
  const clean = (value) => String(value ?? '').trim();

  function relayBase() {
    const meta = document.querySelector('meta[name="ampula-short-link-relay"]')?.content;
    const raw = clean(window.AMPULA_SHORT_LINK_RELAY || meta);
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:') return '';
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (BLOCKED_HOSTS.includes(host)) return '';
      return `${url.origin}${url.pathname.replace(/\/*$/, '/')}`;
    } catch {
      return '';
    }
  }

  const isEnabled = () => Boolean(relayBase());

  function payloadFromUrl(value) {
    try {
      return clean(new URL(String(value), location.href).searchParams.get(AMPULA_PARAM));
    } catch {
      return '';
    }
  }

  function usablePayload(value) {
    const payload = clean(value);
    if (!PAYLOAD_RE.test(payload)) return '';
    if (payload.length > api.maxPayloadBytes) return '';
    return payload;
  }

  async function requestJson(url, options = {}) {
    if (typeof fetch !== 'function') throw new Error('fetch unavailable');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    // The deadline is enforced here rather than delegated, so a fetch implementation that ignores
    // an abort signal still cannot keep the Share flow waiting on a relay.
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(new Error('alias backend timed out'));
      }, api.timeoutMs);
    });
    try {
      const response = await Promise.race([
        fetch(url, {
          cache: 'no-store',
          ...options,
          ...(controller ? { signal: controller.signal } : {}),
        }),
        deadline,
      ]);
      if (!response?.ok) throw new Error(`alias backend HTTP ${response?.status}`);
      return await Promise.race([response.json(), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function create(shareUrl) {
    const base = relayBase();
    if (!base) return null;
    const payload = usablePayload(payloadFromUrl(shareUrl));
    if (!payload) return null;
    try {
      const body = await requestJson(new URL('a', base).toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ v: 1, payload }),
      });
      const token = clean(body?.token);
      if (!TOKEN_RE.test(token)) return null;
      const url = new URL(clean(body?.url) || new URL(`a/${token}`, base).toString());
      if (url.origin !== new URL(base).origin) return null;
      return { token, url: url.toString(), expiresAt: clean(body?.expiresAt) || null };
    } catch (error) {
      console.info('[AMPULAMP short link] alias unavailable, keeping the self-contained link', error?.message || error);
      return null;
    }
  }

  async function apply(shareUrl, root = document) {
    const alias = await create(shareUrl);
    if (!alias) return null;
    const input = root?.querySelector?.('#winampShareUrl') || document.getElementById('winampShareUrl');
    // Only replace the link this call was asked to shorten; a newer share wins.
    if (input && clean(input.value) === clean(shareUrl)) {
      input.value = alias.url;
      setStatus('SHORT LINK READY');
    }
    return alias.url;
  }

  async function resolve(token) {
    const id = clean(token);
    if (!TOKEN_RE.test(id)) return '';

    // Same-origin static aliases need no configuration and no service.
    try {
      const body = await requestJson(new URL(`a/${id}.json`, location.href).toString(), { method: 'GET' });
      const payload = usablePayload(body?.payload);
      if (payload) return payload;
    } catch {}

    const base = relayBase();
    if (!base) return '';
    try {
      const url = new URL(`a/${id}`, base);
      url.searchParams.set('format', 'json');
      const body = await requestJson(url.toString(), { method: 'GET' });
      return usablePayload(body?.payload);
    } catch {
      return '';
    }
  }

  async function receive() {
    const token = clean(new URLSearchParams(location.search).get(ALIAS_PARAM));
    if (!token) return false;

    setStatus('OPENING SHORT LINK');
    const payload = await resolve(token);
    if (!payload) {
      setStatus('SHORT LINK EXPIRED OR UNAVAILABLE');
      return true;
    }

    const url = new URL(location.href);
    for (const key of [ALIAS_PARAM, 'p', 's', 'playlist']) url.searchParams.delete(key);
    url.searchParams.set(AMPULA_PARAM, payload);
    url.hash = '';
    history.replaceState({}, '', url);

    const load = window.winampMusicCompactShare?.load;
    if (typeof load !== 'function') {
      setStatus('SHARED MUSIC COULD NOT LOAD');
      return true;
    }
    await load();
    return true;
  }

  const api = {
    isEnabled,
    create,
    apply,
    resolve,
    receive,
    timeoutMs: TIMEOUT_MS,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
  };
  window.ampulaShortLink = api;
})();
