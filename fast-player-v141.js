(() => {
  'use strict';

  const VERSION = '1.4.1-fast';
  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const INITIAL_ROWS = 30;
  const CHUNK_ROWS = 40;
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
  const readLibrary = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      return value.filter((track) => track && clean(track.id)).map((track) => ({
        ...track,
        id: clean(track.id),
        title: clean(track.title) || `YouTube ${clean(track.id)}`,
        artist: clean(track.artist) || 'YouTube',
      }));
    } catch { return []; }
  };

  let library = readLibrary();
  let filtered = library.map((_, index) => index);
  let currentIndex = (() => {
    const value = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(value) && value >= 0 && value < library.length ? value : -1;
  })();
  let player = null;
  let playerPromise = null;
  let youtubePromise = null;
  let progressTimer = null;
  let renderGeneration = 0;
  let playing = false;

  const setStatus = (text) => { ui.status.textContent = text; };
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
    ui.title.textContent = track.title;
    ui.artist.textContent = track.artist;
    saveCurrent();
    highlightCurrent();
  }

  function makeRow(index) {
    const track = library[index];
    const row = document.createElement('li');
    row.className = `track${index === currentIndex ? ' active' : ''}`;
    row.dataset.index = String(index);

    const number = document.createElement('span');
    number.className = 'track-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'track-main';
    main.dataset.index = String(index);
    main.setAttribute('aria-label', `Play ${track.title}`);
    main.style.cssText = 'display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:6px 0;cursor:pointer;touch-action:manipulation';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title;
    const artist = document.createElement('div');
    artist.className = 'track-artist';
    artist.textContent = track.artist;
    main.append(title, artist);

    const marker = document.createElement('span');
    marker.className = 'track-play';
    marker.textContent = index === currentIndex && playing ? '⏸' : '▶';
    row.append(number, main, marker);
    return row;
  }

  const scheduleIdle = (callback, timeout = 120) => {
    if ('requestIdleCallback' in window) requestIdleCallback(callback, { timeout });
    else setTimeout(callback, 0);
  };

  function renderLibrary(indices = filtered) {
    const generation = ++renderGeneration;
    ui.list.replaceChildren();
    ui.count.textContent = String(indices.length);
    ui.empty.hidden = indices.length > 0;
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
    filtered = library
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => !query || `${track.title} ${track.artist} ${track.playlist || ''}`.toLocaleLowerCase().includes(query))
      .map(({ index }) => index);
    renderLibrary(filtered);
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubePromise) return youtubePromise;
    youtubePromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previousReady?.(); } catch {}
        if (window.YT?.Player) resolve(window.YT);
      };
      let script = document.querySelector('script[data-fast-youtube-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.fastYoutubeApi = '1';
        script.addEventListener('error', () => {
          youtubePromise = null;
          reject(new Error('YouTube API failed to load'));
        }, { once: true });
        document.head.appendChild(script);
      }
      const started = performance.now();
      const timer = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(timer);
          resolve(window.YT);
        } else if (performance.now() - started > 15000) {
          clearInterval(timer);
          youtubePromise = null;
          reject(new Error('YouTube API timeout'));
        }
      }, 100);
    });
    return youtubePromise;
  }

  function onPlayerStateChange(event) {
    const state = event?.data;
    if (state === window.YT?.PlayerState?.PLAYING) {
      playing = true;
      ui.play.textContent = '⏸';
      setStatus('PLAYING');
      startProgress();
    } else if (state === window.YT?.PlayerState?.PAUSED) {
      playing = false;
      ui.play.textContent = '▶';
      setStatus('PAUSED');
    } else if (state === window.YT?.PlayerState?.ENDED) {
      playing = false;
      ui.play.textContent = '▶';
      playRelative(1);
    }
    highlightCurrent();
  }

  function ensurePlayer() {
    if (playerPromise) return playerPromise;
    playerPromise = loadYouTubeApi().then(() => new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(player);
      };
      try {
        player = new YT.Player('youtubePlayer', {
          width: '1', height: '1',
          playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: location.origin },
          events: {
            onReady: () => {
              try { player.setVolume(Number(ui.volume.value) || 75); } catch {}
              if (ui.status.textContent.startsWith('WARMING')) setStatus('READY · FAST');
              finish();
            },
            onStateChange: onPlayerStateChange,
            onError: (event) => {
              playing = false;
              ui.play.textContent = '▶';
              highlightCurrent();
              setStatus(`YOUTUBE ERROR ${event?.data ?? ''}`.trim());
            },
          },
        });
        setTimeout(() => { if (!settled && player) finish(); }, 8000);
      } catch (error) {
        playerPromise = null;
        reject(error);
      }
    })).catch((error) => {
      playerPromise = null;
      setStatus('YOUTUBE UNAVAILABLE · TAP AGAIN');
      console.warn('[Winamp Music fast]', error);
      throw error;
    });
    return playerPromise;
  }

  async function playIndex(index) {
    if (!library.length) return setStatus('LIBRARY EMPTY');
    currentIndex = ((Number(index) % library.length) + library.length) % library.length;
    updateNowPlaying();
    setStatus('LOADING PLAYER…');
    ui.play.textContent = '…';
    try {
      const readyPlayer = await ensurePlayer();
      const track = library[currentIndex];
      if (!track) return;
      setStatus('STARTING…');
      readyPlayer.loadVideoById(track.id);
    } catch {
      ui.play.textContent = '▶';
    }
  }

  function togglePlayback() {
    if (!library.length) return setStatus('LIBRARY EMPTY');
    if (!player || !window.YT?.PlayerState) return playIndex(currentIndex >= 0 ? currentIndex : 0);
    let state = null;
    try { state = player.getPlayerState(); } catch {}
    if (state === window.YT.PlayerState.PLAYING) {
      try { player.pauseVideo(); } catch {}
    } else if (currentIndex >= 0) {
      setStatus('STARTING…');
      try { player.playVideo(); } catch { playIndex(currentIndex); }
    } else playIndex(0);
  }

  function playRelative(delta) {
    if (!library.length) return;
    playIndex((currentIndex >= 0 ? currentIndex : 0) + delta);
  }

  function playRandom() {
    if (!library.length) return;
    if (library.length === 1) return playIndex(0);
    let index = currentIndex;
    while (index === currentIndex) index = Math.floor(Math.random() * library.length);
    playIndex(index);
  }

  function startProgress() {
    if (progressTimer) return;
    progressTimer = setInterval(() => {
      if (!player) return;
      try {
        const current = Number(player.getCurrentTime()) || 0;
        const total = Number(player.getDuration()) || 0;
        ui.elapsed.textContent = formatTime(current);
        ui.duration.textContent = formatTime(total);
        if (total > 0 && document.activeElement !== ui.seek) ui.seek.value = String(Math.round((current / total) * 1000));
      } catch {}
    }, 750);
  }

  function importTracks(items) {
    const incoming = Array.isArray(items) ? items : [];
    let added = 0;
    for (const item of incoming) {
      const id = clean(item?.id);
      if (!id || library.some((track) => track.id === id)) continue;
      library.push({ ...item, id, title: clean(item.title) || `YouTube ${id}`, artist: clean(item.artist) || 'YouTube' });
      added += 1;
    }
    if (added) {
      saveLibrary();
      filtered = library.map((_, index) => index);
      renderLibrary(filtered);
    }
    return { added, total: library.length };
  }

  ui.play.addEventListener('click', togglePlayback);
  ui.prev.addEventListener('click', () => playRelative(-1));
  ui.next.addEventListener('click', () => playRelative(1));
  ui.shuffle.addEventListener('click', playRandom);
  ui.list.addEventListener('click', (event) => {
    const button = event.target.closest('.track-main');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (Number.isInteger(index)) playIndex(index);
  });
  ui.search.addEventListener('input', filterLibrary, { passive: true });
  ui.search.addEventListener('search', filterLibrary, { passive: true });
  ui.volume.addEventListener('input', () => { try { player?.setVolume(Number(ui.volume.value) || 0); } catch {} }, { passive: true });
  ui.seek.addEventListener('change', () => {
    if (!player) return;
    try {
      const total = Number(player.getDuration()) || 0;
      if (total > 0) player.seekTo((Number(ui.seek.value) / 1000) * total, true);
    } catch {}
  });

  window.playIndex = playIndex;
  window.importTracks = importTracks;
  window.renderLibrary = () => renderLibrary(filtered);
  window.winampMusicLoadYouTubeApi = loadYouTubeApi;

  updateNowPlaying();
  renderLibrary();
  setStatus('READY · FAST');

  scheduleIdle(() => ensurePlayer().catch(() => {}), 1500);

  // Restore safe search lazily after the player is already interactive.
  scheduleIdle(() => {
    if (document.querySelector('script[data-fast-search]')) return;
    const script = document.createElement('script');
    script.src = './v059.js?v=141';
    script.async = true;
    script.dataset.fastSearch = '1';
    document.head.appendChild(script);
  }, 1800);

  // Remove obsolete workers/caches in the background; never block first paint.
  setTimeout(() => {
    navigator.serviceWorker?.getRegistrations?.().then((registrations) => Promise.all(registrations
      .filter((registration) => registration.scope.includes('/winampmusic/'))
      .map((registration) => registration.unregister()))).catch(() => {});
    window.caches?.keys?.().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('winampmusic-shell-'))
      .map((key) => window.caches.delete(key)))).catch(() => {});
  }, 2500);

  console.info(`[Winamp Music] ${VERSION} ready`, { tracks: library.length });
})();
