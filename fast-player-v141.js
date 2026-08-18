(() => {
  'use strict';

  const VERSION = '1.4.1-fast';
  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const INITIAL_ROWS = 30;
  const CHUNK_ROWS = 40;

  window.__WINAMP_MUSIC_RUNTIME__ = VERSION;
  document.documentElement.dataset.winampRuntime = VERSION;

  const $ = (id) => document.getElementById(id);
  const status = $('status');
  const nowTitle = $('nowTitle');
  const nowArtist = $('nowArtist');
  const elapsed = $('elapsed');
  const duration = $('duration');
  const seek = $('seek');
  const volume = $('volume');
  const playButton = $('playButton');
  const prevButton = $('prevButton');
  const nextButton = $('nextButton');
  const shuffleButton = $('shuffleButton');
  const search = $('search');
  const trackList = $('trackList');
  const trackCount = $('trackCount');
  const emptyState = $('emptyState');

  let library = readLibrary();
  let filtered = library.map((_, index) => index);
  let currentIndex = readCurrentIndex();
  let player = null;
  let playerReadyPromise = null;
  let youtubePromise = null;
  let progressTimer = null;
  let renderGeneration = 0;
  let playing = false;

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value)
        ? value.filter((track) => track && clean(track.id)).map((track) => ({
            ...track,
            id: clean(track.id),
            title: clean(track.title) || `YouTube ${clean(track.id)}`,
            artist: clean(track.artist) || 'YouTube',
          }))
        : [];
    } catch {
      return [];
    }
  }

  function readCurrentIndex() {
    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 && index < library.length ? index : -1;
  }

  function saveCurrentIndex() {
    try { localStorage.setItem(CURRENT_KEY, String(currentIndex)); } catch {}
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function formatTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function updateNowPlaying() {
    const track = library[currentIndex];
    if (!track) {
      nowTitle.textContent = 'No track selected';
      nowArtist.textContent = library.length ? 'Tap a track or ▶' : 'Your saved library is empty';
      return;
    }
    nowTitle.textContent = track.title;
    nowArtist.textContent = track.artist;
    saveCurrentIndex();
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
    main.style.cssText = 'display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:6px 0;cursor:pointer;touch-action:manipulation;';

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

  function renderRows(indices, start, end, generation) {
    if (generation !== renderGeneration) return;
    const fragment = document.createDocumentFragment();
    for (let pos = start; pos < Math.min(end, indices.length); pos += 1) {
      fragment.appendChild(makeRow(indices[pos]));
    }
    trackList.appendChild(fragment);
  }

  function scheduleChunk(callback) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: 120 });
    } else {
      setTimeout(callback, 0);
    }
  }

  function renderLibrary(indices = filtered) {
    const generation = ++renderGeneration;
    trackList.replaceChildren();
    trackCount.textContent = String(indices.length);
    emptyState.hidden = indices.length > 0;
    if (!indices.length) return;

    renderRows(indices, 0, INITIAL_ROWS, generation);
    let cursor = INITIAL_ROWS;

    const appendChunk = () => {
      if (generation !== renderGeneration || cursor >= indices.length) return;
      renderRows(indices, cursor, cursor + CHUNK_ROWS, generation);
      cursor += CHUNK_ROWS;
      if (cursor < indices.length) scheduleChunk(appendChunk);
    };
    if (cursor < indices.length) scheduleChunk(appendChunk);
  }

  function highlightCurrent() {
    trackList.querySelectorAll('.track').forEach((row) => {
      const index = Number(row.dataset.index);
      row.classList.toggle('active', index === currentIndex);
      const marker = row.querySelector('.track-play');
      if (marker) marker.textContent = index === currentIndex && playing ? '⏸' : '▶';
    });
  }

  function filterLibrary() {
    const query = clean(search.value).toLocaleLowerCase();
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
      const done = () => {
        try { previousReady?.(); } catch {}
        if (window.YT?.Player) resolve(window.YT);
      };
      window.onYouTubeIframeAPIReady = done;

      let script = document.querySelector('script[data-fast-youtube-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.fastYoutubeApi = '1';
        script.onerror = () => {
          youtubePromise = null;
          reject(new Error('YouTube API failed to load'));
        };
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

  function ensurePlayer() {
    if (player && playerReadyPromise) return playerReadyPromise;
    if (playerReadyPromise) return playerReadyPromise;

    playerReadyPromise = loadYouTubeApi().then(() => new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(player);
      };
      try {
        player = new YT.Player('youtubePlayer', {
          width: '1',
          height: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            playsinline: 1,
            rel: 0,
            origin: location.origin,
          },
          events: {
            onReady: () => {
              try { player.setVolume(Number(volume.value) || 75); } catch {}
              setStatus('READY');
              finish();
            },
            onStateChange: onPlayerStateChange,
            onError: (event) => {
              playing = false;
              playButton.textContent = '▶';
              highlightCurrent();
              setStatus(`YOUTUBE ERROR ${event?.data ?? ''}`.trim());
            },
          },
        });
        setTimeout(() => {
          if (!settled && player) finish();
        }, 8000);
      } catch (error) {
        playerReadyPromise = null;
        reject(error);
      }
    })).catch((error) => {
      playerReadyPromise = null;
      setStatus('YOUTUBE UNAVAILABLE · TAP AGAIN');
      console.warn('[Winamp Music fast]', error);
      throw error;
    });

    return playerReadyPromise;
  }

  function onPlayerStateChange(event) {
    const state = event?.data;
    if (state === window.YT?.PlayerState?.PLAYING) {
      playing = true;
      playButton.textContent = '⏸';
      setStatus('PLAYING');
      startProgress();
    } else if (state === window.YT?.PlayerState?.PAUSED) {
      playing = false;
      playButton.textContent = '▶';
      setStatus('PAUSED');
    } else if (state === window.YT?.PlayerState?.ENDED) {
      playing = false;
      playButton.textContent = '▶';
      playRelative(1);
    }
    highlightCurrent();
  }

  async function playIndex(index) {
    if (!library.length) {
      setStatus('LIBRARY EMPTY');
      return;
    }
    const normalized = ((Number(index) % library.length) + library.length) % library.length;
    currentIndex = normalized;
    updateNowPlaying();
    setStatus('LOADING PLAYER…');
    playButton.textContent = '…';

    try {
      const readyPlayer = await ensurePlayer();
      const track = library[currentIndex];
      if (!track) return;
      readyPlayer.loadVideoById(track.id);
      setStatus('STARTING…');
    } catch {
      playButton.textContent = '▶';
    }
  }

  function togglePlayback() {
    if (!library.length) return setStatus('LIBRARY EMPTY');
    if (!player || !window.YT?.PlayerState) {
      playIndex(currentIndex >= 0 ? currentIndex : 0);
      return;
    }
    let state = null;
    try { state = player.getPlayerState(); } catch {}
    if (state === window.YT.PlayerState.PLAYING) {
      try { player.pauseVideo(); } catch {}
    } else if (currentIndex >= 0) {
      try {
        player.playVideo();
        setStatus('STARTING…');
      } catch {
        playIndex(currentIndex);
      }
    } else {
      playIndex(0);
    }
  }

  function playRelative(delta) {
    if (!library.length) return;
    const base = currentIndex >= 0 ? currentIndex : 0;
    playIndex(base + delta);
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
        elapsed.textContent = formatTime(current);
        duration.textContent = formatTime(total);
        if (total > 0 && document.activeElement !== seek) {
          seek.value = String(Math.round((current / total) * 1000));
        }
      } catch {}
    }, 750);
  }

  playButton.addEventListener('click', togglePlayback);
  prevButton.addEventListener('click', () => playRelative(-1));
  nextButton.addEventListener('click', () => playRelative(1));
  shuffleButton.addEventListener('click', playRandom);

  trackList.addEventListener('click', (event) => {
    const button = event.target.closest('.track-main');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (Number.isInteger(index)) playIndex(index);
  });

  search.addEventListener('input', filterLibrary, { passive: true });
  search.addEventListener('search', filterLibrary, { passive: true });

  volume.addEventListener('input', () => {
    try { player?.setVolume(Number(volume.value) || 0); } catch {}
  }, { passive: true });

  seek.addEventListener('change', () => {
    if (!player) return;
    try {
      const total = Number(player.getDuration()) || 0;
      if (total > 0) player.seekTo((Number(seek.value) / 1000) * total, true);
    } catch {}
  });

  // Make controls interactive before doing any network work or rendering the full library.
  updateNowPlaying();
  renderLibrary();
  setStatus('READY · FAST');

  // Warm YouTube after first paint without blocking input or library rendering.
  const warm = () => ensurePlayer().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 1500 });
  else setTimeout(warm, 700);

  // Old workers are unnecessary in fast mode. Remove them in the background only.
  setTimeout(() => {
    navigator.serviceWorker?.getRegistrations?.()
      .then((registrations) => Promise.all(registrations
        .filter((registration) => registration.scope.includes('/winampmusic/'))
        .map((registration) => registration.unregister())))
      .catch(() => {});
    caches?.keys?.()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('winampmusic-shell-'))
        .map((key) => caches.delete(key))))
      .catch(() => {});
  }, 2500);

  console.info(`[Winamp Music] ${VERSION} ready`, { tracks: library.length });
})();
