const LYRICS_API = 'https://lrclib.net/api/search';
const LYRICS_CACHE_KEY = 'winampmusic.lyrics.v2';
const LIBRARY_KEY = 'winampmusic.library.v1';
const PLAYER_STATE_KEY = 'winampmusic.player.v1';
const MAX_CACHE_ENTRIES = 80;

const lyricsBar = document.getElementById('lyricsBar');
const lyricsStatus = document.getElementById('lyricsStatus');
const lyricsCurrent = document.getElementById('lyricsCurrent');
const lyricsNext = document.getElementById('lyricsNext');
const titleNode = document.getElementById('nowTitle');
const artistNode = document.getElementById('nowArtist');
const seekNode = document.getElementById('seek');
const durationNode = document.getElementById('duration');

let timedLyrics = [];
let activeTrack = '';
let activeLine = -2;
let requestController = null;
let prefetchTimer = null;

function cleanTitle(text) {
  return String(text || '')
    .replace(/\s*\([^)]*(official|video|audio|lyrics?|visualizer)[^)]*\)/ig, '')
    .replace(/\s*\[[^\]]*(official|video|audio|lyrics?|visualizer)[^\]]*\]/ig, '')
    .replace(/\s*\|.*$/g, '')
    .trim();
}

function cleanArtist(text) {
  return String(text || '').replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').trim();
}

function weakTitle(title, id = '') {
  const text = String(title || '').trim();
  if (!text || text === 'No track selected') return true;
  if (/^(?:current track|track \d+|джем|jam|mix|radio)$/i.test(text)) return true;
  if (id && text.toLowerCase() === `youtube ${id}`.toLowerCase()) return true;
  return false;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function currentVideoId() {
  const saved = readJson(PLAYER_STATE_KEY, {});
  return /^[\w-]{6,20}$/.test(saved.currentId || '') ? saved.currentId : '';
}

function parseTime(text) {
  const p = String(text || '').split(':').map(Number);
  if (p.some((value) => !Number.isFinite(value))) return 0;
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return 0;
}

function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const m = raw.match(/^\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]\s*(.*)$/);
    if (m && m[3]) out.push({ time: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() });
  }
  return out.sort((a, b) => a.time - b.time);
}

function score(record, title, artist, duration) {
  const a = String(record.trackName || '').toLowerCase();
  const b = String(record.artistName || '').toLowerCase();
  const t = title.toLowerCase();
  const r = artist.toLowerCase();
  let s = record.syncedLyrics ? 3 : 0;
  if (a === t) s += 10;
  else if (a.includes(t) || t.includes(a)) s += 4;
  if (b === r) s += 8;
  else if (b.includes(r) || r.includes(b)) s += 3;
  if (duration && record.duration && Math.abs(Number(record.duration) - duration) <= 3) s += 5;
  return s;
}

function readCache() {
  return readJson(LYRICS_CACHE_KEY, {});
}

function saveCacheEntry(key, value) {
  const cache = readCache();
  cache[key] = { ...value, savedAt: Date.now() };
  const entries = Object.entries(cache).sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0));
  localStorage.setItem(LYRICS_CACHE_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES))));
}

function cachedEntry(key) {
  const entry = readCache()[key];
  if (!entry) return null;
  if (entry.found === false && Date.now() - Number(entry.savedAt || 0) > 6 * 60 * 60 * 1000) return null;
  return entry;
}

function ensureFullLyricsNode() {
  let details = lyricsBar?.querySelector('.lyrics-full');
  if (details) return details;
  details = document.createElement('details');
  details.className = 'lyrics-full';
  const summary = document.createElement('summary');
  summary.textContent = 'Full lyrics';
  const pre = document.createElement('pre');
  pre.className = 'lyrics-full-text';
  details.append(summary, pre);
  lyricsBar?.appendChild(details);
  return details;
}

function setFullLyrics(text, { open = false } = {}) {
  const details = ensureFullLyricsNode();
  const pre = details?.querySelector('.lyrics-full-text');
  if (!details || !pre) return;
  const value = String(text || '').trim();
  details.hidden = !value;
  details.open = Boolean(value && open);
  pre.textContent = value;
}

