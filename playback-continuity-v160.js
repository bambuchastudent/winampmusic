(() => {
  'use strict';
  if (window.__AMP_MUSIC_PLAYBACK_CONTINUITY_160__) return;
  window.__AMP_MUSIC_PLAYBACK_CONTINUITY_160__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const CHECKPOINT_KEY = 'winampmusic.playback.checkpoints.v1';
  const ACTIVE_KEY = 'winampmusic.playback.active-context.v1';
  const CONTEXT_KEY = 'library:local';
  const SAVE_INTERVAL_MS = 3000;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const $ = (id) => document.getElementById(id);
  const ui = { status: $('status'), elapsed: $('elapsed'), duration: $('duration'), seek: $('seek') };

  let restoring = false;
  let pendingResume = null;
  let lastSavedPositionMs = -1;
  let lastSavedTrackKey = '';

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }

  function readLibrary() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function currentIndex() {
    const value = Number(localStorage.getItem(CURRENT_KEY));
    const library = readLibrary();
    return Number.isInteger(value) && value >= 0 && value < library.length ? value : -1;
  }

  function parseTime(text) {
    const parts = clean(text).split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    return 0;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function trackKey(track) {
    const title = clean(track?.title);
    const artist = clean(track?.artist);
    if (!title) return '';
    if (typeof window.ampMusicRecordingId === 'function') return clean(window.ampMusicRecordingId(title, artist));
    const text = `${title}\u0000${artist}`.toLowerCase();
    let a = 0x811c9dc5; let b = 0x1b873593;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 2246822519) >>> 0;
    }
    return `U-${a.toString(36).padStart(7, '0')}${(b % 46656).toString(36).padStart(3, '0')}`;
  }

  function readStore() {
    const value = readJson(CHECKPOINT_KEY, { v: 1, checkpoints: {} });
    if (!value || value.v !== 1 || !value.checkpoints || typeof value.checkpoints !== 'object') return { v: 1, checkpoints: {} };
    return value;
  }

  function readCheckpoint(contextKey = CONTEXT_KEY) {
    return readStore().checkpoints?.[contextKey] || null;
  }

  function writeCheckpoint(checkpoint) {
    const store = readStore();
    store.checkpoints[CONTEXT_KEY] = checkpoint;
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(store));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ kind: 'library', id: 'local' }));
  }

  function saveCheckpoint(force = false) {
    if (restoring) return;
    const library = readLibrary();
    const index = currentIndex();
    const track = library[index];
    if (!track) return;
    const key = trackKey(track);
    if (!key) return;

    const positionMs = Math.max(0, parseTime(ui.elapsed?.textContent));
    const durationMs = Math.max(0, parseTime(ui.duration?.textContent));
    const status = clean(ui.status?.textContent).toUpperCase();
    const playing = /PLAYING/.test(status);
    const meaningfulState = playing || /PAUSED|READY/.test(status);
    const previous = readCheckpoint();

    // Boot renders 00:00 before an adapter is ready. Never let that erase a useful checkpoint.
    if (!force && !meaningfulState && positionMs === 0 && previous?.track?.key === key && Number(previous.positionMs) > 0) return;
    if (!force && lastSavedTrackKey === key && Math.abs(positionMs - lastSavedPositionMs) < 1500) return;

    writeCheckpoint({
      v: 1,
      context: { kind: 'library', id: 'local' },
      track: { key, title: clean(track.title), artist: clean(track.artist) },
      positionMs,
      durationMs,
      wasPlaying: playing,
      sourceHint: clean(track.id),
      updatedAt: new Date().toISOString(),
    });
    lastSavedTrackKey = key;
    lastSavedPositionMs = positionMs;
  }

  function paintPosition(positionMs, durationMs) {
    const safePosition = Math.max(0, Number(positionMs) || 0);
    const safeDuration = Math.max(0, Number(durationMs) || 0);
    if (ui.elapsed) ui.elapsed.textContent = formatTime(safePosition);
    if (ui.duration && safeDuration > 0) ui.duration.textContent = formatTime(safeDuration);
    if (ui.seek && safeDuration > 0) ui.seek.value = String(Math.max(0, Math.min(1000, Math.round((safePosition / safeDuration) * 1000))));
  }

  async function seekWhenPlaybackStarts(resume) {
    if (!resume || resume.positionMs < 1000 || !ui.seek) return;
    const targetMs = resume.positionMs;
    const started = Date.now();
    let attempts = 0;
    while (Date.now() - started < 8000 && pendingResume === resume) {
      const status = clean(ui.status?.textContent).toUpperCase();
      if (/PLAYING/.test(status)) {
        const durationMs = parseTime(ui.duration?.textContent) || resume.durationMs;
        if (durationMs > 0) {
          ui.seek.value = String(Math.max(0, Math.min(1000, Math.round((targetMs / durationMs) * 1000))));
          ui.seek.dispatchEvent(new Event('change', { bubbles: true }));
          attempts += 1;
          if (attempts >= 3) break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    if (pendingResume === resume) {
      paintPosition(targetMs, resume.durationMs);
      pendingResume = null;
      saveCheckpoint(true);
    }
  }

  function startPendingResume(resume) {
    if (!resume) return;
    setTimeout(() => void seekWhenPlaybackStarts(resume), 0);
  }

  function armResumeFromEvent(event) {
    if (!pendingResume) return;
    const target = event.target?.closest?.('button, .track-main');
    if (!target) return;

    if (target.id === 'playButton') {
      const resume = pendingResume;
      // FAST captured its numeric cursor before this lazy module loaded. Own the
      // first resumed Play so stable identity, not that stale index, wins.
      if (typeof window.playIndex === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        void window.playIndex(resume.index);
      }
      startPendingResume(resume);
      return;
    }

    if (target.classList?.contains('track-main')) {
      const index = Number(target.dataset.index);
      if (index === pendingResume.index) startPendingResume(pendingResume);
      else pendingResume = null;
      return;
    }

    if (target.id === 'prevButton' || target.id === 'nextButton') {
      const resume = pendingResume;
      const library = readLibrary();
      if (library.length && typeof window.playIndex === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const delta = target.id === 'prevButton' ? -1 : 1;
        void window.playIndex((resume.index + delta + library.length) % library.length);
      }
      pendingResume = null;
      return;
    }

    if (target.id === 'shuffleButton') {
      const resume = pendingResume;
      const library = readLibrary();
      if (library.length && typeof window.playIndex === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        let index = resume.index;
        if (library.length > 1) while (index === resume.index) index = Math.floor(Math.random() * library.length);
        void window.playIndex(index);
      }
      pendingResume = null;
      return;
    }

    if (target.id === 'radioButton') pendingResume = null;
  }

  function restoreLibrary() {
    if (new URLSearchParams(location.search).has('a')) return false;
    const active = readJson(ACTIVE_KEY, null);
    if (active && (active.kind !== 'library' || active.id !== 'local')) return false;
    const checkpoint = readCheckpoint();
    if (!checkpoint?.track?.key || Number(checkpoint.positionMs) < 0) return false;

    const library = readLibrary();
    const index = library.findIndex((track) => trackKey(track) === checkpoint.track.key);
    if (index < 0) return false;

    restoring = true;
    try {
      localStorage.setItem(CURRENT_KEY, String(index));
      paintPosition(checkpoint.positionMs, checkpoint.durationMs);
      pendingResume = {
        index,
        trackKey: checkpoint.track.key,
        positionMs: Math.max(0, Number(checkpoint.positionMs) || 0),
        durationMs: Math.max(0, Number(checkpoint.durationMs) || 0),
      };
      if (ui.status) ui.status.textContent = `READY · RESUME ${formatTime(checkpoint.positionMs)}`;
      lastSavedTrackKey = checkpoint.track.key;
      lastSavedPositionMs = Number(checkpoint.positionMs) || 0;
      return true;
    } finally {
      restoring = false;
    }
  }

  document.addEventListener('click', armResumeFromEvent, true);
  ui.seek?.addEventListener('change', () => setTimeout(() => saveCheckpoint(true), 0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveCheckpoint(true); });
  window.addEventListener('pagehide', () => saveCheckpoint(true));

  const interval = setInterval(() => saveCheckpoint(false), SAVE_INTERVAL_MS);
  interval?.unref?.();

  window.ampMusicPlaybackContinuity = {
    key: CHECKPOINT_KEY,
    trackKey,
    read: readCheckpoint,
    save: () => saveCheckpoint(true),
    restore: restoreLibrary,
    pending: () => pendingResume,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(restoreLibrary, 0), { once: true });
  } else {
    setTimeout(restoreLibrary, 0);
  }
})();
