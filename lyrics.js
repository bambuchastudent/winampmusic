(() => {
  const GENIUS_SEARCH = 'https://genius.com/api/search/multi';
  const GENIUS_SEARCH_FALLBACK = 'https://genius.com/api/search/song';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const GENIUS_MAP_KEY = 'winampmusic.geniusMap.v1';
  const GENIUS_CACHE_KEY = 'winampmusic.geniusResults.v2';
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

  function songTitle(song) {
    return clean(song?.title_with_featured || song?.title || song?.full_title || '');
  }

  function songArtist(song) {
    return clean(song?.primary_artist?.name || song?.artist_names || '');
  }

  function songMatchesTrack(song, title, artist) {
    return titleMatches(songTitle(song), title) && artistMatches(songArtist(song), artist);
  }

  function scoreSong(song, title, artist) {
    if (!songMatchesTrack(song, title, artist)) return -1000;
    const candidateTitle = normalizeText(songTitle(song));
    const candidateArtist = normalizeText(songArtist(song));
    const targetTitle = normalizeText(title);
    const targetArtist = normalizeText(artist);
    let score = 0;

    if (candidateTitle === targetTitle) score += 30;
    else score += Math.round(overlapRatio(candidateTitle, targetTitle) * 14);

    if (targetArtist) {
      if (candidateArtist === targetArtist) score += 24;
      else if (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist)) score += 16;
      else score += Math.round(overlapRatio(candidateArtist, targetArtist) * 8);
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
      title: songTitle(song) || 'Lyrics',
      artist: songArtist(song),
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

  function cachedResult(videoId, track) {
    const cache = readJson(GENIUS_CACHE_KEY, {});
    const raw = cache[videoId];
    const song = normalizeSong(raw);
    if (!song) return null;
    if (songMatchesTrack(song, track.title, track.artist)) return song;
    delete cache[videoId];
    saveJson(GENIUS_CACHE_KEY, cache);
    return null;
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
    return exact ? normalizeSong(exact) : null;
  }

  async function resolveTrack(track, signal) {
    const mapped = mappedSong(track.id);
    if (mapped) return mapped;

    const cached = cachedResult(track.id, track);
    if (cached) return cached;

    const query = clean(`${track.artist} ${track.title}`) || track.title;
    const hits = await geniusSearch(query, signal);
    const ranked = hits
      .map((item) => ({ item, score: scoreSong(item, track.title, track.artist) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 28) return null;
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

  function renderMissing(message = 'No safe Genius match found automatically') {
    statusNode.textContent = 'GENIUS · LYRICS NOT MATCHED';
    currentNode.textContent = message;
    nextNode.textContent = 'Paste the exact Genius lyrics URL below to link it to this YouTube video.';
    embedHost.replaceChildren();
    if (openLink) openLink.hidden = true;
  }

  function currentTrack() {
    const id = currentVideoId();
    const parsed = splitYoutubeTitle(titleNode.textContent, artistNode.textContent);
    return { id, title: parsed.title, artist: parsed.artist };
  }

  async function loadLyrics({ force = false } = {}) {
    const track = currentTrack();
    if (!track.id || weakTitle(track.title, track.id)) {
      activeSignature = '';
      controller?.abort();
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
    nextNode.textContent = track.artist || 'Looking for an exact Genius match…';
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
    currentNode.textContent = 'Matching this exact Genius page…';
    nextNode.textContent = value;
    try {
      const song = await resolveGeniusUrl(value, track, controller.signal);
      if (!song) return renderMissing('Could not resolve that exact Genius page');
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
  setTimeout(() => loadLyrics().catch(() => {}), 300);
})();
