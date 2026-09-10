(() => {
  'use strict';

  const PLAYLIST_ID_RE = /^[A-Za-z0-9]{16,40}$/;
  const KNOWN_ALIASES = new Map([
    ['https://share.google/T0seuEuCz8Wdpksp3', {
      playlistId: '3A4l0emm89zzee5bzE7E0L',
      title: 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)',
      owner: 'your own kind of music',
    }],
  ]);

  const clean = (value) => String(value || '').trim();

  function canonicalPlaylistUrl(playlistId) {
    return PLAYLIST_ID_RE.test(clean(playlistId))
      ? `https://open.spotify.com/playlist/${clean(playlistId)}`
      : '';
  }

  function parseSource(value) {
    const input = clean(value);
    if (!input) return null;

    const known = KNOWN_ALIASES.get(input.replace(/\/$/, ''));
    if (known) {
      return {
        provider: 'spotify',
        kind: 'playlist',
        playlistId: known.playlistId,
        canonicalUrl: canonicalPlaylistUrl(known.playlistId),
        sourceUrl: input,
        title: known.title,
        owner: known.owner,
        alias: true,
      };
    }

    let url;
    try { url = new URL(input); } catch { return null; }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'open.spotify.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const playlistIndex = parts.indexOf('playlist');
    if (playlistIndex < 0) return null;
    const playlistId = clean(parts[playlistIndex + 1]);
    if (!PLAYLIST_ID_RE.test(playlistId)) return null;

    return {
      provider: 'spotify',
      kind: 'playlist',
      playlistId,
      canonicalUrl: canonicalPlaylistUrl(playlistId),
      sourceUrl: url.href,
      title: '',
      owner: '',
      alias: false,
    };
  }

  function ensurePlayedLibrary() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return Promise.resolve(null);
    if (window.ampulaSpotifyPlayedLibrary161) return Promise.resolve(window.ampulaSpotifyPlayedLibrary161);
    if (globalThis.__AMPULA_SPOTIFY_PLAYED_LIBRARY_PROMISE__) return globalThis.__AMPULA_SPOTIFY_PLAYED_LIBRARY_PROMISE__;

    globalThis.__AMPULA_SPOTIFY_PLAYED_LIBRARY_PROMISE__ = new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-ampula-spotify-played-161]');
      const done = () => resolve(window.ampulaSpotifyPlayedLibrary161 || null);
      const failed = () => reject(new Error('Spotify heard-track library failed to load'));
      if (script?.dataset.loaded === '1') return done();
      script = script || document.createElement('script');
      script.addEventListener('load', () => { script.dataset.loaded = '1'; done(); }, { once: true });
      script.addEventListener('error', failed, { once: true });
      if (!script.isConnected) {
        script.src = './spotify-played-library-v161.js?v=161';
        script.async = true;
        script.dataset.ampulaSpotifyPlayed161 = '1';
        document.head.appendChild(script);
      }
    }).catch((error) => {
      globalThis.__AMPULA_SPOTIFY_PLAYED_LIBRARY_PROMISE__ = null;
      throw error;
    });
    return globalThis.__AMPULA_SPOTIFY_PLAYED_LIBRARY_PROMISE__;
  }

  globalThis.AmpulaSpotifyCore160 = Object.freeze({
    parseSource,
    canonicalPlaylistUrl,
    ensurePlayedLibrary,
    knownAliases: Object.freeze([...KNOWN_ALIASES.keys()]),
  });
})();
