(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_NO_AD_FALLBACK_150__) return;
  window.__AMP_MUSIC_APPLE_NO_AD_FALLBACK_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const legacyPlayIndex = window.playIndex;
  if (typeof legacyPlayIndex !== 'function') return;

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function isApple(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    return badges.includes('Apple Music') || Boolean(track?.appleTrackId) || /music\.apple\.com/i.test(clean(track?.sourceUrl));
  }

  window.playIndex = (index) => {
    const library = readLibrary();
    if (library.length) {
      const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
      const track = library[safeIndex];
      if (isApple(track)) {
        const status = document.getElementById('status');
        const play = document.getElementById('playButton');
        if (status) status.textContent = 'APPLE AUDIO UNAVAILABLE · NO AD FALLBACK';
        if (play) play.textContent = '▶';
        console.warn('[AmpMusic] blocked YouTube iframe fallback for Apple track', track?.title || track?.id);
        return false;
      }
    }
    return legacyPlayIndex(index);
  };

  window.ampMusicAppleNoAd150 = { isApple };
})();
