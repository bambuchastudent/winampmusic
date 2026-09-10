(() => {
  'use strict';
  if (window.__AMPULA_RESOLVER_TRUST_167__) return;
  window.__AMPULA_RESOLVER_TRUST_167__ = true;

  const VERSION = 'music-only-v1.6.7';
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

    // For longer titles tolerate punctuation/version wording changes, but require
    // nearly all meaningful words. Short one-word titles intentionally do not
    // fall back to token overlap (e.g. `The News` vs `News in the Past`).
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

    // Accept explicit `Artist - Title` or `Title - Artist` attribution even when
    // the YouTube channel itself is a label/uploader rather than the artist.
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

  window.ampulaResolverTrust167 = {
    version: VERSION,
    maxDurationDeltaSeconds: MAX_DURATION_DELTA_SECONDS,
    validate,
    titleIdentityMatches,
    artistIdentityMatches,
  };
  console.info(`[ÁmpulaMP] resolver final trust gate ${VERSION} ready`);
})();
