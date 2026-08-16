(() => {
  if (window.__WINAMP_MUSIC_BACKGROUND_V11__) return;
  window.__WINAMP_MUSIC_BACKGROUND_V11__ = true;

  const LIBRARY_KEY = 'winampmusic.library.v1';
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
  const controls = document.querySelector('.controls');

  if (!status || !elapsed || !duration || !seek || !play || !previous || !next || !controls) return;

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
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

  function currentTrack() {
    const playerState = readJson(PLAYER_STATE_KEY, {});
    const library = readJson(LIBRARY_KEY, []);
    if (!Array.isArray(library)) return null;
    return library.find((track) => track?.id === playerState.currentId) || null;
  }

  function saveBackgroundState() {
    const track = currentTrack();
    if (!track?.id) return;
    const stateText = String(status.textContent || '').trim().toUpperCase();
    const snapshot = {
      v: 1,
      id: track.id,
      seconds: parseTime(elapsed.textContent),
      duration: parseTime(duration.textContent),
      wasPlaying: stateText === 'PLAYING',
      hidden: document.visibilityState === 'hidden',
      updatedAt: Date.now(),
    };
    localStorage.setItem(BACKGROUND_KEY, JSON.stringify(snapshot));
  }

  function syncMediaMetadata() {
    if (!('mediaSession' in navigator)) return;
    const track = currentTrack();
    if (!track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || `YouTube ${track.id}`,
        artist: track.artist || 'YouTube',
        album: track.playlist || 'Winamp Music',
        artwork: track.thumbnail ? [{ src: track.thumbnail }] : [],
      });
    } catch {}
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator)) return;
    const total = parseTime(duration.textContent);
    const current = parseTime(elapsed.textContent);
    if (!(total > 0) || current < 0 || current > total) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: total,
        playbackRate: 1,
        position: Math.min(total, current),
      });
    } catch {}
  }

  function seekBy(seconds) {
    const total = parseTime(duration.textContent);
    const current = parseTime(elapsed.textContent);
    if (!(total > 0)) return;
    const target = Math.max(0, Math.min(total, current + seconds));
    seek.value = String(Math.round((target / total) * 1000));
    seek.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function seekTo(seconds) {
    const total = parseTime(duration.textContent);
    if (!(total > 0) || !Number.isFinite(Number(seconds))) return;
    const target = Math.max(0, Math.min(total, Number(seconds)));
    seek.value = String(Math.round((target / total) * 1000));
    seek.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function playerStateText() {
    return String(status.textContent || '').trim().toUpperCase();
  }

  function installMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play: () => { if (playerStateText() !== 'PLAYING') play.click(); },
      pause: () => { if (playerStateText() === 'PLAYING') play.click(); },
      previoustrack: () => previous.click(),
      nexttrack: () => next.click(),
      seekbackward: (details) => seekBy(-(details.seekOffset || 10)),
      seekforward: (details) => seekBy(details.seekOffset || 10),
      seekto: (details) => seekTo(details.seekTime),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }
  }

  function ensureIndicator() {
    let indicator = document.getElementById('backgroundPlaybackStatus');
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.id = 'backgroundPlaybackStatus';
    indicator.className = 'background-playback-status';
    indicator.setAttribute('role', 'status');
    controls.insertAdjacentElement('afterend', indicator);

    const style = document.createElement('style');
    style.id = 'backgroundPlaybackV11Styles';
    style.textContent = `
      .background-playback-status{margin:7px 0 0;padding:6px 9px;border:1px solid #343a46;border-radius:7px;background:#111419;color:#9aa3b2;font-size:10px;font-weight:800;letter-spacing:.06em;text-align:center}
      .background-resume-button{width:100%;min-height:42px;margin-top:7px;border:1px solid #8f7724;border-radius:8px;background:linear-gradient(#ffe680,#c9a630);color:#171717;font-weight:900}
    `;
    document.head.appendChild(style);
    return indicator;
  }

  function updateIndicator() {
    const indicator = ensureIndicator();
    if ('mediaSession' in navigator) {
      indicator.textContent = document.visibilityState === 'hidden'
        ? 'BACKGROUND MODE · SYSTEM CONTROLS ACTIVE'
        : 'BACKGROUND MODE · SYSTEM CONTROLS READY';
    } else {
      indicator.textContent = 'BACKGROUND MODE · SESSION RESUME READY';
    }
  }

  function removeResumeButton() {
    document.getElementById('backgroundResumeButton')?.remove();
  }

  function maybeOfferResume() {
    if (document.visibilityState !== 'visible') return;
    if (playerStateText() === 'PLAYING') {
      removeResumeButton();
      return;
    }
    const snapshot = readJson(BACKGROUND_KEY, null);
    if (!snapshot || snapshot.v !== 1 || !snapshot.wasPlaying) return;
    if (!Number.isFinite(Number(snapshot.updatedAt)) || Date.now() - Number(snapshot.updatedAt) > MAX_RESUME_AGE_MS) return;
    const track = currentTrack();
    if (!track || track.id !== snapshot.id) return;
    if (document.getElementById('backgroundResumeButton')) return;

    const button = document.createElement('button');
    button.id = 'backgroundResumeButton';
    button.type = 'button';
    button.className = 'background-resume-button';
    button.textContent = `Resume playback from ${formatTime(snapshot.seconds)}`;
    ensureIndicator().insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      if (playerStateText() !== 'PLAYING') play.click();
      setTimeout(() => seekTo(snapshot.seconds), 350);
      button.remove();
    }, { once: true });
  }

  function syncPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    const stateText = playerStateText();
    try {
      if (stateText === 'PLAYING') navigator.mediaSession.playbackState = 'playing';
      else if (stateText === 'PAUSED') navigator.mediaSession.playbackState = 'paused';
      else navigator.mediaSession.playbackState = 'none';
    } catch {}
  }

  const observer = new MutationObserver(() => {
    syncMediaMetadata();
    syncPlaybackState();
    if (playerStateText() === 'PLAYING') removeResumeButton();
  });
  observer.observe(status, { childList: true, characterData: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    saveBackgroundState();
    syncMediaMetadata();
    syncPlaybackState();
    updateIndicator();
    if (document.visibilityState === 'visible') setTimeout(maybeOfferResume, 250);
  });
  window.addEventListener('pagehide', saveBackgroundState);
  window.addEventListener('freeze', saveBackgroundState);
  window.addEventListener('pageshow', () => setTimeout(maybeOfferResume, 250));

  installMediaSessionHandlers();
  syncMediaMetadata();
  syncPlaybackState();
  updateIndicator();
  setInterval(() => {
    saveBackgroundState();
    updatePositionState();
  }, 1000);
})();