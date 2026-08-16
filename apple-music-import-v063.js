(() => {
  if (window.__WINAMP_MUSIC_APPLE_IMPORT_V063__) return;
  window.__WINAMP_MUSIC_APPLE_IMPORT_V063__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const ODESLI_API = 'https://api.song.link/v1-alpha.1/links';
  const ID_PATTERN = /^[\w-]{6,20}$/;
  const status = document.getElementById('status');
  let activeController = null;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseAppleMusicUrl(value) {
    const text = clean(value);
    if (!/^https?:\/\//i.test(text)) return null;
    try {
      const url = new URL(text);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (!parts.includes('album') && !parts.includes('song')) return null;
      const trackId = clean(url.searchParams.get('i'));
      const albumId = clean(parts.at(-1));
      return {
        href: url.href,
        trackId: /^\d+$/.test(trackId) ? trackId : '',
        albumId: /^\d+$/.test(albumId) ? albumId : '',
      };
    } catch {
      return null;
    }
  }

  function parseYouTubeVideoId(value) {
    try {
      const url = new URL(String(value || ''));
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      let id = '';
      if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
        id = url.searchParams.get('v') || '';
        if (!id) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (['watch', 'shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
        }
      }
      return ID_PATTERN.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function libraryIndex(id) {
    const library = readJson(STORAGE_KEY, []);
    return Array.isArray(library) ? library.findIndex((track) => track?.id === id) : -1;
  }

  function setUiState(text, detail = '') {
    if (status) status.textContent = text;
    const searchStatus = document.getElementById('songSearchStatus');
    if (searchStatus) searchStatus.textContent = detail || text.replace(/_/g, ' ');
    const results = document.getElementById('songSearchResults');
    if (results && /MATCHING|IMPORTING/.test(text)) {
      results.replaceChildren();
      results.hidden = true;
    }
  }

  function bestPlatformLink(payload) {
    const links = payload?.linksByPlatform || {};
    return links.youtubeMusic?.url || links.youtube?.url || '';
  }

  function entityMetadata(payload) {
    const entities = payload?.entitiesByUniqueId || {};
    const preferredId = payload?.entityUniqueId || '';
    const preferred = entities[preferredId];
    const candidates = preferred ? [preferred, ...Object.values(entities)] : Object.values(entities);
    const entity = candidates.find((item) => item && (item.title || item.artistName || item.thumbnailUrl)) || {};
    return {
      title: clean(entity.title),
      artist: clean(entity.artistName),
      thumbnail: clean(entity.thumbnailUrl),
    };
  }

  async function resolveAppleMusic(value, signal) {
    const parsed = parseAppleMusicUrl(value);
    if (!parsed) throw new Error('Not an Apple Music track link');
    const api = new URL(ODESLI_API);
    api.searchParams.set('url', parsed.href);
    const response = await fetch(api, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Apple Music resolver HTTP ${response.status}`);
    const payload = await response.json();
    const youtubeUrl = bestPlatformLink(payload);
    const videoId = parseYouTubeVideoId(youtubeUrl);
    if (!videoId) throw new Error('No YouTube match found');
    return { parsed, payload, youtubeUrl, videoId, metadata: entityMetadata(payload) };
  }

  function enrichSavedTrack(videoId, metadata, appleUrl) {
    if (!metadata?.title && !metadata?.artist && !metadata?.thumbnail) return;
    const track = {
      id: videoId,
      title: metadata.title || `YouTube ${videoId}`,
      artist: metadata.artist || 'YouTube',
      thumbnail: metadata.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      playlist: 'Apple Music import',
      badges: ['Apple Music', 'YouTube match'],
      sourceUrl: appleUrl,
      importedAt: new Date().toISOString(),
    };
    window.importTracks?.([track]);
    window.renderLibrary?.();
  }

  async function importAppleMusicUrl(value, options = {}) {
    const parsed = parseAppleMusicUrl(value);
    if (!parsed) return false;

    activeController?.abort();
    activeController = new AbortController();
    const signal = activeController.signal;
    setUiState('MATCHING APPLE MUSIC', 'Finding the same track on YouTube…');

    try {
      const match = await resolveAppleMusic(parsed.href, signal);
      if (signal.aborted) return true;

      let handled = false;
      if (window.winampMusicDirectYouTubeImport?.handleUrl) {
        handled = Boolean(window.winampMusicDirectYouTubeImport.handleUrl(match.youtubeUrl));
      }

      if (!handled) {
        enrichSavedTrack(match.videoId, match.metadata, parsed.href);
        const index = libraryIndex(match.videoId);
        if (options.play !== false && index >= 0) window.playIndex?.(index);
      } else {
        setTimeout(() => enrichSavedTrack(match.videoId, match.metadata, parsed.href), 120);
      }

      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ currentId: match.videoId }));
      if (options.input) options.input.value = '';
      const songInput = document.getElementById('songSearchInput');
      if (songInput && parseAppleMusicUrl(songInput.value)) songInput.value = '';
      setUiState('APPLE MUSIC IMPORTED', `${match.metadata.artist || 'Apple Music'} · ${match.metadata.title || 'matched on YouTube'}`);
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return true;
      console.warn('[Winamp Music Apple Music import]', error);
      setUiState('APPLE MUSIC MATCH FAILED', 'Could not find a YouTube match');
      const songResults = document.getElementById('songSearchResults');
      if (songResults) {
        songResults.replaceChildren();
        songResults.hidden = false;
        const link = document.createElement('a');
        link.className = 'song-search-fallback';
        link.href = parsed.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open track in Apple Music ↗';
        songResults.appendChild(link);
      }
      return true;
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'songSearchForm') return;
    const input = form.querySelector('#songSearchInput');
    if (!parseAppleMusicUrl(input?.value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    importAppleMusicUrl(input.value, { input, play: true });
  }, true);

  window.winampMusicAppleImport = {
    parseUrl: parseAppleMusicUrl,
    resolve: resolveAppleMusic,
    handleUrl: importAppleMusicUrl,
  };
})();
