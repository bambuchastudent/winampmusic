(() => {
  'use strict';
  if (window.__WINAMP_FAST_BACKGROUND_150__) return;
  window.__WINAMP_FAST_BACKGROUND_150__ = true;

  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const BACKGROUND_KEY = 'winampmusic.background.v1';
  const MAX_RESUME_AGE_MS = 12 * 60 * 60 * 1000;

  const status = document.getElementById('status');
  const elapsed = document.getElementById('elapsed');
  const duration = document.getElementById('duration');
  const seek = document.getElementById('seek');
  const play = document.getElementById('playButton');
  const previous = document.getElementById('prevButton');
  const next = document.getElementById('nextButton');
  if (!status || !elapsed || !duration || !seek || !play || !previous || !next) return;

  let intendedPlaying = String(status.textContent || '').toUpperCase() === 'PLAYING';
  let resumeInFlight = false;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  };

  const parseTime = (value) => {
    const parts = String(value || '').trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  function currentTrack() {
    const library = readJson(LIBRARY_KEY, []);
    if (!Array.isArray(library) || !library.length) return null;

    const state = readJson(PLAYER_STATE_KEY, {});
    const currentId = String(state?.currentId || '').trim();
    if (currentId) {
      const byId = library.find((track) => String(track?.id || '') === currentId);
      if (byId) return byId;
    }

    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 && index < library.length ? library[index] : null;
  }

  function saveSnapshot() {
    const track = currentTrack();
    if (!track?.id) return;
    const stateText = String(status.textContent || '').trim().toUpperCase();
    const snapshot = {
      v: 2,
      id: String(track.id),
      seconds: parseTime(elapsed.textContent),
      duration: parseTime(duration.textContent),
      wasPlaying: intendedPlaying || stateText === 'PLAYING',
      updatedAt: Date.now(),
    };
    try { localStorage.setItem(BACKGROUND_KEY, JSON.stringify(snapshot)); } catch {}
  }

  function mediaSession() {
    try { return navigator.mediaSession || null; } catch { return null; }
  }

  function syncMetadata() {
    const session = mediaSession();
    const track = currentTrack();
    if (!session || !track || typeof window.MediaMetadata !== 'function') return;
    try {
      session.metadata = new MediaMetadata({
        title: track.title || `YouTube ${track.id}`,
        artist: track.artist || 'YouTube',
        album: track.playlist || 'Winamp Music',
        artwork: track.thumbnail ? [{ src: track.thumbnail }] : [],
      });
    } catch {}
  }

  function syncPlaybackState() {
    const session = mediaSession();
    if (!session) return;
    const text = String(status.textContent || '').trim().toUpperCase();
    try {
      session.playbackState = text === 'PLAYING' ? 'playing' : text === 'PAUSED' ? 'paused' : 'none';
    } catch {}
  }

  function syncPosition() {
    const session = mediaSession();
    if (!session || typeof session.setPositionState !== 'function') return;
    const total = parseTime(duration.textContent);
    const current = parseTime(elapsed.textContent);
    if (!(total > 0) || current < 0 || current > total) return;
    try { session.setPositionState({ duration: total, playbackRate: 1, position: Math.min(total, current) }); } catch {}
  }

  function seekTo(seconds) {
    const total = parseTime(duration.textContent);
    if (!(total > 0) || !Number.isFinite(Number(seconds))) return false;
    const target = Math.max(0, Math.min(total, Number(seconds)));
    seek.value = String(Math.round((target / total) * 1000));
    seek.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function seekBy(delta) {
    return seekTo(parseTime(elapsed.textContent) + Number(delta || 0));
  }

  function installMediaSessionHandlers() {
    const session = mediaSession();
    if (!session || typeof session.setActionHandler !== 'function') return;
    const handlers = {
      play: () => { intendedPlaying = true; play.click(); },
      pause: () => { intendedPlaying = false; play.click(); },
      previoustrack: () => previous.click(),
      nexttrack: () => next.click(),
      seekbackward: (details) => seekBy(-(details?.seekOffset || 10)),
      seekforward: (details) => seekBy(details?.seekOffset || 10),
      seekto: (details) => seekTo(details?.seekTime),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { session.setActionHandler(action, handler); } catch {}
    }
  }

  async function resumeSnapshot() {
    if (resumeInFlight || document.visibilityState !== 'visible') return;
    const snapshot = readJson(BACKGROUND_KEY, null);
    if (!snapshot || !snapshot.wasPlaying || !snapshot.id) return;
    if (!Number.isFinite(Number(snapshot.updatedAt)) || Date.now() - Number(snapshot.updatedAt) > MAX_RESUME_AGE_MS) return;

    const track = currentTrack();
    if (!track || String(track.id) !== String(snapshot.id)) return;
    const stateText = String(status.textContent || '').trim().toUpperCase();
    if (stateText === 'PLAYING') return;

    resumeInFlight = true;
    intendedPlaying = true;
    try {
      play.click();
      const started = Date.now();
      while (Date.now() - started < 5000) {
        if (seekTo(snapshot.seconds || 0)) break;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    } catch {}
    finally { resumeInFlight = false; }
  }

  const observer = new MutationObserver(() => {
    const text = String(status.textContent || '').trim().toUpperCase();
    if (text === 'PLAYING') intendedPlaying = true;
    if (text === 'PAUSED') intendedPlaying = false;
    syncMetadata();
    syncPlaybackState();
  });
  observer.observe(status, { childList: true, characterData: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSnapshot();
    else setTimeout(resumeSnapshot, 250);
    syncMetadata();
    syncPlaybackState();
  });
  window.addEventListener('pagehide', saveSnapshot);
  window.addEventListener('freeze', saveSnapshot);
  window.addEventListener('pageshow', () => setTimeout(resumeSnapshot, 300));

  installMediaSessionHandlers();
  syncMetadata();
  syncPlaybackState();
  setInterval(() => {
    if (String(status.textContent || '').trim().toUpperCase() === 'PLAYING') intendedPlaying = true;
    saveSnapshot();
    syncPosition();
  }, 1500);

  console.info('[Winamp Music] background 1.5.0 ready');
})();
