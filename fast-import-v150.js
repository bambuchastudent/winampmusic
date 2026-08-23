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
  const PLAYLIST_ID = /^[\w-]{10,160}$/;

  function parseYouTube(raw) {
    const value = clean(raw);
    if (/^[\w-]{11}$/.test(value)) return { type: 'track', videoId: value, url: value };
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (!['youtu.be', 'youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return null;

      const playlistId = clean(url.searchParams.get('list'));
      if (PLAYLIST_ID.test(playlistId)) {
        let videoId = '';
        if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
        else videoId = url.searchParams.get('v') || '';
        return {
          type: 'playlist',
          playlistId,
          videoId: /^[\w-]{11}$/.test(videoId) ? videoId : '',
          url: url.href,
        };
      }

      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return /^[\w-]{11}$/.test(id || '') ? { type: 'track', videoId: id, url: url.href } : null;
      }

      const queryId = url.searchParams.get('v');
      if (/^[\w-]{11}$/.test(queryId || '')) return { type: 'track', videoId: queryId, url: url.href };
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0]) && /^[\w-]{11}$/.test(parts[1] || '')) {
        return { type: 'track', videoId: parts[1], url: url.href };
      }
    } catch {}
    return null;
  }

  function parseVideoId(raw) {
    const youtube = parseYouTube(raw);
    return youtube?.type === 'track' ? youtube.videoId : '';
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

  async function hydratePlaylistMetadata(videoIds) {
    let cursor = 0;
    const workerCount = Math.min(4, videoIds.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (cursor < videoIds.length) {
        const id = videoIds[cursor];
        cursor += 1;
        await upgradeMetadata(id);
      }
    }));
  }

  function uniqueVideoIds(values) {
    const seen = new Set();
    const ids = [];
    for (const value of Array.isArray(values) ? values : []) {
      const id = clean(value);
      if (!/^[\w-]{11}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  async function resolveYouTubePlaylist(playlistId) {
    if (typeof window.winampMusicLoadYouTubeApi !== 'function') throw new Error('YouTube player is not ready');
    await window.winampMusicLoadYouTubeApi();
    if (!window.YT?.Player) throw new Error('YouTube player API unavailable');

    const mount = document.createElement('div');
    mount.id = `amp-playlist-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    mount.hidden = true;
    document.body.appendChild(mount);

    let probe = null;
    let pollId = 0;
    let timeoutId = 0;

    try {
      return await new Promise((resolve, reject) => {
        let settled = false;

        const settle = (callback, value) => {
          if (settled) return;
          settled = true;
          clearInterval(pollId);
          clearTimeout(timeoutId);
          callback(value);
        };

        const inspect = () => {
          let ids = [];
          try { ids = uniqueVideoIds(probe?.getPlaylist?.()); } catch {}
          if (ids.length) settle(resolve, ids);
        };

        try {
          probe = new window.YT.Player(mount.id, {
            width: '1',
            height: '1',
            playerVars: {
              autoplay: 0,
              controls: 0,
              playsinline: 1,
              rel: 0,
              origin: location.origin,
              listType: 'playlist',
              list: playlistId,
            },
            events: {
              onReady: (event) => {
                try {
                  event.target.cuePlaylist({ listType: 'playlist', list: playlistId, index: 0, startSeconds: 0 });
                } catch {}
                inspect();
                pollId = setInterval(inspect, 180);
              },
              onStateChange: inspect,
              onError: inspect,
            },
          });
          timeoutId = setTimeout(() => settle(reject, new Error('YouTube playlist did not load')), 12000);
        } catch (error) {
          settle(reject, error);
        }
      });
    } finally {
      clearInterval(pollId);
      clearTimeout(timeoutId);
      try { probe?.destroy?.(); } catch {}
      mount.remove();
    }
  }

  async function importYouTubePlaylist(youtube) {
    button.disabled = true;
    button.textContent = 'Importing…';
    hint.textContent = 'Reading YouTube playlist…';
    try {
      const ids = await resolveYouTubePlaylist(youtube.playlistId);
      const importedAt = new Date().toISOString();
      const result = window.importTracks?.(ids.map((id) => ({
        id,
        title: `YouTube ${id}`,
        artist: 'YouTube',
        playlist: `YouTube playlist ${youtube.playlistId}`,
        importedAt,
        badges: ['YouTube', 'Playlist'],
      })));

      const firstIndex = libraryIndex(ids[0]);
      if (firstIndex < 0) {
        hint.textContent = 'Player is still starting — tap Add again';
        return;
      }

      hint.textContent = `${ids.length} tracks · ${result?.added || 0} new · starting playlist`;
      input.value = '';
      window.playIndex?.(firstIndex);
      void hydratePlaylistMetadata(ids);
    } catch (error) {
      console.warn('[AmpMusic] YouTube playlist import failed', error);
      hint.textContent = 'Could not read this YouTube playlist';
    } finally {
      button.disabled = false;
      button.textContent = 'Add & Play';
    }
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

    const youtube = parseYouTube(input.value);
    if (youtube?.type === 'playlist') {
      await importYouTubePlaylist(youtube);
      return;
    }

    const id = youtube?.type === 'track' ? youtube.videoId : '';
    if (!id) {
      hint.textContent = 'Paste a YouTube track/playlist or Apple Music track link';
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
    void upgradeMetadata(id);
  });

  input.addEventListener('paste', () => {
    setTimeout(() => {
      const apple = parseApple(input.value);
      const youtube = parseYouTube(input.value);
      if (apple?.type === 'track') hint.textContent = 'Apple Music track ready — tap Add & Play';
      else if (apple?.type === 'playlist') hint.textContent = 'Apple Music playlist detected';
      else if (youtube?.type === 'playlist') hint.textContent = 'YouTube playlist ready — tap Add & Play';
      else if (youtube?.type === 'track') hint.textContent = 'YouTube track ready — tap Add & Play';
    }, 0);
  });

  window.ampMusicImport150 = { parseVideoId, parseApple, parseYouTube, resolveYouTubePlaylist };
  console.info('[AmpMusic] fast import 1.5 ready');
})();
