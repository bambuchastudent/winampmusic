(() => {
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const CACHE_KEY = 'winampmusic.syncedLyrics.v2';
  const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
  const CACHE_LIMIT = 100;

  if (window.__WINAMP_SYNCED_LYRICS_V2__) return;
  window.__WINAMP_SYNCED_LYRICS_V2__ = true;

  const titleNode = document.getElementById('nowTitle');
  const artistNode = document.getElementById('nowArtist');
  const elapsedNode = document.getElementById('elapsed');
  const durationNode = document.getElementById('duration');
  const lyricsPanel = document.getElementById('lyricsBar');
  const embedHost = document.getElementById('geniusEmbedHost');
  if (!titleNode || !artistNode || !lyricsPanel || !embedHost) return;

  const syncHost = document.createElement('div');
  syncHost.id = 'lyricsSyncHost';
  syncHost.className = 'lyrics-sync-host';
  embedHost.before(syncHost);

  let activeSignature = '';
  let controller = null;
  let activeLines = [];
  let activeLineIndex = -1;
  let syncTimer = null;
  let manualScrollUntil = 0;

  function ensureWinampIcons() {
    const href = './icon.svg';
    if (!document.querySelector('link[rel="icon"][href*="icon.svg"]')) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/svg+xml';
      icon.href = href;
      document.head.appendChild(icon);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const touch = document.createElement('link');
      touch.rel = 'apple-touch-icon';
      touch.href = href;
      document.head.appendChild(touch);
    }
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
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

    if (artistMatchesPrefix || genericChannel) return { title: right, artist: left };
    return { title, artist };
  }

  function currentTrack() {
    const parsed = splitYoutubeTitle(titleNode.textContent, artistNode.textContent);
    return {
      id: currentVideoId(),
      title: parsed.title,
      artist: parsed.artist,
      duration: timeToSeconds(durationNode?.textContent),
    };
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

  function titleMatches(candidate, wanted) {
    const a = normalizeText(candidate);
    const b = normalizeText(wanted);
    if (!a || !b) return false;
    if (a === b) return true;

    const wantedWords = b.split(' ').filter(Boolean);
    if (wantedWords.length <= 2) return false;
    if (a.includes(b) || b.includes(a)) return overlapRatio(a, b) >= 0.8;
    return overlapRatio(a, b) >= 0.75;
  }

  function artistMatches(candidate, wanted) {
    const a = normalizeText(candidate);
    const b = normalizeText(wanted);
    if (!b) return true;
    if (!a) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    return overlapRatio(a, b) >= 0.6;
  }

  function payloadMatchesTrack(item, track) {
    if (!titleMatches(item?.trackName, track.title)) return false;
    if (!artistMatches(item?.artistName, track.artist)) return false;

    const candidateDuration = Number(item?.duration || 0);
    if (track.duration && candidateDuration) {
      const diff = Math.abs(candidateDuration - track.duration);
      const allowed = Math.max(12, track.duration * 0.08);
      if (diff > allowed) return false;
    }
    return true;
  }

  function score(item, track) {
    if (!payloadMatchesTrack(item, track)) return -1000;

    const wantedTitle = normalizeText(track.title);
    const wantedArtist = normalizeText(track.artist);
    const title = normalizeText(item?.trackName || '');
    const artist = normalizeText(item?.artistName || '');
    let value = 0;

    if (title === wantedTitle) value += 30;
    else value += Math.round(overlapRatio(title, wantedTitle) * 14);

    if (wantedArtist) {
      if (artist === wantedArtist) value += 24;
      else if (artist.includes(wantedArtist) || wantedArtist.includes(artist)) value += 16;
      else value += Math.round(overlapRatio(artist, wantedArtist) * 8);
    }

    if (track.duration && Number(item?.duration)) {
      const diff = Math.abs(Number(item.duration) - track.duration);
      if (diff <= 2) value += 12;
      else if (diff <= 6) value += 6;
    }

    if (item?.syncedLyrics) value += 4;
    return value;
  }

  async function findLyrics(track, signal) {
    const cache = readJson(CACHE_KEY, {});
    const cached = cache[track.id];
    if ((cached?.syncedLyrics || cached?.plainLyrics) && payloadMatchesTrack(cached, track)) return cached;
    if (cached) {
      delete cache[track.id];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }

    const url = new URL(LRCLIB_SEARCH);
    url.searchParams.set('q', clean(`${track.artist} ${track.title}`) || track.title);
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Lrclib-Client': 'WinampMusic v0.6 (https://bambuchastudent.github.io/winampmusic/)',
      },
    });
    if (!response.ok) throw new Error(`Lyrics HTTP ${response.status}`);

    const results = await response.json();
    const best = (Array.isArray(results) ? results : [])
      .map((item) => ({ item, score: score(item, track) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 28) return null;
    const payload = {
      trackName: clean(best.item.trackName),
      artistName: clean(best.item.artistName),
      duration: Number(best.item.duration || 0),
      syncedLyrics: String(best.item.syncedLyrics || ''),
      plainLyrics: String(best.item.plainLyrics || ''),
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

  function centerLineInsideLyrics(node) {
    if (!node || Date.now() < manualScrollUntil) return;
    const viewport = node.closest('.lyrics-karaoke');
    if (!viewport) return;
    const target = node.offsetTop - (viewport.clientHeight / 2) + (node.offsetHeight / 2);
    viewport.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function updateActiveLine() {
    if (!activeLines.length) return;
    const seconds = timeToSeconds(elapsedNode?.textContent);
    let index = -1;
    for (let i = 0; i < activeLines.length; i += 1) {
      if (activeLines[i].seconds <= seconds + 0.15) index = i;
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
    const markManualScroll = () => { manualScrollUntil = Date.now() + 5000; };
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
      updateActiveLine();
      syncTimer = setInterval(updateActiveLine, 300);
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

  async function load({ force = false } = {}) {
    const track = currentTrack();
    if (!track.id || !track.title || track.title === 'No track selected') {
      activeSignature = '';
      controller?.abort();
      stopSync();
      syncHost.replaceChildren();
      return;
    }

    const signature = `${track.id}::${track.title}::${track.artist}`;
    if (!force && signature === activeSignature) return;
    activeSignature = signature;
    controller?.abort();
    controller = new AbortController();
    stopSync();
    syncHost.replaceChildren();

    try {
      const payload = await findLyrics(track, controller.signal);
      if (signature !== activeSignature || !payload) return;
      render(payload, track);
    } catch (error) {
      if (error.name !== 'AbortError') {
        stopSync();
        syncHost.replaceChildren();
      }
    }
  }

  ensureWinampIcons();
  new MutationObserver(() => load().catch(() => {}))
    .observe(titleNode, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => load().catch(() => {}))
    .observe(artistNode, { childList: true, subtree: true, characterData: true });
  setInterval(() => load().catch(() => {}), 900);
  setTimeout(() => load().catch(() => {}), 350);
})();
