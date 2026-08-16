(() => {
  if (window.__WINAMP_MUSIC_CORE_INTERACTIONS_V131__) return;
  window.__WINAMP_MUSIC_CORE_INTERACTIONS_V131__ = true;

  const VERSION = '1.3.2';
  const byId = (id) => document.getElementById(id);
  const search = byId('search');
  const list = byId('trackList');

  function filterLibraryFallback() {
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
    if (byId('coreInteractionV131Styles')) return;
    const style = document.createElement('style');
    style.id = 'coreInteractionV131Styles';
    style.textContent = `
      .top-actions,.youtube-import-bar,.skin-actions,.controls,.volume-row,.header-actions,.comments-actions,.dialog-actions,.empty-state,#search,.track-list{position:relative;z-index:20}
      .top-actions button,.top-actions a,.youtube-import-bar input,.youtube-import-bar a,.skin-actions button,.controls button,.volume-row input,.header-actions button,.comments-actions button,.dialog-actions button,.empty-state button,#search,.track-main{pointer-events:auto!important;touch-action:manipulation}
      .controls button,.skin-actions button,.header-actions button,.top-actions button,.top-actions a,.youtube-import-bar a,.empty-state button{-webkit-tap-highlight-color:rgba(255,255,255,.08)}
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

  // v1.3 stole player clicks during capture and prevented the app's own
  // handlers from running. v1.3.2 keeps native click/touch events authoritative
  // and only hardens hit targets without intercepting the event pipeline.
  search?.addEventListener('input', filterLibraryFallback, { passive: true });
  search?.addEventListener('search', filterLibraryFallback, { passive: true });

  protectInteractiveSurface();
  healthBadge();
  const healthTimer = setInterval(() => {
    if (healthBadge()) clearInterval(healthTimer);
  }, 200);
  setTimeout(() => clearInterval(healthTimer), 12000);

  const footer = document.querySelector('.app-version');
  if (footer) footer.textContent = 'v1.3.1';

  window.winampMusicCoreV13 = {
    filterLibrary: filterLibraryFallback,
    health: () => healthBadge(),
  };
})();
