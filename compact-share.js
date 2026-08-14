(() => {
  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const GENIUS_MAP_KEY = 'winampmusic.geniusMap.v1';
  const REMOTE_PARAM = 's';
  const FALLBACK_PARAM = 'p';
  const SHARE_API = 'https://pastepile.com/api/public/pastes';
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
    const tracks = readLibrary();
    const currentId = currentTrackId();
    if (!currentId) return tracks;
    const currentIndex = tracks.findIndex((track) => track?.id === currentId);
    return currentIndex >= 0 ? tracks.slice(currentIndex) : tracks;
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
    return {
      v: 3,
      createdAt: new Date().toISOString(),
      startTrackId: ids[0] || '',
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

  async function createRemoteShare(tracks = shareTracks()) {
    const encrypted = await encryptBundle(shareBundle(tracks));
    const body = {
      title: 'Winamp Music playlist',
      content: JSON.stringify(encrypted.envelope),
      language: 'json',
      expiry: '1w',
      visibility: 'unlisted',
    };
    const response = await fetch(SHARE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Share service HTTP ${response.status}`);
    const data = await response.json();
    if (!SLUG_PATTERN.test(data?.slug || '')) throw new Error('Share service returned an invalid id');
    return buildRemoteShareUrl(data.slug, encrypted.key);
  }

  function shareData(url, count) {
    return {
      title: 'Winamp Music playlist',
      text: `Listen from the current track · ${count} tracks`,
      url,
    };
  }

  async function deliverShare(url, count) {
    if (navigator.share) {
      await navigator.share(shareData(url, count));
      if (STATUS) STATUS.textContent = 'PLAYLIST SHARED';
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      if (STATUS) STATUS.textContent = 'SHORT LINK COPIED';
      return;
    }
    window.prompt('Copy playlist URL', url);
    if (STATUS) STATUS.textContent = 'SHORT SHARE LINK READY';
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
      await deliverShare(remoteUrl, ids.length);
    } catch (error) {
      console.warn('[Winamp Music share] remote short link failed, using URL fallback', error);
      try {
        await deliverShare(buildFallbackShareUrl(ids), ids.length);
        if (STATUS) STATUS.textContent = 'SHORT SERVICE UNAVAILABLE · LINK COPIED';
      } catch {
        if (STATUS) STATUS.textContent = 'SHARE CANCELLED';
      }
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

  function setSharedStartTrack(bundle) {
    const startId = String(bundle?.startTrackId || bundle?.tracks?.[0]?.id || '').trim();
    if (!ID_PATTERN.test(startId)) return;
    const state = readJson(PLAYER_STATE_KEY, {});
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...state, currentId: startId }));
  }

  function applyBundle(bundle) {
    if (!bundle || !Array.isArray(bundle.tracks) || typeof window.importTracks !== 'function') return false;
    const result = window.importTracks(bundle.tracks);
    mergeSharedGeniusMap(bundle.geniusMap);
    setSharedStartTrack(bundle);
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
    const response = await fetch(`${SHARE_API}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'Shared playlist expired' : `Share service HTTP ${response.status}`);
    const data = await response.json();
    const content = data?.files?.[0]?.content;
    if (!content) throw new Error('Shared playlist is empty');
    const bundle = await decryptBundle(JSON.parse(content), hashKey());
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
    if (fallback) loadFallbackPlaylist(fallback);
    return true;
  }

  async function boot(attempt = 0) {
    installShareButton();
    if (typeof window.importTracks === 'function') {
      await loadSharedPlaylist();
      return;
    }
    if (attempt < 40) setTimeout(() => boot(attempt + 1), 50);
  }

  window.winampMusicCompactShare = {
    buildFallbackUrl: buildFallbackShareUrl,
    createRemoteShare,
    share: shareCompactPlaylist,
    tracksFromCurrent: shareTracks,
  };
  window.sharePlaylist = shareCompactPlaylist;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
})();