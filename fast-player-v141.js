(() => {
  'use strict';

  const VERSION = '1.4.1-fast';
  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const INITIAL_ROWS = 30;
  const CHUNK_ROWS = 40;
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const REPAIR_SEARCH_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
  ];
  const $ = (id) => document.getElementById(id);

  window.__WINAMP_MUSIC_RUNTIME__ = VERSION;
  document.documentElement.dataset.winampRuntime = VERSION;

  const ui = {
    status: $('status'), title: $('nowTitle'), artist: $('nowArtist'), elapsed: $('elapsed'),
    duration: $('duration'), seek: $('seek'), volume: $('volume'), play: $('playButton'),
    prev: $('prevButton'), next: $('nextButton'), shuffle: $('shuffleButton'), search: $('search'),
    list: $('trackList'), count: $('trackCount'), empty: $('emptyState'),
  };
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  const localRecordingId = (title, artist) => {
    const text = `${title}\u0000${artist}`.toLowerCase();
    let a = 0x811c9dc5; let b = 0x1b873593;
    for (let i = 0; i < text.length; i += 1) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; }
    return `U-${a.toString(36).padStart(7, '0')}${(b % 46656).toString(36).padStart(3, '0')}`;
  };

  function videoIdFromValue(raw) {
    const value = clean(raw);
    if (VIDEO_ID_RE.test(value)) return value;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      const id = host === 'youtu.be' ? parts[0] : url.searchParams.get('v') ||
        (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '');
      return VIDEO_ID_RE.test(id || '') ? id : '';
    } catch {}
    return '';
  }

  const readLibrary = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      return value.filter(track => track && clean(track.id)).map(track => ({
        ...track, id: videoIdFromValue(track.id) || clean(track.id), title: clean(track.title), artist: clean(track.artist),
      }));
    } catch { return []; }
  };

  let library = readLibrary();
  let filtered = library.map((_, index) => index);
  let currentIndex = savedIndex();
  let player = null;
  let playerPromise = null;
  let youtubePromise = null;
  let progressTimer = null;
  let renderGeneration = 0;
  let playing = false;
  let requestId = 0;
  let active = false;
  let loadedId = '';
  const repairAttempts = new Set();

  const setStatus = (text) => { ui.status.textContent = text; };
  const isResolved = (track) => VIDEO_ID_RE.test(clean(track?.id));
  const recordingId=(t)=>clean(t?.title)?localRecordingId(clean(t.title),clean(t.artist)):'';
  const shownTitle = (track) => clean(track?.title) || 'Unknown track';
  const shownArtist = (track) => clean(track?.artist) || 'Unknown artist';
  const saveLibrary = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch {}
  };
  const saveCurrent = () => {
    try { localStorage.setItem(CURRENT_KEY, String(currentIndex)); } catch {}
  };
  const formatTime = (value) => {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  saveLibrary();

  function highlightCurrent() {
    ui.list.querySelectorAll('.track').forEach((row) => {
      const index = Number(row.dataset.index);
      row.classList.toggle('active', index === currentIndex);
      const marker = row.querySelector('.track-play');
      if (marker) marker.textContent = index === currentIndex && playing ? '⏸' : '▶';
    });
  }

  function updateNowPlaying() {
    const track = library[currentIndex];
    if (!track) {
      ui.title.textContent = 'No track selected';
      ui.artist.textContent = library.length ? 'Tap a track or ▶' : 'Your saved library is empty';
      return;
    }
    ui.title.textContent = shownTitle(track);
    ui.artist.textContent = shownArtist(track);
    saveCurrent();
    highlightCurrent();
  }

  function makeRow(index) {
    const track = library[index];
    const row = document.createElement('li');
    row.className = `track${index === currentIndex ? ' active' : ''}${isResolved(track) ? '' : ' unresolved'}`;
    row.dataset.index = String(index);
    const number = document.createElement('span');
    number.className = 'track-index';
    number.textContent = String(index + 1).padStart(2, '0');
    const main = document.createElement('button');
    main.type = 'button'; main.className = 'track-main'; main.dataset.index = String(index);
    main.setAttribute('aria-label', `Play ${shownTitle(track)}`);
    main.style.cssText = 'display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:6px 0;cursor:pointer;touch-action:manipulation';
    const title = document.createElement('div'); title.className = 'track-title'; title.textContent = shownTitle(track);
    const artist = document.createElement('div'); artist.className = 'track-artist'; artist.textContent = shownArtist(track);
    main.append(title, artist);
    const marker = document.createElement('span'); marker.className = 'track-play'; marker.textContent = index === currentIndex && playing ? '⏸' : '▶';
    row.append(number, main, marker);
    return row;
  }

  const scheduleIdle=(callback,timeout=120)=>window.requestIdleCallback?requestIdleCallback(callback,{timeout}):setTimeout(callback,0);

  function renderLibrary(indices = filtered) {
    const generation = ++renderGeneration;
    ui.list.replaceChildren();
    ui.count.textContent = String(indices.length);
    ui.empty.hidden = indices.length > 0;
    ui.empty.style.display = indices.length > 0 ? 'none' : '';
    if (!indices.length) return;
    const append = (start, end) => {
      if (generation !== renderGeneration) return;
      const fragment = document.createDocumentFragment();
      for (let pos = start; pos < Math.min(end, indices.length); pos += 1) fragment.appendChild(makeRow(indices[pos]));
      ui.list.appendChild(fragment);
    };
    append(0, INITIAL_ROWS);
    let cursor = INITIAL_ROWS;
    const more = () => {
      if (generation !== renderGeneration || cursor >= indices.length) return;
      append(cursor, cursor + CHUNK_ROWS);
      cursor += CHUNK_ROWS;
      if (cursor < indices.length) scheduleIdle(more);
    };
    if (cursor < indices.length) scheduleIdle(more);
  }

  function filterLibrary() {
    const query = clean(ui.search.value).toLocaleLowerCase();
    filtered = library.flatMap((t, i) => !query || `${t.title} ${t.artist} ${t.playlist || ''}`.toLocaleLowerCase().includes(query) ? [i] : []);
    renderLibrary(filtered);
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubePromise) return youtubePromise;
    youtubePromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { try { previousReady?.(); } catch {} if (window.YT?.Player) resolve(window.YT); };
      let script = document.querySelector('script[data-fast-youtube-api]');
      if (!script) {
        script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.dataset.fastYoutubeApi = '1';
        script.addEventListener('error', () => { youtubePromise = null; reject(new Error('YouTube API failed to load')); }, { once: true });
        document.head.appendChild(script);
      }
      const started = performance.now();
      const timer = setInterval(() => {
        if (window.YT?.Player) { clearInterval(timer); resolve(window.YT); }
        else if (performance.now() - started > 15000) { clearInterval(timer); youtubePromise = null; reject(new Error('YouTube API timeout')); }
      }, 100);
    });
    return youtubePromise;
  }

  async function findRepairCandidate(track) {
    const query = clean(`${track?.title || ''} ${track?.artist || ''}`);
    if (query.length < 2) return '';
    for (const base of REPAIR_SEARCH_INSTANCES) {
      try {
        const url = new URL('/api/v1/search', base);
        url.search = new URLSearchParams({ q: query, type: 'video', sort: 'relevance', hl: navigator.language?.split('-')[0] || 'en' });
        const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) continue;
        const payload = await response.json();
        const candidate = Array.isArray(payload) ? payload.find((item) => item?.type === 'video' && VIDEO_ID_RE.test(clean(item.videoId))) : null;
        if (candidate) return clean(candidate.videoId);
      } catch {}
    }
    return '';
  }

  async function repairCurrentTrack() {
    const generation = requestId;
    const track = library[currentIndex];
    if (!track) return false;
    const attemptKey = `${currentIndex}:${clean(track.id)}`;
    if (repairAttempts.has(attemptKey)) return false;
    repairAttempts.add(attemptKey);
    setStatus('REPAIRING YOUTUBE ID…');
    let repairedId = videoIdFromValue(track.id);
    if (!repairedId) repairedId = await findRepairCandidate(track);
    if (generation !== requestId || !VIDEO_ID_RE.test(repairedId)) return false;
    track.id = repairedId;
    saveLibrary(); renderLibrary(filtered); updateNowPlaying();
    try { loadedId = repairedId; player?.loadVideoById(repairedId); return true; } catch { return false; }
  }

  function onPlayerStateChange(event) {
    if (!active) return;
    const state = event?.data;
    if (state === window.YT?.PlayerState?.PLAYING) { playing = true; ui.play.textContent = '⏸'; setStatus('PLAYING'); startProgress(); }
    else if (state === window.YT?.PlayerState?.PAUSED) { playing = false; ui.play.textContent = '▶'; setStatus('PAUSED'); }
    else if (state === window.YT?.PlayerState?.ENDED) { playing = false; ui.play.textContent = '▶'; playRelative(1); }
    highlightCurrent();
  }

  async function onPlayerError(event) {
    if (!active) return;
    const generation = requestId;
    playing = false; ui.play.textContent = '▶'; highlightCurrent();
    const code = Number(event?.data);
    if (code === 2) {
      const repaired = await repairCurrentTrack();
      if (repaired || generation !== requestId) return;
      setStatus('TRACK SOURCE INVALID · RE-IMPORT');
      return;
    }
    setStatus(`YOUTUBE ERROR ${event?.data ?? ''}`.trim());
  }

  function ensurePlayer() {
    if (playerPromise) return playerPromise;
    playerPromise = loadYouTubeApi().then(() => new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; resolve(player); };
      try {
        player = new YT.Player('youtubePlayer', {
          width: '1', height: '1', playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
          events: {
            onReady: () => { try { player.setVolume(Number(ui.volume.value) || 75); } catch {} if (ui.status.textContent.startsWith('WARMING')) setStatus('READY · FAST'); finish(); },
            onStateChange: onPlayerStateChange,
            onError: (event) => { void onPlayerError(event); },
          },
        });
        setTimeout(() => { if (!settled && player) finish(); }, 8000);
      } catch (error) { playerPromise = null; reject(error); }
    })).catch((error) => { playerPromise = null; setStatus('YOUTUBE UNAVAILABLE · TAP AGAIN'); console.warn('[ÁmpulaMP fast]', error); throw error; });
    return playerPromise;
  }

  async function playIndex(index) {
    if (!library.length) return setStatus('LIBRARY EMPTY');
    const generation = ++requestId;
    active = true;
    currentIndex = ((Number(index) % library.length) + library.length) % library.length;
    updateNowPlaying(); setStatus('LOADING PLAYER…'); ui.play.textContent = '…';
    try {
      const ready = await ensurePlayer();
      if (generation !== requestId) return;
      const track = library[currentIndex];
      if (!track) return;
      const safeId = videoIdFromValue(track.id);
      if (!safeId) {
        const repaired = await repairCurrentTrack();
        if (generation !== requestId) return;
        if (!repaired) { ui.play.textContent = '▶'; setStatus(clean(track.id).startsWith('U-') ? 'NO SOURCE FOUND · RESOLVE LATER' : 'TRACK SOURCE INVALID · RE-IMPORT'); }
        return;
      }
      if (safeId !== track.id) { track.id = safeId; saveLibrary(); renderLibrary(filtered); }
      loadedId = safeId;
      setStatus('STARTING…'); ready.loadVideoById(safeId);
    } catch { if (generation === requestId) ui.play.textContent = '▶'; }
  }

  function togglePlayback() {
    if (!library.length) return setStatus('LIBRARY EMPTY');
    if (!player || !window.YT?.PlayerState || !active || !loadedId) return window.playIndex(currentIndex >= 0 ? currentIndex : 0);
    let state = null; try { state = player.getPlayerState(); } catch {}
    if (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.BUFFERING) { try { player.pauseVideo(); } catch {} }
    else if (currentIndex >= 0) { setStatus('STARTING…'); try { player.playVideo(); } catch { playIndex(currentIndex); } }
    else playIndex(0);
  }

  function savedIndex() {
    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 && index < library.length ? index : -1;
  }
  function playRelative(delta) { if (library.length) return window.playIndex(Math.max(0, savedIndex()) + delta); }
  function playRandom() { if (!library.length) return; if (library.length === 1) return window.playIndex(0); let index = currentIndex; while (index === currentIndex) index = Math.floor(Math.random() * library.length); window.playIndex(index); }

  function startProgress() {
    if (progressTimer) return;
    progressTimer = setInterval(() => {
      if (!player || !active) return;
      try {
        const current = Number(player.getCurrentTime()) || 0; const total = Number(player.getDuration()) || 0;
        ui.elapsed.textContent = formatTime(current); ui.duration.textContent = formatTime(total);
        if (total > 0 && document.activeElement !== ui.seek) ui.seek.value = String(Math.round((current / total) * 1000));
      } catch {}
    }, 750);
  }

  function importTracks(items) {
    const incoming = Array.isArray(items) ? items : [];
    let added = 0; let adopted = 0;
    for (const item of incoming) {
      const playable = videoIdFromValue(item?.id);
      const title = clean(item?.title); const artist = clean(item?.artist);
      if (!playable && !title) continue;
      const localId = title ? localRecordingId(title, artist) : '';
      const id = playable || localId;
      const known = library.findIndex((track) => track.id === id || (localId && recordingId(track) === localId));
      if (known >= 0) {
        if (playable && !isResolved(library[known])) { library[known].id = playable; adopted += 1; }
        continue;
      }
      library.push({ ...item, id, title, artist }); added += 1;
    }
    if (added || adopted) { saveLibrary(); filtered = library.map((_, index) => index); renderLibrary(filtered); }
    return { added, total: library.length };
  }

  function updateTrackMetadata(videoId, patch = {}) {
    const id = videoIdFromValue(videoId);
    if (!id) return false;
    const index = library.findIndex((track) => track.id === id);
    if (index < 0) return false;
    const track = library[index];
    const title = clean(patch.title);
    const artist = clean(patch.artist);
    const thumbnail = clean(patch.thumbnail);
    const duration = clean(patch.duration);
    if (title) track.title = title;
    if (artist) track.artist = artist;
    if (thumbnail) track.thumbnail = thumbnail;
    if (duration) track.duration = duration;
    saveLibrary();
    filterLibrary();
    if (currentIndex === index) updateNowPlaying();
    return true;
  }

  ui.play.addEventListener('click', togglePlayback);
  ui.prev.addEventListener('click', () => playRelative(-1));
  ui.next.addEventListener('click', () => playRelative(1));
  ui.shuffle.addEventListener('click', playRandom);
  ui.list.addEventListener('click', (event) => { const button = event.target.closest('.track-main'); if (!button) return; const index = Number(button.dataset.index); if (Number.isInteger(index)) window.playIndex(index); });
  ui.search.addEventListener('input', filterLibrary, { passive: true });
  ui.search.addEventListener('search', filterLibrary, { passive: true });
  ui.volume.addEventListener('input', () => { try { player?.setVolume(Number(ui.volume.value) || 0); } catch {} }, { passive: true });
  ui.seek.addEventListener('change', () => { if (!player) return; try { const total = Number(player.getDuration()) || 0; if (total > 0) player.seekTo((Number(ui.seek.value) / 1000) * total, true); } catch {} });

  window.ampMusicYouTube150 = {
    isActive: () => active && Boolean(loadedId),
    suspend() {
      requestId += 1; active = false; playing = false; loadedId = '';
      try { player?.pauseVideo(); } catch {}
    },
  };
  window.playIndex = playIndex;
  window.importTracks = importTracks;
  window.updateTrackMetadata = updateTrackMetadata;
  window.renderLibrary = () => renderLibrary(filtered);
  window.winampMusicLoadYouTubeApi = loadYouTubeApi;
  window.ampMusicVideoIdFromValue = videoIdFromValue;
  window.ampMusicIsResolved = isResolved;
  window.ampMusicRecordingId = localRecordingId;

  updateNowPlaying(); renderLibrary(); setStatus('READY · FAST');
  scheduleIdle(() => ensurePlayer().catch(() => {}), 1500);
  scheduleIdle(() => {
    if (document.querySelector('script[data-fast-search]')) return;
    const script = document.createElement('script'); script.src = './v059.js?v=150'; script.async = true; script.dataset.fastSearch = '1'; document.head.appendChild(script);
  }, 1800);

  setTimeout(() => {
    navigator.serviceWorker?.getRegistrations?.().then((registrations) => Promise.all(registrations.filter((registration) => registration.scope.includes('/winampmusic/')).map((registration) => registration.unregister()))).catch(() => {});
    window.caches?.keys?.().then((keys) => Promise.all(keys.filter((key) => key.startsWith('winampmusic-shell-')).map((key) => window.caches.delete(key)))).catch(() => {});
  }, 2500);

  console.info(`[ÁmpulaMP] ${VERSION} ready`, { tracks: library.length });
})();