async function search(params, signal) {
  const url = new URL(LYRICS_API);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { 'Lrclib-Client': 'WinampMusic/0.3 (github.com/bambuchastudent/winampmusic)' },
  });
  if (!response.ok) throw new Error(`lyrics HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

function chooseRecord(records, title, artist, duration) {
  const candidates = records.filter((item) => item.syncedLyrics || item.plainLyrics);
  candidates.sort((x, y) => score(y, title, artist, duration) - score(x, title, artist, duration));
  return candidates[0] || null;
}

async function resolveLyrics(track, signal) {
  const title = cleanTitle(track.title);
  const artist = cleanArtist(track.artist);
  const duration = Number(track.durationSeconds || 0) || parseTime(track.duration || durationNode?.textContent);
  let records = await search({ track_name: title, artist_name: artist }, signal);
  let record = chooseRecord(records, title, artist, duration);

  if (!record) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    records = await search({ q: `${artist} ${title}`.trim() }, signal);
    record = chooseRecord(records, title, artist, duration);
  }

  if (!record) return { found: false, title, artist };
  return {
    found: true,
    title,
    artist,
    providerArtist: record.artistName || artist,
    providerTrack: record.trackName || title,
    syncedLyrics: String(record.syncedLyrics || ''),
    plainLyrics: String(record.plainLyrics || ''),
  };
}

function renderLyrics(result) {
  timedLyrics = result?.syncedLyrics ? parseLrc(result.syncedLyrics) : [];
  activeLine = -2;

  if (!result?.found) {
    lyricsStatus.textContent = 'ORIGINAL - LYRICS NOT FOUND';
    lyricsCurrent.textContent = 'No lyrics found yet';
    lyricsNext.textContent = 'Background search will retry later';
    setFullLyrics('');
    return;
  }

  const fullText = result.plainLyrics || timedLyrics.map((line) => line.text).join('\n');
  lyricsStatus.textContent = `ORIGINAL - ${result.providerArtist || result.artist || 'LYRICS'}`;
  setFullLyrics(fullText, { open: !timedLyrics.length });

  if (timedLyrics.length) {
    lyricsCurrent.textContent = '...';
    lyricsNext.textContent = 'Synchronized lyrics ready';
    syncLyrics(true);
  } else {
    lyricsCurrent.textContent = result.providerTrack || result.title || 'Lyrics found';
    lyricsNext.textContent = 'Full lyrics loaded in background';
  }
}

function currentTrackDescriptor() {
  const id = currentVideoId();
  return {
    id,
    title: titleNode?.textContent?.trim() || '',
    artist: artistNode?.textContent?.trim() || '',
    duration: durationNode?.textContent?.trim() || '',
  };
}

async function loadLyrics({ force = false } = {}) {
  const track = currentTrackDescriptor();
  const title = cleanTitle(track.title);
  const artist = cleanArtist(track.artist);
  const key = track.id || `${title}::${artist}`;
  const signature = `${key}::${title}::${artist}`;
  if (!title || weakTitle(title, track.id)) return;
  if (!force && signature === activeTrack) return;

  activeTrack = signature;
  timedLyrics = [];
  activeLine = -2;
  requestController?.abort();
  requestController = new AbortController();
  lyricsBar.hidden = false;
  lyricsStatus.textContent = 'ORIGINAL - FINDING LYRICS';
  lyricsCurrent.textContent = title;
  lyricsNext.textContent = artist || 'Searching the internet in background…';
  setFullLyrics('');

  const cached = !force && cachedEntry(key);
  if (cached) {
    renderLyrics(cached);
    schedulePrefetch(track.id);
    return;
  }

  try {
    const result = await resolveLyrics({ ...track, title, artist }, requestController.signal);
    saveCacheEntry(key, result);
    if (signature !== activeTrack) return;
    renderLyrics(result);
    schedulePrefetch(track.id);
  } catch (error) {
    if (error.name === 'AbortError') return;
    lyricsStatus.textContent = 'ORIGINAL - LYRICS SEARCH RETRYING';
    lyricsCurrent.textContent = title;
    lyricsNext.textContent = 'Internet lookup failed; playback continues';
  }
}

function syncLyrics(force = false) {
  if (!timedLyrics.length) return;
  const duration = parseTime(durationNode?.textContent);
  if (!duration) return;
  const position = (Number(seekNode?.value) / 1000) * duration;
  let index = -1;
  for (let i = 0; i < timedLyrics.length; i += 1) {
    if (timedLyrics[i].time > position + 0.08) break;
    index = i;
  }
  if (!force && index === activeLine) return;
  activeLine = index;
  lyricsCurrent.textContent = index >= 0 ? timedLyrics[index].text : '...';
  lyricsNext.textContent = timedLyrics[index + 1]?.text || '';
  lyricsBar.classList.toggle('lyrics-active', index >= 0);
}

function schedulePrefetch(currentId) {
  clearTimeout(prefetchTimer);
  if (!currentId) return;
  prefetchTimer = setTimeout(() => prefetchNeighbors(currentId).catch(() => {}), 1400);
}

async function prefetchNeighbors(currentId) {
  const library = readJson(LIBRARY_KEY, []);
  if (!Array.isArray(library) || library.length < 2) return;
  const index = library.findIndex((track) => track?.id === currentId);
  if (index < 0) return;

  const targets = [library[index + 1], library[index + 2]].filter(Boolean);
  for (const track of targets) {
    const id = String(track.id || '');
    const title = cleanTitle(track.title);
    const artist = cleanArtist(track.artist);
    if (!id || weakTitle(title, id) || cachedEntry(id)) continue;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const result = await resolveLyrics({ ...track, title, artist }, controller.signal);
      clearTimeout(timer);
      saveCacheEntry(id, result);
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

if (titleNode) new MutationObserver(() => loadLyrics().catch(() => {})).observe(titleNode, { childList: true, subtree: true, characterData: true });
if (artistNode) new MutationObserver(() => loadLyrics().catch(() => {})).observe(artistNode, { childList: true, subtree: true, characterData: true });
setInterval(syncLyrics, 250);
setInterval(() => loadLyrics().catch(() => {}), 1500);
window.addEventListener('DOMContentLoaded', () => setTimeout(() => loadLyrics().catch(() => {}), 350));

const commentsScript = document.createElement('script');
commentsScript.src = './comments.js';
commentsScript.defer = true;
document.head.appendChild(commentsScript);
