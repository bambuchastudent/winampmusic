(() => {
  if (window.__WINAMP_MUSIC_APPLE_IMPORT_V064__) return;
  window.__WINAMP_MUSIC_APPLE_IMPORT_V064__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const ID_PATTERN = /^[\w-]{6,20}$/;
  const PIPED_APIS = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.adminforge.de',
    'https://api.piped.private.coffee',
    'https://api.piped.yt',
  ];
  const INVIDIOUS_APIS = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
  ];
  const SEARCH_TIMEOUT_MS = 2200;
  const DETAIL_TIMEOUT_MS = 2200;
  const ENRICH_LIMIT = 10;
  const MAX_DURATION_DELTA_SECONDS = 15;
  const MIN_MUSIC_EVIDENCE = 4;
  const MIN_MATCH_SCORE = 20;
  const status = document.getElementById('status');
  let activeController = null;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseAppleMusicUrl(value) {
    const text = clean(value);
    if (!/^https?:\/\//i.test(text)) return null;
    try {
      const url = new URL(text);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (!parts.includes('album') && !parts.includes('song')) return null;
      const storefront = /^[a-z]{2}$/i.test(parts[0] || '') ? parts[0].toUpperCase() : 'US';
      const queryTrackId = clean(url.searchParams.get('i'));
      const pathId = clean(parts.at(-1));
      const trackId = /^\d+$/.test(queryTrackId) ? queryTrackId : (/^\d+$/.test(pathId) ? pathId : '');
      if (!trackId) return null;
      return { href: url.href, trackId, storefront };
    } catch {
      return null;
    }
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readLibrary() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function setUiState(text, detail = '') {
    if (status) status.textContent = text;
    const searchStatus = document.getElementById('songSearchStatus');
    if (searchStatus) searchStatus.textContent = detail || text.replace(/_/g, ' ');
    const results = document.getElementById('songSearchResults');
    if (results && /READING|MATCHING|IMPORTING/.test(text)) {
      results.replaceChildren();
      results.hidden = true;
    }
  }

  function appleLookupJsonp(parsed, signal) {
    return new Promise((resolve, reject) => {
      const callback = `__winampAppleLookup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('Apple metadata timeout')), 8000);

      function cleanup() {
        clearTimeout(timeout);
        script.remove();
        try { delete window[callback]; } catch { window[callback] = undefined; }
        signal?.removeEventListener('abort', onAbort);
      }

      function finish(error, value) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(value);
      }

      function onAbort() {
        finish(new DOMException('Aborted', 'AbortError'));
      }

      window[callback] = (payload) => {
        const results = Array.isArray(payload?.results) ? payload.results : [];
        const exact = results.find((item) => String(item?.trackId || '') === parsed.trackId && item?.kind === 'song');
        const item = exact || results.find((entry) => entry?.kind === 'song');
        if (!item) {
          finish(new Error('Apple track metadata not found'));
          return;
        }
        finish(null, {
          trackId: String(item.trackId || parsed.trackId),
          title: clean(item.trackName || item.trackCensoredName),
          artist: clean(item.artistName),
          album: clean(item.collectionName || item.collectionCensoredName),
          durationMs: Number(item.trackTimeMillis || 0),
          artwork: clean(item.artworkUrl100 || '').replace(/100x100bb/i, '600x600bb'),
          appleUrl: clean(item.trackViewUrl) || parsed.href,
        });
      };

      script.onerror = () => finish(new Error('Apple metadata request failed'));
      const url = new URL('https://itunes.apple.com/lookup');
      url.searchParams.set('id', parsed.trackId);
      url.searchParams.set('entity', 'song');
      url.searchParams.set('country', parsed.storefront);
      url.searchParams.set('callback', callback);
      script.src = url.toString();
      script.async = true;
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      document.head.appendChild(script);
    });
  }

  function normalize(value) {
    return clean(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function tokens(value) {
    return normalize(value).split(' ').filter((token) => token.length > 1);
  }

  function parseVideoId(value) {
    const text = clean(value);
    if (ID_PATTERN.test(text)) return text;
    try {
      const url = new URL(text, 'https://www.youtube.com');
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return ID_PATTERN.test(id) ? id : '';
      }
      const id = url.searchParams.get('v') || '';
      return ID_PATTERN.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  function targetDurationSeconds(metadata) {
    return Number(metadata?.durationMs || 0) > 0 ? Number(metadata.durationMs) / 1000 : 0;
  }

  function durationDelta(candidate, metadata) {
    const targetSeconds = targetDurationSeconds(metadata);
    const candidateSeconds = Number(candidate?.duration || 0);
    if (!targetSeconds || !candidateSeconds) return null;
    return Math.abs(targetSeconds - candidateSeconds);
  }

  function musicEvidenceScore(candidate) {
    const title = clean(candidate?.title);
    const artist = clean(candidate?.artist);
    const description = clean(candidate?.description);
    const genre = normalize(candidate?.genre);
    const keywords = Array.isArray(candidate?.keywords) ? candidate.keywords.map(clean) : [];
    const musicTracks = Array.isArray(candidate?.musicTracks) ? candidate.musicTracks : [];
    const categoryId = Number(candidate?.categoryId || 0);
    let score = 0;

    if (genre === 'music') score += 5;
    if (categoryId === 10) score += 5;
    if (musicTracks.length > 0) score += 6;
    if (/\s-\s*topic\b/i.test(artist)) score += 5;
    if (/\bofficial\s+audio\b/i.test(`${title} ${description}`)) score += 4;
    if (/vevo\b/i.test(`${artist} ${title}`)) score += 4;
    if (/provided\s+to\s+youtube\s+by/i.test(description)) score += 5;
    if (keywords.some((keyword) => normalize(keyword) === 'music')) score += 1;
    if (candidate?.licensedContent === true) score += 1;
    return score;
  }

  function isTrustedMusicCandidate(candidate, metadata) {
    if (!candidate || candidate.liveNow === true || candidate.isUpcoming === true) return false;

    const genre = normalize(candidate.genre);
    if (genre && genre !== 'music') return false;

    const categoryId = Number(candidate.categoryId || 0);
    if (categoryId && categoryId !== 10) return false;

    const targetSeconds = targetDurationSeconds(metadata);
    const candidateSeconds = Number(candidate.duration || 0);
    if (targetSeconds) {
      if (!candidateSeconds) return false;
      const diff = Math.abs(targetSeconds - candidateSeconds);
      if (diff > MAX_DURATION_DELTA_SECONDS) return false;
    }

    return musicEvidenceScore(candidate) >= MIN_MUSIC_EVIDENCE;
  }

  function scoreCandidate(candidate, metadata) {
    const haystackTitle = normalize(candidate.title);
    const haystackAll = `${haystackTitle} ${normalize(candidate.artist)}`.trim();
    const titleTokens = tokens(metadata.title);
    const artistTokens = tokens(metadata.artist);
    let score = 0;

    for (const token of titleTokens) score += haystackTitle.includes(token) ? 9 : -7;
    for (const token of artistTokens) score += haystackAll.includes(token) ? 5 : -2;

    const diff = durationDelta(candidate, metadata);
    if (diff !== null) {
      if (diff <= 3) score += 20;
      else if (diff <= 10) score += 10;
      else if (diff <= MAX_DURATION_DELTA_SECONDS) score += 3;
      else score -= 100;
    }

    score += Math.min(10, musicEvidenceScore(candidate));

    const source = normalize(`${metadata.title} ${metadata.artist}`);
    for (const noisy of ['cover', 'remix', 'nightcore', 'sped up', 'slowed', 'live']) {
      if (!source.includes(noisy) && haystackAll.includes(noisy)) score -= 10;
    }
    return score;
  }

  async function fetchJson(url, signal, timeoutMs = 4500) {
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    signal?.addEventListener('abort', relayAbort, { once: true });
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
      signal?.removeEventListener('abort', relayAbort);
    }
  }

  async function pipedCandidates(base, query, signal) {
    const url = new URL('/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', 'videos');
    const payload = await fetchJson(url, signal, SEARCH_TIMEOUT_MS);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items
      .filter((item) => item?.type === 'stream' || item?.url)
      .map((item) => ({
        id: parseVideoId(item.url),
        title: clean(item.title),
        artist: clean(item.uploaderName),
        duration: Number(item.duration || 0),
        thumbnail: clean(item.thumbnail),
      }))
      .filter((item) => ID_PATTERN.test(item.id));
  }

  async function invidiousCandidates(base, query, signal) {
    const url = new URL('/api/v1/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('sort', 'relevance');
    const payload = await fetchJson(url, signal, SEARCH_TIMEOUT_MS);
    return (Array.isArray(payload) ? payload : [])
      .filter((item) => item?.type === 'video')
      .map((item) => ({
        id: clean(item.videoId),
        title: clean(item.title),
        artist: clean(item.author),
        duration: Number(item.lengthSeconds || 0),
        description: clean(item.description),
        liveNow: item.liveNow === true,
        thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(clean(item.videoId))}/hqdefault.jpg`,
      }))
      .filter((item) => ID_PATTERN.test(item.id));
  }

  async function enrichCandidate(base, candidate, signal) {
    if (!base) return candidate;
    const url = new URL(`/api/v1/videos/${encodeURIComponent(candidate.id)}`, base);
    try {
      const payload = await fetchJson(url, signal, DETAIL_TIMEOUT_MS);
      return {
        ...candidate,
        title: clean(payload?.title) || candidate.title,
        artist: clean(payload?.author) || candidate.artist,
        duration: Number(payload?.lengthSeconds || candidate.duration || 0),
        description: clean(payload?.description) || clean(candidate.description),
        keywords: Array.isArray(payload?.keywords) ? payload.keywords.map(clean).filter(Boolean) : [],
        genre: clean(payload?.genre),
        musicTracks: Array.isArray(payload?.musicTracks) ? payload.musicTracks : [],
        liveNow: payload?.liveNow === true || candidate.liveNow === true,
        isUpcoming: payload?.isUpcoming === true,
        categoryId: payload?.categoryId,
        licensedContent: payload?.licensedContent === true,
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      return candidate;
    }
  }

  async function findYouTubeMatch(metadata, signal) {
    const query = [metadata.artist, metadata.title].filter(Boolean).join(' ');
    if (!query) throw new Error('Apple metadata is incomplete');
    const excludedIds = new Set(
      (Array.isArray(metadata?.excludeYoutubeIds) ? metadata.excludeYoutubeIds : [])
        .map(clean)
        .filter((id) => ID_PATTERN.test(id))
    );

    const [piped, invidious] = await Promise.all([
      Promise.allSettled(PIPED_APIS.map((base) => pipedCandidates(base, query, signal))),
      Promise.allSettled(INVIDIOUS_APIS.map(async (base) => ({
        base,
        candidates: await invidiousCandidates(base, query, signal),
      }))),
    ]);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const candidates = [
      ...piped.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
      ...invidious.flatMap((result) => result.status === 'fulfilled' ? result.value.candidates : []),
    ];
    const detailBase = invidious.find((result) => result.status === 'fulfilled')?.value?.base || '';

    const unique = new Map();
    for (const candidate of candidates) {
      const current = unique.get(candidate.id);
      unique.set(candidate.id, current ? {
        ...current,
        ...candidate,
        thumbnail: current.thumbnail || candidate.thumbnail,
      } : candidate);
    }

    const shortlist = [...unique.values()]
      .filter((candidate) => !excludedIds.has(candidate.id))
      .map((candidate) => ({ ...candidate, preliminaryScore: scoreCandidate(candidate, metadata) }))
      .sort((a, b) => b.preliminaryScore - a.preliminaryScore)
      .slice(0, ENRICH_LIMIT);

    const enriched = detailBase
      ? await Promise.all(shortlist.map((candidate) => enrichCandidate(detailBase, candidate, signal)))
      : shortlist;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const ranked = enriched
      .filter((candidate) => isTrustedMusicCandidate(candidate, metadata))
      .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, metadata) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < MIN_MATCH_SCORE) throw new Error('No reliable YouTube match found');
    return best;
  }

  function persistAndPlay(match, metadata, parsed, shouldPlay = true) {
    const track = {
      id: match.id,
      title: metadata.title || match.title || '',
      artist: metadata.artist || match.artist || '',
      thumbnail: metadata.artwork || match.thumbnail || `https://i.ytimg.com/vi/${match.id}/hqdefault.jpg`,
      duration: metadata.durationMs > 0 ? Math.round(metadata.durationMs / 1000) : Number(match.duration || 0),
      playlist: 'Apple Music import',
      badges: ['Apple Music', 'YouTube match'],
      sourceUrl: parsed.href,
      appleTrackId: parsed.trackId,
      importedAt: new Date().toISOString(),
    };

    window.importTracks?.([track]);
    const library = readLibrary();
    const index = library.findIndex((item) => item?.id === match.id);
    if (index >= 0) {
      library[index] = { ...library[index], ...track, id: match.id };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    }

    const state = readJson(PLAYER_STATE_KEY, {});
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...state, currentId: match.id }));
    window.renderLibrary?.();

    const finalIndex = readLibrary().findIndex((item) => item?.id === match.id);
    if (shouldPlay && finalIndex >= 0) setTimeout(() => window.playIndex?.(finalIndex), 0);
    return finalIndex >= 0;
  }

  function clearAppleInputs(parsed, explicitInput) {
    if (explicitInput) explicitInput.value = '';
    for (const id of ['youtubeImportInput', 'songSearchInput']) {
      const input = document.getElementById(id);
      if (input && parseAppleMusicUrl(input.value)?.trackId === parsed.trackId) input.value = '';
    }
  }

  async function importAppleMusicUrl(value, options = {}) {
    const parsed = parseAppleMusicUrl(value);
    if (!parsed) return false;

    activeController?.abort();
    activeController = new AbortController();
    const signal = activeController.signal;
    setUiState('READING APPLE MUSIC', 'Reading track…');

    try {
      const metadata = await appleLookupJsonp(parsed, signal);
      if (signal.aborted) return true;
      setUiState('MATCHING APPLE MUSIC', `${metadata.artist} · ${metadata.title}`);
      const match = await findYouTubeMatch(metadata, signal);
      if (signal.aborted) return true;
      setUiState('IMPORTING APPLE MUSIC', 'Adding track…');
      const saved = persistAndPlay(match, metadata, parsed, options.play !== false);
      if (!saved) throw new Error('Could not save matched track');
      clearAppleInputs(parsed, options.input);
      setUiState('APPLE MUSIC IMPORTED', `${metadata.artist} · ${metadata.title}`);
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return true;
      console.warn('[ÁmpulaMP Apple Music v0.6.4]', error);
      setUiState('APPLE MUSIC IMPORT FAILED', 'Could not add this track yet');
      return true;
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'songSearchForm') return;
    const input = form.querySelector('#songSearchInput');
    if (!parseAppleMusicUrl(input?.value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    importAppleMusicUrl(input.value, { input, play: true });
  }, true);

  window.winampMusicAppleImport = {
    parseUrl: parseAppleMusicUrl,
    lookup: appleLookupJsonp,
    findYouTubeMatch,
    handleUrl: importAppleMusicUrl,
  };
})();