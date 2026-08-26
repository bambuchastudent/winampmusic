(() => {
  'use strict';
  if (window.__AMP_MUSIC_PLAYBACK_CONTINUITY_160__) return;
  window.__AMP_MUSIC_PLAYBACK_CONTINUITY_160__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CHECKPOINT_KEY = 'winampmusic.playback.checkpoints.v1';
  const ACTIVE_KEY = 'winampmusic.playback.active-context.v1';
  const CONTEXT_KEY = 'library:local';
  const SAVE_INTERVAL_MS = 3000;
  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  const ui = {
    status: $('status'), elapsed: $('elapsed'), duration: $('duration'), seek: $('seek'),
  };

  let restoring = false;
  let lastSavedPositionMs = -1;
  let lastSavedTrackKey = '';

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readLibrary() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
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
    const text = `${title}\u0000${artist}`.toLocaleLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    return `r_${hash.toString(36)}`;
  }

  function readStore() {
    const value = readJson(CHECKPOINT_KEY, { v: 1, checkpoints: {} });
    if (!value || value.v !== 1 || typeof value.checkpoints !== 'object') return { v: 1, checkpoints: {} };
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

  function currentSnapshot() {
    const direct = window.ampMusicGetDirectPlaybackSnapshot?.();
    if (direct?.active && Number.isInteger(direct.index)) return direct;
    const youtube = window.ampMusicGetPlaybackSnapshot?.();
    if (youtube && Number.isInteger(youtube.index)) return youtube;
    return null;
  }

  function saveCheckpoint(force = false) {
    if (restoring) return;
    const library = readLibrary();
    const snapshot = currentSnapshot();
    if (!snapshot || !library[snapshot.index]) return;
    const track = library[snapshot.index];
    const key = trackKey(track);
    if (!key) return;
    const positionMs = Math.max(0, Math.round(Number(snapshot.positionMs) || parseTime(ui.elapsed?.textContent)));
    const durationMs = Math.max(0, Math.round(Number(snapshot.durationMs) || parseTime(ui.duration?.textContent)));
    const status = clean(ui.status?.textContent).toUpperCase();
    const activeState = snapshot.playing || /PAUSED|READY|PLAYING/.test(status);
    const previous = readCheckpoint();

    // Do not replace a useful resume point with boot-time 00:00 before an adapter is ready.
    if (!force && !activeState && positionMs === 0 && previous?.track?.key === key && Number(previous.positionMs) > 0) return;
    if (!force && lastSavedTrackKey === key && Math.abs(positionMs - lastSavedPositionMs) < 1500) return;

    writeCheckpoint({
      v: 1,
      context: { kind: 'library', id: 'local' },
      track: { key, title: clean(track.title), artist: clean(track.artist) },
      positionMs,
      durationMs,
      wasPlaying: Boolean(snapshot.playing),
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

  async function restoreLibrary() {
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
      window.ampMusicSelectIndex?.(index);
      paintPosition(checkpoint.positionMs, checkpoint.durationMs);
      const track = library[index];
      const direct = window.ampMusicRadio150?.wantsDirect?.(track);
      const options = { positionMs: Number(checkpoint.positionMs) || 0, autoplay: false, restore: true };
      if (direct && typeof window.ampMusicPlayDirectIndex === 'function') {
        await window.ampMusicPlayDirectIndex(index, options);
      } else if (typeof window.playIndex === 'function') {
        await window.playIndex(index, { startSeconds: options.positionMs / 1000, autoplay: false, restore: true });
      }
      paintPosition(checkpoint.positionMs, checkpoint.durationMs);
      if (ui.status && /^(READY|PAUSED|STARTING|LOADING)/i.test(clean(ui.status.textContent))) {
        ui.status.textContent = `READY · RESUME ${formatTime(checkpoint.positionMs)}`;
      }
      lastSavedTrackKey = checkpoint.track.key;
      lastSavedPositionMs = Number(checkpoint.positionMs) || 0;
      return true;
    } finally {
      restoring = false;
    }
  }

  const interval = setInterval(() => saveCheckpoint(false), SAVE_INTERVAL_MS);
  interval?.unref?.();

  ui.seek?.addEventListener('change', () => setTimeout(() => saveCheckpoint(true), 0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveCheckpoint(true); });
  window.addEventListener('pagehide', () => saveCheckpoint(true));
  window.addEventListener('ampula:playback-state', () => saveCheckpoint(true));

  window.ampMusicPlaybackContinuity = {
    key: CHECKPOINT_KEY,
    trackKey,
    read: readCheckpoint,
    save: () => saveCheckpoint(true),
    restore: restoreLibrary,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => void restoreLibrary(), 0), { once: true });
  } else {
    setTimeout(() => void restoreLibrary(), 0);
  }
})();
