(() => {
  if (window.__WINAMP_MUSIC_CORE_INTERACTIONS_V13__) return;
  window.__WINAMP_MUSIC_CORE_INTERACTIONS_V13__ = true;

  const LIBRARY_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const VERSION = '1.3';

  const byId = (id) => document.getElementById(id);
  const status = byId('status');
  const playButton = byId('playButton');
  const prevButton = byId('prevButton');
  const nextButton = byId('nextButton');
  const shuffleButton = byId('shuffleButton');
  const search = byId('search');
  const list = byId('trackList');

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function library() {
    const value = readJson(LIBRARY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function currentIndex() {
    const tracks = library();
    if (!tracks.length) return -1;
    const saved = readJson(PLAYER_STATE_KEY, {});
    const index = tracks.findIndex((track) => track?.id === saved.currentId);
    return index >= 0 ? index : 0;
  }

  function callPlayIndex(index) {
    if (typeof window.playIndex !== 'function') return false;
    window.playIndex(index);
    return true;
  }

  function youtubeCommand(func, args = []) {
    const iframe = document.querySelector('#youtubePlayer iframe, iframe#youtubePlayer');
    if (!iframe?.contentWindow) return false;
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
      return true;
    } catch {
      return false;
    }
  }

  function togglePlayback() {
    const tracks = library();
    if (!tracks.length) {
      byId('importHelpButton')?.click();
      return;
    }

    const state = String(status?.textContent || '').trim().toUpperCase();
    if (state === 'PLAYING') {
      if (youtubeCommand('pauseVideo')) {
        if (status) status.textContent = 'PAUSED';
        if (playButton) playButton.textContent = '▶';
      }
      return;
    }

    const index = currentIndex();
    if (state === 'PAUSED' && youtubeCommand('playVideo')) {
      if (status) status.textContent = 'PLAYING';
      if (playButton) playButton.textContent = '⏸';
      return;
    }
    callPlayIndex(index >= 0 ? index : 0);
  }

  function previousTrack() {
    const tracks = library();
    if (!tracks.length) return;
    const index = currentIndex();
    callPlayIndex(index <= 0 ? tracks.length - 1 : index - 1);
  }

  function nextTrack() {
    const tracks = library();
    if (!tracks.length) return;
    const index = currentIndex();
    callPlayIndex(index < 0 ? 0 : (index + 1) % tracks.length);
  }

  function randomTrack() {
    const tracks = library();
    if (!tracks.length) return;
    if (tracks.length === 1) {
      callPlayIndex(0);
      return;
    }
    const index = currentIndex();
    let next = index;
    while (next === index) next = Math.floor(Math.random() * tracks.length);
    callPlayIndex(next);
  }

  function filterLibrary() {
    if (typeof window.renderLibrary === 'function') {
      window.renderLibrary();
      return;
    }
    const q = String(search?.value || '').trim().toLocaleLowerCase();
    list?.querySelectorAll('.track').forEach((row) => {
      row.hidden = Boolean(q) && !String(row.textContent || '').toLocaleLowerCase().includes(q);
    });
  }

  function protectInteractiveSurface() {
    if (byId('coreInteractionV13Styles')) return;
    const style = document.createElement('style');
    style.id = 'coreInteractionV13Styles';
    style.textContent = `
      #search,.controls,.track-list,.header-actions,.skin-actions,.top-actions,.volume-row{position:relative;z-index:20}
      #search,.controls button,.track-main,.header-actions button,.skin-actions button,.top-actions button,.top-actions a{pointer-events:auto!important}
      .track-main{cursor:pointer}
      .wm-core-health{position:fixed;right:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:9998;padding:5px 8px;border:1px solid #35533c;border-radius:999px;background:#101711;color:#9df582;font:700 9px SFMono-Regular,Consolas,monospace;letter-spacing:.08em;pointer-events:none;opacity:.72}
    `;
    document.head.appendChild(style);
  }

  function healthBadge() {
    let node = byId('wmCoreHealth');
    if (!node) {
      node = document.createElement('div');
      node.id = 'wmCoreHealth';
      node.className = 'wm-core-health';
      document.body.appendChild(node);
    }
    const ready = typeof window.playIndex === 'function' && typeof window.renderLibrary === 'function';
    node.textContent = ready ? `CORE v${VERSION} · READY` : `CORE v${VERSION} · RECOVERING`;
    node.dataset.ready = String(ready);
    return ready;
  }

  function intercept(button, action) {
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      action();
    }, true);
  }

  intercept(playButton, togglePlayback);
  intercept(prevButton, previousTrack);
  intercept(nextButton, nextTrack);
  intercept(shuffleButton, randomTrack);

  search?.addEventListener('input', filterLibrary, true);
  search?.addEventListener('search', filterLibrary, true);
  search?.addEventListener('keyup', filterLibrary, true);

  list?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('.track-main') : null;
    if (!target) return;
    const row = target.closest('.track');
    const index = Number(row?.dataset.index);
    if (!Number.isInteger(index)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    callPlayIndex(index);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (event.code === 'Space') {
      event.preventDefault();
      togglePlayback();
    }
  }, true);

  protectInteractiveSurface();
  healthBadge();
  const healthTimer = setInterval(() => {
    if (healthBadge()) clearInterval(healthTimer);
  }, 200);
  setTimeout(() => clearInterval(healthTimer), 12000);

  const footer = document.querySelector('.app-version');
  if (footer) footer.textContent = `v${VERSION}`;

  window.winampMusicCoreV13 = {
    togglePlayback,
    previousTrack,
    nextTrack,
    randomTrack,
    filterLibrary,
    health: () => healthBadge(),
  };
})();
