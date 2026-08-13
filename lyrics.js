const LYRICS_API = 'https://lrclib.net/api/search';
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

function cleanTitle(text) {
  return String(text || '')
    .replace(/\s*[[(](official )?(music )?video[])]]/ig, '')
    .replace(/\s*[[(](official )?audio[])]]/ig, '')
    .replace(/\s*[[(](lyrics?|lyric video)[])]]/ig, '')
    .replace(/\s*\|.*$/g, '')
    .trim();
}

function cleanArtist(text) {
  return String(text || '').replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').trim();
}

function parseTime(text) {
  const parts = String(text || '').split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseLrc(text) {
  const lines = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const match = raw.match(/^\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]\s*(.*)$/);
    if (!match || !match[3]) continue;
    lines.push({ time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() });
  }
  return lines.sort((a, b) => a.time - b.time);
}

function scoreRecord(record, title, artist, duration) {
  const a = String(record.trackName || '').toLowerCase();
  const b = String(record.artistName || '').toLowerCase();
  let score = 0;
  if (a === title.toLowerCase()) score += 10;
  else if (a.includes(title.toLowerCase()) || title.toLowerCase().includes(a)) score += 4;
  if (b === artist.toLowerCase()) score += 8;
  else if (b.includes(artist.toLowerCase()) || artist.toLowerCase().includes(b)) score += 3;
  if (duration && record.duration && Math.abs(Number(record.duration) - duration) <= 3) score += 5;
  return score;
}

async function searchLyrics(params, signal) {
  const url = new URL(LYRICS_API);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));
  const response = await fetch(url, {
    signal,
    headers: { 'Lrclib-Client': 'WinampMusic/0.2 (github.com/bambuchastudent/winampmusic)' },
  });
  if (!response.ok) throw new Error(`lyrics HTTP ${response.status}`);
  return response.json();
}

async function loadLyrics() {
  const rawTitle = titleNode?.textContent?.trim();
  if (!rawTitle || rawTitle === 'No track selected') return;
  const title = cleanTitle(rawTitle);
  const artist = cleanArtist(artistNode?.textContent);
  const key = `${title}::${artist}`;
  if (!title || key === activeTrack) return;
  activeTrack = key;
  timedLyrics = [];
  activeLine = -2;
  requestController?.abort();
  requestController = new AbortController();

  lyricsBar.hidden = false;
  lyricsStatus.textContent = 'ORIGINAL - FINDING LYRICS';
  lyricsCurrent.textContent = title;
  lyricsNext.textContent = artist || 'Searching synchronized text...';

  try {
    let records = await searchLyrics({ track_name: title, artist_name: artist }, requestController.signal);
    const duration = parseTime(durationNode?.textContent);
    let candidates = records.filter((item) => item.syncedLyrics);
    candidates.sort((x, y) => scoreRecord(y, title, artist, duration) - scoreRecord(x, title, artist, duration));
    let record = candidates[0];
    if (!record) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      records = await searchLyrics({ q: `${artist} ${title}`.trim() }, requestController.signal);
      candidates = records.filter((item) => item.syncedLyrics);
      candidates.sort((x, y) => scoreRecord(y, title, artist, duration) - scoreRecord(x, title, artist, duration));
      record = candidates[0];
    }
    if (!record) throw new Error('no synchronized lyrics found');
    timedLyrics = parseLrc(record.syncedLyrics);
    if (!timedLyrics.length) throw new Error('empty synchronized lyrics');
    lyricsStatus.textContent = `ORIGINAL - ${record.artistName || artist}`;
    syncLyrics(true);
  } catch (error) {
    if (error.name === 'AbortError') return;
    lyricsStatus.textContent = 'ORIGINAL - LYRICS UNAVAILABLE';
    lyricsCurrent.textContent = 'No synchronized lyrics found';
    lyricsNext.textContent = `${artist} - ${title}`;
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

if (titleNode) {
  new MutationObserver(loadLyrics).observe(titleNode, { childList: true, subtree: true, characterData: true });
}
setInterval(syncLyrics, 250);
window.addEventListener('DOMContentLoaded', () => setTimeout(loadLyrics, 500));
