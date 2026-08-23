(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_URL_ROUTE_151__) return;
  window.__AMP_MUSIC_APPLE_URL_ROUTE_151__ = true;

  const form = document.getElementById('fastImportForm');
  const input = document.getElementById('fastImportInput');
  const hint = document.getElementById('fastImportHint');
  if (!form || !input) return;

  function appleUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function open(url) {
    if (window.ampMusicAppleNoAd150?.openAppleUrl) {
      return window.ampMusicAppleNoAd150.openAppleUrl(url);
    }
    try {
      const popup = window.open(url, '_blank');
      if (popup) {
        try { popup.opener = null; } catch {}
        return true;
      }
    } catch {}
    try {
      window.location.assign(url);
      return true;
    } catch {
      return false;
    }
  }

  form.addEventListener('submit', (event) => {
    const url = appleUrl(input.value);
    if (!url) return;

    // Open the provider URL while the submit is still a trusted user gesture.
    // The normal importer is allowed to continue in the background so AmpMusic
    // still keeps metadata/library state, but its one automatic play is suppressed.
    window.__AMP_MUSIC_APPLE_SKIP_NEXT_PLAY__ = true;
    const opened = open(url);
    if (hint) hint.textContent = opened
      ? 'Opened in Apple Music · importing in background'
      : 'Could not open Apple Music URL';
  }, true);

  console.info('[AmpMusic] Apple URL routing 1.5.1 ready');
})();
