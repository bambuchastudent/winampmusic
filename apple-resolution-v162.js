(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_RESOLUTION_162__) return;
  window.__AMP_MUSIC_APPLE_RESOLUTION_162__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function localRecordingId(title, artist) {
    const text = `${clean(title)}\u0000${clean(artist)}`.toLowerCase();
    let a = 0x811c9dc5;
    let b = 0x1b873593;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 2246822519) >>> 0;
    }
    return `U-${a.toString(36).padStart(7, '0')}${(b % 46656).toString(36).padStart(3, '0')}`;
  }

  function legacyAppleLocalId(trackId) {
    const value = clean(trackId);
    if (!/^\d+$/.test(value)) return '';
    try {
      const encoded = BigInt(value).toString(36).toUpperCase();
      return `A${encoded.padStart(10, '0').slice(-10)}`;
    } catch {
      return '';
    }
  }

  function isLegacySynthetic(track) {
    const appleTrackId = clean(track?.appleTrackId);
    const id = clean(track?.id);
    return Boolean(appleTrackId && id && legacyAppleLocalId(appleTrackId) === id);
  }

  function isRealVideoTrack(track) {
    return VIDEO_ID_RE.test(clean(track?.id)) && !isLegacySynthetic(track);
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function migrateLegacySyntheticIds() {
    const library = readLibrary();
    let changed = false;
    for (const track of library) {
      if (!isLegacySynthetic(track) || !clean(track?.title)) continue;
      track.id = localRecordingId(track.title, track.artist);
      const badges = Array.isArray(track.badges) ? track.badges.map(clean).filter(Boolean) : [];
      if (!badges.some((badge) => /^unresolved$/i.test(badge))) badges.push('Unresolved');
      track.badges = badges;
      changed = true;
    }
    if (!changed) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      window.__AMP_MUSIC_APPLE_MIGRATED_162__ = true;
      return true;
    } catch {
      return false;
    }
  }

  function recordingKey(track) {
    if (!clean(track?.title)) return '';
    if (typeof window.ampMusicRecordingId === 'function') {
      return clean(window.ampMusicRecordingId(clean(track.title), clean(track.artist)));
    }
    return localRecordingId(track.title, track.artist);
  }

  function findLibraryIndex(track) {
    const library = readLibrary();
    const id = clean(track?.id);
    if (id) {
      const byId = library.findIndex((item) => clean(item?.id) === id);
      if (byId >= 0) return byId;
    }
    const appleTrackId = clean(track?.appleTrackId);
    if (appleTrackId) {
      const byApple = library.findIndex((item) => clean(item?.appleTrackId) === appleTrackId);
      if (byApple >= 0) return byApple;
    }
    const key = recordingKey(track);
    return key ? library.findIndex((item) => recordingKey(item) === key) : -1;
  }

  function uniqueBadges(values) {
    const seen = new Set();
    const result = [];
    for (const raw of Array.isArray(values) ? values : []) {
      const value = clean(raw);
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  }

  function baseTrack(source, parsed, playlistName, kind) {
    const title = clean(source?.title);
    if (!title) return null;
    const artist = clean(source?.artist);
    const durationMs = Number(source?.durationMs || 0);
    const appleTrackId = clean(source?.appleTrackId || source?.trackId);
    return {
      title,
      artist,
      album: clean(source?.album),
      thumbnail: clean(source?.artwork || source?.thumbnail),
      duration: durationMs > 0 ? Math.round(durationMs / 1000) : Number(source?.duration || 0),
      playlist: clean(playlistName || 'Apple Music import'),
      badges: uniqueBadges(['Apple Music', kind, 'Apple catalog']),
      sourceUrl: clean(parsed?.href || source?.sourceUrl),
      appleTrackId,
      appleTrackUrl: clean(source?.appleUrl || source?.appleTrackUrl || parsed?.href),
      importedAt: new Date().toISOString(),
    };
  }

  function unresolved(track) {
    return {
      ...track,
      badges: uniqueBadges([...(track?.badges || []).filter((badge) => !/youtube match/i.test(clean(badge))), 'Unresolved']),
    };
  }

  async function resolveTrack(source, parsed, playlistName, kind, signal) {
    const track = baseTrack(source, parsed, playlistName, kind);
    if (!track) return null;
    const finder = window.ampMusicStrictMatcher150?.findYouTubeMatch
      || window.winampMusicAppleImport?.findYouTubeMatch;
    if (typeof finder !== 'function' || !track.artist) return unresolved(track);

    try {
      const match = await finder({
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationMs: Number(source?.durationMs || track.duration * 1000 || 0),
      }, signal);
      const id = clean(match?.id);
      if (!VIDEO_ID_RE.test(id)) return unresolved(track);
      return {
        ...track,
        id,
        thumbnail: track.thumbnail || clean(match?.thumbnail),
        duration: track.duration || Number(match?.duration || 0),
        badges: uniqueBadges([...(track.badges || []).filter((badge) => !/^unresolved$/i.test(clean(badge))), 'YouTube match']),
        strictMatchedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      console.warn('[AmpMusic Apple full resolver] unresolved', track.artist, track.title, error);
      return unresolved(track);
    }
  }

  async function resolveCollection(sources, parsed, playlistName, kind, signal, onProgress) {
    const input = Array.isArray(sources) ? sources : [];
    const results = new Array(input.length).fill(null);
    let cursor = 0;
    let completed = 0;
    let matched = 0;
    const workers = Math.min(4, input.length);

    await Promise.all(Array.from({ length: workers }, async () => {
      while (!signal?.aborted) {
        const index = cursor;
        cursor += 1;
        if (index >= input.length) return;
        const track = await resolveTrack(input[index], parsed, playlistName, kind, signal);
        results[index] = track;
        if (isRealVideoTrack(track)) matched += 1;
        completed += 1;
        onProgress?.({ completed, total: input.length, matched });
      }
    }));

    return results.filter(Boolean);
  }

  function importResolvedTracks(tracks) {
    const outcome = window.importTracks?.(tracks) || { added: 0, total: readLibrary().length };
    window.renderLibrary?.();
    return { added: Number(outcome?.added || 0), total: Number(outcome?.total || readLibrary().length) };
  }

  function musicKitConfigured() {
    try { return Boolean(window.ampMusicAppleKit150?.configured?.()); }
    catch { return false; }
  }

  function firstPlayableTrackIndex(tracks) {
    const configured = musicKitConfigured();
    return tracks.findIndex((track) => isRealVideoTrack(track) || (configured && /^\d+$/.test(clean(track?.appleTrackId))));
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

  function doneMessage(total, matched, unresolvedCount, added) {
    const parts = [`${total} tracks`, `${matched} playable`];
    if (unresolvedCount > 0) parts.push(`${unresolvedCount} unresolved`);
    parts.push(`${added} new`);
    return parts.join(' · ');
  }

  function patchTrackApi(api) {
    if (!api || api.__ampFullResolver162 || typeof api.lookup !== 'function' || typeof api.parseUrl !== 'function') return api;
    api.handleUrl = async (value, options = {}) => {
      const parsed = api.parseUrl(value);
      if (!parsed) return false;
      const controller = new AbortController();
      setUiState('READING APPLE MUSIC', 'Reading track…');
      try {
        const metadata = await api.lookup(parsed, controller.signal);
        setUiState('RESOLVING FULL TRACK', `${clean(metadata?.artist)} · ${clean(metadata?.title)}`);
        const track = await resolveTrack({
          trackId: metadata?.trackId || parsed?.trackId,
          title: metadata?.title,
          artist: metadata?.artist,
          album: metadata?.album,
          artwork: metadata?.artwork,
          durationMs: metadata?.durationMs,
          appleUrl: metadata?.appleUrl || parsed?.href,
        }, parsed, 'Apple Music import', 'Track', controller.signal);
        if (!track) throw new Error('Apple catalog track metadata incomplete');
        importResolvedTracks([track]);
        const index = findLibraryIndex(track);
        if (options.input) options.input.value = '';
        if (isRealVideoTrack(track)) setUiState('APPLE MUSIC MATCHED', `${track.artist} · ${track.title}`);
        else setUiState('APPLE TRACK NOT MATCHED', 'No full in-player source found yet');
        if (options.play !== false && index >= 0) void playPreferred(index);
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return true;
        console.warn('[AmpMusic Apple full resolver] track import failed', error);
        setUiState('APPLE TRACK UNAVAILABLE', 'Could not read this Apple Music track');
        return true;
      }
    };
    api.__ampFullResolver162 = true;
    return api;
  }

  function patchAlbumApi(api) {
    if (!api || api.__ampFullResolver162 || typeof api.importAlbumUrl !== 'function' || typeof api.lookupAlbumJsonp !== 'function') return api;
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
        const tracks = await resolveCollection(album.tracks, parsed, album.name, 'Album', controller.signal, ({ completed, total, matched }) => {
          options.onStatus?.({
            phase: 'matching',
            message: `Resolving ${completed}/${total} · ${matched} playable`,
            completed,
            total,
            matched,
          });
        });
        const outcome = importResolvedTracks(tracks);
        const matched = tracks.filter(isRealVideoTrack).length;
        const unresolvedCount = tracks.length - matched;
        const playable = firstPlayableTrackIndex(tracks);
        const firstIndex = playable >= 0 ? findLibraryIndex(tracks[playable]) : -1;
        if (options.input) options.input.value = '';
        options.onStatus?.({
          phase: 'done',
          message: doneMessage(tracks.length, matched, unresolvedCount, outcome.added),
          total: tracks.length,
          matched,
          unresolved: unresolvedCount,
          added: outcome.added,
        });
        if (options.play !== false && firstIndex >= 0) void playPreferred(firstIndex);
        return { handled: true, album, tracks, added: outcome.added, matched, unresolved: unresolvedCount };
      } catch (error) {
        if (error?.name === 'AbortError') return { handled: true, aborted: true };
        console.warn('[AmpMusic Apple full resolver] album import failed', error);
        options.onStatus?.({ phase: 'error', message: 'Could not import this Apple Music album', error });
        return { handled: true, error };
      } finally {
        externalSignal?.removeEventListener('abort', abort);
      }
    };
    api.__ampFullResolver162 = true;
    return api;
  }

  function patchPlaylistApi(api) {
    if (!api || api.__ampFullResolver162 || typeof api.importPlaylistUrl !== 'function' || typeof api.fetchPublicPlaylist !== 'function') return api;
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
        if (!playlist.tracks.length) {
          if (options.input) options.input.value = '';
          options.onStatus?.({ phase: 'empty', message: 'This Apple Music playlist has no readable tracks', total: 0, matched: 0, unresolved: 0, added: 0 });
          return { handled: true, empty: true, playlist, tracks: [], added: 0 };
        }
        const tracks = await resolveCollection(playlist.tracks, parsed, playlist.name, 'Playlist', controller.signal, ({ completed, total, matched }) => {
          options.onStatus?.({
            phase: 'matching',
            message: `Resolving ${completed}/${total} · ${matched} playable`,
            completed,
            total,
            matched,
          });
        });
        const outcome = importResolvedTracks(tracks);
        const matched = tracks.filter(isRealVideoTrack).length;
        const unresolvedCount = tracks.length - matched;
        const playable = firstPlayableTrackIndex(tracks);
        const firstIndex = playable >= 0 ? findLibraryIndex(tracks[playable]) : -1;
        if (options.input) options.input.value = '';
        options.onStatus?.({
          phase: 'done',
          message: doneMessage(tracks.length, matched, unresolvedCount, outcome.added),
          total: tracks.length,
          matched,
          unresolved: unresolvedCount,
          added: outcome.added,
        });
        if (options.play !== false && firstIndex >= 0) void playPreferred(firstIndex);
        return { handled: true, playlist, tracks, added: outcome.added, matched, unresolved: unresolvedCount };
      } catch (error) {
        if (error?.name === 'AbortError') return { handled: true, aborted: true };
        console.warn('[AmpMusic Apple full resolver] playlist import failed', error);
        options.onStatus?.({ phase: 'error', message: 'Could not import this Apple Music playlist', error });
        return { handled: true, error };
      } finally {
        externalSignal?.removeEventListener('abort', abort);
      }
    };
    api.__ampFullResolver162 = true;
    return api;
  }

  function patchAll() {
    patchTrackApi(window.winampMusicAppleImport);
    patchAlbumApi(window.ampMusicAppleAlbum150);
    patchPlaylistApi(window.ampMusicApplePlaylist150);
  }

  window.ampMusicAppleResolution162 = {
    localRecordingId,
    legacyAppleLocalId,
    isLegacySynthetic,
    isRealVideoTrack,
    migrateLegacySyntheticIds,
    resolveTrack,
    resolveCollection,
    patchAll,
    patchTrackApi,
    patchAlbumApi,
    patchPlaylistApi,
  };

  if (migrateLegacySyntheticIds()) {
    setTimeout(() => {
      try { location.reload(); } catch {}
    }, 30);
    return;
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
  if (document.head) observer.observe(document.head, { childList: true });

  console.info('[AmpMusic] Apple full-source resolver 1.6.2 ready');
})();
