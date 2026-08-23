(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_URL_ROUTE_151__) return;
  window.__AMP_MUSIC_APPLE_URL_ROUTE_151__ = true;

  const form = document.getElementById('fastImportForm');
  const input = document.getElementById('fastImportInput');
  const hint = document.getElementById('fastImportHint');
  if (!form || !input) return;

  function parseApple(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      return {
        href: url.href,
        type: parts.includes('playlist') ? 'playlist' : 'track',
      };
    } catch {
      return null;
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
    const apple = parseApple(input.value);
    if (!apple) return;

    const opened = open(apple.href);

    if (apple.type === 'playlist') {
      // Playlist URLs are provider-native playback: open them directly and do not
      // spend time matching every entry to another provider first.
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = '';
      if (hint) hint.textContent = opened
        ? 'Opened Apple Music playlist from source URL'
        : 'Could not open Apple Music playlist';
      return;
    }

    // For a single track, keep the existing background metadata import, but do not
    // reopen the provider URL when that importer performs its automatic play step.
    window.__AMP_MUSIC_APPLE_SKIP_NEXT_PLAY__ = true;
    if (hint) hint.textContent = opened
      ? 'Opened in Apple Music · importing in background'
      : 'Could not open Apple Music URL';
  }, true);

  console.info('[AmpMusic] Apple URL routing 1.5.1 ready');
})();
