(() => {
  'use strict';
  if (window.__AMP_MUSIC_LEGACY_SHARE_V1__) return;
  window.__AMP_MUSIC_LEGACY_SHARE_V1__ = true;

  const LIBRARY_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const GENIUS_MAP_KEY = 'winampmusic.geniusMap.v1';
  const REMOTE_PARAM = 's';
  const FALLBACK_PARAM = 'p';
  const SHARE_RAW_BASE = 'https://www.pastepile.com/raw';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const SLUG_PATTERN = /^[a-zA-Z0-9-]{3,64}$/;
  const STATUS = document.getElementById('status');

  const clean = (value) => String(value ?? '').trim();
  const setStatus = (text) => { if (STATUS) STATUS.textContent = text; };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function parseLegacyIds(value) {
    const seen = new Set();
    const ids = [];
    for (const raw of String(value || '').split('.')) {
      const id = clean(raw);
      if (!VIDEO_ID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function bytesFromBase64Url(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  }

  async function gunzip(bytes) {
    if (!window.DecompressionStream) throw new Error('Compressed legacy shares are not supported by this browser');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decryptBundle(envelope, keyText) {
    if (!window.crypto?.subtle || !envelope || envelope.v !== 1 || !envelope.iv || !envelope.ct || !keyText) {
      throw new Error('Invalid legacy share payload');
    }
    const key = await crypto.subtle.importKey('raw', bytesFromBase64Url(keyText), { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesFromBase64Url(envelope.iv) },
      key,
      bytesFromBase64Url(envelope.ct)
    ));
    const unpacked = envelope.z ? await gunzip(plain) : plain;
    return JSON.parse(new TextDecoder().decode(unpacked));
  }

  function sanitizeGeniusMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const [videoId, raw] of Object.entries(value)) {
      if (!VIDEO_ID_RE.test(videoId) || !raw || typeof raw !== 'object') continue;
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

  function mergeSharedGeniusMap(value) {
    const incoming = sanitizeGeniusMap(value);
    if (!Object.keys(incoming).length) return;
    const current = sanitizeGeniusMap(readJson(GENIUS_MAP_KEY, {}));
    try { localStorage.setItem(GENIUS_MAP_KEY, JSON.stringify({ ...current, ...incoming })); } catch {}
  }

  function libraryIndex(videoId) {
    const library = readJson(LIBRARY_KEY, []);
    return Array.isArray(library) ? library.findIndex((track) => clean(track?.id) === videoId) : -1;
  }

  function applyStartTrack(startId) {
    const id = VIDEO_ID_RE.test(clean(startId)) ? clean(startId) : '';
    if (!id) return;
    try {
      const state = readJson(PLAYER_STATE_KEY, {});
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...state, currentId: id }));
    } catch {}
    const index = libraryIndex(id);
    if (index >= 0 && typeof window.playIndex === 'function') {
      setTimeout(() => window.playIndex(index), 0);
    }
  }

  function normalizeLegacyTracks(tracks) {
    const source = Array.isArray(tracks) ? tracks : [];
    const seen = new Set();
    const out = [];
    for (const track of source) {
      const id = clean(track?.id);
      if (!VIDEO_ID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ ...track, id });
    }
    return out;
  }

  function applyBundle(bundle) {
    if (typeof window.importTracks !== 'function') return false;
    const tracks = normalizeLegacyTracks(bundle?.tracks);
    if (!tracks.length) return false;
    const result = window.importTracks(tracks);
    mergeSharedGeniusMap(bundle?.geniusMap);
    const requestedStart = clean(bundle?.startTrackId);
    const startId = VIDEO_ID_RE.test(requestedStart) ? requestedStart : tracks[0].id;
    applyStartTrack(startId);
    setStatus(`LEGACY SHARE RESTORED · ${tracks.length} TRACKS`);
    if (typeof window.refreshWinampMetadata === 'function') setTimeout(() => window.refreshWinampMetadata(), 0);
    return Boolean(result || tracks.length);
  }

  function loadFallbackPlaylist(value) {
    const ids = parseLegacyIds(value);
    if (!ids.length) {
      setStatus('LEGACY SHARE INVALID');
      return false;
    }
    return applyBundle({
      v: 1,
      startTrackId: ids[0],
      tracks: ids.map((id) => ({ id })),
    });
  }

  function hashKey() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    return hash.get('k') || '';
  }

  async function loadRemotePlaylist(slug) {
    if (!SLUG_PATTERN.test(slug || '')) throw new Error('Invalid legacy share id');
    const response = await fetch(`${SHARE_RAW_BASE}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'text/plain' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'Legacy share expired' : `Legacy share HTTP ${response.status}`);
    const bundle = await decryptBundle(JSON.parse(await response.text()), hashKey());
    if (!applyBundle(bundle)) throw new Error('Legacy share is invalid');
  }

  async function loadFromLocation() {
    const params = new URLSearchParams(location.search);
    const remote = clean(params.get(REMOTE_PARAM));
    if (remote) {
      setStatus('OPENING LEGACY SHARE');
      try {
        await loadRemotePlaylist(remote);
      } catch (error) {
        console.warn('[AMPULAMP legacy share]', error);
        setStatus('LEGACY SHARE UNAVAILABLE');
      }
      return true;
    }

    if (params.has(FALLBACK_PARAM)) {
      setStatus('OPENING LEGACY SHARE');
      loadFallbackPlaylist(params.get(FALLBACK_PARAM));
      return true;
    }
    return false;
  }

  async function boot(attempt = 0) {
    const params = new URLSearchParams(location.search);
    if (!params.has(FALLBACK_PARAM) && !params.has(REMOTE_PARAM)) return false;
    if (typeof window.importTracks === 'function') return loadFromLocation();
    if (attempt < 80) {
      setTimeout(() => void boot(attempt + 1), 50);
      return true;
    }
    setStatus('LEGACY SHARE COULD NOT LOAD');
    return true;
  }

  window.winampMusicLegacyShare = {
    load: loadFromLocation,
    parseIds: parseLegacyIds,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
  } else {
    void boot();
  }
})();
