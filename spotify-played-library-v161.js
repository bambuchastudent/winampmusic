(() => {
  'use strict';
  if (window.__AMPULA_SPOTIFY_PLAYED_LIBRARY_161__) return;
  window.__AMPULA_SPOTIFY_PLAYED_LIBRARY_161__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const SIDE_KEY = 'ampula.spotifyPlayed.v1';
  const TRACK_URI_RE = /^spotify:track:([A-Za-z0-9]{16,40})$/;
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalize = (value) => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const inflight = new Map();
  let matcherPromise = null;
  let decorateQueued = false;

  function parsePlayingURI(value) {
    const match = clean(value).match(TRACK_URI_RE);
    if (!match) return null;
    return { trackId: match[1], trackUrl: `https://open.spotify.com/track/${match[1]}` };
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function readLibrary() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function readSidecar() {
    const value = readJson(SIDE_KEY, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function writeSidecar(trackId, patch) {
    const sidecar = readSidecar();
    sidecar[trackId] = { ...(sidecar[trackId] || {}), ...patch };
    const entries = Object.entries(sidecar)
      .sort((a, b) => String(b[1]?.spotifyPlayedAt || '').localeCompare(String(a[1]?.spotifyPlayedAt || '')))
      .slice(0, 500);
    localStorage.setItem(SIDE_KEY, JSON.stringify(Object.fromEntries(entries)));
    return sidecar[trackId];
  }

  function sourceFromDetail(detail = {}) {
    const source = detail.playlist || {};
    const playlistId = clean(source.playlistId);
    const spotifyPlaylistUrl = clean(source.canonicalUrl) || (playlistId ? `https://open.spotify.com/playlist/${playlistId}` : '');
    return {
      spotifyPlaylistId: playlistId,
      spotifyPlaylistUrl,
      spotifyPlaylistTitle: clean(source.title),
      spotifyPlaylistOwner: clean(source.owner),
    };
  }

  async function readOEmbed(entityUrl) {
    const endpoint = new URL('https://open.spotify.com/oembed');
    endpoint.searchParams.set('url', entityUrl);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Spotify oEmbed HTTP ${response.status}`);
    const payload = await response.json();
    return { title: clean(payload?.title), thumbnail: clean(payload?.thumbnail_url) };
  }

  function loadMatcher() {
    if (window.winampMusicAppleImport?.findYouTubeMatch) return Promise.resolve(window.winampMusicAppleImport.findYouTubeMatch);
    if (matcherPromise) return matcherPromise;
    matcherPromise = new Promise((resolve) => {
      let script = document.querySelector('script[data-spotify-played-matcher]');
      if (script?.dataset.loaded === '1') return resolve(window.winampMusicAppleImport?.findYouTubeMatch || null);
      script = script || document.createElement('script');
      const finish = () => resolve(window.winampMusicAppleImport?.findYouTubeMatch || null);
      const timer = setTimeout(finish, 2600);
      script.addEventListener('load', () => { clearTimeout(timer); script.dataset.loaded = '1'; finish(); }, { once: true });
      script.addEventListener('error', () => { clearTimeout(timer); resolve(null); }, { once: true });
      if (!script.isConnected) {
        script.src = './apple-music-import-v064.js?v=161';
        script.async = true;
        script.dataset.spotifyPlayedMatcher = '1';
        document.head.appendChild(script);
      }
    }).finally(() => { matcherPromise = null; });
    return matcherPromise;
  }

  async function resolveFallback(title, durationMs) {
    const matcher = await loadMatcher();
    if (typeof matcher !== 'function') return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2400);
    try {
      const candidate = await matcher({ title, artist: '', durationMs: Math.max(0, Number(durationMs || 0)) }, controller.signal);
      if (!VIDEO_ID_RE.test(clean(candidate?.id))) return null;
      return {
        id: clean(candidate.id),
        artist: clean(candidate.artist).replace(/\s*-\s*Topic$/i, '').replace(/\s+VEVO$/i, '').trim(),
        thumbnail: clean(candidate.thumbnail),
        duration: Math.max(0, Number(candidate.duration || 0)),
      };
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function findLibraryTrack(library, trackId, side = null, preferredId = '', title = '') {
    let index = library.findIndex((track) => clean(track?.spotifyTrackId) === trackId);
    if (index < 0 && side?.libraryId) index = library.findIndex((track) => clean(track?.id) === clean(side.libraryId));
    if (index < 0 && preferredId) index = library.findIndex((track) => clean(track?.id) === preferredId);
    if (index < 0 && title) {
      const needle = normalize(title);
      const matches = library.map((track, i) => ({ track, i })).filter(({ track }) => normalize(track?.title) === needle);
      if (matches.length === 1) index = matches[0].i;
    }
    return index;
  }

  function mergeProvenance(track, fields) {
    const next = { ...track };
    for (const key of ['spotifyTrackId','spotifyTrackUrl','spotifyPlaylistId','spotifyPlaylistUrl','spotifyPlaylistTitle','spotifyPlaylistOwner','spotifyPlayedAt']) {
      const value = clean(fields[key]);
      if (value) next[key] = value;
    }
    if (!clean(next.sourceUrl)) next.sourceUrl = clean(fields.spotifyTrackUrl);
    if (!clean(next.originUrl)) next.originUrl = clean(fields.spotifyTrackUrl);
    if (!clean(next.playlist)) next.playlist = clean(fields.spotifyPlaylistTitle) || 'Spotify playlist';
    if (!clean(next.thumbnail) && clean(fields.thumbnail)) next.thumbnail = clean(fields.thumbnail);
    if (!clean(next.artist) && clean(fields.artist)) next.artist = clean(fields.artist);
    const duration = Math.max(0, Number(fields.duration || 0));
    if (duration) next.duration = duration;
    next.badges = [...new Set([...(Array.isArray(next.badges) ? next.badges : []), 'Spotify', 'Played'].map(clean).filter(Boolean))];
    return next;
  }

  function patchLibrary(trackId, fields, side = null, preferredId = '') {
    const library = readLibrary();
    const index = findLibraryTrack(library, trackId, side, preferredId, fields.title);
    if (index < 0) return null;
    library[index] = mergeProvenance(library[index], fields);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    return { index, track: library[index] };
  }

  function saveMapping(parsed, fields, libraryTrack) {
    return writeSidecar(parsed.trackId, {
      libraryId: clean(libraryTrack?.id),
      title: clean(libraryTrack?.title || fields.title),
      artist: clean(libraryTrack?.artist || fields.artist),
      spotifyTrackId: parsed.trackId,
      spotifyTrackUrl: parsed.trackUrl,
      spotifyPlaylistId: clean(fields.spotifyPlaylistId),
      spotifyPlaylistUrl: clean(fields.spotifyPlaylistUrl),
      spotifyPlaylistTitle: clean(fields.spotifyPlaylistTitle),
      spotifyPlaylistOwner: clean(fields.spotifyPlaylistOwner),
      spotifyPlayedAt: clean(fields.spotifyPlayedAt),
      duration: Math.max(0, Number(fields.duration || 0)),
    });
  }

  function ensureStyles() {
    if (document.getElementById('ampulaSpotifyPlayed161Styles')) return;
    const style = document.createElement('style');
    style.id = 'ampulaSpotifyPlayed161Styles';
    style.textContent = `#trackList .track.spotify-played-track{grid-template-columns:42px minmax(0,1fr) auto 28px}.spotify-playlist-backlink{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 7px;border:1px solid #315b43;border-radius:7px;background:#15231b;color:#7ae29c;text-decoration:none;font:800 9px/1 system-ui,sans-serif;white-space:nowrap}.spotify-playlist-backlink:hover{border-color:#4d8b65;color:#a6f2bd}@media(max-width:520px){.spotify-playlist-backlink{width:36px;padding:0;font-size:0}.spotify-playlist-backlink::after{content:'SP↗';font-size:9px}}`;
    document.head.appendChild(style);
  }

  function decorateRows() {
    const list = document.getElementById('trackList');
    if (!list) return;
    ensureStyles();
    const library = readLibrary();
    const sidecar = readSidecar();
    for (const row of list.querySelectorAll('.track[data-index]')) {
      const index = Number(row.dataset.index);
      const track = library[index];
      if (!track) continue;
      const side = clean(track.spotifyTrackId) ? sidecar[clean(track.spotifyTrackId)] : Object.values(sidecar).find((item) => clean(item?.libraryId) === clean(track.id));
      const trackId = clean(track.spotifyTrackId || side?.spotifyTrackId);
      if (!trackId) continue;
      row.classList.add('spotify-played-track');

      const artist = clean(track.artist || side?.artist);
      const playlistTitle = clean(track.spotifyPlaylistTitle || side?.spotifyPlaylistTitle || track.playlist);
      const artistText = artist ? `${artist} · Spotify` : `Spotify${playlistTitle ? ` · ${playlistTitle}` : ''}`;
      const artistNode = row.querySelector('.track-artist');
      if (artistNode && clean(artistNode.textContent) !== artistText) artistNode.textContent = artistText;
      if (artistNode) artistNode.title = [artist, 'Spotify', playlistTitle].filter(Boolean).join(' · ');

      const playlistUrl = clean(track.spotifyPlaylistUrl || side?.spotifyPlaylistUrl);
      if (!playlistUrl) continue;
      let link = row.querySelector('.spotify-playlist-backlink');
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

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    queueMicrotask(() => { decorateQueued = false; decorateRows(); });
  }

  async function handleStarted(detail = {}) {
    const parsed = parsePlayingURI(detail.playingURI);
    if (!parsed) return { handled: false };
    if (inflight.has(parsed.trackId)) return inflight.get(parsed.trackId);

    const job = (async () => {
      const source = sourceFromDetail(detail);
      const playedAt = new Date().toISOString();
      const duration = Math.max(0, Math.round(Number(detail.durationMs || 0) / 1000));
      const side = readSidecar()[parsed.trackId];
      const existingLibrary = readLibrary();
      const existingIndex = findLibraryTrack(existingLibrary, parsed.trackId, side);

      if (existingIndex >= 0) {
        const existing = existingLibrary[existingIndex];
        const fields = { ...source, title: clean(existing.title || side?.title), artist: clean(existing.artist || side?.artist), thumbnail: clean(existing.thumbnail), duration, spotifyTrackId: parsed.trackId, spotifyTrackUrl: parsed.trackUrl, spotifyPlayedAt: playedAt };
        const patched = patchLibrary(parsed.trackId, fields, side, clean(existing.id));
        saveMapping(parsed, fields, patched?.track || existing);
        if (VIDEO_ID_RE.test(clean(existing.id)) && duration) window.updateTrackMetadata?.(existing.id, { duration });
        queueDecorate();
        return { handled: true, duplicate: true, track: patched?.track || existing };
      }

      let meta;
      try { meta = await readOEmbed(parsed.trackUrl); }
      catch (error) {
        console.warn('[ÁmpulaMP] Spotify played-track metadata unavailable', error);
        return { handled: true, error };
      }
      if (!meta.title) return { handled: true, error: new Error('Spotify track title unavailable') };

      const fallback = await resolveFallback(meta.title, detail.durationMs);
      const fields = {
        ...(fallback?.id ? { id: fallback.id } : {}),
        title: meta.title,
        artist: fallback?.artist || '',
        thumbnail: meta.thumbnail || fallback?.thumbnail || '',
        duration: duration || fallback?.duration || 0,
        playlist: source.spotifyPlaylistTitle || 'Spotify playlist',
        badges: ['Spotify', 'Played'],
        sourceUrl: parsed.trackUrl,
        originUrl: parsed.trackUrl,
        spotifyTrackId: parsed.trackId,
        spotifyTrackUrl: parsed.trackUrl,
        ...source,
        spotifyPlayedAt: playedAt,
        importedAt: playedAt,
      };

      const exactIndex = findLibraryTrack(existingLibrary, parsed.trackId, null, '', meta.title);
      let saved;
      let added = 0;
      if (exactIndex >= 0) {
        const existing = existingLibrary[exactIndex];
        saved = patchLibrary(parsed.trackId, fields, null, clean(existing.id))?.track || existing;
        if (VIDEO_ID_RE.test(clean(existing.id))) window.updateTrackMetadata?.(existing.id, { title: meta.title, artist: fields.artist || clean(existing.artist), thumbnail: fields.thumbnail, duration: fields.duration });
      } else {
        const result = window.importTracks?.([fields]);
        if (!result) return { handled: true, error: new Error('Library import unavailable') };
        added = Number(result.added || 0);
        saved = patchLibrary(parsed.trackId, fields, null, fallback?.id || '')?.track;
      }

      if (!saved) {
        const library = readLibrary();
        const index = findLibraryTrack(library, parsed.trackId, null, fallback?.id || '', meta.title);
        saved = index >= 0 ? library[index] : null;
      }
      saveMapping(parsed, fields, saved);
      queueDecorate();
      const status = document.getElementById('spotifySourceStatus');
      if (status) status.textContent = 'Playing from Spotify · saved to Your library';
      return { handled: true, added, track: saved };
    })().finally(() => inflight.delete(parsed.trackId));

    inflight.set(parsed.trackId, job);
    return job;
  }

  async function handleUpdate(detail = {}) {
    const parsed = parsePlayingURI(detail.playingURI);
    if (!parsed) return { handled: false };
    const duration = Math.max(0, Math.round(Number(detail.durationMs || 0) / 1000));
    if (!duration) return { handled: true };
    const side = readSidecar()[parsed.trackId];
    if (!side) return { handled: true, pending: true };
    if (Number(side.duration || 0) === duration) return { handled: true, unchanged: true };

    const source = sourceFromDetail(detail);
    const fields = { ...source, title: clean(side.title), artist: clean(side.artist), duration, spotifyTrackId: parsed.trackId, spotifyTrackUrl: parsed.trackUrl, spotifyPlayedAt: clean(side.spotifyPlayedAt) };
    const patched = patchLibrary(parsed.trackId, fields, side);
    saveMapping(parsed, fields, patched?.track || null);
    if (VIDEO_ID_RE.test(clean(patched?.track?.id))) window.updateTrackMetadata?.(patched.track.id, { duration });
    queueDecorate();
    return { handled: true, track: patched?.track || null };
  }

  window.addEventListener('ampula:spotify-playback-started', (event) => { void handleStarted(event.detail); });
  window.addEventListener('ampula:spotify-playback-update', (event) => { void handleUpdate(event.detail); });
  const list = document.getElementById('trackList');
  if (list) new MutationObserver(queueDecorate).observe(list, { childList: true, subtree: true });
  setTimeout(decorateRows, 100);

  window.ampulaSpotifyPlayedLibrary161 = { parsePlayingURI, readOEmbed, handleStarted, handleUpdate, decorateRows };
  console.info('[ÁmpulaMP] Spotify played-track library 1.6.1 ready');
})();
