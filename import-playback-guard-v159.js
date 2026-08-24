(() => {
  'use strict';
  if (window.__AMP_MUSIC_IMPORT_PLAYBACK_GUARD_159__) return;
  window.__AMP_MUSIC_IMPORT_PLAYBACK_GUARD_159__ = true;

  const playButton = document.getElementById('playButton');
  const isPlaybackActive = () => String(playButton?.textContent || '').includes('⏸');

  function guardMethod(api, methodName, marker) {
    if (!api || api[marker] || typeof api[methodName] !== 'function') return api;
    const original = api[methodName].bind(api);
    api[methodName] = async (value, options = {}) => {
      const requestedPlay = options.play !== false;
      const preserveCurrentPlayback = requestedPlay && isPlaybackActive();
      return original(value, {
        ...options,
        play: preserveCurrentPlayback ? false : requestedPlay,
      });
    };
    api[marker] = true;
    return api;
  }

  function patchAll() {
    guardMethod(window.winampMusicAppleImport, 'handleUrl', '__ampPlaybackGuard159');
    guardMethod(window.ampMusicAppleAlbum150, 'importAlbumUrl', '__ampPlaybackGuard159');
    guardMethod(window.ampMusicApplePlaylist150, 'importPlaylistUrl', '__ampPlaybackGuard159');
  }

  patchAll();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node?.tagName === 'SCRIPT') node.addEventListener('load', () => setTimeout(patchAll, 0), { once: true });
      }
    }
    setTimeout(patchAll, 0);
  }).observe(document.head, { childList: true, subtree: true });
  window.addEventListener('load', patchAll, { once: true });

  window.ampMusicImportPlaybackGuard159 = { patchAll, isPlaybackActive };
  console.info('[ÁmpulaMP] import playback guard 1.5.9 ready');
})();
