(() => {
  'use strict';
  if (window.__AMPULA_AD_INDICATOR_170__) return;
  window.__AMPULA_AD_INDICATOR_170__ = true;

  const VERSION = '1.7.0';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const MIN_DURATION_DELTA = 16;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

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

  function isCanonicalOrigin(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    const source = clean(track?.originUrl || track?.sourceUrl);
    return Boolean(
      clean(track?.spotifyTrackId) || clean(track?.appleTrackId) ||
      badges.includes('Spotify') || badges.includes('Apple Music') ||
      /(?:open\.spotify\.com|music\.apple\.com)/i.test(source)
    );
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

  function sync() {
    const indicator = ensureUi();
    if (!indicator) return false;
    const track = readCurrentTrack();
    const canonicalDuration = Math.max(0, Number(track?.duration || 0));
    const elapsed = parseClock(document.getElementById('elapsed')?.textContent);
    const reportedDuration = parseClock(document.getElementById('duration')?.textContent);
    const status = clean(document.getElementById('status')?.textContent);
    const playText = clean(document.getElementById('playButton')?.textContent);
    const playing = /^PLAYING$/i.test(status) || playText.includes('⏸');
    const durationLooksLikeAd = canonicalDuration > 0 && reportedDuration >= 3 &&
      Math.abs(reportedDuration - canonicalDuration) > MIN_DURATION_DELTA;
    const detected = Boolean(playing && isCanonicalOrigin(track) && durationLooksLikeAd);

    if (!detected) {
      indicator.hidden = true;
      indicator.textContent = '';
      indicator.removeAttribute('aria-label');
      return false;
    }

    const remaining = Math.max(0, reportedDuration - elapsed);
    indicator.hidden = false;
    indicator.textContent = `AD ${formatTime(remaining)}`;
    indicator.setAttribute('aria-label', `YouTube advertisement, ${formatTime(remaining)} remaining, ${formatTime(reportedDuration)} total`);
    return true;
  }

  const observer = new MutationObserver(sync);
  for (const id of ['status', 'elapsed', 'duration', 'playButton']) {
    const node = document.getElementById(id);
    if (node) observer.observe(node, { childList: true, subtree: true, characterData: true });
  }
  sync();
  const timer = setInterval(sync, 500);

  window.ampulaAdIndicator170 = {
    version: VERSION,
    minDurationDelta: MIN_DURATION_DELTA,
    parseClock,
    sync,
    stop() { clearInterval(timer); observer.disconnect(); },
  };
})();