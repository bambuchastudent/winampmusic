(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_PREFETCH_165__) return;
  window.__AMPULA_PLAYBACK_PREFETCH_165__ = true;

  const VERSION = '1.7.5';
  const MODE = 'full-library';
  const WORKER_COUNT = 4;
  const RESOLVE_TIMEOUT_MS = 120000;
  const RESOLVER_VERSION = 'music-only-v1.6.4';
  const FINAL_TRUST_VERSION = 'music-only-v1.6.7';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const inflight = new Map();
  let matcherPromise = null;
  let fullResolvePromise = null;
  let rerunRequested = false;
  let rerunStartIndex = 0;

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function recordingKey(track) {
    const spotify = clean(track?.spotifyTrackId);
    if (spotify) return `spotify:${spotify}`;
    const apple = clean(track?.appleTrackId);
    if (apple) return `apple:${apple}`;
    return `meta:${clean(track?.artist).toLowerCase()}\u0000${clean(track?.title).toLowerCase()}`;
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

  function needsPrefetchResolution(track) {
    if (!track || !isKnownSongOrigin(track) || !clean(track.title)) return false;
    return !VIDEO_ID_RE.test(clean(track.id)) || clean(track.youtubeMatchFinalTrustVersion) !== FINAL_TRUST_VERSION;
  }

  function loadMatcher() {
    if (typeof window.winampMusicAppleImport?.findYouTubeMatch === 'function') {
      return Promise.resolve(window.winampMusicAppleImport.findYouTubeMatch);
    }
    if (matcherPromise) return matcherPromise;
    matcherPromise = new Promise((resolve) => {
      let script = document.querySelector('script[data-playback-prefetch-matcher],script[data-track-diagnostics-matcher],script[data-spotify-origin-matcher],script[src*="apple-music-import-v064.js"]');
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(typeof window.winampMusicAppleImport?.findYouTubeMatch === 'function' ? window.winampMusicAppleImport.findYouTubeMatch : null);
      };
      const timer = setTimeout(finish, 15000);
      const done = () => { clearTimeout(timer); setTimeout(finish, 0); };
      if (!script) {
        script = document.createElement('script');
        script.src = './apple-music-import-v064.js?v=175';
        script.async = true;
        script.dataset.playbackPrefetchMatcher = '1';
        document.head.appendChild(script);
      }
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', done, { once: true });
      if (window.winampMusicAppleImport?.findYouTubeMatch) done();
    }).finally(() => { matcherPromise = null; });
    return matcherPromise;
  }

  function findCurrentIndex(library, originalTrack, fallbackIndex) {
    const key = recordingKey(originalTrack);
    let index = library.findIndex((track) => recordingKey(track) === key);
    if (index < 0 && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < library.length) index = fallbackIndex;
    return index;
  }

  async function resolveAhead(index, originalTrack) {
    if (!needsPrefetchResolution(originalTrack)) return originalTrack || null;
    const key = recordingKey(originalTrack);
    if (inflight.has(key)) return inflight.get(key);

    const job = (async () => {
      const matcher = await loadMatcher();
      if (typeof matcher !== 'function') return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
      try {
        const candidate = await matcher({
          title: clean(originalTrack.title),
          artist: clean(originalTrack.artist),
          durationMs: Math.max(0, Number(originalTrack.duration || 0) * 1000),
        }, controller.signal);
        const id = clean(candidate?.id);
        const finalTrustVersion = clean(candidate?.finalTrustVersion);
        if (!VIDEO_ID_RE.test(id) || finalTrustVersion !== FINAL_TRUST_VERSION) return null;

        const library = readLibrary();
        const currentIndex = findCurrentIndex(library, originalTrack, index);
        if (currentIndex < 0) return null;
        const current = library[currentIndex];
        if (!needsPrefetchResolution(current)) return current;
        const resolved = {
          ...current,
          id,
          title: clean(current.title || originalTrack.title),
          artist: clean(current.artist || originalTrack.artist),
          youtubeMatchId: id,
          youtubeMatchResolverVersion: RESOLVER_VERSION,
          youtubeMatchFinalTrustVersion: finalTrustVersion,
          playbackProvider: 'youtube',
          badges: [...new Set([...(Array.isArray(current.badges) ? current.badges : []), 'YouTube match'])],
        };

        try { window.importTracks?.([resolved]); } catch {}
        const latest = readLibrary();
        const latestIndex = findCurrentIndex(latest, originalTrack, currentIndex);
        if (latestIndex >= 0) latest[latestIndex] = { ...latest[latestIndex], ...resolved };
        else latest.push(resolved);
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(latest));
        window.renderLibrary?.();
        window.ampMusicOriginPlayback151?.refresh?.();
        return resolved;
      } catch (error) {
        if (error?.name !== 'AbortError') console.debug('[ÁmpulaMP resolver] no final-trusted match', clean(error?.message));
        return null;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => inflight.delete(key));

    inflight.set(key, job);
    return job;
  }

  function orderedTargets(library, startIndex = 0) {
    if (!library.length) return [];
    const safeStart = ((Number(startIndex) % library.length) + library.length) % library.length;
    const targets = [];
    for (let offset = 0; offset < library.length; offset += 1) {
      const targetIndex = (safeStart + offset) % library.length;
      const track = library[targetIndex];
      if (needsPrefetchResolution(track)) targets.push([targetIndex, track]);
    }
    return targets;
  }

  async function resolveAll(startIndex = 0) {
    if (fullResolvePromise) {
      rerunRequested = true;
      rerunStartIndex = startIndex;
      return fullResolvePromise;
    }

    const library = readLibrary();
    const targets = orderedTargets(library, startIndex);
    if (!targets.length) return [];
    let cursor = 0;
    const results = new Array(targets.length);

    const worker = async () => {
      while (cursor < targets.length) {
        const slot = cursor++;
        const [targetIndex, track] = targets[slot];
        try {
          results[slot] = await resolveAhead(targetIndex, track);
        } catch {
          results[slot] = null;
        }
      }
    };

    fullResolvePromise = Promise.all(
      Array.from({ length: Math.min(WORKER_COUNT, targets.length) }, () => worker())
    ).then(() => results);

    try {
      return await fullResolvePromise;
    } finally {
      fullResolvePromise = null;
      if (rerunRequested) {
        const nextStart = rerunStartIndex;
        rerunRequested = false;
        rerunStartIndex = 0;
        setTimeout(() => { void resolveAll(nextStart); }, 0);
      }
    }
  }

  // Historical compatibility name. The policy is intentionally no longer positional.
  function prefetchFollowing(index) {
    return resolveAll(index);
  }

  function installPlayBridge() {
    const current = window.playIndex;
    if (typeof current !== 'function' || current.__ampulaPrefetch165) return false;
    const wrapped = (index) => {
      const result = current(index);
      queueMicrotask(() => { void resolveAll(index); });
      return result;
    };
    Object.defineProperty(wrapped, '__ampulaPrefetch165', { value: true });
    Object.defineProperty(wrapped, '__ampulaWrappedPlayIndex', { value: current });
    window.playIndex = wrapped;
    return true;
  }

  function installImportBridge() {
    const current = window.importTracks;
    if (typeof current !== 'function' || current.__ampulaResolveAll175) return false;
    const wrapped = (...args) => {
      const result = current.apply(window, args);
      queueMicrotask(() => {
        const saved = Number(localStorage.getItem(CURRENT_KEY));
        void resolveAll(Number.isInteger(saved) && saved >= 0 ? saved : 0);
      });
      return result;
    };
    Object.defineProperty(wrapped, '__ampulaResolveAll175', { value: true });
    Object.defineProperty(wrapped, '__ampulaWrappedImportTracks', { value: current });
    window.importTracks = wrapped;
    return true;
  }

  installPlayBridge();
  installImportBridge();
  for (const delay of [80, 300, 1000]) setTimeout(installImportBridge, delay);

  window.ampulaPlaybackPrefetch165 = {
    version: VERSION,
    mode: MODE,
    count: Number.POSITIVE_INFINITY,
    workerCount: WORKER_COUNT,
    resolveTimeoutMs: RESOLVE_TIMEOUT_MS,
    finalTrustVersion: FINAL_TRUST_VERSION,
    needsPrefetchResolution,
    resolveAhead,
    resolveAll,
    prefetchFollowing,
    installPlayBridge,
    installImportBridge,
  };

  setTimeout(() => {
    const saved = Number(localStorage.getItem(CURRENT_KEY));
    void resolveAll(Number.isInteger(saved) && saved >= 0 ? saved : 0);
  }, 0);

  console.info(`[ÁmpulaMP] playback resolver ${VERSION} ready · full library · ${WORKER_COUNT} workers · ${RESOLVE_TIMEOUT_MS / 1000}s budget · final trust ${FINAL_TRUST_VERSION}`);
})();