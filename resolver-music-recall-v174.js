(() => {
  'use strict';
  if (window.__AMPULA_RESOLVER_MUSIC_RECALL_174__) return;
  window.__AMPULA_RESOLVER_MUSIC_RECALL_174__ = true;

  const VERSION = '1.7.4';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const SEARCH_TIMEOUT_MS = 2200;
  const PIPED_APIS = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.adminforge.de',
    'https://api.piped.private.coffee',
    'https://api.piped.yt',
  ];
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function parseVideoId(value) {
    const text = clean(value);
    if (VIDEO_ID_RE.test(text)) return text;
    try {
      const url = new URL(text, 'https://www.youtube.com');
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return VIDEO_ID_RE.test(id) ? id : '';
      }
      const id = url.searchParams.get('v') || '';
      return VIDEO_ID_RE.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  async function fetchJson(url, signal) {
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    signal?.addEventListener('abort', relayAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', relayAbort);
    }
  }

  async function musicSongCandidates(base, query, signal) {
    const url = new URL('/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', 'music_songs');
    const payload = await fetchJson(url, signal);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => ({
      id: parseVideoId(item?.url),
      title: clean(item?.title),
      artist: clean(item?.uploaderName),
      duration: Math.max(0, Number(item?.duration || 0)),
      thumbnail: clean(item?.thumbnail),
      source: 'piped-music-songs',
    })).filter((item) => VIDEO_ID_RE.test(item.id));
  }

  function effectiveMetadata(metadata) {
    try {
      if (typeof window.ampulaPlaybackMiss173?.metadataWithRejected === 'function') {
        return window.ampulaPlaybackMiss173.metadataWithRejected(metadata);
      }
    } catch {}
    return metadata || {};
  }

  async function resolveMusicSongFallback(metadata, signal) {
    const trust = window.ampulaResolverTrust167;
    if (!trust || typeof trust.validate !== 'function') return null;
    const query = [metadata?.artist, metadata?.title].map(clean).filter(Boolean).join(' ');
    if (!query) return null;
    const excluded = new Set(
      (Array.isArray(metadata?.excludeYoutubeIds) ? metadata.excludeYoutubeIds : [])
        .map(clean)
        .filter((id) => VIDEO_ID_RE.test(id))
    );

    const settled = await Promise.allSettled(
      PIPED_APIS.map((base) => musicSongCandidates(base, query, signal))
    );
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const unique = new Map();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const candidate of result.value) {
        if (excluded.has(candidate.id) || unique.has(candidate.id)) continue;
        unique.set(candidate.id, candidate);
      }
    }

    const trusted = [];
    for (const candidate of unique.values()) {
      const verdict = trust.validate(candidate, metadata);
      if (!verdict.ok) continue;
      const topicBonus = /\s-\s*topic\b/i.test(candidate.artist) ? 20 : 0;
      const exactDurationBonus = verdict.durationDelta === null ? 0 : Math.max(0, 15 - verdict.durationDelta);
      trusted.push({
        ...candidate,
        score: 60 + topicBonus + exactDurationBonus,
        finalTrustVersion: trust.version,
        finalTrustDurationDelta: verdict.durationDelta,
      });
    }

    trusted.sort((a, b) => b.score - a.score);
    return trusted[0] || null;
  }

  function install() {
    const api = window.winampMusicAppleImport;
    const original = api?.findYouTubeMatch;
    if (!api || typeof original !== 'function' || original.__ampulaMusicRecall174) return false;

    const wrapped = async function findYouTubeMatchWithMusicRecall(metadata, signal) {
      const effective = effectiveMetadata(metadata);
      const fallbackPromise = resolveMusicSongFallback(effective, signal).catch((error) => {
        if (error?.name === 'AbortError') throw error;
        return null;
      });
      try {
        return await original.call(api, metadata, signal);
      } catch (primaryError) {
        if (primaryError?.name === 'AbortError') throw primaryError;
        const fallback = await fallbackPromise;
        if (fallback) return fallback;
        throw primaryError;
      }
    };
    Object.defineProperty(wrapped, '__ampulaMusicRecall174', { value: true });
    Object.defineProperty(wrapped, '__ampulaFinalTrust167', { value: true });
    Object.defineProperty(wrapped, '__ampulaOriginalMatcher', { value: original });
    api.findYouTubeMatch = wrapped;
    return true;
  }

  install();
  window.ampulaResolverMusicRecall174 = {
    version: VERSION,
    resolveMusicSongFallback,
    install,
  };
  console.info(`[ÁmpulaMP] resolver music recall ${VERSION} ready`);
})();
