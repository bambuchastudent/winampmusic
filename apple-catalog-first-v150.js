(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_CATALOG_FIRST_150__) return;
  window.__AMP_MUSIC_APPLE_CATALOG_FIRST_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function appleLocalId(trackId) {
    const value = clean(trackId);
    if (!/^\d+$/.test(value)) return '';
    try {
      const encoded = BigInt(value).toString(36).toUpperCase();
      return `A${encoded.padStart(10, '0').slice(-10)}`;
    } catch {
      return '';
    }
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function existingIndex(track) {
    const library = readLibrary();
    const appleTrackId = clean(track?.appleTrackId);
    if (appleTrackId) {
      const index = library.findIndex((item) => clean(item?.appleTrackId) === appleTrackId);
      if (index >= 0) return index;
    }
    const id = clean(track?.id);
    return id ? library.findIndex((item) => clean(item?.id) === id) : -1;
  }

  function importWithoutAppleDuplicates(tracks) {
    const incoming = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    const newTracks = incoming.filter((track) => existingIndex(track) < 0);
    const outcome = newTracks.length ? window.importTracks?.(newTracks) : { added: 0, total: readLibrary().length };
    const indices = incoming.map((track) => existingIndex(track));
    return { added: outcome?.added || 0, total: outcome?.total || readLibrary().length, indices };
  }

  function appleTrackFromMetadata(metadata, parsed, extra = {}) {
    const appleTrackId = clean(metadata?.trackId || parsed?.trackId || extra.appleTrackId);
    const id = appleLocalId(appleTrackId);
    if (!id) return null;
    return {
      id,
      title: clean(metadata?.title || extra.title),
      artist: clean(metadata?.artist || extra.artist),
      thumbnail: clean(metadata?.artwork || extra.artwork),
      duration: Number(metadata?.durationMs || extra.durationMs || 0) > 0
        ? Math.round(Number(metadata?.durationMs || extra.durationMs) / 1000)
        : 0,
      playlist: clean(extra.playlist || 'Apple Music import'),
      badges: ['Apple Music', ...(Array.isArray(extra.badges) ? extra.badges : []), 'Apple catalog'],
      sourceUrl: clean(parsed?.href || extra.sourceUrl),
      appleTrackId,
      appleTrackUrl: clean(metadata?.appleUrl || extra.appleUrl || parsed?.href),
      importedAt: new Date().toISOString(),
    };
  }

  async function playPreferred(index) {
    if (index < 0) return false;
    if (typeof window.ampMusicPlayPreferredIndex === 'function') return window.ampMusicPlayPreferredIndex(index);
    if (typeof window.ampMusicPlayDirectIndex === 'function') return window.ampMusicPlayDirectIndex(index);
    return window.playIndex?.(index);
  }

  function setUiState(text, detail = '') {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
    const searchStatus = document.getElementById('songSearchStatus');
    if (searchStatus) searchStatus.textContent = detail || text.replace(/_/g, ' ');
  }

  function patchTrackApi(api) {
    if (!api || api.__ampCatalogFirst150 || typeof api.lookup !== 'function' || typeof api.parseUrl !== 'function') return api;
    const strictFinder = window.ampMusicStrictMatcher150?.findYouTubeMatch || api.findYouTubeMatch;
    if (typeof strictFinder === 'function') api.findYouTubeMatch = strictFinder;

    api.handleUrl = async (value, options = {}) => {
      const parsed = api.parseUrl(value);
      if (!parsed) return false;
      const controller = new AbortController();
      setUiState('READING APPLE MUSIC', 'Reading track…');
      try {
        const metadata = await api.lookup(parsed, controller.signal);
        const track = appleTrackFromMetadata(metadata, parsed);
        if (!track) throw new Error('Apple catalog song id unavailable');
        const saved = importWithoutAppleDuplicates([track]);
        const index = saved.indices[0];
        if (options.input) options.input.value = '';
        window.renderLibrary?.();
        setUiState('APPLE MUSIC READY', `${track.artist} · ${track.title}`);
        if (options.play !== false && index >= 0) void playPreferred(index);
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return true;
        console.warn('[AmpMusic Apple catalog import]', error);
        setUiState('APPLE TRACK UNAVAILABLE', 'Could not read this Apple Music track');
        return true;
      }
    };
    api.__ampCatalogFirst150 = true;
    return api;
  }

  function patchAlbumApi(api) {
    if (!api || api.__ampCatalogFirst150 || typeof api.importAlbumUrl !== 'function' || typeof api.lookupAlbumJsonp !== 'function') return api;
    api.importAlbumUrl = async (value, options = {}) => {
      const parsed = api.parseAlbumUrl?.(value);
      if (!parsed) return { handled: false };
      const controller = new AbortController();
      const externalSignal = options.signal;
      const abort = () => controller.abort();
      externalSignal?.addEventListener('abort', abort, { once: true });
      try {
        options.onStatus?.({ phase: 'reading', message: 'Reading Apple Music album…' });
        const album = await api.lookupAlbumJsonp(parsed, controller.signal);
        const tracks = album.tracks
          .map((item) => appleTrackFromMetadata({
            trackId: item.appleTrackId,
            title: item.title,
            artist: item.artist,
            artwork: item.artwork,
            durationMs: item.durationMs,
            appleUrl: item.appleUrl,
          }, parsed, { playlist: album.name, badges: ['Album'] }))
          .filter(Boolean);
        if (!tracks.length) throw new Error('Apple album contained no catalog song ids');
        const result = importWithoutAppleDuplicates(tracks);
        const firstIndex = result.indices.find((index) => index >= 0) ?? -1;
        if (options.input) options.input.value = '';
        window.renderLibrary?.();
        options.onStatus?.({
          phase: 'done',
          message: `${album.tracks.length} tracks · ${tracks.length} Apple · ${result.added} new`,
          total: album.tracks.length,
          matched: tracks.length,
          added: result.added,
        });
        if (options.play !== false && firstIndex >= 0) void playPreferred(firstIndex);
        return { handled: true, album, tracks, added: result.added };
      } catch (error) {
        if (error?.name === 'AbortError') return { handled: true, aborted: true };
        console.warn('[AmpMusic Apple catalog album]', error);
        options.onStatus?.({ phase: 'error', message: 'Could not import this Apple Music album', error });
        return { handled: true, error };
      } finally {
        externalSignal?.removeEventListener('abort', abort);
      }
    };
    api.__ampCatalogFirst150 = true;
    return api;
  }

  async function playlistTrack(appleTrack, parsed, playlistName, signal) {
    const appleTrackId = clean(appleTrack?.appleTrackId);
    if (appleTrackId) {
      return appleTrackFromMetadata({
        trackId: appleTrackId,
        title: appleTrack.title,
        artist: appleTrack.artist,
        durationMs: appleTrack.durationMs,
        appleUrl: appleTrack.appleUrl,
      }, parsed, { playlist: playlistName, badges: ['Playlist'] });
    }

    const finder = window.ampMusicStrictMatcher150?.findYouTubeMatch || window.winampMusicAppleImport?.findYouTubeMatch;
    if (typeof finder !== 'function') return null;
    try {
      const match = await finder({
        title: appleTrack.title,
        artist: appleTrack.artist,
        album: appleTrack.album,
        durationMs: appleTrack.durationMs,
      }, signal);
      const id = clean(match?.id);
      if (!VIDEO_ID_RE.test(id)) return null;
      return {
        id,
        title: clean(appleTrack.title),
        artist: clean(appleTrack.artist),
        thumbnail: clean(match?.thumbnail),
        duration: appleTrack.durationMs > 0 ? Math.round(appleTrack.durationMs / 1000) : Number(match?.duration || 0),
        playlist: playlistName,
        badges: ['Apple Music', 'Playlist', 'YouTube fallback'],
        sourceUrl: parsed.href,
        appleTrackId: '',
        appleTrackUrl: clean(appleTrack.appleUrl),
        importedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return null;
    }
  }

  function patchPlaylistApi(api) {
    if (!api || api.__ampCatalogFirst150 || typeof api.importPlaylistUrl !== 'function' || typeof api.fetchPublicPlaylist !== 'function') return api;
    api.importPlaylistUrl = async (value, options = {}) => {
      const parsed = api.parsePlaylistUrl?.(value);
      if (!parsed) return { handled: false };
      const controller = new AbortController();
      const externalSignal = options.signal;
      const abort = () => controller.abort();
      externalSignal?.addEventListener('abort', abort, { once: true });
      try {
        options.onStatus?.({ phase: 'reading', message: 'Reading Apple Music playlist…' });
        const playlist = await api.fetchPublicPlaylist(parsed, controller.signal);
        const results = new Array(playlist.tracks.length).fill(null);
        let cursor = 0;
        let completed = 0;
        let appleCount = 0;
        let fallbackCount = 0;
        const workers = Math.min(4, playlist.tracks.length);
        await Promise.all(Array.from({ length: workers }, async () => {
          while (!controller.signal.aborted) {
            const index = cursor++;
            if (index >= playlist.tracks.length) return;
            const source = playlist.tracks[index];
            const resolved = await playlistTrack(source, parsed, playlist.name, controller.signal);
            results[index] = resolved;
            if (resolved) {
              if (clean(resolved.appleTrackId)) appleCount += 1;
              else fallbackCount += 1;
            }
            completed += 1;
            options.onStatus?.({
              phase: 'matching',
              message: `Reading ${completed}/${playlist.tracks.length} · ${appleCount} Apple · ${fallbackCount} fallback`,
              completed,
              total: playlist.tracks.length,
              matched: appleCount + fallbackCount,
            });
          }
        }));
        const tracks = results.filter(Boolean);
        if (!tracks.length) throw new Error('No playlist tracks could be resolved');
        const result = importWithoutAppleDuplicates(tracks);
        const firstIndex = result.indices.find((index) => index >= 0) ?? -1;
        if (options.input) options.input.value = '';
        window.renderLibrary?.();
        options.onStatus?.({
          phase: 'done',
          message: `${playlist.tracks.length} tracks · ${appleCount} Apple · ${fallbackCount} fallback · ${result.added} new`,
          total: playlist.tracks.length,
          matched: tracks.length,
          added: result.added,
        });
        if (options.play !== false && firstIndex >= 0) void playPreferred(firstIndex);
        return { handled: true, playlist, tracks, added: result.added };
      } catch (error) {
        if (error?.name === 'AbortError') return { handled: true, aborted: true };
        console.warn('[AmpMusic Apple catalog playlist]', error);
        options.onStatus?.({ phase: 'error', message: 'Could not import this Apple Music playlist', error });
        return { handled: true, error };
      } finally {
        externalSignal?.removeEventListener('abort', abort);
      }
    };
    api.__ampCatalogFirst150 = true;
    return api;
  }

  function patchAll() {
    patchTrackApi(window.winampMusicAppleImport);
    patchAlbumApi(window.ampMusicAppleAlbum150);
    patchPlaylistApi(window.ampMusicApplePlaylist150);
  }

  patchAll();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node?.tagName !== 'SCRIPT') continue;
        if (/apple-(?:music-import-v064|album-import-v150|playlist-import-v150)\.js/i.test(node.src || '')) {
          node.addEventListener('load', () => queueMicrotask(patchAll), { once: true });
        }
      }
    }
    queueMicrotask(patchAll);
  });
  observer.observe(document.head, { childList: true });

  window.ampMusicAppleCatalogFirst150 = {
    appleLocalId,
    patchAll,
    patchTrackApi,
    patchAlbumApi,
    patchPlaylistApi,
  };

  console.info('[AmpMusic] Apple catalog-first import 1.5 ready');
})();
