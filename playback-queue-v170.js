(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_QUEUE_170__) return;
  window.__AMPULA_PLAYBACK_QUEUE_170__ = true;

  const VERSION = '1.7.5';
  const MODE = 'full-library';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const RESOLVER_VERSION = 'music-only-v1.6.4';
  const FINAL_TRUST_VERSION = 'music-only-v1.6.7';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const PLAYABLE_AHEAD = Number.POSITIVE_INFINITY;
  const SCAN_LIMIT = Number.POSITIVE_INFINITY;
  const QUEUE_WAIT_MS = 120000;
  const POLL_MS = 250;
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

  function startResolveAndCache(index, sourceTrack) {
    const rows = readLibrary();
    const track = rows[index] || sourceTrack;
    if (!track) return Promise.resolve(null);
    if (isReady(track)) return Promise.resolve(track);
    if (!isKnownSongOrigin(track)) return Promise.resolve(VIDEO_ID_RE.test(clean(track.id)) ? track : null);

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

  async function resolveAndCache(index, sourceTrack) {
    return startResolveAndCache(index, sourceTrack);
  }

  function startFullResolution(index) {
    try {
      const promise = window.ampulaPlaybackPrefetch165?.resolveAll?.(index);
      if (promise?.catch) promise.catch(() => {});
    } catch {}
  }

  async function ensurePlayableAhead(index) {
    startFullResolution(index);
    const rows = readLibrary();
    return {
      playable: rows.filter(isReady).length,
      checked: Math.max(0, rows.length - 1),
      mode: MODE,
    };
  }

  function nextReadyIndex(rows, afterIndex, attempted) {
    if (!rows.length) return -1;
    const safeIndex = ((Number(afterIndex) % rows.length) + rows.length) % rows.length;
    if (isReady(rows[safeIndex]) && !attempted.has(safeIndex)) return safeIndex;
    for (let offset = 1; offset < rows.length; offset += 1) {
      const index = (safeIndex + offset) % rows.length;
      if (!attempted.has(index) && isReady(rows[index])) return index;
    }
    return -1;
  }

  async function playNextAvailable(afterIndex, originalPlayIndex) {
    const initial = readLibrary();
    if (!initial.length) return false;
    const safeIndex = ((Number(afterIndex) % initial.length) + initial.length) % initial.length;
    const attempted = new Set();
    startFullResolution(safeIndex);
    const deadline = Date.now() + QUEUE_WAIT_MS;

    while (true) {
      const rows = readLibrary();
      if (!rows.length) return false;
      const targetIndex = nextReadyIndex(rows, safeIndex, attempted);
      if (targetIndex >= 0) {
        attempted.add(targetIndex);
        const result = await originalPlayIndex(targetIndex);
        if (result !== false) {
          startFullResolution(targetIndex);
          return result;
        }
        continue;
      }

      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    const status = document.getElementById('status');
    if (status) status.textContent = 'NO PLAYABLE TRACK YET · RESOLUTION CONTINUES';
    return false;
  }

  function installQueueBridge() {
    const current = window.playIndex;
    if (typeof current !== 'function' || current.__ampulaPlaybackQueue170) return false;
    const wrapped = async (index) => {
      const rows = readLibrary();
      if (!rows.length) return current(index);
      const safeIndex = ((Number(index) % rows.length) + rows.length) % rows.length;
      const track = rows[safeIndex];
      if (!isReady(track)) {
        void startResolveAndCache(safeIndex, track);
        return playNextAvailable(safeIndex, current);
      }
      const result = await current(safeIndex);
      startFullResolution(safeIndex);
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
    mode: MODE,
    playableAhead: PLAYABLE_AHEAD,
    scanLimit: SCAN_LIMIT,
    queueWaitMs: QUEUE_WAIT_MS,
    finalTrustVersion: FINAL_TRUST_VERSION,
    isReady,
    resolveAndCache,
    ensurePlayableAhead,
    playNextAvailable,
    installQueueBridge,
  };
  console.info(`[ÁmpulaMP] playback queue ${VERSION} ready · full-library scan · ${QUEUE_WAIT_MS / 1000}s recovery window · final trust ${FINAL_TRUST_VERSION}`);
})();