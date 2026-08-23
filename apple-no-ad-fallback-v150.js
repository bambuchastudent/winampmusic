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

  function appleUrl(track) {
    for (const raw of [track?.appleTrackUrl, track?.sourceUrl]) {
      const value = clean(raw);
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.hostname.replace(/^www\./, '').toLowerCase() === 'music.apple.com') return url.href;
      } catch {}
    }
    return '';
  }

  function openAppleUrl(url) {
    if (!url) return false;
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

  window.playIndex = (index) => {
    const library = readLibrary();
    if (library.length) {
      const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
      const track = library[safeIndex];
      if (isApple(track)) {
        const status = document.getElementById('status');
        const play = document.getElementById('playButton');
        const title = document.getElementById('nowTitle');
        const artist = document.getElementById('nowArtist');
        if (title) title.textContent = clean(track?.title) || 'Apple Music';
        if (artist) artist.textContent = clean(track?.artist) || 'Apple Music';
        if (play) play.textContent = '▶';

        const url = appleUrl(track);
        if (url) {
          if (status) status.textContent = 'OPENING APPLE MUSIC…';
          const opened = openAppleUrl(url);
          if (!opened && status) status.textContent = 'APPLE MUSIC LINK UNAVAILABLE';
          console.info('[AmpMusic] opening Apple source URL', url);
          return opened;
        }

        if (status) status.textContent = 'APPLE AUDIO UNAVAILABLE · NO SOURCE URL';
        console.warn('[AmpMusic] Apple track has no usable source URL', track?.title || track?.id);
        return false;
      }
    }
    return legacyPlayIndex(index);
  };

  window.ampMusicAppleNoAd150 = { isApple, appleUrl, openAppleUrl };
})();
