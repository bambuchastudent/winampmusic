(() => {
  'use strict';
  if (window.__AMPULA_RESOLVER_TRUST_167__) return;
  window.__AMPULA_RESOLVER_TRUST_167__ = true;

  const VERSION = 'music-only-v1.6.7';
  const LEGACY_TRUST_VERSION = 'music-only-v1.6.4';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const MIGRATION_KEY = 'ampula.resolverTrust167.migrated';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const MAX_DURATION_DELTA_SECONDS = 15;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function normalize(value) {
    return clean(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function targetDurationSeconds(metadata) {
    const durationMs = Number(metadata?.durationMs || 0);
    if (durationMs > 0) return durationMs / 1000;
    const duration = Number(metadata?.duration || 0);
    return duration > 0 ? duration : 0;
  }

  function titleIdentityMatches(candidateTitle, canonicalTitle) {
    const candidate = normalize(candidateTitle);
    const canonical = normalize(canonicalTitle);
    if (!canonical) return true;
    if (!candidate) return false;
    if (candidate.includes(canonical)) return true;

    // Longer titles may differ only by punctuation/version wording. Short titles
    // deliberately do not fall back to one shared keyword: `The News` must not
    // become `News in the Past: Kathleen Madigan`.
    const stop = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'to', 'in']);
    const canonicalTokens = canonical.split(' ').filter((token) => token.length > 1 && !stop.has(token));
    if (canonicalTokens.length < 2) return false;
    const candidateTokens = new Set(candidate.split(' ').filter(Boolean));
    const hits = canonicalTokens.filter((token) => candidateTokens.has(token)).length;
    return hits / canonicalTokens.length >= 0.85;
  }

  function primaryArtist(value) {
    const raw = clean(value);
    if (!raw) return '';
    return normalize(raw.split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i)[0]);
  }

  function artistIdentityMatches(candidate, metadata) {
    const canonicalArtist = primaryArtist(metadata?.artist);
    if (!canonicalArtist) return true;

    const candidateArtist = normalize(candidate?.artist);
    if (candidateArtist.includes(canonicalArtist)) return true;

    const musicTracks = Array.isArray(candidate?.musicTracks) ? candidate.musicTracks : [];
    if (musicTracks.some((item) => normalize(item?.artist).includes(canonicalArtist))) return true;

    // Allow a label/uploader channel when the video title itself clearly carries
    // `Artist - Track` or `Track - Artist` attribution.
    const segments = clean(candidate?.title)
      .split(/\s[-–—|•]\s|\s*:\s*/)
      .map(normalize)
      .filter(Boolean);
    return segments.some((segment, index) =>
      (index === 0 || index === segments.length - 1) &&
      (segment === canonicalArtist || segment.startsWith(`${canonicalArtist} `) || segment.endsWith(` ${canonicalArtist}`))
    );
  }

  function validate(candidate, metadata) {
    const id = clean(candidate?.id);
    if (!VIDEO_ID_RE.test(id)) return { ok: false, reason: 'invalid YouTube id', durationDelta: null };
    if (candidate?.liveNow === true || candidate?.isUpcoming === true) {
      return { ok: false, reason: 'live/upcoming candidate', durationDelta: null };
    }

    const targetDuration = targetDurationSeconds(metadata);
    const candidateDuration = Number(candidate?.duration || 0);
    let durationDelta = null;
    if (targetDuration > 0) {
      if (!(candidateDuration > 0)) return { ok: false, reason: 'missing candidate duration', durationDelta: null };
      durationDelta = Math.abs(targetDuration - candidateDuration);
      if (durationDelta > MAX_DURATION_DELTA_SECONDS) {
        return {
          ok: false,
          reason: `duration delta ${Math.round(durationDelta)}s > ${MAX_DURATION_DELTA_SECONDS}s`,
          durationDelta,
        };
      }
    }

    if (!titleIdentityMatches(candidate?.title, metadata?.title)) {
      return { ok: false, reason: 'title identity mismatch', durationDelta };
    }
    if (!artistIdentityMatches(candidate, metadata)) {
      return { ok: false, reason: 'artist identity mismatch', durationDelta };
    }

    return { ok: true, reason: '', durationDelta };
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

  function migrateLegacyTrustedRows() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === VERSION) return 0;
      const parsed = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      if (!Array.isArray(parsed)) return 0;
      let changed = 0;
      for (const track of parsed) {
        if (!isKnownSongOrigin(track)) continue;
        if (clean(track?.youtubeMatchResolverVersion) !== LEGACY_TRUST_VERSION) continue;
        delete track.youtubeMatchResolverVersion;
        changed += 1;
      }
      if (changed) localStorage.setItem(LIBRARY_KEY, JSON.stringify(parsed));
      localStorage.setItem(MIGRATION_KEY, VERSION);
      return changed;
    } catch {
      return 0;
    }
  }

  function guardMatcher(original, api) {
    if (typeof original !== 'function' || original.__ampulaFinalTrust167) return original;
    const guarded = async function guardedFindYouTubeMatch(metadata, signal) {
      const candidate = await original.call(api || this, metadata, signal);
      const verdict = validate(candidate, metadata);
      if (!verdict.ok) throw new Error(`Final trust gate rejected: ${verdict.reason}`);
      return {
        ...candidate,
        finalTrustVersion: VERSION,
        finalTrustDurationDelta: verdict.durationDelta,
      };
    };
    Object.defineProperty(guarded, '__ampulaFinalTrust167', { value: true });
    Object.defineProperty(guarded, '__ampulaOriginalMatcher', { value: original });
    return guarded;
  }

  function wrapMatcherApi(api) {
    if (!api || typeof api !== 'object') return api;
    if (typeof api.findYouTubeMatch === 'function') {
      api.findYouTubeMatch = guardMatcher(api.findYouTubeMatch, api);
    }
    return api;
  }

  function installMatcherGuard() {
    let current = wrapMatcherApi(window.winampMusicAppleImport);
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'winampMusicAppleImport');
      if (!descriptor || descriptor.configurable) {
        Object.defineProperty(window, 'winampMusicAppleImport', {
          configurable: true,
          enumerable: true,
          get() { return current; },
          set(value) { current = wrapMatcherApi(value); },
        });
        return true;
      }
    } catch {}

    // Rare fallback for a non-configurable host property.
    const timer = setInterval(() => {
      const api = window.winampMusicAppleImport;
      if (api?.findYouTubeMatch && !api.findYouTubeMatch.__ampulaFinalTrust167) wrapMatcherApi(api);
    }, 50);
    setTimeout(() => clearInterval(timer), 15000);
    return false;
  }

  const migrated = migrateLegacyTrustedRows();
  installMatcherGuard();

  window.ampulaResolverTrust167 = {
    version: VERSION,
    maxDurationDeltaSeconds: MAX_DURATION_DELTA_SECONDS,
    validate,
    titleIdentityMatches,
    artistIdentityMatches,
    guardMatcher,
    migrateLegacyTrustedRows,
  };
  console.info(`[ÁmpulaMP] resolver final trust gate ${VERSION} ready · migrated ${migrated}`);
})();
