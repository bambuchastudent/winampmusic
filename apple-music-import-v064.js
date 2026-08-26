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

  function scoreCandidate(candidate, metadata) {
    const haystackTitle = normalize(candidate.title);
    const haystackAll = `${haystackTitle} ${normalize(candidate.artist)}`.trim();
    const titleTokens = tokens(metadata.title);
    const artistTokens = tokens(metadata.artist);
    let score = 0;

    for (const token of titleTokens) score += haystackTitle.includes(token) ? 9 : -7;
    for (const token of artistTokens) score += haystackAll.includes(token) ? 5 : -2;

    const targetSeconds = metadata.durationMs > 0 ? metadata.durationMs / 1000 : 0;
    const candidateSeconds = Number(candidate.duration || 0);
    if (targetSeconds && candidateSeconds) {
      const diff = Math.abs(targetSeconds - candidateSeconds);
      if (diff <= 3) score += 12;
      else if (diff <= 8) score += 7;
      else if (diff <= 20) score += 2;
      else if (diff > 60) score -= 8;
    }

    if (/\b(topic|official audio|soundtrack|ost)\b/i.test(`${candidate.title} ${candidate.artist}`)) score += 2;
    const source = normalize(`${metadata.title} ${metadata.artist}`);
    for (const noisy of ['cover', 'remix', 'nightcore', 'sped up', 'slowed', 'live']) {
      if (!source.includes(noisy) && haystackAll.includes(noisy)) score -= 7;
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
    const payload = await fetchJson(url, signal);
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
    const payload = await fetchJson(url, signal);
    return (Array.isArray(payload) ? payload : [])
      .filter((item) => item?.type === 'video')
      .map((item) => ({
        id: clean(item.videoId),
        title: clean(item.title),
        artist: clean(item.author),
        duration: Number(item.lengthSeconds || 0),
        thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(clean(item.videoId))}/hqdefault.jpg`,
      }))
      .filter((item) => ID_PATTERN.test(item.id));
  }

  async function findYouTubeMatch(metadata, signal) {
    const query = [metadata.artist, metadata.title].filter(Boolean).join(' ');
    if (!query) throw new Error('Apple metadata is incomplete');

    const piped = await Promise.allSettled(PIPED_APIS.map((base) => pipedCandidates(base, query, signal)));
    let candidates = piped.flatMap((result) => result.status === 'fulfilled' ? result.value : []);

    if (!candidates.length && !signal.aborted) {
      const invidious = await Promise.allSettled(INVIDIOUS_APIS.map((base) => invidiousCandidates(base, query, signal)));
      candidates = invidious.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    }

    const unique = new Map();
    for (const candidate of candidates) if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
    const ranked = [...unique.values()]
      .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, metadata) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < 8) throw new Error('No reliable YouTube match found');
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
      console.warn('[Winamp Music Apple Music v0.6.4]', error);
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
