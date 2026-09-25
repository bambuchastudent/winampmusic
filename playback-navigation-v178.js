(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_NAVIGATION_178__) return;
  window.__AMPULA_PLAYBACK_NAVIGATION_178__ = true;

  const VERSION = '1.7.9';
  const SHUFFLE_KEY = 'winampmusic.playback.shuffle.v1';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const shuffleButton = document.getElementById('shuffleButton');
  const playButton = document.getElementById('playButton');
  const status = document.getElementById('status');
  const artist = document.getElementById('nowArtist');
  let intent = null;
  let shuffleEnabled = false;
  let pendingPlaybackIntent = false;
  let reservedNext = null;

  try { shuffleEnabled = localStorage.getItem(SHUFFLE_KEY) === '1'; } catch {}

  function setIntent(next) {
    intent = next;
    queueMicrotask(() => { if (intent === next) intent = null; });
  }

  function currentIntent() {
    return intent ? { ...intent } : null;
  }

  function ensureModeLine() {
    let line = document.getElementById('playbackModeStatus');
    if (!line) {
      line = document.createElement('div');
      line.id = 'playbackModeStatus';
      line.className = 'playback-mode-status';
      line.style.cssText = 'margin-top:2px;color:#737b88;font:700 9px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.055em;text-transform:uppercase;white-space:normal';
    }

    const source = document.getElementById('nowSource');
    if (source?.parentElement) {
      if (line.previousElementSibling !== source) source.insertAdjacentElement('afterend', line);
    } else if (artist?.parentElement && line.previousElementSibling !== artist) {
      artist.insertAdjacentElement('afterend', line);
    }
    return line;
  }

  function normalizePendingPlaybackControl() {
    if (!playButton) return;
    const buttonText = clean(playButton.textContent);
    const statusText = clean(status?.textContent).toUpperCase();
    if (buttonText === '…') {
      pendingPlaybackIntent = true;
      playButton.dataset.pendingPlayback = '1';
      playButton.textContent = '⏸';
      return;
    }
    if (/^(PLAYING|PAUSED)$/.test(statusText) || /ERROR|UNAVAILABLE|NO SOURCE|INVALID/.test(statusText)) {
      pendingPlaybackIntent = false;
      delete playButton.dataset.pendingPlayback;
    }
  }

  function libraryRows() {
    try { const rows = JSON.parse(localStorage.getItem('winampmusic.library.v1') || '[]'); return Array.isArray(rows) ? rows : []; }
    catch { return []; }
  }

  function ready(track) {
    const queueReady = window.ampulaPlaybackQueue170?.isReady;
    if (queueReady) return queueReady(track);
    if (!/^[A-Za-z0-9_-]{11}$/.test(clean(track?.id))) return false;
    const badges = Array.isArray(track?.badges) ? track.badges : [];
    const fromSongService = track?.spotifyTrackId || track?.appleTrackId || track?.spotifyPlaylistId ||
      badges.some((badge) => /^(Spotify|Apple Music)$/.test(clean(badge))) ||
      /(?:open\.spotify\.com|music\.apple\.com)/i.test(clean(track?.originUrl || track?.sourceUrl));
    return !fromSongService || clean(track.youtubeMatchFinalTrustVersion) === 'music-only-v1.6.7';
  }

  function currentPosition(rows) {
    const index = Number(localStorage.getItem('winampmusic.fast.current.v1'));
    return Number.isInteger(index) && index >= 0 && index < rows.length ? index : -1;
  }

  function nextPreview() {
    const rows = libraryRows();
    const current = currentPosition(rows);
    if (current < 0 || rows.length < 2) return null;
    let index = -1;
    if (shuffleEnabled) {
      const candidates = rows.map((track, i) => i !== current && ready(track) ? `${i}:${clean(track.id)}` : '').filter(Boolean).join('|');
      if (reservedNext?.current === current && reservedNext.candidates === candidates) index = reservedNext.index;
      else {
        index = chooseShuffleIndex(rows, current, ready);
        reservedNext = { current, candidates, index };
      }
    } else {
      reservedNext = null;
      for (let offset = 1; offset < rows.length; offset++) {
        const candidate = (current + offset) % rows.length;
        if (ready(rows[candidate])) { index = candidate; break; }
      }
    }
    return index < 0 ? null : { index, number: index + 1, total: rows.length, title: clean(rows[index].title) || 'Unknown track', artist: clean(rows[index].artist) };
  }

  function renderNext() {
    const mode = ensureModeLine();
    let line = document.getElementById('nextTrackStatus');
    if (!line) {
      line = document.createElement('div');
      line.id = 'nextTrackStatus';
      line.className = 'playback-mode-status';
      line.style.cssText = 'margin-top:3px;color:#acc6a7;font:700 10px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:normal';
    }
    if (mode?.parentElement && line.previousElementSibling !== mode) mode.insertAdjacentElement('afterend', line);
    const next = nextPreview();
    const value = next ? `NEXT · #${next.number}/${next.total} · ${next.title}${next.artist ? ` — ${next.artist}` : ''}` : 'NEXT · WAITING FOR A PLAYABLE TRACK';
    if (line.textContent !== value) line.textContent = value;
  }

  function render() {
    if (shuffleButton) {
      shuffleButton.setAttribute('aria-pressed', shuffleEnabled ? 'true' : 'false');
      shuffleButton.classList.toggle('active', shuffleEnabled);
      shuffleButton.dataset.shuffle = shuffleEnabled ? 'on' : 'off';
      shuffleButton.title = shuffleEnabled ? 'Shuffle on — next track is random' : 'Shuffle off — library order';
    }
    const line = ensureModeLine();
    const text = shuffleEnabled ? 'SHUFFLE · ON · NEXT · RANDOM' : 'SHUFFLE · OFF · ORDER · SEQUENTIAL';
    if (line && clean(line.textContent) !== text) line.textContent = text;
    renderNext();
    normalizePendingPlaybackControl();
  }

  function setShuffleEnabled(value) {
    shuffleEnabled = Boolean(value);
    reservedNext = null;
    try { localStorage.setItem(SHUFFLE_KEY, shuffleEnabled ? '1' : '0'); } catch {}
    render();
    try { window.dispatchEvent(new CustomEvent('ampula:shufflechange', { detail: { enabled: shuffleEnabled } })); } catch {}
    return shuffleEnabled;
  }

  function isShuffleEnabled() {
    return shuffleEnabled;
  }

  function chooseShuffleIndex(rows, currentIndex, isReady) {
    if (!Array.isArray(rows) || !rows.length || typeof isReady !== 'function') return -1;
    const candidates = [];
    for (let index = 0; index < rows.length; index += 1) {
      if (index === currentIndex) continue;
      if (isReady(rows[index])) candidates.push(index);
    }
    if (!candidates.length) return -1;
    const fingerprint = candidates.map((index) => `${index}:${clean(rows[index].id)}`).join('|');
    if (reservedNext?.current === currentIndex && reservedNext.candidates === fingerprint && candidates.includes(reservedNext.index)) {
      const chosen = reservedNext.index;
      reservedNext = null;
      return chosen;
    }
    const slot = Math.min(candidates.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, Number(Math.random()) || 0)) * candidates.length));
    return candidates[slot];
  }

  function cancelPendingPlayback(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    pendingPlaybackIntent = false;
    if (playButton) {
      delete playButton.dataset.pendingPlayback;
      playButton.textContent = '▶';
    }
    try { window.ampMusicYouTube150?.suspend?.(); } catch {}
    if (status) status.textContent = 'PAUSED';
    setIntent({ type: 'pause' });
  }

  function captureIntent(event) {
    const target = event.target?.closest?.('button, .track-main');
    if (!target) return;

    if (target.id === 'shuffleButton') {
      event.preventDefault();
      event.stopImmediatePropagation();
      setShuffleEnabled(!shuffleEnabled);
      return;
    }

    if (target.classList?.contains('track-main')) {
      const index = Number(target.dataset.index);
      if (Number.isInteger(index)) setIntent({ type: 'track', index });
      return;
    }
    if (target.id === 'nextButton') setIntent({ type: 'next' });
    else if (target.id === 'prevButton') setIntent({ type: 'previous' });
    else if (target.id === 'playButton' && pendingPlaybackIntent) cancelPendingPlayback(event);
    else if (target.id === 'playButton') setIntent({ type: 'play' });
  }

  document.addEventListener('click', captureIntent, true);

  const host = artist?.parentElement;
  if (host) {
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(host, { childList: true });
  }
  if (playButton) {
    const observer = new MutationObserver(() => queueMicrotask(normalizePendingPlaybackControl));
    observer.observe(playButton, { childList: true, characterData: true, subtree: true });
  }
  if (status) {
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }
  window.addEventListener('pageshow', render);
  window.addEventListener('focus', render);
  window.addEventListener('ampula:librarychange', render);

  window.ampulaPlaybackNavigation178 = {
    version: VERSION,
    shuffleKey: SHUFFLE_KEY,
    currentIntent,
    isShuffleEnabled,
    setShuffleEnabled,
    chooseShuffleIndex,
    nextPreview,
    isPendingPlaybackIntent: () => pendingPlaybackIntent,
    refresh: render,
  };

  render();
  console.info('[ÁmpulaMP] playback navigation 1.7.9 ready · latest intent wins · exact selection · explicit Shuffle state');
})();
