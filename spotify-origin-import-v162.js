(() => {
  'use strict';
  if (window.__AMPULA_SPOTIFY_ORIGIN_162__) return;
  window.__AMPULA_SPOTIFY_ORIGIN_162__ = true;

  const VERSION = '1.7.12';
  const STORAGE_KEY = 'winampmusic.library.v1';
  const LEGACY_SOURCE_KEY = 'ampula.spotifySource.v1';
  const DATA_API = 'https://spotify.xwolf.space/api/playlist/';
  const TOKEN_API = 'https://spotify.xwolf.space/api/token';
  const SPOTIFY_API = 'https://api.spotify.com/v1';
  const PRIMARY_TIMEOUT_MS = 6500;
  const TOKEN_TIMEOUT_MS = 4500;
  const SPOTIFY_TIMEOUT_MS = 6000;
  const RESOLVE_TIMEOUT_MS = 120000;
  const SPOTIFY_PAGE_SIZE = 50;
  const MAX_SPOTIFY_TRACKS = 500;
  const PRIMARY_TRACK_BOUNDARY = 100;
  const PLAYLIST_ID_RE = /^[A-Za-z0-9]{16,40}$/;
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const TRUST_VERSION = 'music-only-v1.6.4';
  const FINAL_TRUST_VERSION = 'music-only-v1.6.7';
  const KNOWN_ALIASES = new Map([
    ['https://share.google/T0seuEuCz8Wdpksp3', '3A4l0emm89zzee5bzE7E0L'],
  ]);
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const $ = (id) => document.getElementById(id);
  let matcherPromise = null;
  let activeImport = 0;
  let activeImportController = null;

  function parsePlaylist(value) {
    const text = clean(value).replace(/\/$/, '');
    const aliasId = KNOWN_ALIASES.get(text);
    if (aliasId) return {
      playlistId: aliasId,
      canonicalUrl: `https://open.spotify.com/playlist/${aliasId}`,
      sourceUrl: text,
    };
    try {
      const url = new URL(text);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host !== 'open.spotify.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const playlistIndex = parts.indexOf('playlist');
      if (playlistIndex < 0) return null;
      const playlistId = clean(parts[playlistIndex + 1]);
      if (!PLAYLIST_ID_RE.test(playlistId)) return null;
      return {
        playlistId,
        canonicalUrl: `https://open.spotify.com/playlist/${playlistId}`,
        sourceUrl: url.href,
      };
    } catch {
      return null;
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

  function recordingId(title, artist) {
    if (typeof window.ampMusicRecordingId === 'function') return window.ampMusicRecordingId(clean(title), clean(artist));
    const text = `${clean(title)}\u0000${clean(artist)}`.toLowerCase();
    let a = 0x811c9dc5; let b = 0x1b873593;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 2246822519) >>> 0;
    }
    return `U-${a.toString(36).padStart(7, '0')}${(b % 46656).toString(36).padStart(3, '0')}`;
  }

  function normalizePayload(parsed, payload) {
    const playlist = payload?.playlist || payload?.data?.playlist || null;
    const rows = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
    if (!playlist || !rows.length) throw new Error('Spotify playlist has no readable tracks');
    const playlistTitle = clean(playlist.name || playlist.title) || 'Spotify playlist';
    const playlistOwner = clean(playlist.owner);
    const tracks = rows.map((track) => {
      const spotifyTrackId = clean(track?.id);
      const title = clean(track?.title || track?.name);
      const artist = clean(track?.artist || track?.artists?.map?.((item) => item?.name).filter(Boolean).join(', '));
      const durationMs = Math.max(0, Number(track?.duration_ms || track?.durationMs || 0));
      if (!title) return null;
      const spotifyTrackUrl = clean(track?.url || track?.external_urls?.spotify) || (spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : '');
      return {
        title,
        artist,
        duration: durationMs ? Math.round(durationMs / 1000) : 0,
        playlist: playlistTitle,
        badges: ['Spotify', 'Origin'],
        sourceUrl: spotifyTrackUrl || parsed.canonicalUrl,
        originUrl: spotifyTrackUrl || parsed.canonicalUrl,
        spotifyTrackId,
        spotifyTrackUrl,
        spotifyPlaylistId: parsed.playlistId,
        spotifyPlaylistUrl: parsed.canonicalUrl,
        spotifyPlaylistTitle: playlistTitle,
        spotifyPlaylistOwner: playlistOwner,
        importedAt: new Date().toISOString(),
      };
    }).filter(Boolean);
    if (!tracks.length) throw new Error('Spotify playlist metadata is empty');
    return { playlistTitle, playlistOwner, tracks };
  }

  function primaryTrackTotal(payload) {
    const playlist = payload?.playlist || payload?.data?.playlist || {};
    const values = [
      playlist?.total,
      playlist?.totalTracks,
      playlist?.trackCount,
      playlist?.tracksTotal,
      payload?.total,
      payload?.totalTracks,
      payload?.trackCount,
    ].map(Number).filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.max(...values) : 0;
  }

  function primaryMayBeTruncated(payload, metadata) {
    const readable = metadata?.tracks?.length || 0;
    const hintedTotal = primaryTrackTotal(payload);
    return hintedTotal > readable || readable === PRIMARY_TRACK_BOUNDARY;
  }

  function timeoutError(timeoutMs) {
    const error = new Error(`request timed out after ${timeoutMs}ms`);
    error.name = 'TimeoutError';
    return error;
  }

  async function fetchJsonBounded(url, { signal, timeoutMs, headers = {} } = {}) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const controller = new AbortController();
    let timedOut = false;
    const relayAbort = () => controller.abort();
    signal?.addEventListener('abort', relayAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.max(1, Number(timeoutMs) || SPOTIFY_TIMEOUT_MS));
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json', ...headers },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (timedOut) throw timeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', relayAbort);
    }
  }

  async function fetchPrimaryPlaylist(parsed, signal) {
    const payload = await fetchJsonBounded(`${DATA_API}${encodeURIComponent(parsed.playlistId)}`, {
      signal,
      timeoutMs: PRIMARY_TIMEOUT_MS,
    });
    if (payload?.success === false) throw new Error(clean(payload?.error) || 'Spotify metadata unavailable');
    const metadata = normalizePayload(parsed, payload);
    return {
      metadata,
      mayBeTruncated: primaryMayBeTruncated(payload, metadata),
    };
  }

  function spotifyWebTrack(entry) {
    const track = entry?.track || entry?.item || entry;
    if (!track || typeof track !== 'object') return null;
    const id = clean(track.id || track.uri?.split?.(':')?.at?.(-1));
    const title = clean(track.name || track.title);
    if (!title) return null;
    const artists = Array.isArray(track.artists) ? track.artists : [];
    const artist = clean(track.artist || artists.map((item) => item?.name).filter(Boolean).join(', '));
    return {
      id,
      title,
      artist,
      artists,
      duration_ms: Math.max(0, Number(track.duration_ms || track.durationMs || 0)),
      url: clean(track.external_urls?.spotify) || (id ? `https://open.spotify.com/track/${id}` : ''),
    };
  }

  async function fetchSpotifyWebApiPlaylist(parsed, signal) {
    const tokenPayload = await fetchJsonBounded(TOKEN_API, { signal, timeoutMs: TOKEN_TIMEOUT_MS });
    const token = clean(tokenPayload?.access_token || tokenPayload?.accessToken || tokenPayload?.token);
    if (!token) throw new Error('Spotify anonymous token unavailable');
    const headers = { Authorization: `Bearer ${token}` };

    const playlistUrl = `${SPOTIFY_API}/playlists/${encodeURIComponent(parsed.playlistId)}`;
    const playlist = await fetchJsonBounded(playlistUrl, { signal, timeoutMs: SPOTIFY_TIMEOUT_MS, headers });
    const playlistTitle = clean(playlist?.name || playlist?.title) || 'Spotify playlist';
    const playlistOwner = clean(playlist?.owner?.display_name || playlist?.owner?.displayName || playlist?.owner?.id || playlist?.owner);

    const tracks = [];
    let offset = 0;
    while (offset < MAX_SPOTIFY_TRACKS) {
      const url = new URL(`${SPOTIFY_API}/playlists/${encodeURIComponent(parsed.playlistId)}/tracks`);
      url.searchParams.set('limit', String(SPOTIFY_PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      const page = await fetchJsonBounded(url.toString(), { signal, timeoutMs: SPOTIFY_TIMEOUT_MS, headers });
      const items = Array.isArray(page?.items) ? page.items : [];
      if (!items.length) break;
      for (const item of items) {
        const track = spotifyWebTrack(item);
        if (track) tracks.push(track);
        if (tracks.length >= MAX_SPOTIFY_TRACKS) break;
      }
      offset += items.length;
      const total = Math.max(0, Number(page?.total || 0));
      if (tracks.length >= MAX_SPOTIFY_TRACKS || !page?.next || (total && offset >= total) || items.length < SPOTIFY_PAGE_SIZE) break;
    }

    return normalizePayload(parsed, {
      playlist: {
        id: parsed.playlistId,
        name: playlistTitle,
        owner: playlistOwner,
        tracks,
      },
    });
  }

  async function fetchPlaylist(parsed, signal, onFallback) {
    let primary;
    try {
      primary = await fetchPrimaryPlaylist(parsed, signal);
    } catch (primaryError) {
      if (signal?.aborted) throw primaryError;
      onFallback?.(primaryError);
      return fetchSpotifyWebApiPlaylist(parsed, signal);
    }

    if (!primary.mayBeTruncated) return primary.metadata;
    onFallback?.(new Error(`Spotify primary metadata may be truncated at ${primary.metadata.tracks.length} tracks`));
    try {
      const completed = await fetchSpotifyWebApiPlaylist(parsed, signal);
      if (completed.tracks.length >= primary.metadata.tracks.length) return completed;
      console.warn('[ÁmpulaMP] Spotify metadata completion returned fewer tracks; keeping primary rows', {
        primary: primary.metadata.tracks.length,
        completed: completed.tracks.length,
      });
    } catch (completionError) {
      if (signal?.aborted) throw completionError;
      console.warn('[ÁmpulaMP] Spotify metadata completion unavailable; keeping primary rows', completionError);
    }
    return primary.metadata;
  }

  function patchProvenance(track) {
    const library = readLibrary();
    const localId = recordingId(track.title, track.artist);
    let index = library.findIndex((item) => clean(item?.spotifyTrackId) && clean(item.spotifyTrackId) === clean(track.spotifyTrackId));
    if (index < 0) index = library.findIndex((item) => recordingId(item?.title, item?.artist) === localId);
    if (index < 0) return null;
    const existing = library[index];
    const preservedId = clean(existing.id);
    library[index] = {
      ...existing,
      ...track,
      id: preservedId || localId,
      badges: [...new Set([...(Array.isArray(existing.badges) ? existing.badges : []), 'Spotify', 'Origin'])],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    return { index, track: library[index] };
  }

  function importMetadata(tracks) {
    if (typeof window.importTracks !== 'function') throw new Error('Library import is unavailable');
    const result = window.importTracks(tracks);
    const patched = tracks.map(patchProvenance).filter(Boolean);
    window.renderLibrary?.();
    window.ampMusicOriginPlayback151?.refresh?.();
    return { result, patched };
  }

  function loadMatcher() {
    if (window.winampMusicAppleImport?.findYouTubeMatch) return Promise.resolve(window.winampMusicAppleImport.findYouTubeMatch);
    if (matcherPromise) return matcherPromise;
    matcherPromise = new Promise((resolve) => {
      let script = document.querySelector('script[data-spotify-origin-matcher]');
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(window.winampMusicAppleImport?.findYouTubeMatch || null);
      };
      const timer = setTimeout(finish, 15000);
      const done = () => { clearTimeout(timer); finish(); };
      if (!script) {
        script = document.createElement('script');
        script.src = './apple-music-import-v064.js?v=175';
        script.async = true;
        script.dataset.spotifyOriginMatcher = '1';
        document.head.appendChild(script);
      }
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', done, { once: true });
      if (script.dataset.loaded === '1') done();
      else script.addEventListener('load', () => { script.dataset.loaded = '1'; }, { once: true });
    }).finally(() => { matcherPromise = null; });
    return matcherPromise;
  }

  function mergeResolved(track, candidate) {
    if (!VIDEO_ID_RE.test(clean(candidate?.id))) return false;
    if (clean(candidate?.finalTrustVersion) !== FINAL_TRUST_VERSION) return false;
    const resolved = {
      ...track,
      id: clean(candidate.id),
      youtubeMatchId: clean(candidate.id),
      youtubeMatchResolverVersion: TRUST_VERSION,
      youtubeMatchFinalTrustVersion: FINAL_TRUST_VERSION,
      playbackProvider: 'youtube',
      badges: ['Spotify', 'Origin', 'YouTube match'],
    };
    window.importTracks?.([resolved]);
    const library = readLibrary();
    const localId = recordingId(track.title, track.artist);
    let index = library.findIndex((item) => clean(item?.spotifyTrackId) === clean(track.spotifyTrackId));
    if (index < 0) index = library.findIndex((item) => recordingId(item?.title, item?.artist) === localId || clean(item?.id) === clean(candidate.id));
    if (index < 0) return false;
    library[index] = {
      ...library[index],
      ...track,
      id: clean(candidate.id),
      youtubeMatchId: clean(candidate.id),
      youtubeMatchResolverVersion: TRUST_VERSION,
      youtubeMatchFinalTrustVersion: FINAL_TRUST_VERSION,
      playbackProvider: 'youtube',
      badges: [...new Set([...(Array.isArray(library[index].badges) ? library[index].badges : []), 'Spotify', 'Origin', 'YouTube match'])],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    window.renderLibrary?.();
    return true;
  }

  async function resolveOne(track, matcher) {
    if (typeof matcher !== 'function') return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
    try {
      const candidate = await matcher({
        title: track.title,
        artist: track.artist,
        durationMs: Math.max(0, Number(track.duration || 0) * 1000),
      }, controller.signal);
      return mergeResolved(track, candidate);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  // Compatibility API: also follows the new all-tracks / long-budget policy.
  async function resolveInBackground(tracks, onProgress) {
    const matcher = await loadMatcher();
    if (typeof matcher !== 'function') return { matched: 0, total: tracks.length };
    let cursor = 0;
    let matched = 0;
    let done = 0;
    const worker = async () => {
      while (cursor < tracks.length) {
        const index = cursor++;
        if (await resolveOne(tracks[index], matcher)) matched += 1;
        done += 1;
        onProgress?.({ done, matched, total: tracks.length });
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, Math.max(1, tracks.length)) }, () => worker()));
    window.ampMusicOriginPlayback151?.refresh?.();
    return { matched, total: tracks.length };
  }

  function firstImportedIndex(firstTrack) {
    const library = readLibrary();
    const localId = recordingId(firstTrack.title, firstTrack.artist);
    return library.findIndex((item) => clean(item?.spotifyTrackId) === clean(firstTrack.spotifyTrackId)
      || recordingId(item?.title, item?.artist) === localId);
  }

  async function importPlaylist(value, options = {}) {
    const parsed = parsePlaylist(value);
    if (!parsed) return { handled: false };
    const generation = ++activeImport;
    activeImportController?.abort();
    const controller = new AbortController();
    activeImportController = controller;
    const onStatus = options.onStatus || (() => {});
    onStatus({ phase: 'reading', message: 'Reading Spotify playlist…' });
    try {
      const metadata = await fetchPlaylist(parsed, controller.signal, () => {
        if (generation === activeImport) onStatus({ phase: 'retrying', message: 'Spotify metadata retry…' });
      });
      if (generation !== activeImport) return { handled: true, stale: true };
      importMetadata(metadata.tracks);
      options.input && (options.input.value = '');
      onStatus({ phase: 'imported', message: `Spotify · ${metadata.tracks.length} tracks imported · resolving full library` });

      const firstIndex = firstImportedIndex(metadata.tracks[0]);
      const startIndex = firstIndex >= 0 ? firstIndex : 0;
      const resolution = Promise.resolve().then(async () => {
        if (typeof window.ampulaPlaybackPrefetch165?.resolveAll === 'function') {
          const results = await window.ampulaPlaybackPrefetch165.resolveAll(startIndex);
          return {
            matched: Array.isArray(results) ? results.filter(Boolean).length : 0,
            total: metadata.tracks.length,
            strategy: 'background-all+on-demand',
          };
        }
        const fallback = await resolveInBackground(metadata.tracks);
        return { ...fallback, strategy: 'background-all+on-demand' };
      });

      setTimeout(() => {
        void window.ampulaPlaybackPrefetch165?.resolveAll?.(startIndex);
        if (options.play !== false && firstIndex >= 0) window.playIndex?.(firstIndex);
      }, 0);

      onStatus({ phase: 'done', message: `Spotify origin · ${metadata.tracks.length} tracks · resolving all in background` });
      return { handled: true, parsed, metadata, resolution };
    } catch (error) {
      if (generation !== activeImport) return { handled: true, stale: true };
      if (error?.name === 'TimeoutError') onStatus({ phase: 'error', message: 'Spotify playlist read timed out' });
      else onStatus({ phase: 'error', message: 'Could not read Spotify playlist' });
      console.warn('[ÁmpulaMP] Spotify origin import failed', error);
      return { handled: true, error };
    } finally {
      if (activeImportController === controller) activeImportController = null;
    }
  }

  // Kill the old visible Spotify Embed experiment. Spotify is metadata/origin only now.
  try { localStorage.removeItem(LEGACY_SOURCE_KEY); } catch {}
  document.getElementById('spotifySourcePanel')?.remove();
  for (const iframe of document.querySelectorAll('iframe[src*="open.spotify.com/embed"]')) iframe.remove();

  const form = $('fastImportForm');
  const input = $('fastImportInput');
  const button = $('fastImportButton');
  const hint = $('fastImportHint');
  form?.addEventListener('submit', (event) => {
    const parsed = parsePlaylist(input?.value);
    if (!parsed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button) { button.disabled = true; button.textContent = 'Importing…'; }
    void importPlaylist(input.value, {
      input,
      play: true,
      onStatus: (state) => {
        if (hint && state?.message) hint.textContent = state.message;
        if (state?.phase === 'imported' || state?.phase === 'done' || state?.phase === 'error') {
          if (button) { button.disabled = false; button.textContent = 'Search'; }
        }
      },
    });
  }, true);

  window.ampulaSpotifyOrigin162 = {
    parsePlaylist,
    fetchPlaylist,
    fetchSpotifyWebApiPlaylist,
    importPlaylist,
    resolveInBackground,
  };
  console.info(`[ÁmpulaMP] Spotify origin ${VERSION} ready · resilient complete metadata import · full-library resolver`);
})();