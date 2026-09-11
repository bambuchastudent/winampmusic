(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_QUEUE_170__) return;
  window.__AMPULA_PLAYBACK_QUEUE_170__ = true;

  const VERSION = '1.7.1';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const RESOLVER_VERSION = 'music-only-v1.6.4';
  const FINAL_TRUST_VERSION = 'music-only-v1.6.7';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const PLAYABLE_AHEAD = 2;
  const SCAN_LIMIT = 12;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const inflight = new Map();

  function readLibrary() {
    try {
      const rows = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function writeLibrary(rows) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(rows)); } catch {}
  }

  function recordingKey(track) {
    const spotify = clean(track?.spotifyTrackId);
    if (spotify) return `spotify:${spotify}`;
    const apple = clean(track?.appleTrackId);
    if (apple) return `apple:${apple}`;
    return `meta:${clean(track?.artist).toLowerCase()}\u0000${clean(track?.title).toLowerCase()}`;
  }

  function sameRecording(left, right) {
    if (!left || !right) return false;
    if (clean(left.spotifyTrackId) && clean(left.spotifyTrackId) === clean(right.spotifyTrackId)) return true;
    if (clean(left.appleTrackId) && clean(left.appleTrackId) === clean(right.appleTrackId)) return true;
    return clean(left.title).toLowerCase() === clean(right.title).toLowerCase() &&
      clean(left.artist).toLowerCase() === clean(right.artist).toLowerCase();
  }

  function isKnownSongOrigin(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    const url = clean(track?.originUrl || track?.sourceUrl);
    return Boolean(
      clean(track?.spotifyTrackId) || clean(track?.spotifyPlaylistId) || clean(track?.appleTrackId) ||
      badges.includes('Spotify') || badges.includes('Apple Music') ||
      /(?:open\.spotify\.com|music\.apple\.com)/i.test(url)
    );
  }

  function isReady(track) {
    if (!track || !VIDEO_ID_RE.test(clean(track.id))) return false;
    if (!isKnownSongOrigin(track)) return true;
    return clean(track.youtubeMatchFinalTrustVersion) === FINAL_TRUST_VERSION;
  }

  function persistResolved(resolved, fallbackIndex) {
    if (!resolved || !VIDEO_ID_RE.test(clean(resolved.id))) return null;
    try { window.importTracks?.([resolved]); } catch {}
    const rows = readLibrary();
    let index = rows.findIndex((row) => sameRecording(row, resolved));
    if (index < 0 && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < rows.length) index = fallbackIndex;
    if (index < 0) return null;
    rows[index] = {
      ...rows[index],
      ...resolved,
      id: clean(resolved.id),
      title: clean(rows[index]?.title || resolved.title),
      artist: clean(rows[index]?.artist || resolved.artist),
      youtubeMatchId: clean(resolved.youtubeMatchId || resolved.id),
      youtubeMatchResolverVersion: clean(resolved.youtubeMatchResolverVersion || RESOLVER_VERSION),
      youtubeMatchFinalTrustVersion: FINAL_TRUST_VERSION,
      playbackProvider: clean(resolved.playbackProvider || 'youtube'),
      badges: [...new Set([...(Array.isArray(rows[index]?.badges) ? rows[index].badges : []), ...(Array.isArray(resolved.badges) ? resolved.badges : []), 'YouTube match'])],
    };
    writeLibrary(rows);
    window.renderLibrary?.();
    window.ampMusicOriginPlayback151?.refresh?.();
    return rows[index];
  }

  async function resolveAndCache(index, sourceTrack) {
    const rows = readLibrary();
    const track = rows[index] || sourceTrack;
    if (!track) return null;
    if (isReady(track)) return track;
    if (!isKnownSongOrigin(track)) return VIDEO_ID_RE.test(clean(track.id)) ? track : null;

    const key = recordingKey(track);
    if (inflight.has(key)) return inflight.get(key);
    const job = (async () => {
      let resolved = null;
      if (typeof window.ampulaPlaybackPrefetch165?.resolveAhead === 'function') {
        resolved = await window.ampulaPlaybackPrefetch165.resolveAhead(index, track);
      }
      if (!resolved) {
        const diagnostics = window.ampulaTrackDiagnostics164;
        if (typeof diagnostics?.resolveTrusted === 'function') resolved = await diagnostics.resolveTrusted(index, track);
      }
      if (!resolved || !VIDEO_ID_RE.test(clean(resolved.id))) return null;
      return persistResolved(resolved, index);
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  }

  async function ensurePlayableAhead(index, count = PLAYABLE_AHEAD) {
    const initial = readLibrary();
    if (initial.length < 2) return { playable: 0, checked: 0 };
    const safeIndex = ((Number(index) % initial.length) + initial.length) % initial.length;
    const max = Math.min(SCAN_LIMIT, initial.length - 1);
    let playable = 0;
    let checked = 0;
    for (let offset = 1; offset <= max && playable < count; offset += 1) {
      const rows = readLibrary();
      const targetIndex = (safeIndex + offset) % rows.length;
      const track = rows[targetIndex];
      checked += 1;
      const ready = isReady(track) ? track : await resolveAndCache(targetIndex, track);
      if (ready && isReady(ready)) playable += 1;
    }
    return { playable, checked };
  }

  function isAutomaticEndAdvance(requestedIndex, rows) {
    if (!rows.length) return false;
    const saved = Number(localStorage.getItem(CURRENT_KEY));
    if (!Number.isInteger(saved) || saved < 0 || saved >= rows.length) return false;
    const expected = (saved + 1) % rows.length;
    const safeRequested = ((Number(requestedIndex) % rows.length) + rows.length) % rows.length;
    const status = clean(document.getElementById('status')?.textContent);
    const playText = clean(document.getElementById('playButton')?.textContent);
    return safeRequested === expected && /^PLAYING$/i.test(status) && !playText.includes('⏸');
  }

  async function playNextAvailable(afterIndex, originalPlayIndex) {
    const initial = readLibrary();
    if (initial.length < 2) return false;
    const safeIndex = ((Number(afterIndex) % initial.length) + initial.length) % initial.length;
    const max = Math.min(SCAN_LIMIT, initial.length - 1);
    for (let offset = 1; offset <= max; offset += 1) {
      const rows = readLibrary();
      const targetIndex = (safeIndex + offset) % rows.length;
      const track = rows[targetIndex];
      const ready = isReady(track) ? track : await resolveAndCache(targetIndex, track);
      if (!ready || !isReady(ready)) continue;
      const result = await originalPlayIndex(targetIndex);
      if (result === false) continue;
      queueMicrotask(() => { void ensurePlayableAhead(targetIndex, PLAYABLE_AHEAD); });
      return result;
    }
    const status = document.getElementById('status');
    if (status) status.textContent = `NO PLAYABLE TRACK IN NEXT ${max} · ORIGIN PRESERVED`;
    return false;
  }

  function installQueueBridge() {
    const current = window.playIndex;
    if (typeof current !== 'function' || current.__ampulaPlaybackQueue170) return false;
    const wrapped = async (index) => {
      const rows = readLibrary();
      if (!rows.length) return current(index);
      const safeIndex = ((Number(index) % rows.length) + rows.length) % rows.length;
      const automatic = isAutomaticEndAdvance(safeIndex, rows);
      const track = rows[safeIndex];
      const ready = isReady(track) ? track : await resolveAndCache(safeIndex, track);
      if (!ready || !isReady(ready)) {
        if (automatic) return playNextAvailable(safeIndex, current);
        return false;
      }
      const result = await current(safeIndex);
      queueMicrotask(() => { void ensurePlayableAhead(safeIndex, PLAYABLE_AHEAD); });
      return result;
    };
    Object.defineProperty(wrapped, '__ampulaPlaybackQueue170', { value: true });
    Object.defineProperty(wrapped, '__ampulaWrappedPlayIndex', { value: current });
    window.playIndex = wrapped;
    return true;
  }

  installQueueBridge();
  for (const delay of [60, 250, 900, 2200]) setTimeout(installQueueBridge, delay);

  window.ampulaPlaybackQueue170 = {
    version: VERSION,
    playableAhead: PLAYABLE_AHEAD,
    scanLimit: SCAN_LIMIT,
    finalTrustVersion: FINAL_TRUST_VERSION,
    isReady,
    resolveAndCache,
    ensurePlayableAhead,
    installQueueBridge,
  };
  console.info(`[ÁmpulaMP] rolling playback queue ${VERSION} ready · ${PLAYABLE_AHEAD} playable ahead · final trust ${FINAL_TRUST_VERSION}`);
})();