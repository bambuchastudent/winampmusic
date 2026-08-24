(() => {
  'use strict';
  if (window.__AMP_MUSIC_STABLE_150__) return;
  window.__AMP_MUSIC_STABLE_150__ = true;

  const ALLOWED_IMPORT_ORIGINS = new Set([
    'https://www.youtube.com',
    'https://youtube.com',
    'https://music.youtube.com',
  ]);

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
      await navigator.serviceWorker.register('./sw.js?v=150', { updateViaCache: 'none' });
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

  // Register after the FAST shell is interactive. The inherited FAST runtime still
  // performs one delayed stale-worker cleanup, so re-register once after that window.
  if (document.readyState === 'complete') registerPwa();
  else window.addEventListener('load', registerPwa, { once: true });
  setTimeout(registerPwa, 3200);

  loadOriginPlaybackBridge();
  console.info('[AmpMusic] stable 1.5 bridge ready');
})();
