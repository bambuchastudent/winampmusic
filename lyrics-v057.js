(() => {
  if (window.__WINAMP_LYRICS_V057__) return;
  window.__WINAMP_LYRICS_V057__ = true;
  // Prevent the older synced-lyrics module from starting; this release owns
  // matching, rendering and timing so two timers cannot fight over the lines.
  window.__WINAMP_SYNCED_LYRICS_V2__ = true;

  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const CACHE_KEY = 'winampmusic.syncedLyrics.v3';
  const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
  const CACHE_LIMIT = 100;

  const panel = document.getElementById('lyricsBar');
  const titleNode = document.getElementById('nowTitle');
  const artistNode = document.getElementById('nowArtist');
  const statusNode = document.getElementById('status');
  const durationNode = document.getElementById('duration');
  const seekNode = document.getElementById('seek');
  const embedHost = document.getElementById('geniusEmbedHost');
  if (!panel || !titleNode || !artistNode || !durationNode || !seekNode || !embedHost) return;

  let syncHost = document.getElementById('lyricsSyncHost');
  if (!syncHost) {
    syncHost = document.createElement('div');
    syncHost.id = 'lyricsSyncHost';
    syncHost.className = 'lyrics-sync-host';
    embedHost.before(syncHost);
  }

  let activeSignature = '';
  let controller = null;
  let activeLines = [];
  let activeLineIndex = -1;
  let syncTimer = null;
  let manualScrollUntil = 0;
  let lastSeekValue = Number(seekNode.value) || 0;
  let clockSeconds = 0;
  let clockAnchoredAt = performance.now();
  let allowLyricsFocusUntil = 0;
  let lastOutsideFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let lastUserNavigationAt = Date.now();

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeText(value) {
    return clean(value)
      .toLocaleLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function cleanTitle(value) {
    return clean(value)
      .replace(/\s*\([^)]*(official|video|audio|lyrics?|visualizer|music video)[^)]*\)/ig, '')
      .replace(/\s*\[[^\]]*(official|video|audio|lyrics?|visualizer|music video)[^\]]*\]/ig, '')
      .replace(/\s*\|.*$/g, '')
      .trim();
  }

  function cleanArtist(value) {
    const artist = clean(value).replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').trim();
    return /^(?:youtube|unknown)$/i.test(artist) ? '' : artist;
  }

  function splitYoutubeTitle(rawTitle, rawArtist) {
    const title = cleanTitle(rawTitle);
    const artist = cleanArtist(rawArtist);
    const match = title.match(/^(.{1,80}?)\s+[-–—]\s+(.{1,180})$/);
    if (!match) return { title, artist };
    const left = clean(match[1]);
    const right = clean(match[2]);
    const leftNorm = normalizeText(left);
    const artistNorm = normalizeText(artist);
    const artistMatchesPrefix = artistNorm && (artistNorm.includes(leftNorm) || leftNorm.includes(artistNorm));
    const genericChannel = !artistNorm || /\b(records?|music|official|channel|label|vevo)\b/.test(artistNorm);
    return artistMatchesPrefix || genericChannel ? { title: right, artist: left } : { title, artist };
  }

  function currentVideoId() {
    const state = readJson(PLAYER_STATE_KEY, {});
    return /^[\w-]{6,20}$/.test(state.currentId || '') ? state.currentId : '';
  }

  function timeToSeconds(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function currentTrack() {
    const parsed = splitYoutubeTitle(titleNode.textContent, artistNode.textContent);
    return {
      id: currentVideoId(),
      title: parsed.title,
      artist: parsed.artist,
      duration: timeToSeconds(durationNode.textContent),
    };
  }

  function tokenSet(value) {
    return new Set(normalizeText(value).split(' ').filter((word) => word.length > 1));
  }

  function overlapRatio(a, b) {
    const left = tokenSet(a);
    const right = tokenSet(b);
    if (!left.size || !right.size) return 0;
    let common = 0;
    for (const token of left) if (right.has(token)) common += 1;
    return common / Math.max(left.size, right.size);
  }

  function titleScore(candidate, wanted) {
    const a = normalizeText(candidate);
    const b = normalizeText(wanted);
    if (!a || !b) return -100;
    if (a === b) return 40;
    const overlap = overlapRatio(a, b);
    if ((a.includes(b) || b.includes(a)) && overlap >= 0.8) return 30;
    if (overlap >= 0.8) return 24;
    return -100;
  }

  function artistScore(candidate, wanted) {
    const a = normalizeText(candidate);
    const b = normalizeText(wanted);
    if (!b) return 0;
    if (!a) return -100;
    if (a === b) return 30;
    if (a.includes(b) || b.includes(a)) return 22;
    const overlap = overlapRatio(a, b);
    return overlap >= 0.7 ? 14 : -100;
  }

  function score(item, track) {
    const title = titleScore(item?.trackName, track.title);
    const artist = artistScore(item?.artistName, track.artist);
    if (title < 0 || artist < 0) return -1000;
    let value = title + artist;
    const candidateDuration = Number(item?.duration || 0);
    if (track.duration && candidateDuration) {
      const diff = Math.abs(candidateDuration - track.duration);
      if (diff <= 2) value += 35;
      else if (diff <= 6) value += 15;
      else if (diff > Math.max(12, track.duration * 0.05)) return -1000;
    }
    if (item?.syncedLyrics) value += 25;
    else if (item?.plainLyrics) value += 5;
    return value;
  }

  function cacheLyrics(videoId, payload) {
    if (!videoId || !payload) return;
    const cache = readJson(CACHE_KEY, {});
    cache[videoId] = { ...payload, savedAt: Date.now() };
    const trimmed = Object.fromEntries(
      Object.entries(cache)
        .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
        .slice(0, CACHE_LIMIT)
    );
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  }

  function cachedLyrics(track) {
    const cache = readJson(CACHE_KEY, {});
    const item = cache[track.id];
    if (!item || (!item.syncedLyrics && !item.plainLyrics)) return null;
    return score(item, track) >= 55 ? item : null;
  }

  async function searchLrclib(params, signal) {
    const url = new URL(LRCLIB_SEARCH);
    for (const [key, value] of Object.entries(params)) if (clean(value)) url.searchParams.set(key, clean(value));
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Lrclib-Client': 'WinampMusic v0.5.7 (https://bambuchastudent.github.io/winampmusic/)',
      },
    });
    if (!response.ok) throw new Error(`Lyrics HTTP ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }

  function bestResult(results, track) {
    const ranked = results
      .map((item) => ({ item, score: score(item, track) }))
      .filter((entry) => entry.score >= 55)
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.item || null;
  }

  async function findLyrics(track, signal) {
    const cached = cachedLyrics(track);
    if (cached) return cached;

    let results = await searchLrclib({ track_name: track.title, artist_name: track.artist }, signal);
    let best = bestResult(results, track);
    if (!best) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      results = await searchLrclib({ q: clean(`${track.artist} ${track.title}`) || track.title }, signal);
      best = bestResult(results, track);
    }
    if (!best) return null;

    const payload = {
      trackName: clean(best.trackName),
      artistName: clean(best.artistName),
      albumName: clean(best.albumName),
      duration: Number(best.duration || 0),
      syncedLyrics: String(best.syncedLyrics || ''),
      plainLyrics: String(best.plainLyrics || ''),
    };
    cacheLyrics(track.id, payload);
    return payload;
  }

  function parseSynced(value) {
    const result = [];
    for (const line of String(value || '').split(/\r?\n/)) {
      const match = line.match(/^\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/);
      if (!match) continue;
      const seconds = Number(match[1]) * 60 + Number(match[2]);
      const text = clean(match[3]);
      if (text && Number.isFinite(seconds)) result.push({ seconds, text });
    }
    return result.sort((a, b) => a.seconds - b.seconds);
  }

  function stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    activeLines = [];
    activeLineIndex = -1;
  }

  function markManualScroll() {
    manualScrollUntil = Date.now() + 5000;
  }

  function syncClock() {
    const duration = timeToSeconds(durationNode.textContent);
    const seekValue = Number(seekNode.value) || 0;
    const now = performance.now();
    if (seekValue !== lastSeekValue || !Number.isFinite(clockSeconds)) {
      lastSeekValue = seekValue;
      clockSeconds = duration > 0 ? (seekValue / 1000) * duration : 0;
      clockAnchoredAt = now;
    }
    const playing = String(statusNode?.textContent || '').trim().toUpperCase() === 'PLAYING';
    const interpolated = playing ? clockSeconds + ((now - clockAnchoredAt) / 1000) : clockSeconds;
    return duration > 0 ? Math.min(duration, Math.max(0, interpolated)) : Math.max(0, interpolated);
  }

  function centerLineInsideLyrics(node) {
    if (!node || Date.now() < manualScrollUntil) return;
    const viewport = node.closest('.lyrics-karaoke');
    if (!viewport) return;
    const top = node.offsetTop;
    const bottom = top + node.offsetHeight;
    const visibleTop = viewport.scrollTop + viewport.clientHeight * 0.2;
    const visibleBottom = viewport.scrollTop + viewport.clientHeight * 0.8;
    if (top >= visibleTop && bottom <= visibleBottom) return;
    const target = top - (viewport.clientHeight / 2) + (node.offsetHeight / 2);
    viewport.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function updateActiveLine() {
    if (!activeLines.length) return;
    const seconds = syncClock();
    let index = -1;
    for (let i = 0; i < activeLines.length; i += 1) {
      if (activeLines[i].seconds <= seconds + 0.12) index = i;
      else break;
    }
    if (index === activeLineIndex) return;
    activeLineIndex = index;
    const nodes = syncHost.querySelectorAll('.lyrics-line');
    nodes.forEach((node, nodeIndex) => {
      node.classList.toggle('active', nodeIndex === index);
      node.classList.toggle('past', nodeIndex < index);
    });
    centerLineInsideLyrics(nodes[index]);
  }

  function syncLabel(text) {
    const label = document.createElement('div');
    label.className = 'lyrics-sync-label';
    label.textContent = text;
    return label;
  }

  function render(payload, track) {
    stopSync();
    syncHost.replaceChildren();
    const lines = parseSynced(payload?.syncedLyrics);
    const wrapper = document.createElement('div');
    wrapper.className = 'lyrics-karaoke';
    wrapper.addEventListener('wheel', markManualScroll, { passive: true });
    wrapper.addEventListener('touchstart', markManualScroll, { passive: true });
    wrapper.addEventListener('pointerdown', markManualScroll, { passive: true });

    if (lines.length) {
      activeLines = lines;
      for (const line of lines) {
        const row = document.createElement('div');
        row.className = 'lyrics-line';
        row.textContent = line.text;
        wrapper.appendChild(row);
      }
      syncHost.append(syncLabel(`SYNCED LYRICS · LRCLIB · ${payload.artistName || track.artist} — ${payload.trackName || track.title}`), wrapper);
      clockSeconds = track.duration > 0 ? (Number(seekNode.value || 0) / 1000) * track.duration : 0;
      lastSeekValue = Number(seekNode.value) || 0;
      clockAnchoredAt = performance.now();
      updateActiveLine();
      syncTimer = setInterval(updateActiveLine, 100);
      return;
    }

    const plain = String(payload?.plainLyrics || '').trim();
    if (plain) {
      const text = document.createElement('div');
      text.className = 'lyrics-plain';
      text.textContent = plain;
      wrapper.appendChild(text);
      syncHost.append(syncLabel(`LYRICS · LRCLIB · ${payload.artistName || track.artist} — ${payload.trackName || track.title}`), wrapper);
    }
  }

  function hasSyncedText() {
    return Boolean(syncHost.querySelector('.lyrics-line, .lyrics-plain'));
  }

  function prepareGeniusFrame(frame) {
    if (!frame || frame.dataset.winampNoFocus === '1') return;
    frame.dataset.winampNoFocus = '1';
    frame.tabIndex = -1;
    frame.setAttribute('tabindex', '-1');
    const mountedAt = Date.now();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const navigationStamp = lastUserNavigationAt;
    const restoreFocus = lastOutsideFocus;
    frame.addEventListener('load', () => {
      const automaticWindow = Date.now() - mountedAt < 1800;
      const userDidNotNavigate = lastUserNavigationAt === navigationStamp;
      if (!automaticWindow || !userDidNotNavigate) return;
      if (Math.abs(window.scrollY - scrollY) > 2 || Math.abs(window.scrollX - scrollX) > 2) {
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      }
      if (document.activeElement === frame && restoreFocus?.isConnected) {
        try { restoreFocus.focus({ preventScroll: true }); } catch { restoreFocus.focus(); }
      }
    });
  }

  function refreshVisibility() {
    const header = panel.querySelector('.lyrics-panel-header');
    let geniusFrame = embedHost.querySelector('iframe.genius-lyrics-frame, iframe');
    const synced = hasSyncedText();

    // Synced lyrics are the primary UI. Do not keep a second Genius iframe alive
    // underneath them: it can capture browser focus while its embed boots.
    if (synced && geniusFrame) {
      embedHost.replaceChildren();
      geniusFrame = null;
    }
    if (geniusFrame) prepareGeniusFrame(geniusFrame);

    const hasGenius = Boolean(geniusFrame);
    panel.hidden = !(synced || hasGenius);
    syncHost.hidden = !synced;
    embedHost.hidden = !hasGenius;
    if (header) header.hidden = !hasGenius;
  }

  async function load({ force = false } = {}) {
    const track = currentTrack();
    if (!track.id || !track.title || track.title === 'No track selected' || /^YouTube [\w-]+$/i.test(track.title)) {
      activeSignature = '';
      controller?.abort();
      stopSync();
      syncHost.replaceChildren();
      refreshVisibility();
      return;
    }

    const durationBucket = track.duration ? Math.round(track.duration) : 0;
    const signature = `${track.id}::${track.title}::${track.artist}::${durationBucket}`;
    if (!force && signature === activeSignature) return;
    activeSignature = signature;
    controller?.abort();
    controller = new AbortController();
    stopSync();
    syncHost.replaceChildren();
    refreshVisibility();

    try {
      const payload = await findLyrics(track, controller.signal);
      if (signature !== activeSignature || !payload) {
        refreshVisibility();
        return;
      }
      render(payload, track);
      refreshVisibility();
    } catch (error) {
      if (error.name !== 'AbortError') {
        stopSync();
        syncHost.replaceChildren();
        refreshVisibility();
      }
    }
  }

  const markLyricsInteraction = () => { allowLyricsFocusUntil = Date.now() + 2500; };
  panel.addEventListener('pointerdown', markLyricsInteraction, true);
  panel.addEventListener('touchstart', markLyricsInteraction, { capture: true, passive: true });
  panel.addEventListener('keydown', markLyricsInteraction, true);
  document.addEventListener('pointerdown', () => { lastUserNavigationAt = Date.now(); }, true);
  document.addEventListener('touchmove', () => { lastUserNavigationAt = Date.now(); }, { capture: true, passive: true });
  document.addEventListener('wheel', () => { lastUserNavigationAt = Date.now(); }, { capture: true, passive: true });
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!panel.contains(target)) {
      if (target instanceof HTMLElement) lastOutsideFocus = target;
      return;
    }
    if (target?.classList?.contains('genius-lyrics-frame') && Date.now() > allowLyricsFocusUntil) {
      const restore = lastOutsideFocus;
      setTimeout(() => {
        if (restore?.isConnected && typeof restore.focus === 'function') {
          try { restore.focus({ preventScroll: true }); } catch { restore.focus(); }
        } else if (document.activeElement === target && target instanceof HTMLElement) {
          try { target.blur(); } catch {}
        }
      }, 0);
    }
  }, true);

  const panelObserver = new MutationObserver(refreshVisibility);
  panelObserver.observe(panel, { childList: true, subtree: true });
  new MutationObserver(() => load().catch(() => {})).observe(titleNode, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => load().catch(() => {})).observe(artistNode, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => load().catch(() => {})).observe(durationNode, { childList: true, subtree: true, characterData: true });
  setInterval(() => load().catch(() => {}), 1000);
  setTimeout(() => load().catch(() => {}), 350);
  refreshVisibility();
})();
