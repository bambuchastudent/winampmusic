(() => {
  if (window.__WINAMP_MUSIC_CONTROLS_V138__) return;
  window.__WINAMP_MUSIC_CONTROLS_V138__ = true;
  window.__WINAMP_CONTROLS_RUNTIME__ = '1.3.8';
  document.documentElement.dataset.winampControlsRuntime = '1.3.8';

  const ACTION_SELECTOR = '#playButton,#prevButton,#nextButton,#shuffleButton,.track-main';
  const status = () => document.getElementById('status');
  let lastPointerKey = '';
  let lastPointerAt = 0;
  let youtubePromise = null;
  let resumeTimer = null;

  const style = document.createElement('style');
  style.id = 'winampHardControls138';
  style.textContent = `
    .controls,.controls button,.track,.track-main{
      position:relative!important;
      z-index:2147483000!important;
      pointer-events:auto!important;
      touch-action:manipulation!important;
    }
    .controls button,.track-main{
      -webkit-tap-highlight-color:rgba(255,255,255,.14)!important;
      user-select:none;
      -webkit-user-select:none;
    }
    body:not(.video-large) .youtube-player,
    body:not(.video-large) .youtube-player iframe{
      pointer-events:none!important;
    }
  `;
  document.head.appendChild(style);

  function actionableFromEvent(event) {
    const direct = event.target instanceof Element ? event.target.closest(ACTION_SELECTOR) : null;
    if (direct) return direct;
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const stack = document.elementsFromPoint?.(event.clientX, event.clientY) || [];
    for (const element of stack) {
      const candidate = element instanceof Element ? element.closest(ACTION_SELECTOR) : null;
      if (candidate) return candidate;
    }
    return null;
  }

  function actionKey(element) {
    if (!element) return '';
    if (element.classList.contains('track-main')) {
      return `track:${element.closest('.track')?.dataset.index ?? ''}`;
    }
    return element.id || '';
  }

  function ownLoader() {
    if (window.YT?.Player) {
      try { window.onYouTubeIframeAPIReady?.(); } catch {}
      return Promise.resolve(window.YT);
    }
    if (typeof window.winampMusicLoadYouTubeApi === 'function') {
      try { return Promise.resolve(window.winampMusicLoadYouTubeApi()); } catch {}
    }
    if (youtubePromise) return youtubePromise;

    youtubePromise = new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-winamp-hard-youtube-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.winampHardYoutubeApi = '1';
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

  function resumeWhenReady(callback) {
    clearInterval(resumeTimer);
    const started = Date.now();
    resumeTimer = setInterval(() => {
      const text = status()?.textContent?.trim().toUpperCase() || '';
      if (text === 'READY' || text === 'PAUSED') {
        clearInterval(resumeTimer);
        resumeTimer = null;
        try { callback?.(); } catch (error) { console.warn('[Winamp Music] hard control resume failed', error); }
      } else if (text === 'PLAYING' || Date.now() - started > 16000) {
        clearInterval(resumeTimer);
        resumeTimer = null;
      }
    }, 100);
  }

  function ensurePlaybackBackend(resume) {
    const text = status()?.textContent?.trim().toUpperCase() || '';
    if (window.YT?.Player && text !== 'PLAYER LOADING') return;
    ownLoader()
      .then(() => {
        try { window.onYouTubeIframeAPIReady?.(); } catch {}
        resumeWhenReady(resume);
      })
      .catch((error) => {
        const node = status();
        if (node) node.textContent = 'YOUTUBE PLAYER UNAVAILABLE · TAP AGAIN';
        console.warn('[Winamp Music] hard control YouTube loader failed', error);
      });
  }

  function callGlobal(name, ...args) {
    const fn = window[name];
    if (typeof fn !== 'function') return false;
    try {
      fn(...args);
      return true;
    } catch (error) {
      console.error(`[Winamp Music] ${name} failed`, error);
      const node = status();
      if (node) node.textContent = 'PLAYER ERROR · TAP AGAIN';
      return false;
    }
  }

  function runAction(element) {
    if (!element) return;
    let resume = null;

    if (element.classList.contains('track-main')) {
      const index = Number(element.closest('.track')?.dataset.index);
      if (!Number.isInteger(index)) return;
      if (!callGlobal('playIndex', index)) return;
      resume = () => callGlobal('togglePlayback');
      ensurePlaybackBackend(resume);
      return;
    }

    if (element.id === 'playButton') {
      if (!callGlobal('togglePlayback')) return;
      resume = () => callGlobal('togglePlayback');
      ensurePlaybackBackend(resume);
      return;
    }

    const map = {
      prevButton: 'playPrevious',
      nextButton: 'playNext',
      shuffleButton: 'playRandom',
    };
    const fn = map[element.id];
    if (!fn || !callGlobal(fn)) return;
    resume = () => callGlobal('togglePlayback');
    ensurePlaybackBackend(resume);
  }

  function handlePointer(event) {
    const element = actionableFromEvent(event);
    if (!element) return;
    const key = actionKey(element);
    lastPointerKey = key;
    lastPointerAt = Date.now();
    event.preventDefault();
    event.stopImmediatePropagation();
    runAction(element);
  }

  function handleClick(event) {
    const element = actionableFromEvent(event);
    if (!element) return;
    const key = actionKey(element);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key && key === lastPointerKey && Date.now() - lastPointerAt < 900) return;
    runAction(element);
  }

  // Pointer-up gives mobile browsers a path that does not depend on synthetic click.
  // Click capture remains for keyboard/mouse and browsers that do not expose Pointer Events.
  document.addEventListener('pointerup', handlePointer, true);
  document.addEventListener('click', handleClick, true);

  // Safari/Chrome Media Session is optional. It must never be allowed to kill playback.
  if (typeof window.setNowPlaying === 'function' && !window.__WINAMP_HARD_SAFE_NOW_PLAYING__) {
    const native = window.setNowPlaying;
    window.setNowPlaying = function hardSafeNowPlaying(track) {
      try { return native(track); }
      catch (error) {
        const title = document.getElementById('nowTitle');
        const artist = document.getElementById('nowArtist');
        if (title) title.textContent = track?.title || 'No track selected';
        if (artist) artist.textContent = track?.artist || 'YouTube';
        console.warn('[Winamp Music] Media Session metadata ignored', error);
        return undefined;
      }
    };
    window.__WINAMP_HARD_SAFE_NOW_PLAYING__ = true;
  }

  console.info('[Winamp Music] hard controls 1.3.8 ready');
})();
