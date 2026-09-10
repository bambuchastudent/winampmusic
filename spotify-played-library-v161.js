(() => {
  'use strict';
  if (window.__AMPULA_SPOTIFY_PLAYED_LIBRARY_161__) return;
  window.__AMPULA_SPOTIFY_PLAYED_LIBRARY_161__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const SIDE_KEY = 'ampula.spotifyPlayed.v1';
  const TRACK_URI_RE = /^spotify:track:([A-Za-z0-9]{16,40})$/;
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const inflight = new Map();
  const seenDurations = new Map();
  let matcherPromise = null;

  function parsePlayingURI(value) {
    const match = clean(value).match(TRACK_URI_RE);
    if (!match) return null;
    const trackId = match[1];
    return {
      trackId,
      trackUrl: `https://open.spotify.com/track/${trackId}`,
    };
  }

  function normalize(value) {
    return clean(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function stripYoutubeArtist(value) {
    return clean(value)
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s+VEVO$/i, '')
      .trim();
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readLibrary() {
    const library = readJson(STORAGE_KEY, []);
    return Array.isArray(library) ? library : [];
  }

  function readSidecar() {
    const value = readJson(SIDE_KEY, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function saveSidecar(trackId, value) {
    const sidecar = readSidecar();
    sidecar[trackId] = { ...(sidecar[trackId] || {}), ...value };
    const entries = Object.entries(sidecar)
      .sort((a, b) => String(b[1]?.spotifyPlayedAt || '').localeCompare(String(a[1]?.spotifyPlayedAt || '')))
      .slice(0, 500);
    localStorage.setItem(SIDE_KEY, JSON.stringify(Object.fromEntries(entries)));
    return sidecar[trackId];
  }

  function sourceFromDetail(detail = {}) {
    const source = detail?.playlist || {};
    const playlistId = clean(source.playlistId);
    const canonicalUrl = clean(source.canonicalUrl) || (playlistId ? `https://open.spotify.com/playlist/${playlistId}` : '');
    return {
      playlistId,
      canonicalUrl,
      sourceUrl: clean(source.sourceUrl) || canonicalUrl,
      title: clean(source.title),
      owner: clean(source.owner),
    };
  }

  async function readOEmbed(entityUrl) {
    const endpoint = new URL('https://open.spotify.com/oembed');
    endpoint.searchParams.set('url', entityUrl);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Spotify oEmbed HTTP ${response.status}`);
    const payload = await response.json();
    return {
      title: clean(payload?.title),
      thumbnail: clean(payload?.thumbnail_url),
    };
  }

  function loadScript(src, marker, timeoutMs = 2500) {
    const existing = document.querySelector(`script[data-spotify-played-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(new Error(`${marker} timeout`)), timeoutMs);
      script.addEventListener('load', () => { script.dataset.loaded = '1'; finish(); }, { once: true });
      script.addEventListener('error', () => finish(new Error(`${marker} failed`)), { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.spotifyPlayedModule = marker;
        document.head.appendChild(script);
      }
    });
  }

  async function ensureMatcher() {
    if (window.winampMusicAppleImport?.findYouTubeMatch) return window.winampMusicAppleImport.findYouTubeMatch;
    if (!matcherPromise) {
      matcherPromise = loadScript('./apple-music-import-v064.js?v=161', 'cross-provider-matcher')
        .then(() => window.winampMusicAppleImport?.findYouTubeMatch || null)
        .catch(() => null)
        .finally(() => { matcherPromise = null; });
    }
    return matcherPromise;
  }

  async function resolveFallback(metadata, durationMs) {
    const matcher = await ensureMatcher();
    if (typeof matcher !== 'function') return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2400);
    try {
      const candidate = await matcher({
        title: metadata.title,
        artist: '',
        durationMs: Math.max(0, Number(durationMs || 0)),
      }, controller.signal);
      if (!candidate || !VIDEO_ID_RE.test(clean(candidate.id))) return null;
      return {
        id: clean(candidate.id),
        title: clean(candidate.title),
        artist: stripYoutubeArtist(candidate.artist),
        thumbnail: clean(candidate.thumbnail),
        duration: Math.max(0, Number(candidate.duration || 0)),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function exactTitleCandidate(library, title) {
    const needle = normalize(title);
    if (!needle) return null;
    const matches = library.filter((track) => normalize(track?.title) === needle);
    return matches.length === 1 ? matches[0] : null;
  }

  function providerFields(parsed, source, metadata, fallback, durationMs, playedAt) {
    const seconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
    return {
      ...(fallback?.id ? { id: fallback.id } : {}),
      title: metadata.title,
      artist: fallback?.artist || '',
      thumbnail: metadata.thumbnail || fallback?.thumbnail || '',
      duration: seconds || fallback?.duration || 0,
      playlist: source.title || 'Spotify playlist',
      badges: ['Spotify', 'Played'],
      sourceUrl: parsed.trackUrl,
      originUrl: parsed.trackUrl,
      spotifyTrackId: parsed.trackId,
      spotifyTrackUrl: parsed.trackUrl,
      spotifyPlaylistId: source.playlistId,
      spotifyPlaylistUrl: source.canonicalUrl,
      spotifyPlaylistTitle: source.title,
      spotifyPlaylistOwner: source.owner,
      spotifyPlayedAt: playedAt,
      importedAt: playedAt,
    };
  }

  function mergeProviderFields(target, fields) {
    const next = { ...target };
    for (const key of [
      'spotifyTrackId', 'spotifyTrackUrl', 'spotifyPlaylistId', 'spotifyPlaylistUrl',
      'spotifyPlaylistTitle', 'spotifyPlaylistOwner', 'spotifyPlayedAt',
    ]) {
      const value = clean(fields[key]);
      if (value) next[key] = value;
    }
    if (!clean(next.sourceUrl) && clean(fields.sourceUrl)) next.sourceUrl = clean(fields.sourceUrl);
    if (!clean(next.originUrl) && clean(fields.originUrl)) next.originUrl = clean(fields.originUrl);
    if (!clean(next.playlist) && clean(fields.playlist)) next.playlist = clean(fields.playlist);
    if (!clean(next.thumbnail) && clean(fields.thumbnail)) next.thumbnail = clean(fields.thumbnail);
    const incomingDuration = Math.max(0, Number(fields.duration || 0));
    if (incomingDuration > 0) next.duration = incomingDuration;
    const badges = new Set([...(Array.isArray(next.badges) ? next.badges : []), 'Spotify', 'Played'].map(clean).filter(Boolean));
    next.badges = [...badges];
    return next;
  }

  function patchSerializedLibrary(trackId, fields, preferredId = '') {
    const library = readLibrary();
    let index = library.findIndex((track) => clean(track?.spotifyTrackId) === trackId);
    if (index < 0 && preferredId) index = library.findIndex((track) => clean(track?.id) === preferredId);
    if (index < 0) {
      const exact = exactTitleCandidate(library, fields.title);
      if (exact) index = library.indexOf(exact);
    }
    if (index < 0) return null;
    library[index] = mergeProviderFields(library[index], fields);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    return { index, track: library[index] };
  }

  function ensureStyles() {
    if (document.getElementById('ampulaSpotifyPlayed161Styles')) return;
    const style = document.createElement('style');
    style.id = 'ampulaSpotifyPlayed161Styles';
    style.textContent = `
      #trackList .track.spotify-played-track{grid-template-columns:42px minmax(0,1fr) auto 28px}
      .spotify-playlist-backlink{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 7px;border:1px solid #315b43;border-radius:7px;background:#15231b;color:#7ae29c;text-decoration:none;font:800 9px/1 system-ui,sans-serif;white-space:nowrap;touch-action:manipulation}
      .spotify-playlist-backlink:hover{border-color:#4d8b65;color:#a6f2bd}
      @media(max-width:520px){.spotify-playlist-backlink{width:36px;padding:0;font-size:0}.spotify-playlist-backlink::after{content:'SP↗';font-size:9px}}
    `;
    document.head.appendChild(style);
  }

  function sidecarForLibraryTrack(track, sidecar) {
    const directId = clean(track?.spotifyTrackId);
    if (directId && sidecar[directId]) return sidecar[directId];
    const id = clean(track?.id);
    const title = normalize(track?.title);
    const candidates = Object.values(sidecar).filter((item) => {
      if (id && clean(item?.libraryId) === id) return true;
      return title && normalize(item?.title) === title;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function decorateRows() {
    const list = document.getElementById('trackList');
    if (!list) return;
    ensureStyles();
    const library = readLibrary();
    const sidecar = readSidecar();
    let serializedChanged = false;

    for (const row of list.querySelectorAll('.track[data-index]')) {
      const index = Number(row.dataset.index);
      const track = library[index];
      if (!track) continue;
      const saved = sidecarForLibraryTrack(track, sidecar);
      const spotifyTrackId = clean(track.spotifyTrackId || saved?.spotifyTrackId);
      if (!spotifyTrackId) continue;

      const fields = saved ? { ...saved } : track;
      const merged = mergeProviderFields(track, fields);
      if (JSON.stringify(merged) !== JSON.stringify(track)) {
        library[index] = merged;
        serializedChanged = true;
      }

      row.classList.add('spotify-played-track');
      const artistNode = row.querySelector('.track-artist');
      const actualArtist = clean(track.artist || saved?.artist);
      const playlistTitle = clean(track.spotifyPlaylistTitle || saved?.spotifyPlaylistTitle || track.playlist);
      if (artistNode) {
        artistNode.textContent = actualArtist
          ? `${actualArtist} · Spotify`
          : `Spotify${playlistTitle ? ` · ${playlistTitle}` : ''}`;
        artistNode.title = [actualArtist, 'Spotify', playlistTitle].filter(Boolean).join(' · ');
      }

      const playlistUrl = clean(track.spotifyPlaylistUrl || saved?.spotifyPlaylistUrl);
      let link = row.querySelector('.spotify-playlist-backlink');
      if (playlistUrl) {
        if (!link) {
          link = document.createElement('a');
          link.className = 'spotify-playlist-backlink';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Playlist ↗';
          const marker = row.querySelector('.track-play');
          if (marker) row.insertBefore(link, marker); else row.appendChild(link);
        }
        link.href = playlistUrl;
        link.title = playlistTitle ? `Open source Spotify playlist: ${playlistTitle}` : 'Open source Spotify playlist';
        link.setAttribute('aria-label', link.title);
      }
    }

    if (serializedChanged) localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }

  function rememberSidecar(parsed, source, fields, libraryTrack) {
    const value = saveSidecar(parsed.trackId, {
      libraryId: clean(libraryTrack?.id),
      title: clean(libraryTrack?.title || fields.title),
      artist: clean(libraryTrack?.artist || fields.artist),
      spotifyTrackId: parsed.trackId,
      spotifyTrackUrl: parsed.trackUrl,
      spotifyPlaylistId: source.playlistId,
      spotifyPlaylistUrl: source.canonicalUrl,
      spotifyPlaylistTitle: source.title,
      spotifyPlaylistOwner: source.owner,
      spotifyPlayedAt: fields.spotifyPlayedAt,
      duration: Math.max(0, Number(fields.duration || 0)),
    });
    return value;
  }

  async function enrichPlaylistSource(source) {
    if (source.title || !source.canonicalUrl) return source;
    try {
      const meta = await readOEmbed(source.canonicalUrl);
      if (meta.title) source.title = meta.title;
    } catch {}
    return source;
  }

  async function retainStarted(detail = {}) {
    const parsed = parsePlayingURI(detail.playingURI);
    if (!parsed) return { handled: false };
    const source = await enrichPlaylistSource(sourceFromDetail(detail));
    const durationMs = Math.max(0, Number(detail.durationMs || seenDurations.get(parsed.trackId) || 0));
    const playedAt = new Date().toISOString();
    const existingSide = readSidecar()[parsed.trackId];
    const library = readLibrary();
    let existing = library.find((track) => clean(track?.spotifyTrackId) === parsed.trackId);
    if (!existing && existingSide?.libraryId) existing = library.find((track) => clean(track?.id) === clean(existingSide.libraryId));

    if (existing) {
      const fields = providerFields(parsed, source, {
        title: clean(existing.title || existingSide?.title),
        thumbnail: clean(existing.thumbnail),
      }, null, durationMs, playedAt);
      const patch = patchSerializedLibrary(parsed.trackId, fields, clean(existing.id));
      rememberSidecar(parsed, source, fields, patch?.track || existing);
      if (VIDEO_ID_RE.test(clean(existing.id)) && durationMs > 0) {
        window.updateTrackMetadata?.(existing.id, { duration: Math.round(durationMs / 1000) });
      }
      decorateRows();
      return { handled: true, duplicate: true, track: patch?.track || existing };
    }

    let metadata;
    try {
      metadata = await readOEmbed(parsed.trackUrl);
    } catch (error) {
      console.warn('[ÁmpulaMP] Spotify played-track metadata unavailable', error);
      return { handled: true, error };
    }
    if (!metadata.title) return { handled: true, error: new Error('Spotify track title unavailable') };

    const exact = exactTitleCandidate(library, metadata.title);
    const fallback = await resolveFallback(metadata, durationMs);
    const fields = providerFields(parsed, source, metadata, fallback, durationMs, playedAt);

    if (exact) {
      const patch = patchSerializedLibrary(parsed.trackId, fields, clean(exact.id));
      rememberSidecar(parsed, source, fields, patch?.track || exact);
      if (VIDEO_ID_RE.test(clean(exact.id))) {
        window.updateTrackMetadata?.(exact.id, {
          title: metadata.title,
          artist: fallback?.artist || clean(exact.artist),
          thumbnail: metadata.thumbnail || fallback?.thumbnail,
          duration: fields.duration,
        });
      }
      decorateRows();
      return { handled: true, adoptedExisting: true, track: patch?.track || exact };
    }

    const result = window.importTracks?.([fields]);
    if (!result) return { handled: true, error: new Error('Library import unavailable') };
    const patch = patchSerializedLibrary(parsed.trackId, fields, fallback?.id || '');
    const saved = patch?.track || readLibrary().find((track) => clean(track?.spotifyTrackId) === parsed.trackId) || null;
    rememberSidecar(parsed, source, fields, saved);
    decorateRows();

    const status = document.getElementById('spotifySourceStatus');
    if (status) status.textContent = `Playing from Spotify · saved to Your library${source.title ? ` · ${source.title}` : ''}`;
    return { handled: true, added: Number(result.added || 0), track: saved };
  }

  async function handleStarted(detail = {}) {
    const parsed = parsePlayingURI(detail.playingURI);
    if (!parsed) return { handled: false };
    if (inflight.has(parsed.trackId)) return inflight.get(parsed.trackId);
    const promise = retainStarted(detail).finally(() => inflight.delete(parsed.trackId));
    inflight.set(parsed.trackId, promise);
    return promise;
  }

  async function handleUpdate(detail = {}) {
    const parsed = parsePlayingURI(detail.playingURI);
    if (!parsed) return { handled: false };
    const durationMs = Math.max(0, Number(detail.durationMs || 0));
    if (!durationMs) return { handled: true };
    seenDurations.set(parsed.trackId, durationMs);
    const duration = Math.round(durationMs / 1000);
    const previous = Number(readSidecar()[parsed.trackId]?.duration || 0);
    if (previous === duration) return { handled: true, unchanged: true };

    const source = sourceFromDetail(detail);
    const side = readSidecar()[parsed.trackId];
    const library = readLibrary();
    const existing = library.find((track) => clean(track?.spotifyTrackId) === parsed.trackId)
      || (side?.libraryId ? library.find((track) => clean(track?.id) === clean(side.libraryId)) : null);
    if (!existing) return { handled: true, pending: true };

    const fields = {
      title: clean(existing.title || side?.title),
      duration,
      spotifyTrackId: parsed.trackId,
      spotifyTrackUrl: parsed.trackUrl,
      spotifyPlaylistId: source.playlistId || clean(side?.spotifyPlaylistId),
      spotifyPlaylistUrl: source.canonicalUrl || clean(side?.spotifyPlaylistUrl),
      spotifyPlaylistTitle: source.title || clean(side?.spotifyPlaylistTitle),
      spotifyPlaylistOwner: source.owner || clean(side?.spotifyPlaylistOwner),
      spotifyPlayedAt: clean(side?.spotifyPlayedAt),
    };
    const patch = patchSerializedLibrary(parsed.trackId, fields, clean(existing.id));
    rememberSidecar(parsed, source, { ...fields, spotifyPlayedAt: clean(side?.spotifyPlayedAt) || new Date().toISOString() }, patch?.track || existing);
    if (VIDEO_ID_RE.test(clean(existing.id))) window.updateTrackMetadata?.(existing.id, { duration });
    decorateRows();
    return { handled: true, track: patch?.track || existing };
  }

  window.addEventListener('ampula:spotify-playback-started', (event) => { void handleStarted(event.detail); });
  window.addEventListener('ampula:spotify-playback-update', (event) => { void handleUpdate(event.detail); });

  const list = document.getElementById('trackList');
  if (list) new MutationObserver(() => queueMicrotask(decorateRows)).observe(list, { childList: true, subtree: true });
  setTimeout(decorateRows, 100);

  window.ampulaSpotifyPlayedLibrary161 = {
    parsePlayingURI,
    readOEmbed,
    handleStarted,
    handleUpdate,
    decorateRows,
  };

  console.info('[ÁmpulaMP] Spotify played-track library 1.6.1 ready');
})();