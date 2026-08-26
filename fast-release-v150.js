(() => {
  'use strict';
  if (window.__AMP_MUSIC_RELEASE_150__) return;
  window.__AMP_MUSIC_RELEASE_150__ = true;

  const RELEASE = '1.5.0';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  window.__AMP_MUSIC_RELEASE__ = RELEASE;
  document.documentElement.dataset.ampMusicRelease = RELEASE;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  };

  function legacyAppleLocalId(trackId) {
    const value = clean(trackId);
    if (!/^\d+$/.test(value)) return '';
    try {
      const encoded = BigInt(value).toString(36).toUpperCase();
      return `A${encoded.padStart(10, '0').slice(-10)}`;
    } catch {
      return '';
    }
  }

  function isAppleTrack(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    return Boolean(clean(track?.appleTrackId)) || badges.includes('Apple Music') || /music\.apple\.com/i.test(clean(track?.sourceUrl));
  }

  function hasRealYouTubeHandle(track) {
    const id = clean(track?.id);
    if (!VIDEO_ID_RE.test(id)) return false;
    const appleTrackId = clean(track?.appleTrackId);
    return !(appleTrackId && legacyAppleLocalId(appleTrackId) === id);
  }

  function syncCurrentTrackId() {
    const library = readJson(LIBRARY_KEY, []);
    const index = Number(localStorage.getItem(CURRENT_KEY));
    if (!Array.isArray(library) || !Number.isInteger(index) || index < 0 || index >= library.length) return;
    const id = String(library[index]?.id || '').trim();
    if (!id) return;
    const state = readJson(PLAYER_STATE_KEY, {});
    if (state.currentId === id) return;
    try { localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...state, currentId: id })); } catch {}
  }

  const status = document.getElementById('status');
  if (status) {
    new MutationObserver(syncCurrentTrackId).observe(status, { childList: true, characterData: true, subtree: true });
  }
  document.getElementById('trackList')?.addEventListener('click', () => queueMicrotask(syncCurrentTrackId));
  syncCurrentTrackId();

  // clean-playback prefers direct audio for Apple-origin tracks. If its proxy
  // sources fail but the resolver already found a real YouTube id, fall back to
  // the original YouTube iframe player instead of reporting the track dead.
  const legacyPlayIndex = window.playIndex;
  let directPlayback = window.ampMusicPlayDirectIndex;

  function wrapDirectPlayback(value) {
    if (typeof value !== 'function' || value.__ampFullYoutubeFallback162) return value;
    const wrapped = async (index) => {
      let result = false;
      try { result = await value(index); } catch (error) { console.warn('[AmpMusic] direct playback failed', error); }
      if (result) return true;

      const library = readJson(LIBRARY_KEY, []);
      if (!Array.isArray(library) || !library.length) return false;
      const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
      const track = library[safeIndex];
      if (!isAppleTrack(track) || !hasRealYouTubeHandle(track) || typeof legacyPlayIndex !== 'function') return false;

      try {
        const fallback = await legacyPlayIndex(safeIndex);
        return fallback !== false;
      } catch (error) {
        console.warn('[AmpMusic] YouTube iframe fallback failed', error);
        return false;
      }
    };
    Object.defineProperty(wrapped, '__ampFullYoutubeFallback162', { value: true });
    return wrapped;
  }

  directPlayback = wrapDirectPlayback(directPlayback);
  try {
    Object.defineProperty(window, 'ampMusicPlayDirectIndex', {
      configurable: true,
      enumerable: true,
      get: () => directPlayback,
      set: (value) => { directPlayback = wrapDirectPlayback(value); },
    });
  } catch {}

  function forceAppleResolution() {
    const resolver = window.ampMusicAppleResolution162;
    if (!resolver?.patchAll) return;
    // Older adapters mark the API object itself and can run their load callback
    // after the v1.6.2 resolver. Clear only our marker, then re-apply the final
    // adapter after all load-event microtasks have settled.
    for (const api of [window.winampMusicAppleImport, window.ampMusicAppleAlbum150, window.ampMusicApplePlaylist150]) {
      try { if (api) delete api.__ampFullResolver162; } catch {}
    }
    resolver.patchAll();
  }

  function scheduleAppleResolution() {
    setTimeout(forceAppleResolution, 0);
    setTimeout(forceAppleResolution, 60);
  }

  function loadAppleResolution() {
    if (document.querySelector('script[data-amp-apple-resolution-162]')) return;
    const script = document.createElement('script');
    script.src = './apple-resolution-v162.js?v=162';
    script.async = true;
    script.setAttribute('data-amp-apple-resolution-162', '1');
    script.addEventListener('load', scheduleAppleResolution, { once: true });
    document.head.appendChild(script);
  }

  const appleAdapterObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node?.tagName !== 'SCRIPT') continue;
        if (/apple-(?:music-import-v064|album-import-v150|playlist-import-v150)\.js/i.test(node.src || '')) {
          node.addEventListener('load', scheduleAppleResolution, { once: true });
        }
      }
    }
  });
  if (document.head) appleAdapterObserver.observe(document.head, { childList: true });

  function loadBackground() {
    if (document.querySelector('script[data-amp-background-150]')) return;
    const script = document.createElement('script');
    script.src = './fast-background-v150.js?v=150';
    script.async = true;
    script.setAttribute('data-amp-background-150', '1');
    document.head.appendChild(script);
  }

  loadAppleResolution();
  if ('requestIdleCallback' in window) requestIdleCallback(loadBackground, { timeout: 2200 });
  else setTimeout(loadBackground, 900);

  window.ampMusicFullYoutubeFallback162 = { isAppleTrack, hasRealYouTubeHandle, wrapDirectPlayback, forceAppleResolution };
  console.info('[AmpMusic] release 1.5.0 adapter ready');
})();
