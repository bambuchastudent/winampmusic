(() => {
  'use strict';
  if (window.__AMPULA_RESOLVER_MUSIC_RECALL_174__) return;
  window.__AMPULA_RESOLVER_MUSIC_RECALL_174__ = true;

  const VERSION = '1.7.5';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const REQUEST_TIMEOUT_MS = 12000;
  const TRACK_SEARCH_BUDGET_MS = 120000;
  const MAX_PAGES_PER_PLAN = 4;
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
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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

  function candidatesFromPayload(payload, source) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => ({
      id: parseVideoId(item?.url || item?.videoId),
      title: clean(item?.title),
      artist: clean(item?.uploaderName || item?.author),
      duration: Math.max(0, Number(item?.duration || item?.lengthSeconds || 0)),
      thumbnail: clean(item?.thumbnail),
      liveNow: item?.liveNow === true,
      isUpcoming: item?.isUpcoming === true,
      source,
    })).filter((item) => VIDEO_ID_RE.test(item.id));
  }

  async function pipedSearchPage(base, query, filter, nextpage, signal) {
    const url = new URL(nextpage ? '/nextpage/search' : '/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', filter);
    if (nextpage) url.searchParams.set('nextpage', nextpage);
    const payload = await fetchJson(url, signal);
    return {
      candidates: candidatesFromPayload(payload, nextpage ? `piped-${filter}-nextpage` : `piped-${filter}`),
      nextpage: clean(payload?.nextpage),
    };
  }

  function effectiveMetadata(metadata) {
    try {
      if (typeof window.ampulaPlaybackMiss173?.metadataWithRejected === 'function') {
        return window.ampulaPlaybackMiss173.metadataWithRejected(metadata);
      }
    } catch {}
    return metadata || {};
  }

  function searchPlans(metadata) {
    const artist = clean(metadata?.artist);
    const title = clean(metadata?.title);
    const canonical = [artist, title].filter(Boolean).join(' ');
    const reverse = [title, artist].filter(Boolean).join(' ');
    const raw = [
      { query: canonical, filter: 'music_songs' },
      { query: reverse, filter: 'music_songs' },
      { query: canonical, filter: 'music_videos' },
      { query: canonical, filter: 'videos' },
      { query: `${canonical} official audio`, filter: 'videos' },
      { query: `${canonical} topic`, filter: 'videos' },
    ];
    const seen = new Set();
    return raw.filter((plan) => {
      plan.query = clean(plan.query);
      const key = `${plan.filter}\u0000${plan.query.toLowerCase()}`;
      if (!plan.query || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function trustedCandidate(candidates, metadata, excluded, trust) {
    const trusted = [];
    for (const candidate of candidates) {
      if (excluded.has(candidate.id)) continue;
      const verdict = trust.validate(candidate, metadata);
      if (!verdict.ok) continue;
      const title = clean(candidate.title).toLowerCase();
      const artist = clean(metadata?.artist).toLowerCase();
      const topicBonus = /\s-\s*topic\b/i.test(candidate.artist) ? 20 : 0;
      const exactDurationBonus = verdict.durationDelta === null ? 0 : Math.max(0, 20 - verdict.durationDelta);
      const artistTitleBonus = artist && title.includes(artist) ? 12 : 0;
      trusted.push({
        ...candidate,
        score: 60 + topicBonus + exactDurationBonus + artistTitleBonus,
        finalTrustVersion: trust.version,
        finalTrustDurationDelta: verdict.durationDelta,
      });
    }
    trusted.sort((a, b) => b.score - a.score);
    return trusted[0] || null;
  }

  async function searchBase(base, plans, metadata, excluded, trust, signal) {
    for (const plan of plans) {
      let nextpage = '';
      const seenPages = new Set();
      for (let page = 0; page < MAX_PAGES_PER_PLAN; page += 1) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        let result;
        try {
          result = await pipedSearchPage(base, plan.query, plan.filter, nextpage, signal);
        } catch (error) {
          if (signal?.aborted) throw error;
          break;
        }
        const match = trustedCandidate(result.candidates, metadata, excluded, trust);
        if (match) return match;
        const token = clean(result.nextpage);
        if (!token || seenPages.has(token)) break;
        seenPages.add(token);
        nextpage = token;
      }
    }
    return null;
  }

  async function resolveMusicSongFallback(metadata, signal) {
    const trust = window.ampulaResolverTrust167;
    if (!trust || typeof trust.validate !== 'function') return null;
    const plans = searchPlans(metadata);
    if (!plans.length) return null;
    const excluded = new Set(
      (Array.isArray(metadata?.excludeYoutubeIds) ? metadata.excludeYoutubeIds : [])
        .map(clean)
        .filter((id) => VIDEO_ID_RE.test(id))
    );

    const controller = new AbortController();
    let budgetExpired = false;
    const relayAbort = () => controller.abort();
    signal?.addEventListener('abort', relayAbort, { once: true });
    const budgetTimer = setTimeout(() => {
      budgetExpired = true;
      controller.abort();
    }, TRACK_SEARCH_BUDGET_MS);

    try {
      const workers = PIPED_APIS.map(async (base) => {
        const match = await searchBase(base, plans, metadata, excluded, trust, controller.signal);
        if (!match) throw new Error(`No trusted match from ${base}`);
        return match;
      });
      const match = await Promise.any(workers);
      controller.abort();
      return match || null;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (budgetExpired) return null;
      return null;
    } finally {
      clearTimeout(budgetTimer);
      signal?.removeEventListener('abort', relayAbort);
      controller.abort();
    }
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
        return await original.call(api, effective, signal);
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
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    trackSearchBudgetMs: TRACK_SEARCH_BUDGET_MS,
    maxPagesPerPlan: MAX_PAGES_PER_PLAN,
    resolveMusicSongFallback,
    install,
  };
  console.info(`[ÁmpulaMP] resolver music recall ${VERSION} ready · ${TRACK_SEARCH_BUDGET_MS / 1000}s track budget · paginated search`);
})();