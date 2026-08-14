(() => {
  const GENIUS_SEARCH = 'https://genius.com/api/search/multi';
  const GENIUS_SEARCH_FALLBACK = 'https://genius.com/api/search/song';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const GENIUS_MAP_KEY = 'winampmusic.geniusMap.v1';
  const GENIUS_CACHE_KEY = 'winampmusic.geniusResults.v1';
  const MAX_CACHE_ENTRIES = 100;

  const panel = document.getElementById('lyricsBar');
  const statusNode = document.getElementById('lyricsStatus');
  const titleNode = document.getElementById('nowTitle');
  const artistNode = document.getElementById('nowArtist');
  const currentNode = document.getElementById('lyricsCurrent');
  const nextNode = document.getElementById('lyricsNext');
  const embedHost = document.getElementById('geniusEmbedHost');
  const urlInput = document.getElementById('geniusUrlInput');
  const useUrlButton = document.getElementById('geniusUrlSave');
  const openLink = document.getElementById('geniusOpen');

  if (!panel || !statusNode || !titleNode || !artistNode || !embedHost) return;

  let activeSignature = '';
  let controller = null;

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

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function currentVideoId() {
    const state = readJson(PLAYER_STATE_KEY, {});
    return /^[\w-]{6,20}$/.test(state.currentId || '') ? state.currentId : '';
  }

  function cleanTitle(value) {
    return clean(value)
      .replace(/\s*\([^)]*(official|video|audio|lyrics?|visualizer|music video)[^)]*\)/ig, '')
      .replace(/\s*\[[^\]]*(official|video|audio|lyrics?|visualizer|music video)[^\]]*\]/ig, '')
      .replace(/\s*\|.*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function cleanArtist(value) {
    const artist = clean(value).replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').trim();
    return /^(?:youtube|unknown)$/i.test(artist) ? '' : artist;
  }

  function weakTitle(value, id = '') {
    const text = clean(value);
    if (!text || text === 'No track selected') return true;
    if (/^(?:current track|track \d+|джем|jam|mix|radio)$/i.test(text)) return true;
    return Boolean(id && text.toLowerCase() === `youtube ${id}`.toLowerCase());
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

  function canonicalGeniusUrl(value) {
    try {
      const url = new URL(value);
      if (!/(^|\.)genius\.com$/i.test(url.hostname)) return '';
      url.hash = '';
      url.search = '';
      return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '')}`;
    } catch {
      return '';
    }
  }

  function collectHits(payload) {
    const response = payload?.response || {};
    const hits = [];
    for (const section of response.sections || []) {
      for (const hit of section?.hits || []) hits.push(hit?.result || hit);
    }
    for (const hit of response.hits || []) hits.push(hit?.result || hit);
    return hits.filter((item) => item && item.id && item.url && /-lyrics\/?$/i.test(item.url));
  }

  async function geniusSearch(query, signal) {
    const endpoints = [GENIUS_SEARCH, GENIUS_SEARCH_FALLBACK];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set('q', query);
        const response = await fetch(url, {
          signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Genius HTTP ${response.status}`);
        const hits = collectHits(await response.json());
        if (hits.length) return hits;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  }

  function scoreSong(song, title, artist) {
    const candidateTitle = normalizeText(song.title_with_featured || song.title || song.full_title || '');
    const candidateArtist = normalizeText(song.primary_artist?.name || song.artist_names || '');
    const targetTitle = normalizeText(title);
    const targetArtist = normalizeText(artist);
    let score = 0;
    if (candidateTitle === targetTitle) score += 24;
    else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 10;
    const titleWords = new Set(targetTitle.split(' ').filter(Boolean));
    for (const word of candidateTitle.split(' ')) if (titleWords.has(word) && word.length > 2) score += 1;
    if (targetArtist) {
      if (candidateArtist === targetArtist) score += 18;
      else if (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist)) score += 8;
    }
    return score;
  }

  function normalizeSong(song) {
    if (!song?.id || !song?.url) return null;
    const url = canonicalGeniusUrl(song.url);
    if (!url) return null;
    return {
      id: Number(song.id),
      url,
      title: clean(song.title_with_featured || song.title || song.full_title || 'Lyrics'),
      artist: clean(song.primary_artist?.name || song.artist_names || ''),
      fullTitle: clean(song.full_title || ''),
    };
  }

  function cacheResult(videoId, song) {
    if (!videoId || !song) return;
    const cache = readJson(GENIUS_CACHE_KEY, {});
    cache[videoId] = { ...song, savedAt: Date.now() };
    const entries = Object.entries(cache)
      .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
      .slice(0, MAX_CACHE_ENTRIES);
    saveJson(GENIUS_CACHE_KEY, Object.fromEntries(entries));
  }

  function cachedResult(videoId) {
    const song = readJson(GENIUS_CACHE_KEY, {})[videoId];
    return normalizeSong(song);
  }

  function mappedUrl(videoId) {
    return canonicalGeniusUrl(readJson(GENIUS_MAP_KEY, {})[videoId]?.url || '');
  }

  function saveMapping(videoId, song) {
    if (!videoId || !song) return;
    const map = readJson(GENIUS_MAP_KEY, {});
    map[videoId] = { id: song.id, url: song.url, title: song.title, artist: song.artist };
    saveJson(GENIUS_MAP_KEY, map);
    cacheResult(videoId, song);
  }

  function mappedSong(videoId) {
    const value = readJson(GENIUS_MAP_KEY, {})[videoId];
    return normalizeSong(value);
  }

  async function resolveGeniusUrl(rawUrl, track, signal) {
    const wanted = canonicalGeniusUrl(rawUrl);
    if (!wanted) return null;
    const slug = decodeURIComponent(new URL(wanted).pathname)
      .replace(/^\//, '')
      .replace(/-lyrics\/?$/i, '')
      .replace(/[-_]+/g, ' ');
    const hits = await geniusSearch(slug || `${track.artist} ${track.title}`, signal);
    const exact = hits.find((item) => canonicalGeniusUrl(item.url) === wanted);
    if (exact) return normalizeSong(exact);
    const ranked = hits
      .map((item) => ({ item, score: scoreSong(item, track.title, track.artist) }))
      .sort((a, b) => b.score - a.score);
    return normalizeSong(ranked[0]?.item);
  }

  async function resolveTrack(track, signal) {
    const mapped = mappedSong(track.id);
    if (mapped) return mapped;
    const cached = cachedResult(track.id);
    if (cached) return cached;

    const query = clean(`${track.artist} ${track.title}`) || track.title;
    const hits = await geniusSearch(query, signal);
    const ranked = hits
      .map((item) => ({ item, score: scoreSong(item, track.title, track.artist) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 3) return null;
    return normalizeSong(best.item);
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderEmbed(song) {
    embedHost.replaceChildren();
    if (!song?.id) return;
    const iframe = document.createElement('iframe');
    iframe.className = 'genius-lyrics-frame';
    iframe.title = `Lyrics for ${song.title || 'current track'} on Genius`;
    iframe.loading = 'lazy';
    iframe.sandbox = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
    const id = Number(song.id);
    const url = escapeAttr(song.url);
    iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif}body{overflow:auto}a{color:#111}</style></head><body><div id="rg_embed_link_${id}" class="rg_embed_link" data-song-id="${id}">Read <a href="${url}">${escapeAttr(song.title || 'lyrics')}</a> on Genius</div><script crossorigin src="https://genius.com/songs/${id}/embed.js"><\/script></body></html>`;
    embedHost.appendChild(iframe);
  }

  function renderSong(song, { manual = false } = {}) {
    if (!song) return renderMissing();
    statusNode.textContent = manual ? 'GENIUS · LINKED TO THIS VIDEO' : 'GENIUS · LYRICS FOUND';
    currentNode.textContent = song.title || 'Lyrics';
    nextNode.textContent = song.artist ? `${song.artist} · official Genius embed` : 'Official Genius embed';
    if (urlInput) urlInput.value = song.url;
    if (openLink) {
      openLink.hidden = false;
      openLink.href = song.url;
      openLink.textContent = 'Open on Genius';
    }
    renderEmbed(song);
  }

  function renderMissing(message = 'No Genius match found automatically') {
    statusNode.textContent = 'GENIUS · LYRICS NOT MATCHED';
    currentNode.textContent = message;
    nextNode.textContent = 'Paste the exact Genius lyrics URL below to link it to this YouTube video.';
    embedHost.replaceChildren();
    if (openLink) openLink.hidden = true;
  }

  function currentTrack() {
    const id = currentVideoId();
    return {
      id,
      title: cleanTitle(titleNode.textContent),
      artist: cleanArtist(artistNode.textContent),
    };
  }

  async function loadLyrics({ force = false } = {}) {
    const track = currentTrack();
    if (!track.id || weakTitle(track.title, track.id)) {
      statusNode.textContent = 'GENIUS · WAITING';
      currentNode.textContent = 'Play a track to find its Genius lyrics';
      nextNode.textContent = 'Search happens in the background.';
      embedHost.replaceChildren();
      return;
    }

    const signature = `${track.id}::${track.title}::${track.artist}`;
    if (!force && signature === activeSignature) return;
    activeSignature = signature;
    controller?.abort();
    controller = new AbortController();

    const mapped = mappedSong(track.id);
    if (mapped) {
      renderSong(mapped, { manual: true });
      return;
    }

    statusNode.textContent = 'GENIUS · SEARCHING IN BACKGROUND';
    currentNode.textContent = track.title;
    nextNode.textContent = track.artist || 'Looking for the best Genius match…';
    embedHost.replaceChildren();

    try {
      const song = await resolveTrack(track, controller.signal);
      if (signature !== activeSignature) return;
      if (!song) return renderMissing();
      cacheResult(track.id, song);
      renderSong(song);
    } catch (error) {
      if (error.name === 'AbortError') return;
      renderMissing('Genius search could not be reached from this browser');
    }
  }

  useUrlButton?.addEventListener('click', async () => {
    const track = currentTrack();
    const value = canonicalGeniusUrl(urlInput?.value || '');
    if (!track.id || !value) {
      renderMissing('Paste a valid genius.com/...-lyrics URL first');
      return;
    }
    controller?.abort();
    controller = new AbortController();
    statusNode.textContent = 'GENIUS · LINKING';
    currentNode.textContent = 'Matching this Genius page…';
    nextNode.textContent = value;
    try {
      const song = await resolveGeniusUrl(value, track, controller.signal);
      if (!song) return renderMissing('Could not resolve that Genius page');
      saveMapping(track.id, song);
      renderSong(song, { manual: true });
    } catch (error) {
      if (error.name === 'AbortError') return;
      renderMissing('Could not resolve that Genius page');
    }
  });

  urlInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      useUrlButton?.click();
    }
  });

  new MutationObserver(() => loadLyrics().catch(() => {})).observe(titleNode, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => loadLyrics().catch(() => {})).observe(artistNode, { childList: true, subtree: true, characterData: true });
  setInterval(() => loadLyrics().catch(() => {}), 1800);
  setTimeout(() => loadLyrics().catch(() => {}), 350);
})();
