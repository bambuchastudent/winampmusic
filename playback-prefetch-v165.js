(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_PREFETCH_165__) return;
  window.__AMPULA_PLAYBACK_PREFETCH_165__ = true;

  const VERSION = '1.6.5';
  const PREFETCH_COUNT = 2;
  const TRUST_VERSION = 'music-only-v1.6.4';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const inflight = new Map();
  let matcherPromise = null;

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
    // Prefetch is deliberately limited to unresolved rows. A valid-looking stale YouTube
    // id is revalidated only when it becomes current, where the v1.6.4 safe bridge can
    // keep FAST's in-memory playback state and persisted state in lock-step.
    return !VIDEO_ID_RE.test(clean(track.id));
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
      const timer = setTimeout(finish, 4200);
      const done = () => { clearTimeout(timer); setTimeout(finish, 0); };
      if (!script) {
        script = document.createElement('script');
        script.src = './apple-music-import-v064.js?v=165';
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
      const timer = setTimeout(() => controller.abort(), 6500);
      try {
        const candidate = await matcher({
          title: clean(originalTrack.title),
          artist: clean(originalTrack.artist),
          durationMs: Math.max(0, Number(originalTrack.duration || 0) * 1000),
        }, controller.signal);
        const id = clean(candidate?.id);
        if (!VIDEO_ID_RE.test(id)) return null;

        const library = readLibrary();
        const currentIndex = findCurrentIndex(library, originalTrack, index);
        if (currentIndex < 0) return null;
        const current = library[currentIndex];
        // If another path resolved the row while prefetch was in flight, do not replace it.
        if (!needsPrefetchResolution(current)) return current;
        const resolved = {
          ...current,
          id,
          title: clean(current.title || originalTrack.title),
          artist: clean(current.artist || originalTrack.artist),
          youtubeMatchId: id,
          youtubeMatchResolverVersion: TRUST_VERSION,
          playbackProvider: 'youtube',
          badges: [...new Set([...(Array.isArray(current.badges) ? current.badges : []), 'YouTube match'])],
        };

        // Newly imported unresolved rows can be adopted safely by FAST's in-memory library.
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
        if (error?.name !== 'AbortError') console.debug('[ÁmpulaMP prefetch] no trusted match', clean(error?.message));
        return null;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => inflight.delete(key));

    inflight.set(key, job);
    return job;
  }

  async function prefetchFollowing(index, count = PREFETCH_COUNT) {
    const library = readLibrary();
    if (library.length < 2) return [];
    const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
    const targets = [];
    const limit = Math.min(Math.max(0, Number(count) || 0), Math.max(0, library.length - 1));
    for (let offset = 1; offset <= limit; offset += 1) {
      const targetIndex = (safeIndex + offset) % library.length;
      const track = library[targetIndex];
      if (needsPrefetchResolution(track)) targets.push([targetIndex, track]);
    }
    return Promise.allSettled(targets.map(([targetIndex, track]) => resolveAhead(targetIndex, track)));
  }

  function installPlayBridge() {
    const current = window.playIndex;
    if (typeof current !== 'function' || current.__ampulaPrefetch165) return false;
    const wrapped = (index) => {
      const result = current(index);
      queueMicrotask(() => { void prefetchFollowing(index, PREFETCH_COUNT); });
      return result;
    };
    Object.defineProperty(wrapped, '__ampulaPrefetch165', { value: true });
    Object.defineProperty(wrapped, '__ampulaWrappedPlayIndex', { value: current });
    window.playIndex = wrapped;
    return true;
  }

  installPlayBridge();
  window.ampulaPlaybackPrefetch165 = {
    version: VERSION,
    count: PREFETCH_COUNT,
    needsPrefetchResolution,
    resolveAhead,
    prefetchFollowing,
    installPlayBridge,
  };
  console.info(`[ÁmpulaMP] playback resolver prefetch ${VERSION} ready · ${PREFETCH_COUNT} ahead`);
})();