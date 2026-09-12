(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_BRIDGE_GUARD_1711__) return;
  window.__AMPULA_PLAYBACK_BRIDGE_GUARD_1711__ = true;

  const VERSION = '1.7.11';
  const TRUSTED_MARKER = '__ampulaTrustedResolver164';
  const QUEUE_MARKER = '__ampulaPlaybackQueue170';
  const WRAPPED = '__ampulaWrappedPlayIndex';
  let current = window.playIndex;

  function markerCount(fn, marker) {
    let count = 0;
    const seen = new Set();
    let cursor = fn;
    while (typeof cursor === 'function' && !seen.has(cursor)) {
      seen.add(cursor);
      if (cursor[marker]) count += 1;
      cursor = cursor[WRAPPED];
    }
    return count;
  }

  function hasMarker(fn, marker) {
    return markerCount(fn, marker) > 0;
  }

  function isRedundantLateTrustedWrapper(next, previous) {
    if (typeof next !== 'function' || !next[TRUSTED_MARKER]) return false;
    if (!hasMarker(previous, QUEUE_MARKER) || !hasMarker(next, QUEUE_MARKER)) return false;
    const before = markerCount(previous, TRUSTED_MARKER);
    const after = markerCount(next, TRUSTED_MARKER);
    return before > 0 && after > before;
  }

  try {
    Object.defineProperty(window, 'playIndex', {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (next) => {
        if (isRedundantLateTrustedWrapper(next, current)) {
          console.info('[ÁmpulaMP] playback bridge guard rejected duplicate late trusted-resolver wrapper');
          return;
        }
        current = next;
      },
    });
  } catch (error) {
    console.warn('[ÁmpulaMP] playback bridge guard unavailable', error);
  }

  window.ampulaPlaybackBridgeGuard1711 = {
    version: VERSION,
    markerCount: (marker) => markerCount(current, marker),
    hasMarker: (marker) => hasMarker(current, marker),
    current: () => current,
  };

  console.info('[ÁmpulaMP] playback bridge guard 1.7.11 ready · queue remains authoritative after delayed diagnostics refresh');
})();
