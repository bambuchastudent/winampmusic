(() => {
  if (window.__WINAMP_MUSIC_BOOT_V134__) return;
  window.__WINAMP_MUSIC_BOOT_V134__ = true;

  const YOUTUBE_API = 'https://www.youtube.com/iframe_api';
  let youtubePromise = null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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
      loadYouTubeApi().then(retryPendingPlayback).catch(() => {
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
