(() => {
  'use strict';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const CHECKPOINT_KEY = 'winampmusic.playback.checkpoints.v1';
  const ACTIVE_KEY = 'winampmusic.playback.active-context.v1';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }

  function recordingKey(title, artist) {
    const text = `${clean(title)}\u0000${clean(artist)}`.toLowerCase();
    if (!clean(title)) return '';
    let a = 0x811c9dc5; let b = 0x1b873593;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 2246822519) >>> 0;
    }
    return `U-${a.toString(36).padStart(7, '0')}${(b % 46656).toString(36).padStart(3, '0')}`;
  }

  const active = readJson(ACTIVE_KEY, null);
  if (active && (active.kind !== 'library' || active.id !== 'local')) return;
  if (new URLSearchParams(location.search).has('a')) return;
  const store = readJson(CHECKPOINT_KEY, null);
  const checkpoint = store?.v === 1 ? store.checkpoints?.['library:local'] : null;
  if (!checkpoint?.track?.key) return;
  const library = readJson(LIBRARY_KEY, []);
  if (!Array.isArray(library)) return;
  const index = library.findIndex((track) => recordingKey(track?.title, track?.artist) === checkpoint.track.key);
  if (index >= 0) localStorage.setItem(CURRENT_KEY, String(index));
})();
