(() => {
  'use strict';
  if (window.__AMP_MUSIC_RELEASE_150__) return;
  window.__AMP_MUSIC_RELEASE_150__ = true;

  const RELEASE = '1.5.0';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';

  window.__AMP_MUSIC_RELEASE__ = RELEASE;
  document.documentElement.dataset.ampMusicRelease = RELEASE;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  };

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

  function loadBackground() {
    if (document.querySelector('script[data-amp-background-150]')) return;
    const script = document.createElement('script');
    script.src = './fast-background-v150.js?v=150';
    script.async = true;
    script.setAttribute('data-amp-background-150', '1');
    document.head.appendChild(script);
  }

  if ('requestIdleCallback' in window) requestIdleCallback(loadBackground, { timeout: 2200 });
  else setTimeout(loadBackground, 900);

  console.info('[AmpDrop Music] release 1.5.0 adapter ready');
})();
