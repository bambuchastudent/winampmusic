(() => {
  'use strict';
  if (window.__AMPULA_AD_INDICATOR_170__) return;
  window.__AMPULA_AD_INDICATOR_170__ = true;

  const VERSION = '1.7.11';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const FINAL_TRUST_VERSION = 'music-only-v1.6.7';
  const MIN_DURATION_DELTA = 16;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  let youtubeWire = {};
  let adActive = false;
  let statusBeforeAd = '';

  function parseClock(value) {
    const parts = clean(value).split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
    return Math.max(0, parts[0]);
  }

  function formatTime(value) {
    const total = Math.max(0, Math.ceil(Number(value) || 0));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function readCurrentTrack() {
    try {
      const rows = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      const index = Number(localStorage.getItem(CURRENT_KEY));
      return Array.isArray(rows) && Number.isInteger(index) && index >= 0 && index < rows.length ? rows[index] : null;
    } catch {
      return null;
    }
  }

  function currentIndex() {
    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 ? index : -1;
  }

  function isCanonicalOrigin(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    const source = clean(track?.originUrl || track?.sourceUrl);
    return Boolean(
      clean(track?.spotifyTrackId) || clean(track?.appleTrackId) ||
      badges.includes('Spotify') || badges.includes('Apple Music') ||
      /(?:open\.spotify\.com|music\.apple\.com)/i.test(source)
    );
  }

  function isFinalTrusted(track) {
    return isCanonicalOrigin(track) && clean(track?.youtubeMatchFinalTrustVersion) === FINAL_TRUST_VERSION;
  }

  function ensureUi() {
    const status = document.getElementById('status');
    const screen = status?.closest('.screen');
    if (!status || !screen) return null;

    let row = status.parentElement?.classList?.contains('screen-status-row') ? status.parentElement : null;
    if (!row) {
      row = document.createElement('div');
      row.className = 'screen-status-row';
      screen.insertBefore(row, status);
      row.appendChild(status);
    }

    let indicator = document.getElementById('ampulaAdIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'ampulaAdIndicator';
      indicator.className = 'ad-indicator';
      indicator.hidden = true;
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      row.appendChild(indicator);
    }

    if (!document.getElementById('ampulaAdIndicator170Styles')) {
      const style = document.createElement('style');
      style.id = 'ampulaAdIndicator170Styles';
      style.textContent = `
        .screen-status-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:18px}
        .screen-status-row .status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ad-indicator{flex:0 0 auto;margin-left:auto;padding:3px 6px;border:1px solid #8f7724;border-radius:4px;background:#f0c94d;color:#171717;box-shadow:inset 0 1px rgba(255,255,255,.35),0 0 10px rgba(240,201,77,.16);font:900 10px/1.1 "SFMono-Regular",Consolas,monospace;letter-spacing:.08em;font-variant-numeric:tabular-nums}
        .ad-indicator[hidden]{display:none!important}
      `;
      document.head.appendChild(style);
    }
    return indicator;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function diagnosticsWire() {
    const index = currentIndex();
    if (index < 0) return {};
    try {
      return window.ampulaTrackDiagnostics164?.payloadForIndex?.(index)?.playback?.youtubeWire || {};
    } catch {
      return {};
    }
  }

  function activeWire() {
    const fallback = diagnosticsWire();
    return {
      videoId: clean(youtubeWire.videoId || fallback.videoId),
      title: clean(youtubeWire.title || fallback.title),
      author: clean(youtubeWire.author || fallback.author),
      playerState: Number.isFinite(Number(youtubeWire.playerState)) ? Number(youtubeWire.playerState) : finite(fallback.playerState, NaN),
      currentTime: Number.isFinite(Number(youtubeWire.currentTime)) ? Number(youtubeWire.currentTime) : finite(fallback.currentTime, 0),
      duration: Number.isFinite(Number(youtubeWire.duration)) ? Number(youtubeWire.duration) : finite(fallback.duration, 0),
    };
  }

  function handleYouTubeMessage(event) {
    if (!/youtube(?:-nocookie)?\.com$/i.test(String(event.origin || '').replace(/^https?:\/\//, ''))) return;
    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (!data || data.event !== 'infoDelivery' || !data.info) return;
    const info = data.info;
    youtubeWire = {
      ...youtubeWire,
      videoId: clean(info.videoData?.video_id || youtubeWire.videoId),
      title: clean(info.videoData?.title || youtubeWire.title),
      author: clean(info.videoData?.author || youtubeWire.author),
      playerState: Number.isFinite(Number(info.playerState)) ? Number(info.playerState) : youtubeWire.playerState,
      currentTime: Number.isFinite(Number(info.currentTime)) ? Number(info.currentTime) : youtubeWire.currentTime,
      duration: Number.isFinite(Number(info.duration)) ? Number(info.duration) : youtubeWire.duration,
    };
    sync();
  }

  function applyAdStatus(active) {
    const statusNode = document.getElementById('status');
    if (!statusNode) return;
    const currentStatus = clean(statusNode.textContent);
    if (active) {
      if (!adActive) statusBeforeAd = currentStatus && currentStatus !== 'AD' ? currentStatus : '';
      adActive = true;
      if (currentStatus !== 'AD') statusNode.textContent = 'AD';
      return;
    }
    if (!adActive) return;
    adActive = false;
    if (currentStatus === 'AD') {
      const playText = clean(document.getElementById('playButton')?.textContent);
      statusNode.textContent = playText.includes('⏸') ? 'PLAYING' : (statusBeforeAd || 'PAUSED');
    }
    statusBeforeAd = '';
  }

  function clearIndicator(indicator) {
    indicator.hidden = true;
    indicator.textContent = '';
    indicator.removeAttribute('aria-label');
    applyAdStatus(false);
  }

  function sync() {
    const indicator = ensureUi();
    if (!indicator) return false;
    const track = readCurrentTrack();
    if (!isFinalTrusted(track)) {
      clearIndicator(indicator);
      return false;
    }

    const status = clean(document.getElementById('status')?.textContent);
    const playText = clean(document.getElementById('playButton')?.textContent);
    const uiPlaying = /^PLAYING$/i.test(status) || playText.includes('⏸');
    const expectedId = clean(track?.youtubeMatchId || track?.id);
    const canonicalDuration = Math.max(0, Number(track?.duration || 0));
    const wire = activeWire();
    const wireId = clean(wire.videoId);
    const wireDuration = Math.max(0, Number(wire.duration || 0));
    const wireCurrent = Math.max(0, Number(wire.currentTime || 0));
    const wirePlaying = Number(wire.playerState) === 1 || uiPlaying || adActive;
    const idLooksLikeAd = Boolean(expectedId && wireId && wireId !== expectedId);
    const durationLooksLikeAd = canonicalDuration > 0 && wireDuration >= 3 &&
      Math.abs(wireDuration - canonicalDuration) > MIN_DURATION_DELTA;

    const reportedDuration = parseClock(document.getElementById('duration')?.textContent);
    const elapsed = parseClock(document.getElementById('elapsed')?.textContent);
    const domDurationLooksLikeAd = !wireDuration && canonicalDuration > 0 && reportedDuration >= 3 &&
      Math.abs(reportedDuration - canonicalDuration) > MIN_DURATION_DELTA;

    const detected = Boolean(wirePlaying && (idLooksLikeAd || durationLooksLikeAd || domDurationLooksLikeAd));
    if (!detected) {
      clearIndicator(indicator);
      return false;
    }

    const total = wireDuration || reportedDuration;
    const current = wireDuration ? wireCurrent : elapsed;
    const remaining = Math.max(0, total - current);
    applyAdStatus(true);
    indicator.hidden = false;
    indicator.textContent = `AD ${formatTime(remaining)}`;
    indicator.setAttribute('aria-label', `YouTube advertisement, ${formatTime(remaining)} remaining, ${formatTime(total)} total`);
    return true;
  }

  const observer = new MutationObserver(sync);
  for (const id of ['status', 'elapsed', 'duration', 'playButton']) {
    const node = document.getElementById(id);
    if (node) observer.observe(node, { childList: true, subtree: true, characterData: true });
  }
  window.addEventListener('message', handleYouTubeMessage);
  sync();
  const timer = setInterval(sync, 500);

  window.ampulaAdIndicator170 = {
    version: VERSION,
    finalTrustVersion: FINAL_TRUST_VERSION,
    minDurationDelta: MIN_DURATION_DELTA,
    parseClock,
    sync,
    isActive: () => adActive,
    stop() {
      clearInterval(timer);
      observer.disconnect();
      window.removeEventListener('message', handleYouTubeMessage);
    },
  };
})();