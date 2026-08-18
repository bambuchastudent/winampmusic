(() => {
  if (window.__WINAMP_CORE_BOOT_140__) return;
  window.__WINAMP_CORE_BOOT_140__ = true;
  window.__WINAMP_MUSIC_RUNTIME__ = '1.4.0-core';

  const status = () => document.getElementById('status');
  const play = () => document.getElementById('playButton');
  let youtubePromise = null;
  let retryTimer = null;

  function safeOptionalApis() {
    if (typeof window.setNowPlaying === 'function' && !window.__WINAMP_SAFE_NOW_PLAYING_140__) {
      const original = window.setNowPlaying;
      window.setNowPlaying = (track) => {
        try {
          return original(track);
        } catch (error) {
          const title = document.getElementById('nowTitle');
          const artist = document.getElementById('nowArtist');
          if (title) title.textContent = track?.title || 'No track selected';
          if (artist) artist.textContent = track?.artist || 'YouTube';
          console.warn('[Winamp Music] optional Media Session metadata ignored', error);
        }
      };
      window.__WINAMP_SAFE_NOW_PLAYING_140__ = true;
    }

    if (typeof window.onPlayerStateChange === 'function' && !window.__WINAMP_SAFE_PLAYER_STATE_140__) {
      const original = window.onPlayerStateChange;
      window.onPlayerStateChange = (event) => {
        try {
          return original(event);
        } catch (error) {
          const state = window.YT?.PlayerState;
          if (state && event?.data === state.PLAYING) {
            if (status()) status().textContent = 'PLAYING';
            if (play()) play().textContent = '⏸';
          } else if (state && event?.data === state.PAUSED) {
            if (status()) status().textContent = 'PAUSED';
            if (play()) play().textContent = '▶';
          }
          console.warn('[Winamp Music] optional Media Session state ignored', error);
        }
      };
      window.__WINAMP_SAFE_PLAYER_STATE_140__ = true;
    }
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) {
      try { window.onYouTubeIframeAPIReady?.(); } catch {}
      return Promise.resolve(window.YT);
    }
    if (youtubePromise) return youtubePromise;

    youtubePromise = new Promise((resolve, reject) => {
      const old = document.querySelector('script[data-winamp-core-youtube]');
      const script = old || document.createElement('script');
      if (!old) {
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.winampCoreYoutube = '1';
        document.head.appendChild(script);
      }

      const started = Date.now();
      const timer = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(timer);
          try { window.onYouTubeIframeAPIReady?.(); } catch {}
          resolve(window.YT);
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          youtubePromise = null;
          reject(new Error('YouTube API timeout'));
        }
      }, 100);

      script.addEventListener('error', () => {
        clearInterval(timer);
        youtubePromise = null;
        reject(new Error('YouTube API failed to load'));
      }, { once: true });
    });

    return youtubePromise;
  }

  function resumeSelectedTrack() {
    clearInterval(retryTimer);
    const started = Date.now();
    retryTimer = setInterval(() => {
      const text = status()?.textContent?.trim().toUpperCase() || '';
      if (text === 'READY') {
        clearInterval(retryTimer);
        retryTimer = null;
        play()?.click();
      } else if (text === 'PLAYING' || Date.now() - started > 16000) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 100);
  }

  function ensurePlayerAfterUserClick(event) {
    const control = event.target instanceof Element
      ? event.target.closest('#playButton,.track-main')
      : null;
    if (!control) return;

    queueMicrotask(() => {
      if (status()?.textContent?.trim().toUpperCase() !== 'PLAYER LOADING') return;
      loadYouTubeApi()
        .then(resumeSelectedTrack)
        .catch((error) => {
          console.warn('[Winamp Music] YouTube player unavailable', error);
          if (status()) status().textContent = 'YOUTUBE PLAYER UNAVAILABLE';
        });
    });
  }

  safeOptionalApis();
  document.addEventListener('click', ensurePlayerAfterUserClick, false);

  // Warm only after the UI is fully interactive; never block first paint or taps.
  setTimeout(() => loadYouTubeApi().catch(() => {}), 800);

  window.winampMusicLoadYouTubeApi = loadYouTubeApi;
  console.info('[Winamp Music] core 1.4.0 ready');
})();
