(() => {
  'use strict';
  if (window.__AMP_MUSIC_FAST_IMPORT_150__) return;
  window.__AMP_MUSIC_FAST_IMPORT_150__ = true;

  const form = document.getElementById('fastImportForm');
  const input = document.getElementById('fastImportInput');
  const button = document.getElementById('fastImportButton');
  const hint = document.getElementById('fastImportHint');
  if (!form || !input || !button) return;

  const clean = (value) => String(value || '').trim();

  function parseVideoId(raw) {
    const value = clean(raw);
    if (/^[\w-]{11}$/.test(value)) return value;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return /^[\w-]{11}$/.test(id || '') ? id : '';
      }
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        const queryId = url.searchParams.get('v');
        if (/^[\w-]{11}$/.test(queryId || '')) return queryId;
        const parts = url.pathname.split('/').filter(Boolean);
        if (['shorts', 'embed', 'live'].includes(parts[0]) && /^[\w-]{11}$/.test(parts[1] || '')) return parts[1];
      }
    } catch {}
    return '';
  }

  function parseApple(raw) {
    try {
      const url = new URL(clean(raw));
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.includes('playlist')) return { type: 'playlist', url: url.href };
      const trackId = url.searchParams.get('i') || (/^\d+$/.test(parts.at(-1) || '') ? parts.at(-1) : '');
      if ((parts.includes('album') || parts.includes('song')) && /^\d+$/.test(trackId || '')) {
        return { type: 'track', url: url.href };
      }
    } catch {}
    return null;
  }

  function loadScript(src, marker) {
    const existing = document.querySelector(`script[data-amp-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const done = () => { script.dataset.loaded = '1'; resolve(); };
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error(`${marker} failed`)), { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.ampModule = marker;
        document.head.appendChild(script);
      }
    });
  }

  function libraryIndex(videoId) {
    try {
      const library = JSON.parse(localStorage.getItem('winampmusic.library.v1') || '[]');
      return Array.isArray(library) ? library.findIndex((track) => track?.id === videoId) : -1;
    } catch { return -1; }
  }

  async function upgradeMetadata(videoId) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, { cache: 'no-store' });
      if (!response.ok) return;
      const meta = await response.json();
      const title = clean(meta?.title);
      const artist = clean(meta?.author_name);
      if (!title && !artist) return;
      const library = JSON.parse(localStorage.getItem('winampmusic.library.v1') || '[]');
      if (!Array.isArray(library)) return;
      const index = library.findIndex((track) => track?.id === videoId);
      if (index < 0) return;
      library[index] = { ...library[index], title: title || library[index].title, artist: artist || library[index].artist };
      localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
    } catch {}
  }

  async function importAppleTrack(url) {
    button.disabled = true;
    button.textContent = 'Matching…';
    hint.textContent = 'Reading Apple Music track…';
    try {
      await loadScript('./apple-music-import-v064.js?v=150', 'apple-track-import');
      const handled = await window.winampMusicAppleImport?.handleUrl?.(url, { input, play: true });
      hint.textContent = handled ? 'Apple Music track added · playing YouTube match' : 'Could not read this Apple Music track';
    } catch (error) {
      console.warn('[AmpMusic] Apple Music import failed', error);
      hint.textContent = 'Apple Music track import unavailable';
    } finally {
      button.disabled = false;
      button.textContent = 'Add & Play';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const apple = parseApple(input.value);
    if (apple?.type === 'playlist') {
      hint.textContent = 'Apple Music playlists need MusicKit connection — track links work now';
      return;
    }
    if (apple?.type === 'track') {
      await importAppleTrack(apple.url);
      return;
    }

    const id = parseVideoId(input.value);
    if (!id) {
      hint.textContent = 'Paste a YouTube video or Apple Music track link';
      input.focus();
      return;
    }

    const result = window.importTracks?.([{
      id,
      title: `YouTube ${id}`,
      artist: 'YouTube',
      importedAt: new Date().toISOString(),
      badges: ['YouTube'],
    }]);

    const index = libraryIndex(id);
    if (index < 0) {
      hint.textContent = 'Player is still starting — tap Add again';
      return;
    }

    hint.textContent = result?.added ? 'Added · starting track' : 'Already saved · starting track';
    input.value = '';
    window.playIndex?.(index);
    upgradeMetadata(id);
  });

  input.addEventListener('paste', () => {
    setTimeout(() => {
      const apple = parseApple(input.value);
      if (apple?.type === 'track') hint.textContent = 'Apple Music track ready — tap Add & Play';
      else if (apple?.type === 'playlist') hint.textContent = 'Apple Music playlist detected';
      else if (parseVideoId(input.value)) hint.textContent = 'YouTube ready — tap Add & Play';
    }, 0);
  });

  window.ampMusicImport150 = { parseVideoId, parseApple };
  console.info('[AmpMusic] fast import 1.5 ready');
})();
