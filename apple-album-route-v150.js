(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_ALBUM_ROUTE_150__) return;
  window.__AMP_MUSIC_APPLE_ALBUM_ROUTE_150__ = true;

  const clean = (value) => String(value || '').trim();
  const form = document.getElementById('fastImportForm');
  const input = document.getElementById('fastImportInput');
  const button = document.getElementById('fastImportButton');
  const hint = document.getElementById('fastImportHint');
  if (!form || !input || !button || !hint) return;

  function parseAlbum(value) {
    try {
      const url = new URL(clean(value));
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (!parts.includes('album')) return null;
      if (/^\d+$/.test(clean(url.searchParams.get('i')))) return null;
      const albumId = clean(parts.at(-1));
      if (!/^\d+$/.test(albumId)) return null;
      return { url: url.href, albumId };
    } catch {
      return null;
    }
  }

  function loadScript(src, marker) {
    const existing = document.querySelector(`script[data-amp-album-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const done = () => { script.dataset.loaded = '1'; resolve(); };
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error(`${marker} failed`)), { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.ampAlbumModule = marker;
        document.head.appendChild(script);
      }
    });
  }

  async function importAlbum(url) {
    button.disabled = true;
    button.textContent = 'Importing…';
    hint.textContent = 'Reading Apple Music album…';
    try {
      await loadScript('./apple-music-import-v064.js?v=150', 'apple-track-import');
      await loadScript('./apple-album-import-v150.js?v=150', 'apple-album-import');
      const result = await window.ampMusicAppleAlbum150?.importAlbumUrl?.(url, {
        input,
        play: true,
        onStatus: (state) => { if (state?.message) hint.textContent = state.message; },
      });
      if (!result?.handled) hint.textContent = 'Could not read this Apple Music album';
    } catch (error) {
      console.warn('[AmpMusic] Apple album route failed', error);
      hint.textContent = 'Apple Music album import unavailable';
    } finally {
      button.disabled = false;
      button.textContent = 'Add & Play';
    }
  }

  document.addEventListener('submit', (event) => {
    if (event.target !== form) return;
    const album = parseAlbum(input.value);
    if (!album) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void importAlbum(album.url);
  }, true);

  input.addEventListener('paste', () => {
    setTimeout(() => {
      if (parseAlbum(input.value)) hint.textContent = 'Apple Music album ready — tap Add & Play';
    }, 0);
  });

  window.ampMusicAppleAlbumRoute150 = { parseAlbum, importAlbum };
})();
