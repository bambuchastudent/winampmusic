(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_STRICT_150__) return;
  window.__AMP_MUSIC_APPLE_STRICT_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const PIPED_APIS = [
    'https://pipedapi.adminforge.de',
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
    'https://api.piped.yt',
  ];
  const INVIDIOUS_APIS = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
  ];
  const NOISY_TERMS = [
    'ad', 'advert', 'advertisement', 'commercial', 'promo', 'sponsored', 'trailer', 'teaser',
    'review', 'reaction', 'interview', 'podcast', 'karaoke', 'cover', 'remix', 'nightcore',
    'sped up', 'slowed', 'live', 'реклама', 'промо', 'тизер', 'трейлер', 'обзор', 'реакция',
    'кавер', 'ремикс', 'лайв',
  ];
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function normalize(value) {
    return clean(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function tokens(value) {
    return normalize(value).split(' ').filter((token) => token.length > 1);
  }

  function ratioPresent(sourceTokens, haystack) {
    if (!sourceTokens.length) return 1;
    let matched = 0;
    for (const token of sourceTokens) if (haystack.includes(token)) matched += 1;
    return matched / sourceTokens.length;
  }

  function parseVideoId(value) {
    const text = clean(value);
    if (VIDEO_ID_RE.test(text)) return text;
    try {
      const url = new URL(text, 'https://www.youtube.com');
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return VIDEO_ID_RE.test(id) ? id : '';
      }
      const id = clean(url.searchParams.get('v'));
      return VIDEO_ID_RE.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  function candidateNoise(candidate, metadata) {
    const source = normalize(`${metadata?.title || ''} ${metadata?.artist || ''}`);
    const haystack = normalize(`${candidate?.title || ''} ${candidate?.artist || ''}`);
    for (const term of NOISY_TERMS) {
      const normalizedTerm = normalize(term);
      if (!normalizedTerm) continue;
      if (!source.includes(normalizedTerm) && haystack.includes(normalizedTerm)) return term;
    }
    return '';
  }

  function scoreStrictCandidate(candidate, metadata) {
    const titleTokens = tokens(metadata?.title);
    const artistTokens = tokens(metadata?.artist);
    if (!titleTokens.length || !clean(candidate?.title)) return Number.NEGATIVE_INFINITY;

    const candidateTitle = normalize(candidate.title);
    const candidateAll = normalize(`${candidate.title} ${candidate.artist || ''}`);
    const titleCoverage = ratioPresent(titleTokens, candidateTitle);
    const artistCoverage = ratioPresent(artistTokens, candidateAll);
    const requiredTitleCoverage = titleTokens.length <= 2 ? 1 : 0.8;

    if (titleCoverage < requiredTitleCoverage) return Number.NEGATIVE_INFINITY;
    if (artistTokens.length && artistCoverage < 0.5) return Number.NEGATIVE_INFINITY;
    if (candidateNoise(candidate, metadata)) return Number.NEGATIVE_INFINITY;

    const targetSeconds = Number(metadata?.durationMs || 0) / 1000;
    const candidateSeconds = Number(candidate?.duration || 0);
    let durationScore = 0;
    if (targetSeconds > 0 && candidateSeconds > 0) {
      const diff = Math.abs(targetSeconds - candidateSeconds);
      const maxDiff = Math.max(18, targetSeconds * 0.08);
      if (diff > maxDiff) return Number.NEGATIVE_INFINITY;
      if (diff <= 3) durationScore = 20;
      else if (diff <= 8) durationScore = 15;
      else durationScore = Math.max(4, 14 - diff * 0.4);
    }

    let score = titleCoverage * 60 + artistCoverage * 25 + durationScore;
    const sourceTitle = normalize(metadata.title);
    if (candidateTitle === sourceTitle) score += 12;
    if (candidateTitle.includes(sourceTitle) && sourceTitle.length >= 4) score += 7;
    if (/\b(topic|official audio|provided to youtube)\b/i.test(`${candidate.title} ${candidate.artist || ''}`)) score += 10;
    if (candidate.verified) score += 5;
    return score;
  }

  async function fetchJson(url, signal, timeoutMs = 5000) {
    const controller = new AbortController();
    const relay = () => controller.abort();
    signal?.addEventListener('abort', relay, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      signal?.removeEventListener('abort', relay);
    }
  }

  async function pipedCandidates(base, query, signal) {
    const url = new URL('/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', 'videos');
    const payload = await fetchJson(url, signal);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => ({
      id: parseVideoId(item?.url),
      title: clean(item?.title),
      artist: clean(item?.uploaderName),
      duration: Number(item?.duration || 0),
      thumbnail: clean(item?.thumbnail),
      verified: Boolean(item?.uploaderVerified),
      source: 'piped',
    })).filter((item) => VIDEO_ID_RE.test(item.id));
  }

  async function invidiousCandidates(base, query, signal) {
    const url = new URL('/api/v1/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('sort', 'relevance');
    const payload = await fetchJson(url, signal);
    return (Array.isArray(payload) ? payload : []).map((item) => ({
      id: clean(item?.videoId),
      title: clean(item?.title),
      artist: clean(item?.author),
      duration: Number(item?.lengthSeconds || 0),
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(clean(item?.videoId))}/hqdefault.jpg`,
      verified: Boolean(item?.authorVerified),
      source: 'invidious',
    })).filter((item) => VIDEO_ID_RE.test(item.id));
  }

  function bestStrict(candidates, metadata) {
    const unique = new Map();
    for (const candidate of candidates) {
      if (!candidate || !VIDEO_ID_RE.test(candidate.id) || unique.has(candidate.id)) continue;
      unique.set(candidate.id, candidate);
    }
    const ranked = [...unique.values()]
      .map((candidate) => ({ ...candidate, strictScore: scoreStrictCandidate(candidate, metadata) }))
      .filter((candidate) => Number.isFinite(candidate.strictScore))
      .sort((a, b) => b.strictScore - a.strictScore);
    const best = ranked[0];
    return best && best.strictScore >= 70 ? best : null;
  }

  async function searchPool(metadata, signal, query) {
    const piped = await Promise.allSettled(PIPED_APIS.map((base) => pipedCandidates(base, query, signal)));
    let candidates = piped.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    let best = bestStrict(candidates, metadata);
    if (best || signal?.aborted) return best;

    const invidious = await Promise.allSettled(INVIDIOUS_APIS.map((base) => invidiousCandidates(base, query, signal)));
    candidates = candidates.concat(invidious.flatMap((result) => result.status === 'fulfilled' ? result.value : []));
    return bestStrict(candidates, metadata);
  }

  async function findYouTubeMatch(metadata, signal = new AbortController().signal) {
    const artist = clean(metadata?.artist);
    const title = clean(metadata?.title);
    if (!title || !artist) throw new Error('Apple metadata is incomplete');

    let best = await searchPool(metadata, signal, `${artist} ${title}`);
    if (!best && !signal.aborted) best = await searchPool(metadata, signal, `${artist} ${title} official audio`);
    if (!best) throw new Error('No strict YouTube match found');
    return best;
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function setUiState(text, detail = '') {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
    const searchStatus = document.getElementById('songSearchStatus');
    if (searchStatus) searchStatus.textContent = detail || text.replace(/_/g, ' ');
  }

  function clearAppleInputs(parsed, explicitInput) {
    if (explicitInput) explicitInput.value = '';
    for (const id of ['youtubeImportInput', 'songSearchInput']) {
      const input = document.getElementById(id);
      try {
        if (input && window.winampMusicAppleImport?.parseUrl?.(input.value)?.trackId === parsed.trackId) input.value = '';
      } catch {}
    }
  }

  async function strictHandleUrl(value, options = {}) {
    const api = window.winampMusicAppleImport;
    const parsed = api?.parseUrl?.(value);
    if (!parsed) return false;

    const controller = new AbortController();
    const signal = controller.signal;
    setUiState('READING APPLE MUSIC', 'Reading track…');
    try {
      const metadata = await api.lookup(parsed, signal);
      setUiState('MATCHING APPLE MUSIC', `${metadata.artist} · ${metadata.title}`);
      const match = await findYouTubeMatch(metadata, signal);
      const track = {
        id: match.id,
        title: metadata.title || match.title,
        artist: metadata.artist || match.artist,
        thumbnail: metadata.artwork || match.thumbnail || `https://i.ytimg.com/vi/${match.id}/hqdefault.jpg`,
        duration: metadata.durationMs > 0 ? Math.round(metadata.durationMs / 1000) : Number(match.duration || 0),
        playlist: 'Apple Music import',
        badges: ['Apple Music', 'Strict match'],
        sourceUrl: parsed.href,
        appleTrackId: parsed.trackId,
        importedAt: new Date().toISOString(),
        strictMatchedAt: new Date().toISOString(),
      };

      window.importTracks?.([track]);
      const library = readLibrary();
      const index = library.findIndex((item) => item?.id === match.id);
      if (index >= 0) {
        library[index] = { ...library[index], ...track, id: match.id };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      }
      window.renderLibrary?.();
      clearAppleInputs(parsed, options.input);
      setUiState('APPLE MUSIC MATCHED', `${metadata.artist} · ${metadata.title}`);

      if (options.play !== false && index >= 0) {
        if (typeof window.ampMusicPlayDirectIndex === 'function') void window.ampMusicPlayDirectIndex(index);
        else window.playIndex?.(index);
      }
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return true;
      console.warn('[AmpMusic strict Apple match]', error);
      setUiState('APPLE TRACK NOT MATCHED', 'No safe exact source found');
      return true;
    }
  }

  function patchApi(api) {
    if (!api || api.__ampStrict150) return api;
    api.findYouTubeMatch = findYouTubeMatch;
    api.handleUrl = strictHandleUrl;
    api.__ampStrict150 = true;
    return api;
  }

  let storedApi = patchApi(window.winampMusicAppleImport);
  try {
    Object.defineProperty(window, 'winampMusicAppleImport', {
      configurable: true,
      enumerable: true,
      get: () => storedApi,
      set: (value) => { storedApi = patchApi(value); },
    });
  } catch {
    if (storedApi) window.winampMusicAppleImport = storedApi;
  }

  window.ampMusicStrictMatcher150 = {
    normalize,
    scoreStrictCandidate,
    findYouTubeMatch,
    patchApi,
  };
  console.info('[AmpMusic] strict Apple matcher 1.5 ready');
})();
