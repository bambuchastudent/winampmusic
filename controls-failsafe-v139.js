(() => {
  if (window.__WINAMP_MUSIC_CONTROLS_V139__) return;
  window.__WINAMP_MUSIC_CONTROLS_V139__ = true;
  window.__WINAMP_CONTROLS_RUNTIME__ = '1.3.9';
  document.documentElement.dataset.winampControlsRuntime = '1.3.9';

  const ACTION_SELECTOR = '#playButton,#prevButton,#nextButton,#shuffleButton,.track-main';

  const style = document.createElement('style');
  style.id = 'winampNativeControls139';
  style.textContent = `
    .controls,.controls button,.track,.track-main{
      position:relative!important;
      z-index:2147483000!important;
      pointer-events:auto!important;
      touch-action:manipulation!important;
    }
    .controls button,.track-main{
      -webkit-tap-highlight-color:rgba(255,255,255,.14)!important;
    }
    body:not(.video-large) .youtube-player,
    body:not(.video-large) .youtube-player iframe{
      pointer-events:none!important;
    }
  `;
  document.head.appendChild(style);

  function directAction(event) {
    return event.target instanceof Element ? event.target.closest(ACTION_SELECTOR) : null;
  }

  function actionUnderPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const stack = document.elementsFromPoint?.(x, y) || [];
    for (const element of stack) {
      const candidate = element instanceof Element ? element.closest(ACTION_SELECTOR) : null;
      if (candidate) return candidate;
    }
    return null;
  }

  function overlayFallback(event) {
    // Native button clicks are authoritative. Never prevent, stop, re-dispatch,
    // or otherwise interfere when the pointer actually landed on a control.
    if (directAction(event)) return;

    // Only rescue the genuine overlay case: the pointer hit something else but
    // elementsFromPoint reveals a Winamp control underneath it. Calling click()
    // synchronously from pointerup preserves the app.js event pipeline and lets
    // boot-v134.js observe the same click to initialize YouTube playback.
    const control = actionUnderPoint(event.clientX, event.clientY);
    if (!control) return;
    control.click();
  }

  document.addEventListener('pointerup', overlayFallback, true);

  console.info('[Winamp Music] native controls 1.3.9 ready');
})();
