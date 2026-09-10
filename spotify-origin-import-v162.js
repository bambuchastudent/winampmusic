(() => {
  'use strict';
  if (window.__AMPULA_SPOTIFY_ORIGIN_162__) return;
  window.__AMPULA_SPOTIFY_ORIGIN_162__ = true;

  const VERSION = '1.6.5';
  const STORAGE_KEY = 'winampmusic.library.v1';
  const LEGACY_SOURCE_KEY = 'ampula.spotifySource.v1';
  const DATA_API = 'https://spotify.xwolf.space/api/playlist/';
  const PLAYLIST_ID_RE = /^[A-Za-z0-9]{16,40}$/;
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const TRUST_VERSION = 'music-only-v1.6.4';
  const KNOWN_ALIASES = new Map([
    ['https://share.google/T0seuEuCz8Wdpksp3', '3A4l0emm89zzee5bzE7E0L'],
  ]);
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const $ = (id) => document.getElementById(id);
  let matcherPromise = null;
  let activeImport = 0;

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
      const spotifyTrackUrl = clean(track?.url) || (spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : '');
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

  async function fetchPlaylist(parsed, signal) {
    const response = await fetch(`${DATA_API}${encodeURIComponent(parsed.playlistId)}`, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Spotify metadata HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.success === false) throw new Error(clean(payload?.error) || 'Spotify metadata unavailable');
    return normalizePayload(parsed, payload);
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
      const timer = setTimeout(finish, 3500);
      const done = () => { clearTimeout(timer); finish(); };
      if (!script) {
        script = document.createElement('script');
        script.src = './apple-music-import-v064.js?v=165';
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
    const resolved = {
      ...track,
      id: clean(candidate.id),
      youtubeMatchId: clean(candidate.id),
      youtubeMatchResolverVersion: TRUST_VERSION,
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
    const timer = setTimeout(() => controller.abort(), 5500);
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

  // Compatibility API only. Normal playlist import no longer calls this function.
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
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    };
    await Promise.all([worker(), worker()]);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const onStatus = options.onStatus || (() => {});
    onStatus({ phase: 'reading', message: 'Reading Spotify playlist…' });
    try {
      const metadata = await fetchPlaylist(parsed, controller.signal);
      if (generation !== activeImport) return { handled: true, stale: true };
      importMetadata(metadata.tracks);
      options.input && (options.input.value = '');
      onStatus({ phase: 'imported', message: `Spotify · ${metadata.tracks.length} tracks imported · resolve on playback · 2 ahead` });

      const firstIndex = firstImportedIndex(metadata.tracks[0]);
      if (options.play !== false && firstIndex >= 0) {
        setTimeout(() => {
          window.playIndex?.(firstIndex);
          void window.ampulaPlaybackPrefetch165?.prefetchFollowing?.(firstIndex, 2);
        }, 0);
      }

      const resolution = Promise.resolve({
        matched: 0,
        total: metadata.tracks.length,
        strategy: 'on-demand+2-ahead',
      });
      onStatus({ phase: 'done', message: `Spotify origin · ${metadata.tracks.length} tracks · resolve on playback · 2 ahead` });
      return { handled: true, parsed, metadata, resolution };
    } catch (error) {
      if (error?.name === 'AbortError') onStatus({ phase: 'error', message: 'Spotify playlist read timed out' });
      else onStatus({ phase: 'error', message: 'Could not read Spotify playlist' });
      console.warn('[ÁmpulaMP] Spotify origin import failed', error);
      return { handled: true, error };
    } finally {
      clearTimeout(timeout);
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
    importPlaylist,
    resolveInBackground,
  };
  console.info(`[ÁmpulaMP] Spotify origin ${VERSION} ready · on-demand resolver`);
})();