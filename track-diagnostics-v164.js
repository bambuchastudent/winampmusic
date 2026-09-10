(() => {
  'use strict';
  if (window.__AMPULA_TRACK_DIAGNOSTICS_164__) return;
  window.__AMPULA_TRACK_DIAGNOSTICS_164__ = true;

  const VERSION = '1.6.4';
  const TRUST_VERSION = 'music-only-v1.6.4';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const TRACE_KEY = 'ampula.resolverDiagnostics.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const MAX_DURATION_DELTA_SECONDS = 15;
  const MIN_MUSIC_EVIDENCE = 4;
  const MIN_MATCH_SCORE = 20;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const inflight = new Map();
  let matcherPromise = null;
  let decorateQueued = false;
  let openMenu = null;
  let youtubeWire = {};
  let networkTrace = [];

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function readLibrary() {
    const value = readJson(LIBRARY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function normalize(value) {
    return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function tokens(value) {
    return normalize(value).split(' ').filter((token) => token.length > 1);
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

  function needsTrustedResolution(track) {
    if (!track || !isKnownSongOrigin(track) || !clean(track.title)) return false;
    const id = clean(track.id);
    return !VIDEO_ID_RE.test(id) || clean(track.youtubeMatchResolverVersion) !== TRUST_VERSION;
  }

  function loadMatcher() {
    if (typeof window.winampMusicAppleImport?.findYouTubeMatch === 'function') return Promise.resolve(window.winampMusicAppleImport.findYouTubeMatch);
    if (matcherPromise) return matcherPromise;
    matcherPromise = new Promise((resolve) => {
      let script = document.querySelector('script[data-track-diagnostics-matcher],script[data-spotify-origin-matcher],script[src*="apple-music-import-v064.js"]');
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
        script.src = './apple-music-import-v064.js?v=164';
        script.async = true;
        script.dataset.trackDiagnosticsMatcher = '1';
        document.head.appendChild(script);
      }
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', done, { once: true });
      if (window.winampMusicAppleImport?.findYouTubeMatch) done();
    }).finally(() => { matcherPromise = null; });
    return matcherPromise;
  }

  function traceKey(track) {
    return clean(track?.spotifyTrackId || track?.appleTrackId || `${normalize(track?.artist)}::${normalize(track?.title)}`);
  }

  function writeResolverTrace(track, patch) {
    const key = traceKey(track);
    if (!key) return;
    const store = readJson(TRACE_KEY, {});
    const previous = store && typeof store === 'object' && !Array.isArray(store) ? store[key] : null;
    const next = {
      ...(previous || {}),
      key,
      title: clean(track?.title),
      artist: clean(track?.artist),
      duration: Math.max(0, Number(track?.duration || 0)),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const entries = Object.entries({ ...(store || {}), [key]: next })
      .sort((a, b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || '')))
      .slice(0, 80);
    try { localStorage.setItem(TRACE_KEY, JSON.stringify(Object.fromEntries(entries))); } catch {}
  }

  async function resolveTrusted(index, track) {
    const key = traceKey(track) || String(index);
    if (inflight.has(key)) return inflight.get(key);
    const job = (async () => {
      const matcher = await loadMatcher();
      if (typeof matcher !== 'function') {
        writeResolverTrace(track, { phase: 'unresolved', rejectReason: 'trusted matcher unavailable', previousId: clean(track.id) });
        return null;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      writeResolverTrace(track, { phase: 'resolving', query: clean(`${track.artist || ''} ${track.title || ''}`), previousId: clean(track.id) });
      try {
        const candidate = await matcher({
          title: clean(track.title),
          artist: clean(track.artist),
          durationMs: Math.max(0, Number(track.duration || 0) * 1000),
        }, controller.signal);
        const id = clean(candidate?.id);
        if (!VIDEO_ID_RE.test(id)) throw new Error('trusted resolver returned invalid YouTube id');

        const library = readLibrary();
        const current = library[index];
        if (!current) return null;
        const canonicalTitle = clean(current.title || track.title);
        const canonicalArtist = clean(current.artist || track.artist);
        library[index] = {
          ...current,
          id,
          title: canonicalTitle,
          artist: canonicalArtist,
          youtubeMatchId: id,
          youtubeMatchResolverVersion: TRUST_VERSION,
          playbackProvider: 'youtube',
          badges: [...new Set([...(Array.isArray(current.badges) ? current.badges : []), 'YouTube match'])],
        };
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
        writeResolverTrace(library[index], {
          phase: 'matched',
          query: clean(`${canonicalArtist} ${canonicalTitle}`),
          previousId: clean(track.id),
          chosenId: id,
          chosenTitle: clean(candidate.title),
          chosenArtist: clean(candidate.artist),
          chosenDuration: Math.max(0, Number(candidate.duration || 0)),
          chosenScore: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : null,
        });
        window.renderLibrary?.();
        window.ampMusicOriginPlayback151?.refresh?.();
        return library[index];
      } catch (error) {
        if (error?.name !== 'AbortError') console.warn('[ÁmpulaMP diagnostics] trusted resolver rejected playback candidate', error);
        writeResolverTrace(track, {
          phase: 'unresolved',
          query: clean(`${track.artist || ''} ${track.title || ''}`),
          previousId: clean(track.id),
          rejectReason: error?.name === 'AbortError' ? 'trusted resolver timeout' : clean(error?.message) || 'no trustworthy music candidate',
        });
        return null;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  }

  function installSafePlayBridge() {
    const current = window.playIndex;
    if (typeof current !== 'function' || current.__ampulaTrustedResolver164) return;
    const wrapped = async (index) => {
      const library = readLibrary();
      if (!library.length) return current(index);
      const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
      const track = library[safeIndex];
      if (!needsTrustedResolution(track)) return current(index);

      const status = document.getElementById('status');
      if (status) status.textContent = 'RESOLVING TRUSTED YOUTUBE MATCH…';
      const resolved = await resolveTrusted(safeIndex, track);
      if (!resolved) {
        if (status) status.textContent = 'NO TRUSTWORTHY YOUTUBE MATCH · ORIGIN PRESERVED';
        queueDecorate();
        return false;
      }
      return current(safeIndex);
    };
    Object.defineProperty(wrapped, '__ampulaTrustedResolver164', { value: true });
    Object.defineProperty(wrapped, '__ampulaWrappedPlayIndex', { value: current });
    window.playIndex = wrapped;
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

  function diagnosticScore(candidate, track) {
    const haystackTitle = normalize(candidate?.title);
    const haystackAll = `${haystackTitle} ${normalize(candidate?.artist)}`.trim();
    let score = 0;
    for (const token of tokens(track?.title)) score += haystackTitle.includes(token) ? 9 : -7;
    for (const token of tokens(track?.artist)) score += haystackAll.includes(token) ? 5 : -2;
    const target = Number(track?.duration || 0);
    const actual = Number(candidate?.duration || 0);
    if (target && actual) {
      const diff = Math.abs(target - actual);
      if (diff <= 3) score += 20;
      else if (diff <= 10) score += 10;
      else if (diff <= 15) score += 3;
      else score -= 100;
    }
    score += Math.min(10, musicEvidenceScore(candidate));
    const source = normalize(`${track?.title || ''} ${track?.artist || ''}`);
    for (const noisy of ['cover', 'remix', 'nightcore', 'sped up', 'slowed', 'live']) {
      if (!source.includes(noisy) && haystackAll.includes(noisy)) score -= 10;
    }
    return score;
  }

  function rejectReason(candidate, track) {
    if (candidate?.liveNow === true || candidate?.isUpcoming === true) return 'live/upcoming';
    const genre = normalize(candidate?.genre);
    if (genre && genre !== 'music') return `genre=${clean(candidate.genre)}`;
    const categoryId = Number(candidate?.categoryId || 0);
    if (categoryId && categoryId !== 10) return `categoryId=${categoryId}`;
    const target = Number(track?.duration || 0);
    const actual = Number(candidate?.duration || 0);
    if (target && !actual) return 'missing duration';
    if (target && Math.abs(target - actual) > MAX_DURATION_DELTA_SECONDS) return `duration delta ${Math.round(Math.abs(target - actual))}s`;
    const evidence = musicEvidenceScore(candidate);
    if (evidence < MIN_MUSIC_EVIDENCE) return `music evidence ${evidence} < ${MIN_MUSIC_EVIDENCE}`;
    const score = diagnosticScore(candidate, track);
    if (score < MIN_MATCH_SCORE) return `match score ${score} < ${MIN_MATCH_SCORE}`;
    return '';
  }

  function summarizeSearchPayload(url, payload) {
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
    return rows.slice(0, 10).map((item) => ({
      id: clean(item.videoId || item.url?.match?.(/[?&]v=([\w-]{11})/)?.[1] || item.url?.match?.(/\/watch\/([\w-]{11})/)?.[1]),
      title: clean(item.title),
      artist: clean(item.author || item.uploaderName),
      duration: Math.max(0, Number(item.lengthSeconds || item.duration || 0)),
      description: clean(item.description).slice(0, 220),
      liveNow: item.liveNow === true,
      source: url.includes('/api/v1/search') ? 'invidious-search' : 'piped-search',
    })).filter((item) => item.id || item.title);
  }

  function summarizeVideoPayload(payload) {
    return {
      id: clean(payload?.videoId),
      title: clean(payload?.title),
      artist: clean(payload?.author),
      duration: Math.max(0, Number(payload?.lengthSeconds || 0)),
      description: clean(payload?.description).slice(0, 320),
      genre: clean(payload?.genre),
      categoryId: payload?.categoryId ?? null,
      keywords: Array.isArray(payload?.keywords) ? payload.keywords.slice(0, 20).map(clean) : [],
      musicTracks: Array.isArray(payload?.musicTracks) ? payload.musicTracks.slice(0, 5) : [],
      licensedContent: payload?.licensedContent === true,
      liveNow: payload?.liveNow === true,
      isUpcoming: payload?.isUpcoming === true,
      source: 'invidious-video',
    };
  }

  function installFetchTrace() {
    const original = window.fetch;
    if (typeof original !== 'function' || original.__ampulaDiagnostics164) return;
    const traced = async (...args) => {
      const requestUrl = clean(typeof args[0] === 'string' || args[0] instanceof URL ? args[0] : args[0]?.url);
      const relevant = /\/api\/v1\/(?:search|videos\/)|\/search(?:\?|$)/.test(requestUrl) && /(?:invidious|piped|nadeko|nerdvpn|chocolatemoo|kavin|leptons|adminforge|private\.coffee|piped\.yt)/i.test(requestUrl);
      const startedAt = new Date().toISOString();
      try {
        const response = await original.apply(window, args);
        if (relevant) {
          response.clone().json().then((payload) => {
            let summary = null;
            if (/\/api\/v1\/videos\//.test(requestUrl)) summary = summarizeVideoPayload(payload);
            else summary = summarizeSearchPayload(requestUrl, payload);
            networkTrace.push({ at: startedAt, url: requestUrl, status: response.status, ok: response.ok, summary });
            networkTrace = networkTrace.slice(-60);
          }).catch(() => {});
        }
        return response;
      } catch (error) {
        if (relevant) {
          networkTrace.push({ at: startedAt, url: requestUrl, error: clean(error?.message) || 'fetch failed' });
          networkTrace = networkTrace.slice(-60);
        }
        throw error;
      }
    };
    Object.defineProperty(traced, '__ampulaDiagnostics164', { value: true });
    Object.defineProperty(traced, '__ampulaOriginalFetch', { value: original });
    window.fetch = traced;
  }

  function installYouTubeWireTrace() {
    window.addEventListener('message', (event) => {
      if (!/youtube(?:-nocookie)?\.com$/i.test(String(event.origin || '').replace(/^https?:\/\//, ''))) return;
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || data.event !== 'infoDelivery' || !data.info) return;
      const info = data.info;
      youtubeWire = {
        ...youtubeWire,
        capturedAt: new Date().toISOString(),
        videoId: clean(info.videoData?.video_id || youtubeWire.videoId),
        title: clean(info.videoData?.title || youtubeWire.title),
        author: clean(info.videoData?.author || youtubeWire.author),
        playerState: info.playerState ?? youtubeWire.playerState ?? null,
        currentTime: Number.isFinite(Number(info.currentTime)) ? Number(info.currentTime) : youtubeWire.currentTime ?? null,
        duration: Number.isFinite(Number(info.duration)) ? Number(info.duration) : youtubeWire.duration ?? null,
      };
    });
  }

  function mergedNetworkCandidates(track) {
    const map = new Map();
    for (const event of networkTrace) {
      const items = Array.isArray(event.summary) ? event.summary : (event.summary ? [event.summary] : []);
      for (const item of items) {
        const id = clean(item.id);
        if (!id) continue;
        const previous = map.get(id) || {};
        map.set(id, { ...previous, ...item, sources: [...new Set([...(previous.sources || []), item.source].filter(Boolean))] });
      }
    }
    return [...map.values()].map((candidate) => ({
      ...candidate,
      musicEvidence: musicEvidenceScore(candidate),
      diagnosticScore: diagnosticScore(candidate, track),
      durationDelta: Number(track?.duration || 0) && Number(candidate.duration || 0) ? Math.abs(Number(track.duration) - Number(candidate.duration)) : null,
      accepted: !rejectReason(candidate, track),
      rejectReason: rejectReason(candidate, track) || null,
    })).sort((a, b) => Number(b.diagnosticScore || 0) - Number(a.diagnosticScore || 0)).slice(0, 15);
  }

  function currentResolverTrace(track) {
    const store = readJson(TRACE_KEY, {});
    return store?.[traceKey(track)] || null;
  }

  function diagnosticPayload(index) {
    const library = readLibrary();
    const track = library[index] || null;
    const currentIndex = Number(localStorage.getItem(CURRENT_KEY));
    const status = clean(document.getElementById('status')?.textContent);
    return {
      schema: 'ampula-track-diagnostics-v1',
      capturedAt: new Date().toISOString(),
      app: {
        diagnosticsVersion: VERSION,
        release: clean(window.__AMP_MUSIC_RELEASE__),
        runtime: clean(window.__WINAMP_MUSIC_RUNTIME__),
        page: location.href,
      },
      selectedRow: {
        index,
        isCurrent: index === currentIndex,
        track,
      },
      resolver: {
        requiredTrustVersion: TRUST_VERSION,
        needsTrustedResolution: needsTrustedResolution(track),
        trace: track ? currentResolverTrace(track) : null,
        observedCandidates: track ? mergedNetworkCandidates(track) : [],
      },
      playback: {
        currentIndex: Number.isInteger(currentIndex) ? currentIndex : null,
        status,
        nowTitle: clean(document.getElementById('nowTitle')?.textContent),
        nowArtist: clean(document.getElementById('nowArtist')?.textContent),
        nowSource: clean(document.getElementById('nowSource')?.textContent),
        playerState: readJson(PLAYER_STATE_KEY, {}),
        youtubeWire,
        storedYoutubeId: clean(track?.youtubeMatchId || (VIDEO_ID_RE.test(clean(track?.id)) ? track.id : '')),
        actualYoutubeId: clean(youtubeWire.videoId),
        storedVsActualMismatch: Boolean(track && clean(youtubeWire.videoId) && clean(track?.youtubeMatchId || track?.id) !== clean(youtubeWire.videoId)),
      },
      recentResolverNetwork: networkTrace.slice(-20),
    };
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch { return false; }
  }

  function closeOpenMenu() {
    if (!openMenu) return;
    openMenu.hidden = true;
    openMenu.closest('.track')?.querySelector('.track-more')?.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }

  function ensureStyles() {
    if (document.getElementById('ampulaTrackDiagnostics164Styles')) return;
    const style = document.createElement('style');
    style.id = 'ampulaTrackDiagnostics164Styles';
    style.textContent = `
      #trackList .track.has-track-diagnostics{grid-template-columns:42px minmax(0,1fr) 32px 28px;overflow:visible}
      #trackList .track.spotify-played-track.has-track-diagnostics{grid-template-columns:42px minmax(0,1fr) auto 32px 28px}
      .track-more{width:30px;height:32px;padding:0;border:0;border-radius:7px;background:transparent;color:#aeb5c1;font:900 19px/1 system-ui,sans-serif;cursor:pointer;z-index:8;touch-action:manipulation}
      .track-more:hover,.track-more[aria-expanded="true"]{background:#2b3038;color:#fff}.track-more:focus-visible{outline:1px solid #f0c94d;outline-offset:1px}
      .track-more-menu{position:absolute;right:24px;top:34px;z-index:40;min-width:178px;padding:5px;border:1px solid #414957;border-radius:9px;background:#171b21;box-shadow:0 12px 30px rgba(0,0,0,.45)}
      .track-more-menu[hidden]{display:none!important}.track-more-menu button{width:100%;min-height:38px;border:0;border-radius:6px;background:transparent;color:#e4e8ef;padding:0 10px;text-align:left;font:750 12px/1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}.track-more-menu button:hover{background:#292f38}.track-more-menu small{display:block;color:#818a98;font-size:9px;margin-top:3px}
      @media(max-width:520px){#trackList .track.has-track-diagnostics{grid-template-columns:34px minmax(0,1fr) 34px 30px}.track-more{width:34px;height:38px}.track-more-menu{right:18px;top:38px;min-width:190px}}
    `;
    document.head.appendChild(style);
  }

  function decorateRows() {
    const list = document.getElementById('trackList');
    if (!list) return;
    ensureStyles();
    for (const row of list.querySelectorAll('.track[data-index]')) {
      if (row.querySelector(':scope > .track-more')) continue;
      const index = Number(row.dataset.index);
      if (!Number.isInteger(index)) continue;
      row.classList.add('has-track-diagnostics');

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'track-more';
      more.textContent = '⋮';
      more.title = 'Track menu';
      more.setAttribute('aria-label', 'Track menu');
      more.setAttribute('aria-expanded', 'false');

      const menu = document.createElement('div');
      menu.className = 'track-more-menu';
      menu.hidden = true;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.innerHTML = 'Copy diagnostics<small>resolver + stored/actual playback</small>';
      menu.appendChild(copy);

      more.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const wasOpen = !menu.hidden;
        closeOpenMenu();
        if (!wasOpen) {
          menu.hidden = false;
          more.setAttribute('aria-expanded', 'true');
          openMenu = menu;
        }
      });
      copy.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const payload = diagnosticPayload(Number(row.dataset.index));
        const ok = await copyText(JSON.stringify(payload, null, 2));
        copy.firstChild.textContent = ok ? 'Copied diagnostics' : 'Copy failed';
        setTimeout(() => { if (copy.firstChild) copy.firstChild.textContent = 'Copy diagnostics'; }, 1400);
        if (ok) setTimeout(closeOpenMenu, 350);
      });

      const marker = row.querySelector(':scope > .track-play');
      if (marker) row.insertBefore(more, marker); else row.appendChild(more);
      row.appendChild(menu);
    }
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    queueMicrotask(() => { decorateQueued = false; decorateRows(); installSafePlayBridge(); });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.track-more,.track-more-menu')) closeOpenMenu();
  }, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOpenMenu(); });

  installFetchTrace();
  installYouTubeWireTrace();
  installSafePlayBridge();
  ensureStyles();
  queueDecorate();

  const list = document.getElementById('trackList');
  if (list) new MutationObserver(queueDecorate).observe(list, { childList: true, subtree: true });
  window.addEventListener('pageshow', queueDecorate);
  window.addEventListener('ampula:spotify-playback-started', queueDecorate);
  for (const delay of [0, 60, 250, 900, 2200, 5000]) setTimeout(installSafePlayBridge, delay);

  window.ampulaTrackDiagnostics164 = {
    version: VERSION,
    trustVersion: TRUST_VERSION,
    payloadForIndex: diagnosticPayload,
    resolveTrusted,
    refresh: queueDecorate,
  };
  console.info('[ÁmpulaMP] track diagnostics + trusted playback bridge 1.6.4 ready');
})();