(() => {
  if (window.__WINAMP_MUSIC_BOOT_V135__) return;
  window.__WINAMP_MUSIC_BOOT_V135__ = true;

  const YOUTUBE_API = 'https://www.youtube.com/iframe_api';
  let youtubePromise = null;

  // Safari can expose navigator.mediaSession while MediaMetadata or parts of the
  // Media Session implementation are missing. app.js used to throw inside a
  // click handler in that case, making Play/Next/track clicks look completely dead.
  // Keep the native implementation when it works, but never let optional media
  // integration abort core playback controls.
  if (typeof window.setNowPlaying === 'function' && !window.__WINAMP_SAFE_NOW_PLAYING__) {
    const nativeSetNowPlaying = window.setNowPlaying;
    window.setNowPlaying = function safeSetNowPlaying(track) {
      try {
        return nativeSetNowPlaying(track);
      } catch (error) {
        const title = document.getElementById('nowTitle');
        const artist = document.getElementById('nowArtist');
        if (title) title.textContent = track?.title || 'No track selected';
        if (artist) artist.textContent = track?.artist || 'Import a YouTube playlist to begin';
        console.warn('[Winamp Music] optional Media Session metadata failed; playback continues', error);
        return undefined;
      }
    };
    window.__WINAMP_SAFE_NOW_PLAYING__ = true;
  }

  if (typeof window.onPlayerStateChange === 'function' && !window.__WINAMP_SAFE_PLAYER_STATE__) {
    const nativePlayerStateChange = window.onPlayerStateChange;
    window.onPlayerStateChange = function safePlayerStateChange(event) {
      try {
        return nativePlayerStateChange(event);
      } catch (error) {
        // Media Session playbackState is optional. Do not let it kill YouTube
        // state handling after audio already started.
        const status = document.getElementById('status');
        const play = document.getElementById('playButton');
        const state = window.YT?.PlayerState;
        if (state && event?.data === state.PLAYING) {
          if (status) status.textContent = 'PLAYING';
          if (play) play.textContent = '⏸';
        } else if (state && event?.data === state.PAUSED) {
          if (status) status.textContent = 'PAUSED';
          if (play) play.textContent = '▶';
        }
        console.warn('[Winamp Music] optional Media Session state update failed; playback continues', error);
        return undefined;
      }
    };
    window.__WINAMP_SAFE_PLAYER_STATE__ = true;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw-v135.js').catch(() => {});
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) {
      window.onYouTubeIframeAPIReady?.();
      return Promise.resolve(window.YT);
    }
    if (youtubePromise) return youtubePromise;

    youtubePromise = new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-winamp-youtube-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = YOUTUBE_API;
        script.async = true;
        script.dataset.winampYoutubeApi = '1';
        document.head.appendChild(script);
      }

      const started = Date.now();
      const timer = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(timer);
          resolve(window.YT);
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          youtubePromise = null;
          reject(new Error('YouTube player API timeout'));
        }
      }, 100);

      script.addEventListener('error', () => {
        clearInterval(timer);
        youtubePromise = null;
        reject(new Error('YouTube player API failed to load'));
      }, { once: true });
    });

    return youtubePromise;
  }

  function retryPendingPlayback() {
    const status = document.getElementById('status');
    const play = document.getElementById('playButton');
    if (!status || !play) return;

    const started = Date.now();
    const timer = setInterval(() => {
      if (status.textContent.trim().toUpperCase() === 'READY') {
        clearInterval(timer);
        play.click();
      } else if (Date.now() - started > 16000) {
        clearInterval(timer);
      }
    }, 120);
  }

  function requestPlayerForInteraction(event) {
    const target = event.target instanceof Element ? event.target.closest('#playButton,.track-main') : null;
    if (!target) return;
    queueMicrotask(() => {
      const status = document.getElementById('status');
      if (status?.textContent.trim().toUpperCase() !== 'PLAYER LOADING') return;
      loadYouTubeApi().then(retryPendingPlayback).catch((error) => {
        console.warn('[Winamp Music] YouTube API unavailable', error);
        if (status) status.textContent = 'YOUTUBE PLAYER UNAVAILABLE · TAP AGAIN TO RETRY';
      });
    });
  }

  document.addEventListener('click', requestPlayerForInteraction, false);

  const warm = () => setTimeout(() => loadYouTubeApi().catch(() => {}), 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', warm, { once: true });
  else warm();

  window.winampMusicLoadYouTubeApi = loadYouTubeApi;
})();
