(() => {
  'use strict';
  if (window.__AMP_MUSIC_STABLE_150__) return;
  window.__AMP_MUSIC_STABLE_150__ = true;

  const ALLOWED_IMPORT_ORIGINS = new Set([
    'https://www.youtube.com',
    'https://youtube.com',
    'https://music.youtube.com',
  ]);
  const clean = (value) => String(value || '').trim();

  window.addEventListener('message', (event) => {
    if (!ALLOWED_IMPORT_ORIGINS.has(event.origin)) return;
    const payload = event.data;
    if (!payload || payload.type !== 'WINAMP_MUSIC_IMPORT' || payload.version !== 1) return;
    if (!Array.isArray(payload.tracks) || typeof window.importTracks !== 'function') return;

    const result = window.importTracks(payload.tracks);
    if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage({
        type: 'WINAMP_MUSIC_IMPORT_ACK',
        version: 1,
        added: result?.added || 0,
        total: result?.total || 0,
      }, event.origin);
    }
  });

  async function registerPwa() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./sw.js?v=162', { updateViaCache: 'none' });
    } catch (error) {
      console.warn('[AmpMusic] PWA registration failed', error);
    }
  }

  function loadOriginPlaybackBridge() {
    if (window.__AMP_MUSIC_ORIGIN_PLAYBACK_151__) return;
    const existing = document.querySelector('script[data-amp-origin-playback-151]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = './origin-playback-v151.js?v=151';
    script.async = true;
    script.dataset.ampOriginPlayback151 = '1';
    script.addEventListener('error', () => console.warn('[AmpMusic] origin/playback bridge failed to load'), { once: true });
    document.head.appendChild(script);
  }

  function isSpotifyPlaylist(value) {
    const text = clean(value);
    if (text.replace(/\/$/, '') === 'https://share.google/T0seuEuCz8Wdpksp3') return true;
    try {
      const url = new URL(text);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      return host === 'open.spotify.com' && url.pathname.split('/').filter(Boolean).includes('playlist');
    } catch {
      return false;
    }
  }

  function loadSpotifyOrigin() {
    if (window.ampulaSpotifyOrigin162?.importPlaylist) return Promise.resolve(window.ampulaSpotifyOrigin162);
    const existing = document.querySelector('script[data-amp-spotify-origin-162]');
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('Spotify origin module timeout')), 8000);
      const ready = () => {
        clearTimeout(timeout);
        if (window.ampulaSpotifyOrigin162?.importPlaylist) resolve(window.ampulaSpotifyOrigin162);
        else reject(new Error('Spotify origin module unavailable'));
      };
      script.addEventListener('load', ready, { once: true });
      script.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Spotify origin module failed to load')); }, { once: true });
      if (!existing) {
        script.src = './spotify-origin-import-v162.js?v=162';
        script.async = true;
        script.dataset.ampSpotifyOrigin162 = '1';
        document.head.appendChild(script);
      }
    });
  }

  // Remove the previous visible Spotify Embed experiment before the unified entry boots.
  try { localStorage.removeItem('ampula.spotifySource.v1'); } catch {}
  document.getElementById('spotifySourcePanel')?.remove();

  document.getElementById('fastImportForm')?.addEventListener('submit', (event) => {
    const input = document.getElementById('fastImportInput');
    if (!isSpotifyPlaylist(input?.value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = document.getElementById('fastImportButton');
    const hint = document.getElementById('fastImportHint');
    if (button) { button.disabled = true; button.textContent = 'Importing…'; }
    if (hint) hint.textContent = 'Reading Spotify playlist…';
    loadSpotifyOrigin()
      .then((api) => api.importPlaylist(input.value, {
        input,
        play: true,
        onStatus: (state) => {
          if (hint && state?.message) hint.textContent = state.message;
          if (['imported', 'done', 'error'].includes(state?.phase) && button) {
            button.disabled = false;
            button.textContent = 'Search';
          }
        },
      }))
      .catch((error) => {
        console.warn('[AmpMusic] Spotify origin import unavailable', error);
        if (hint) hint.textContent = 'Spotify playlist metadata unavailable';
        if (button) { button.disabled = false; button.textContent = 'Search'; }
      });
  }, true);

  // Register after the FAST shell is interactive. The inherited FAST runtime still
  // performs one delayed stale-worker cleanup, so re-register once after that window.
  if (document.readyState === 'complete') registerPwa();
  else window.addEventListener('load', registerPwa, { once: true });
  setTimeout(registerPwa, 3200);

  loadOriginPlaybackBridge();
  console.info('[AmpMusic] stable 1.6.2 bridge ready');
})();
