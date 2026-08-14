(() => {
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const CACHE_KEY = 'winampmusic.syncedLyrics.v1';
  const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
  const CACHE_LIMIT = 100;

  if (window.__WINAMP_SYNCED_LYRICS_V1__) return;
  window.__WINAMP_SYNCED_LYRICS_V1__ = true;

  const titleNode = document.getElementById('nowTitle');
  const artistNode = document.getElementById('nowArtist');
  const elapsedNode = document.getElementById('elapsed');
  const durationNode = document.getElementById('duration');
  const lyricsPanel = document.getElementById('lyricsBar');
  const embedHost = document.getElementById('geniusEmbedHost');
  const statusNode = document.getElementById('lyricsStatus');
  const currentNode = document.getElementById('lyricsCurrent');
  const nextNode = document.getElementById('lyricsNext');
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

  function currentTrack() {
    return {
      id: currentVideoId(),
      title: cleanTitle(titleNode.textContent),
      artist: cleanArtist(artistNode.textContent),
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

  function score(item, track) {
    const wantedTitle = normalizeText(track.title);
    const wantedArtist = normalizeText(track.artist);
    const title = normalizeText(item?.trackName || '');
    const artist = normalizeText(item?.artistName || '');
    let value = 0;

    if (title === wantedTitle) value += 20;
    else if (title.includes(wantedTitle) || wantedTitle.includes(title)) value += 8;

    if (wantedArtist) {
      if (artist === wantedArtist) value += 14;
      else if (artist.includes(wantedArtist) || wantedArtist.includes(artist)) value += 6;
    }

    if (track.duration && Number(item?.duration)) {
      const diff = Math.abs(Number(item.duration) - track.duration);
      if (diff <= 2) value += 10;
      else if (diff <= 6) value += 4;
      else if (diff > 20) value -= 5;
    }

    if (item?.syncedLyrics) value += 4;
    return value;
  }

  async function findLyrics(track, signal) {
    const cached = readJson(CACHE_KEY, {})[track.id];
    if (cached?.syncedLyrics || cached?.plainLyrics) return cached;

    const url = new URL(LRCLIB_SEARCH);
    url.searchParams.set('q', clean(`${track.artist} ${track.title}`) || track.title);
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Lrclib-Client': 'WinampMusic v0.5 (https://bambuchastudent.github.io/winampmusic/)',
      },
    });
    if (!response.ok) throw new Error(`Lyrics HTTP ${response.status}`);

    const results = await response.json();
    const best = (Array.isArray(results) ? results : [])
      .map((item) => ({ item, score: score(item, track) }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 5) return null;
    const payload = {
      trackName: clean(best.item.trackName),
      artistName: clean(best.item.artistName),
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
    nodes[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function render(payload, track) {
    stopSync();
    syncHost.replaceChildren();

    const lines = parseSynced(payload?.syncedLyrics);
    const wrapper = document.createElement('div');
    wrapper.className = 'lyrics-karaoke';

    if (lines.length) {
      activeLines = lines;
      for (const line of lines) {
        const row = document.createElement('div');
        row.className = 'lyrics-line';
        row.textContent = line.text;
        wrapper.appendChild(row);
      }
      syncHost.appendChild(wrapper);
      updateActiveLine();
      syncTimer = setInterval(updateActiveLine, 300);
      if (statusNode) statusNode.textContent = 'GENIUS MATCH · SYNCED LYRICS';
      if (currentNode) currentNode.textContent = payload.trackName || track.title;
      if (nextNode) nextNode.textContent = `${payload.artistName || track.artist || 'Current track'} · timed lyrics follow playback`;
      return;
    }

    const plain = String(payload?.plainLyrics || '').trim();
    if (plain) {
      const text = document.createElement('div');
      text.className = 'lyrics-plain';
      text.textContent = plain;
      wrapper.appendChild(text);
      syncHost.appendChild(wrapper);
      if (statusNode) statusNode.textContent = 'GENIUS MATCH · LYRICS';
      if (currentNode) currentNode.textContent = payload.trackName || track.title;
      if (nextNode) nextNode.textContent = payload.artistName || track.artist || '';
    }
  }

  async function load({ force = false } = {}) {
    const track = currentTrack();
    if (!track.id || !track.title || track.title === 'No track selected') {
      stopSync();
      syncHost.replaceChildren();
      return;
    }

    const signature = `${track.id}::${track.title}::${track.artist}`;
    if (!force && signature === activeSignature) return;
    activeSignature = signature;
    controller?.abort();
    controller = new AbortController();

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
  setInterval(() => load().catch(() => {}), 1800);
  setTimeout(() => load().catch(() => {}), 500);
})();
