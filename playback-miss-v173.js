(() => {
  'use strict';
  if (window.__AMPULA_PLAYBACK_MISS_173__) return;
  window.__AMPULA_PLAYBACK_MISS_173__ = true;

  const VERSION = '1.7.3';
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const REJECTED_KEY = 'ampula.playbackRejectedMatches.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const MAX_REJECTED_PER_RECORDING = 20;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  let retrying = false;

  function normalize(value) {
    return clean(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function durationSeconds(value) {
    const durationMs = Number(value?.durationMs || 0);
    if (durationMs > 0) return Math.round(durationMs / 1000);
    return Math.max(0, Math.round(Number(value?.duration || 0)));
  }

  function rejectionKey(value) {
    return `${normalize(value?.artist)}\u0000${normalize(value?.title)}\u0000${durationSeconds(value)}`;
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function readLibrary() {
    const rows = readJson(LIBRARY_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function writeLibrary(rows) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(rows)); } catch {}
  }

  function readRejectedStore() {
    const store = readJson(REJECTED_KEY, {});
    return store && typeof store === 'object' && !Array.isArray(store) ? store : {};
  }

  function writeRejectedStore(store) {
    try { localStorage.setItem(REJECTED_KEY, JSON.stringify(store)); } catch {}
  }

  function getRejectedIds(value) {
    const key = rejectionKey(value);
    if (!key.replace(/\u0000/g, '')) return [];
    const entry = readRejectedStore()[key];
    return Array.isArray(entry?.ids) ? entry.ids.map(clean).filter((id) => VIDEO_ID_RE.test(id)) : [];
  }

  function rejectId(value, id) {
    const videoId = clean(id);
    if (!VIDEO_ID_RE.test(videoId)) return getRejectedIds(value);
    const key = rejectionKey(value);
    const store = readRejectedStore();
    const existing = Array.isArray(store[key]?.ids) ? store[key].ids.map(clean).filter((item) => VIDEO_ID_RE.test(item)) : [];
    const ids = [videoId, ...existing.filter((item) => item !== videoId)].slice(0, MAX_REJECTED_PER_RECORDING);
    store[key] = { ids, updatedAt: new Date().toISOString() };
    writeRejectedStore(store);
    return ids;
  }

  function metadataWithRejected(metadata) {
    const existing = Array.isArray(metadata?.excludeYoutubeIds) ? metadata.excludeYoutubeIds.map(clean) : [];
    const rejected = getRejectedIds(metadata);
    return {
      ...(metadata || {}),
      excludeYoutubeIds: [...new Set([...existing, ...rejected].filter((id) => VIDEO_ID_RE.test(id)))],
    };
  }

  function currentIndex() {
    const index = Number(localStorage.getItem(CURRENT_KEY));
    const rows = readLibrary();
    return Number.isInteger(index) && index >= 0 && index < rows.length ? index : -1;
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

  function fallbackLocalRecordingId(title, artist) {
    const text = `${clean(title)}\u0000${clean(artist)}`.toLowerCase();
    let a = 0x811c9dc5;
    let b = 0x1b873593;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 2246822519) >>> 0;
    }
    return `U-${a.toString(36).padStart(7, '0')}${(b % 46656).toString(36).padStart(3, '0')}`;
  }

  function localRecordingId(track) {
    try {
      const id = window.ampMusicRecordingId?.(clean(track?.title), clean(track?.artist));
      if (clean(id)) return clean(id);
    } catch {}
    return fallbackLocalRecordingId(track?.title, track?.artist);
  }

  function candidateId(track, index) {
    for (const value of [track?.youtubeMatchId, track?.id]) {
      const id = clean(value);
      if (VIDEO_ID_RE.test(id)) return id;
    }
    try {
      const playback = window.ampulaTrackDiagnostics164?.payloadForIndex?.(index)?.playback || {};
      for (const value of [playback.actualYoutubeId, playback.youtubeWire?.videoId]) {
        const id = clean(value);
        if (VIDEO_ID_RE.test(id)) return id;
      }
    } catch {}
    return '';
  }

  function clearPlaybackCandidate(index, expectedTrack) {
    const rows = readLibrary();
    const current = rows[index];
    if (!current) return null;
    const sameOrigin = clean(expectedTrack?.spotifyTrackId) && clean(expectedTrack.spotifyTrackId) === clean(current.spotifyTrackId) ||
      clean(expectedTrack?.appleTrackId) && clean(expectedTrack.appleTrackId) === clean(current.appleTrackId) ||
      normalize(expectedTrack?.title) === normalize(current.title) && normalize(expectedTrack?.artist) === normalize(current.artist);
    if (!sameOrigin) return null;

    const next = {
      ...current,
      id: localRecordingId(current),
      badges: (Array.isArray(current.badges) ? current.badges : []).filter((badge) => clean(badge) !== 'YouTube match'),
    };
    delete next.youtubeMatchId;
    delete next.youtubeMatchResolverVersion;
    delete next.youtubeMatchFinalTrustVersion;
    if (clean(next.playbackProvider).toLowerCase() === 'youtube') delete next.playbackProvider;
    rows[index] = next;
    writeLibrary(rows);
    try { window.renderLibrary?.(); } catch {}
    try { window.ampMusicOriginPlayback151?.refresh?.(); } catch {}
    return next;
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

    let button = document.getElementById('ampulaPlaybackMiss');
    if (!button) {
      button = document.createElement('button');
      button.id = 'ampulaPlaybackMiss';
      button.className = 'playback-miss';
      button.type = 'button';
      button.hidden = true;
      button.title = 'Wrong playback match — try another';
      button.setAttribute('aria-label', 'Wrong playback match — try another');
      const ad = document.getElementById('ampulaAdIndicator');
      if (ad?.parentElement === row) row.insertBefore(button, ad);
      else row.appendChild(button);
      button.addEventListener('click', () => { void rejectCurrentAndRetry(); });
    }

    if (!document.getElementById('ampulaPlaybackMiss173Styles')) {
      const style = document.createElement('style');
      style.id = 'ampulaPlaybackMiss173Styles';
      style.textContent = `
        .screen-status-row{display:flex;align-items:center;gap:7px;min-height:18px}
        .screen-status-row .status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .playback-miss{flex:0 0 auto;margin-left:auto;min-height:20px;padding:2px 7px;border:1px solid #a88d2c;border-radius:3px;background:linear-gradient(#2b2818,#17170f);color:#f0c94d;box-shadow:inset 0 1px rgba(255,255,255,.08);font:900 9px/1 "SFMono-Regular",Consolas,monospace;letter-spacing:.08em;cursor:pointer;touch-action:manipulation}
        .playback-miss:hover,.playback-miss:focus-visible{background:#f0c94d;color:#171717;outline:none}
        .playback-miss:disabled{opacity:.55;cursor:wait}
        .playback-miss[hidden]{display:none!important}
        .screen-status-row .ad-indicator{margin-left:0}
      `;
      document.head.appendChild(style);
    }
    return button;
  }

  function adIsVisible() {
    const ad = document.getElementById('ampulaAdIndicator');
    return Boolean(ad && !ad.hidden);
  }

  function sync() {
    const button = ensureUi();
    if (!button) return false;
    const index = currentIndex();
    const rows = readLibrary();
    const track = index >= 0 ? rows[index] : null;
    const id = track ? candidateId(track, index) : '';
    let active = false;
    try { active = window.ampMusicYouTube150?.isActive?.() === true; } catch {}
    const visible = Boolean(track && isCanonicalOrigin(track) && VIDEO_ID_RE.test(id) && (active || /PLAYING|TRUSTWORTHY|STARTING/i.test(clean(document.getElementById('status')?.textContent))) && !adIsVisible());
    button.hidden = !visible;
    button.disabled = retrying;
    if (visible) {
      const count = getRejectedIds(track).length;
      button.textContent = count ? `MISS · ${count}` : 'MISS';
    } else {
      button.textContent = '';
    }
    return visible;
  }

  async function rejectCurrentAndRetry() {
    if (retrying) return false;
    const index = currentIndex();
    const rows = readLibrary();
    const track = index >= 0 ? rows[index] : null;
    if (!track || !isCanonicalOrigin(track)) return false;
    const id = candidateId(track, index);
    if (!VIDEO_ID_RE.test(id)) return false;

    retrying = true;
    sync();
    rejectId(track, id);
    try { window.ampMusicYouTube150?.suspend?.(); } catch {}
    const unresolved = clearPlaybackCandidate(index, track);
    const status = document.getElementById('status');
    if (status) status.textContent = 'MISS · SEARCHING NEXT MATCH…';

    try {
      if (unresolved && typeof window.playIndex === 'function') {
        const retried = await window.playIndex(index);
        if (retried !== false) return true;
      }

      const latest = readLibrary();
      const max = Math.min(Number(window.ampulaPlaybackQueue170?.scanLimit || 12), Math.max(0, latest.length - 1));
      for (let offset = 1; offset <= max; offset += 1) {
        const target = (index + offset) % latest.length;
        const result = await window.playIndex?.(target);
        if (result !== false) return true;
      }
      if (status) status.textContent = 'MISS · NO TRUSTWORTHY ALTERNATIVE';
      return false;
    } finally {
      retrying = false;
      sync();
    }
  }

  const observer = new MutationObserver(sync);
  for (const id of ['status', 'playButton']) {
    const node = document.getElementById(id);
    if (node) observer.observe(node, { childList: true, subtree: true, characterData: true });
  }
  sync();
  const timer = setInterval(sync, 600);

  window.ampulaPlaybackMiss173 = {
    version: VERSION,
    storageKey: REJECTED_KEY,
    getRejectedIds,
    rejectId,
    metadataWithRejected,
    clearPlaybackCandidate,
    rejectCurrentAndRetry,
    sync,
    stop() {
      clearInterval(timer);
      observer.disconnect();
    },
  };
  console.info(`[ÁmpulaMP] manual playback MISS ${VERSION} ready`);
})();