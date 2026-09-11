(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_QUEUE_170__) return;
  window.__AMPULA_PLAYBACK_QUEUE_170__ = true;

  const VERSION = '1.7.8';
  const MODE = 'full-library';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
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

  function readCurrentIndex(length) {
    const value = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(value) && value >= 0 && value < length ? value : -1;
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

  function nextReadyIndex(rows, startIndex, attempted, excludedIndex = -1, direction = 1) {
    if (!rows.length) return -1;
    const safeIndex = ((Number(startIndex) % rows.length) + rows.length) % rows.length;
    const step = direction < 0 ? -1 : 1;
    for (let offset = 0; offset < rows.length; offset += 1) {
      const index = (safeIndex + (step * offset) + (rows.length * 2)) % rows.length;
      if (index === excludedIndex || attempted.has(index)) continue;
      if (isReady(rows[index])) return index;
    }
    return -1;
  }

  async function playNextAvailable(startIndex, originalPlayIndex, options = {}) {
    const initial = readLibrary();
    if (!initial.length) return false;
    const safeIndex = ((Number(startIndex) % initial.length) + initial.length) % initial.length;
    const excludedIndex = Number.isInteger(options.excludedIndex) ? options.excludedIndex : -1;
    const direction = options.direction < 0 ? -1 : 1;
    const attempted = new Set();
    startFullResolution(safeIndex);
    const status = document.getElementById('status');
    if (status) status.textContent = direction < 0 ? 'SKIPPING UNRESOLVED · FINDING PREVIOUS…' : 'SKIPPING UNRESOLVED · FINDING NEXT…';
    const deadline = Date.now() + QUEUE_WAIT_MS;

    while (true) {
      const rows = readLibrary();
      if (!rows.length) return false;
      const targetIndex = nextReadyIndex(rows, safeIndex, attempted, excludedIndex, direction);
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

    if (status) status.textContent = 'NO PLAYABLE TRACK YET · RESOLUTION CONTINUES';
    return false;
  }

  function navigationState() {
    return window.ampulaPlaybackNavigation178 || null;
  }

  function isExplicitSelection(intent, requestedIndex) {
    return intent?.type === 'track' && Number(intent.index) === requestedIndex;
  }

  function isForwardContinuation(intent, requestedIndex, previousIndex, length) {
    if (previousIndex < 0 || !length) return false;
    if (intent?.type === 'track' || intent?.type === 'previous' || intent?.type === 'play') return false;
    const nextIndex = (previousIndex + 1) % length;
    return requestedIndex === nextIndex && (!intent || intent.type === 'next');
  }

  async function playExplicitSelection(index, track, originalPlayIndex) {
    const status = document.getElementById('status');
    if (status) status.textContent = 'SELECTED TRACK UNRESOLVED · RESOLVING…';
    const resolved = await resolveAndCache(index, track);
    const rows = readLibrary();
    const selected = rows[index] || resolved;
    if (isReady(selected)) {
      const result = await originalPlayIndex(index);
      startFullResolution(index);
      return result;
    }
    startFullResolution(index);
    if (status) status.textContent = 'SELECTED TRACK UNRESOLVED · RESOLUTION CONTINUES';
    return false;
  }

  function installQueueBridge() {
    const current = window.playIndex;
    if (typeof current !== 'function' || current.__ampulaPlaybackQueue170) return false;
    const wrapped = async (index) => {
      const rows = readLibrary();
      if (!rows.length) return current(index);
      const requestedIndex = ((Number(index) % rows.length) + rows.length) % rows.length;
      const previousIndex = readCurrentIndex(rows.length);
      const navigation = navigationState();
      const intent = navigation?.currentIntent?.() || null;
      const explicitSelection = isExplicitSelection(intent, requestedIndex);
      let safeIndex = requestedIndex;

      if (!explicitSelection && isForwardContinuation(intent, requestedIndex, previousIndex, rows.length) && navigation?.isShuffleEnabled?.()) {
        const shuffledIndex = navigation.chooseShuffleIndex?.(rows, previousIndex, isReady);
        if (Number.isInteger(shuffledIndex) && shuffledIndex >= 0) safeIndex = shuffledIndex;
      }

      const backwardTarget = previousIndex >= 0 ? (previousIndex - 1 + rows.length) % rows.length : -1;
      const direction = safeIndex === backwardTarget ? -1 : 1;
      const excludedIndex = previousIndex >= 0 && safeIndex !== previousIndex ? previousIndex : -1;
      const track = rows[safeIndex];

      if (!isReady(track)) {
        if (explicitSelection) return playExplicitSelection(safeIndex, track, current);
        void startResolveAndCache(safeIndex, track);
        return playNextAvailable(safeIndex, current, { excludedIndex, direction });
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
  console.info(`[ÁmpulaMP] playback queue ${VERSION} ready · exact manual selection · unresolved continuation skip · full-library scan · ${QUEUE_WAIT_MS / 1000}s recovery window · final trust ${FINAL_TRUST_VERSION}`);
})();
