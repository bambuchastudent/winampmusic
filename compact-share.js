(() => {
  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const GENIUS_MAP_KEY = 'winampmusic.geniusMap.v1';
  const REMOTE_PARAM = 's';
  const FALLBACK_PARAM = 'p';
  const SHARE_CREATE_API = 'https://www.pastepile.com/api/paste';
  const SHARE_RAW_BASE = 'https://www.pastepile.com/raw';
  const ID_PATTERN = /^[\w-]{6,20}$/;
  const SLUG_PATTERN = /^[a-zA-Z0-9-]{3,64}$/;
  const STATUS = document.getElementById('status');

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readLibrary() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function currentTrackId() {
    const id = String(readJson(PLAYER_STATE_KEY, {}).currentId || '').trim();
    return ID_PATTERN.test(id) ? id : '';
  }

  function shareTracks() {
    return readLibrary();
  }

  function compactIds(tracks = shareTracks()) {
    const seen = new Set();
    const ids = [];
    for (const track of tracks) {
      const id = String(track?.id || '').trim();
      if (!ID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function parseCompactIds(value) {
    if (!value) return [];
    const seen = new Set();
    const ids = [];
    for (const id of String(value).split('.')) {
      if (!ID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToBytes(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  }

  async function gzip(bytes) {
    if (!window.CompressionStream || !window.DecompressionStream) return { bytes, compressed: false };
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), compressed: true };
  }

  async function gunzip(bytes) {
    if (!window.DecompressionStream) throw new Error('Compressed share links are not supported by this browser');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function sanitizeGeniusMap(value, allowedIds = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const allowed = allowedIds ? new Set(allowedIds) : null;
    const result = {};
    for (const [videoId, raw] of Object.entries(value)) {
      if (!ID_PATTERN.test(videoId) || (allowed && !allowed.has(videoId)) || !raw || typeof raw !== 'object') continue;
      try {
        const url = new URL(String(raw.url || ''));
        if (!/(^|\.)genius\.com$/i.test(url.hostname)) continue;
        result[videoId] = {
          id: Number(raw.id) || 0,
          url: `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '')}`,
          title: String(raw.title || '').slice(0, 500),
          artist: String(raw.artist || '').slice(0, 250),
        };
      } catch {}
    }
    return result;
  }

  function shareBundle(tracks = shareTracks()) {
    const ids = compactIds(tracks);
    const currentId = currentTrackId();
    return {
      v: 5,
      createdAt: new Date().toISOString(),
      startTrackId: ids.includes(currentId) ? currentId : (ids[0] || ''),
      tracks,
      geniusMap: sanitizeGeniusMap(readJson(GENIUS_MAP_KEY, {}), ids),
    };
  }

  async function encryptBundle(bundle) {
    if (!window.crypto?.subtle) throw new Error('Secure sharing is not supported by this browser');
    const encoded = new TextEncoder().encode(JSON.stringify(bundle));
    const packed = await gzip(encoded);
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed.bytes));
    return {
      key: bytesToBase64Url(rawKey),
      envelope: {
        v: 1,
        z: packed.compressed ? 1 : 0,
        iv: bytesToBase64Url(iv),
        ct: bytesToBase64Url(cipher),
      },
    };
  }

  async function decryptBundle(envelope, keyText) {
    if (!envelope || envelope.v !== 1 || !envelope.iv || !envelope.ct || !keyText) {
      throw new Error('Invalid share payload');
    }
    const keyBytes = base64UrlToBytes(keyText);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(envelope.iv) },
      key,
      base64UrlToBytes(envelope.ct)
    ));
    const unpacked = envelope.z ? await gunzip(plain) : plain;
    return JSON.parse(new TextDecoder().decode(unpacked));
  }

  function appUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('playlist');
    url.searchParams.delete(FALLBACK_PARAM);
    url.searchParams.delete(REMOTE_PARAM);
    url.hash = '';
    return url;
  }

  function buildFallbackShareUrl(ids = compactIds()) {
    const url = appUrl();
    url.searchParams.set(FALLBACK_PARAM, ids.join('.'));
    return url.toString();
  }

  function buildRemoteShareUrl(slug, key) {
    const url = appUrl();
    url.searchParams.set(REMOTE_PARAM, slug);
    url.hash = `k=${encodeURIComponent(key)}`;
    return url.toString();
  }

  function slugFromPasteUrl(value) {
    const text = String(value || '').trim();
    try {
      const url = new URL(text);
      const match = url.pathname.match(/\/p\/([a-zA-Z0-9-]{3,64})\/?$/);
      return match?.[1] || '';
    } catch {
      const match = text.match(/(?:^|\/p\/)([a-zA-Z0-9-]{3,64})\/?$/);
      return match?.[1] || '';
    }
  }

  async function createRemoteShare(tracks = shareTracks()) {
    const encrypted = await encryptBundle(shareBundle(tracks));
    const response = await fetch(SHARE_CREATE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/plain' },
      body: JSON.stringify(encrypted.envelope),
    });
    if (!response.ok) throw new Error(`Share service HTTP ${response.status}`);
    const slug = slugFromPasteUrl(await response.text());
    if (!SLUG_PATTERN.test(slug)) throw new Error('Share service returned an invalid id');
    return buildRemoteShareUrl(slug, encrypted.key);
  }

  function shareData(url, count) {
    return {
      title: 'Winamp Music playlist',
      text: `Listen to my ${count}-track Winamp Music playlist`,
      url,
    };
  }

  function ensureShareDialog() {
    let dialog = document.getElementById('winampShareDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'winampShareDialog';
    dialog.style.cssText = 'width:min(calc(100% - 24px),620px);border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7);';
    dialog.innerHTML = `
      <div style="padding:16px;display:grid;gap:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><div style="font-size:10px;letter-spacing:.16em;color:#8f98a8;font-weight:800">SHARE PLAYLIST</div><strong id="winampShareHeading">Short link ready</strong></div>
          <button id="winampShareClose" type="button" aria-label="Close" style="border:0;background:transparent;color:#8f98a8;font-size:18px">✕</button>
        </div>
        <p id="winampShareNote" style="margin:0;color:#b4bbc7;font-size:12px;line-height:1.4">Shares the whole playlist and opens on the current track.</p>
        <input id="winampShareUrl" readonly style="width:100%;min-height:42px;border:1px solid #343a46;border-radius:8px;background:#0c0e12;color:#b7f29e;padding:0 10px;font:11px SFMono-Regular,Consolas,monospace" />
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="winampShareCopy" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#2a3039;color:#fff;font-weight:800">Copy link</button>
          <button id="winampShareSystem" type="button" style="min-height:40px;padding:0 14px;border:1px solid #8f7724;border-radius:8px;background:#d8b63f;color:#171717;font-weight:800">Share…</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelector('#winampShareClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#winampShareCopy').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampShareUrl');
      try {
        await navigator.clipboard.writeText(input.value);
        if (STATUS) STATUS.textContent = 'SHORT LINK COPIED';
      } catch {
        input.focus();
        input.select();
        document.execCommand?.('copy');
        if (STATUS) STATUS.textContent = 'LINK SELECTED';
      }
    });
    dialog.querySelector('#winampShareSystem').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampShareUrl');
      const count = Number(dialog.dataset.count || 0);
      if (!navigator.share) {
        input.focus();
        input.select();
        return;
      }
      try {
        await navigator.share(shareData(input.value, count));
        if (STATUS) STATUS.textContent = 'PLAYLIST SHARED';
      } catch {}
    });
    return dialog;
  }

  async function showShareLink(url, count, fallback = false) {
    const dialog = ensureShareDialog();
    dialog.dataset.count = String(count);
    dialog.querySelector('#winampShareHeading').textContent = fallback ? 'Fallback link ready' : 'Short link ready';
    dialog.querySelector('#winampShareNote').textContent = fallback
      ? 'The short-link service is unavailable, so this URL is longer. It still imports the full playlist.'
      : `Whole playlist · ${count} tracks · opens on current track`;
    const input = dialog.querySelector('#winampShareUrl');
    input.value = url;
    dialog.querySelector('#winampShareSystem').hidden = !navigator.share;

    try {
      await navigator.clipboard?.writeText(url);
      if (STATUS) STATUS.textContent = fallback ? 'FALLBACK LINK COPIED' : 'SHORT LINK COPIED';
    } catch {
      if (STATUS) STATUS.textContent = fallback ? 'FALLBACK LINK READY' : 'SHORT LINK READY';
    }

    if (!dialog.open) dialog.showModal();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  async function shareCompactPlaylist() {
    const tracks = shareTracks();
    const ids = compactIds(tracks);
    if (!ids.length) {
      if (STATUS) STATUS.textContent = 'NO TRACKS TO SHARE';
      return;
    }

    if (STATUS) STATUS.textContent = 'CREATING SHORT LINK';
    try {
      const remoteUrl = await createRemoteShare(tracks);
      await showShareLink(remoteUrl, ids.length, false);
    } catch (error) {
      console.warn('[Winamp Music share] remote short link failed, using URL fallback', error);
      await showShareLink(buildFallbackShareUrl(ids), ids.length, true);
    }
  }

  function installShareButton() {
    const oldButton = document.getElementById('sharePlaylistButton');
    if (!oldButton || oldButton.dataset.compactShare === '1') return;
    const button = oldButton.cloneNode(true);
    button.dataset.compactShare = '1';
    oldButton.replaceWith(button);
    button.addEventListener('click', shareCompactPlaylist);
  }

  function mergeSharedGeniusMap(value) {
    const incoming = sanitizeGeniusMap(value);
    if (!Object.keys(incoming).length) return;
    const current = sanitizeGeniusMap(readJson(GENIUS_MAP_KEY, {}));
    localStorage.setItem(GENIUS_MAP_KEY, JSON.stringify({ ...current, ...incoming }));
  }

  function sharedStartTrackId(bundle) {
    const startId = String(bundle?.startTrackId || bundle?.tracks?.[0]?.id || '').trim();
    return ID_PATTERN.test(startId) ? startId : '';
  }

  function applySharedStartTrack(bundle) {
    const startId = sharedStartTrackId(bundle);
    if (!startId) return;
    const state = readJson(PLAYER_STATE_KEY, {});
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...state, currentId: startId }));

    const index = readLibrary().findIndex((track) => track?.id === startId);
    if (index >= 0 && typeof window.playIndex === 'function') {
      setTimeout(() => window.playIndex(index), 0);
    }
  }

  function applyBundle(bundle) {
    if (!bundle || !Array.isArray(bundle.tracks) || typeof window.importTracks !== 'function') return false;
    const result = window.importTracks(bundle.tracks);
    mergeSharedGeniusMap(bundle.geniusMap);
    applySharedStartTrack(bundle);
    if (STATUS) {
      STATUS.textContent = result.added
        ? `SHARED PLAYLIST IMPORTED (${result.total})`
        : 'SHARED PLAYLIST LOADED';
    }
    if (typeof window.refreshWinampMetadata === 'function') {
      setTimeout(() => window.refreshWinampMetadata(), 0);
    }
    return true;
  }

  function hashKey() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return hash.get('k') || '';
  }

  async function loadRemotePlaylist(slug) {
    if (!SLUG_PATTERN.test(slug || '')) throw new Error('Invalid share id');
    const response = await fetch(`${SHARE_RAW_BASE}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'text/plain' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'Shared playlist expired' : `Share service HTTP ${response.status}`);
    const envelope = JSON.parse(await response.text());
    const bundle = await decryptBundle(envelope, hashKey());
    if (!applyBundle(bundle)) throw new Error('Shared playlist is invalid');
  }

  function loadFallbackPlaylist(value) {
    const ids = parseCompactIds(value);
    if (!ids.length || typeof window.importTracks !== 'function') return false;
    return applyBundle({ v: 1, startTrackId: ids[0], tracks: ids.map((id) => ({ id })) });
  }

  async function loadSharedPlaylist() {
    if (typeof window.importTracks !== 'function') return false;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get(REMOTE_PARAM);
    if (slug) {
      if (STATUS) STATUS.textContent = 'LOADING SHARED PLAYLIST';
      try {
        await loadRemotePlaylist(slug);
      } catch (error) {
        console.warn('[Winamp Music share]', error);
        if (STATUS) STATUS.textContent = error.message.toUpperCase();
      }
      return true;
    }
    const fallback = params.get(FALLBACK_PARAM);
    if (fallback) {
      if (STATUS) STATUS.textContent = 'LOADING SHARED PLAYLIST';
      loadFallbackPlaylist(fallback);
    }
    return true;
  }

  async function boot(attempt = 0) {
    installShareButton();
    if (typeof window.importTracks === 'function') {
      await loadSharedPlaylist();
      return;
    }
    if (attempt < 80) setTimeout(() => boot(attempt + 1), 50);
  }

  window.winampMusicCompactShare = {
    buildFallbackUrl: buildFallbackShareUrl,
    createRemoteShare,
    share: shareCompactPlaylist,
    tracksFromCurrent: shareTracks,
    load: loadSharedPlaylist,
  };
  window.sharePlaylist = shareCompactPlaylist;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
})();