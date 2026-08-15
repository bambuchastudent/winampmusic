(() => {
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const CONTINUITY_KEY = 'winampmusic.playbackContinuity.v1';
  const MAX_RESUME_AGE_MS = 24 * 60 * 60 * 1000;

  const status = document.getElementById('status');
  const elapsed = document.getElementById('elapsed');
  const duration = document.getElementById('duration');
  const volume = document.getElementById('volume');
  const controls = document.querySelector('.controls');

  if (!status || !elapsed || !duration || !volume || !controls) return;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function validVideoId(value) {
    return /^[\w-]{6,20}$/.test(String(value || ''));
  }

  function parseTime(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function currentTrackId() {
    const state = readJson(PLAYER_STATE_KEY, {});
    return validVideoId(state.currentId) ? state.currentId : '';
  }

  function library() {
    const value = readJson(LIBRARY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveSnapshot() {
    const id = currentTrackId();
    if (!id) return;

    const stateText = String(status.textContent || '').trim().toUpperCase();
    const active = stateText === 'PLAYING' || stateText === 'PAUSED';
    const seconds = parseTime(elapsed.textContent);
    const total = parseTime(duration.textContent);
    const previous = readJson(CONTINUITY_KEY, {});

    // Do not overwrite a useful resume point with the initial 00:00 UI while
    // the player is still booting after a reload.
    if (!active && seconds === 0 && previous.id === id && Number(previous.seconds) > 0) return;

    localStorage.setItem(CONTINUITY_KEY, JSON.stringify({
      v: 1,
      id,
      seconds,
      duration: total,
      volume: Number(volume.value) || 0,
      wasPlaying: stateText === 'PLAYING',
      updatedAt: Date.now(),
    }));
  }

  function validSnapshot() {
    const snapshot = readJson(CONTINUITY_KEY, null);
    if (!snapshot || snapshot.v !== 1 || !validVideoId(snapshot.id)) return null;
    if (!Number.isFinite(Number(snapshot.updatedAt)) || Date.now() - Number(snapshot.updatedAt) > MAX_RESUME_AGE_MS) return null;
    if (Number(snapshot.seconds) < 2) return null;
    if (!library().some((track) => track?.id === snapshot.id)) return null;
    return snapshot;
  }

  function ensureStyles() {
    if (document.getElementById('playbackContinuityStyles')) return;
    const style = document.createElement('style');
    style.id = 'playbackContinuityStyles';
    style.textContent = `
      .resume-session-button{width:100%;min-height:42px;margin-top:8px;border:1px solid #8f7724;border-radius:8px;background:linear-gradient(#ffe680,#c9a630);color:#171717;font-weight:900}
      .resume-session-button:disabled{opacity:.65}
    `;
    document.head.appendChild(style);
  }

  async function seekWhenReady(snapshot) {
    const seek = document.getElementById('seek');
    const started = Date.now();
    while (Date.now() - started < 9000) {
      if (currentTrackId() !== snapshot.id) return false;
      const liveDuration = parseTime(duration.textContent) || Number(snapshot.duration) || 0;
      if (seek && liveDuration > 0) {
        const target = Math.max(0, Math.min(Number(snapshot.seconds) || 0, Math.max(0, liveDuration - 1)));
        seek.value = String(Math.max(0, Math.min(1000, Math.round((target / liveDuration) * 1000))));
        seek.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  }

  function installResumeButton() {
    const snapshot = validSnapshot();
    if (!snapshot || document.getElementById('resumePlaybackButton')) return;

    ensureStyles();
    const button = document.createElement('button');
    button.id = 'resumePlaybackButton';
    button.type = 'button';
    button.className = 'resume-session-button';
    button.textContent = `Resume from ${formatTime(snapshot.seconds)}`;
    controls.insertAdjacentElement('afterend', button);

    button.addEventListener('click', async () => {
      const items = library();
      const index = items.findIndex((track) => track?.id === snapshot.id);
      if (index < 0 || typeof window.playIndex !== 'function') {
        button.remove();
        return;
      }

      button.disabled = true;
      button.textContent = `Resuming ${formatTime(snapshot.seconds)}…`;
      if (Number.isFinite(Number(snapshot.volume))) {
        volume.value = String(Math.max(0, Math.min(100, Number(snapshot.volume))));
        volume.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // This runs from an explicit user gesture, so browser autoplay rules can
      // allow the normal YouTube player to start. A closed tab itself cannot
      // keep a web page alive; this restores the last session after reopening.
      window.playIndex(index);
      await seekWhenReady(snapshot);
      button.remove();
      saveSnapshot();
    });
  }

  setInterval(saveSnapshot, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSnapshot();
  });
  window.addEventListener('pagehide', saveSnapshot);
  window.addEventListener('freeze', saveSnapshot);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(installResumeButton, 250), { once: true });
  } else {
    setTimeout(installResumeButton, 250);
  }
})();
