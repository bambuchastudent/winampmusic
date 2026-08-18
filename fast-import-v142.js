(() => {
  'use strict';
  if (window.__WINAMP_FAST_IMPORT_142__) return;
  window.__WINAMP_FAST_IMPORT_142__ = true;

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

  function libraryIndex(videoId) {
    try {
      const library = JSON.parse(localStorage.getItem('winampmusic.library.v1') || '[]');
      return Array.isArray(library) ? library.findIndex((track) => track?.id === videoId) : -1;
    } catch { return -1; }
  }

  async function upgradeMetadata(videoId) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const meta = await response.json();
      const title = clean(meta?.title);
      const artist = clean(meta?.author_name);
      if (!title && !artist) return;

      const library = JSON.parse(localStorage.getItem('winampmusic.library.v1') || '[]');
      if (!Array.isArray(library)) return;
      const index = library.findIndex((track) => track?.id === videoId);
      if (index < 0) return;
      library[index] = {
        ...library[index],
        title: title || library[index].title,
        artist: artist || library[index].artist,
      };
      localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
      // Fast runtime owns an in-memory copy, so metadata refresh is cosmetic on next load.
      // Never reload or rebuild the player just to update a title.
    } catch {}
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = parseVideoId(input.value);
    if (!id) {
      hint.textContent = 'Paste a YouTube video link';
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
      if (parseVideoId(input.value)) hint.textContent = 'Ready — tap Add & Play';
    }, 0);
  });

  console.info('[Winamp Music] fast import 1.4.2 ready');
})();
