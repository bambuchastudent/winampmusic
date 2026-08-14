const STORAGE_KEY = 'winampmusic.library.v1';
const PLAYER_STATE_KEY = 'winampmusic.player.v1';
const META_PREFIX = 'WMETA␞';
const META_SEP = '␞';
const BADGE_SEP = '␟';
const ALLOWED_IMPORT_ORIGINS = new Set([
  'https://www.youtube.com',
  'https://youtube.com',
  'https://music.youtube.com',
]);

const $ = (id) => document.getElementById(id);
const ui = {
  status: $('status'),
  title: $('nowTitle'),
  artist: $('nowArtist'),
  elapsed: $('elapsed'),
  duration: $('duration'),
  seek: $('seek'),
  volume: $('volume'),
  play: $('playButton'),
  prev: $('prevButton'),
  next: $('nextButton'),
  shuffle: $('shuffleButton'),
  list: $('trackList'),
  count: $('trackCount'),
  search: $('search'),
  clear: $('clearButton'),
  empty: $('emptyState'),
  dialog: $('importDialog'),
  importHelp: $('importHelpButton'),
  emptyImport: $('emptyImportButton'),
  script: $('importScript'),
  copyScript: $('copyScriptButton'),
  copyBookmarklet: $('copyBookmarkletButton'),
  bookmarklet: $('bookmarkletScript'),
  install: $('installButton'),
  youtubeOpen: $('openYoutubeButton'),
  youtubeOpenLibrary: $('openYoutubeButtonLibrary'),
  share: $('sharePlaylistButton'),
};

let currentIndex = -1;
let player = null;
let playerReady = false;
let deferredInstallPrompt = null;
let progressTimer = null;
let lastDurationSaved = '';

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validDuration(value) {
  const text = clean(value);
  return /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(text) ? text : '';
}

function isNoiseLabel(value) {
  const text = clean(value);
  return !text || /^(?:nan(?:\s*\/\s*nan)?|undefined|null|n\/a)$/i.test(text);
}

function normalizeBadges(value) {
  const input = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  const result = [];
  for (const raw of input) {
    const badge = clean(raw);
    if (isNoiseLabel(badge) || validDuration(badge) || badge.length > 80) continue;
    const key = badge.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(badge);
    if (result.length >= 8) break;
  }
  return result;
}

function splitLeadingDuration(title, explicitDuration = '') {
  const source = clean(title);
  let duration = validDuration(explicitDuration);
  let cleanTitle = source;
  const match = source.match(/^((?:\d{1,2}:)?\d{1,2}:\d{2})(?=\D|$)\s*/);
  if (match) {
    duration ||= validDuration(match[1]);
    cleanTitle = clean(source.slice(match[0].length).replace(/^[\-–—|•·]+\s*/, ''));
  }
  return { title: cleanTitle || source || 'Untitled video', duration };
}

function unpackLegacyMetadata(input) {
  const playlist = String(input?.playlist || '');
  if (!playlist.startsWith(META_PREFIX)) return input;
  const [, duration = '', badgeBlob = '', realPlaylist = ''] = playlist.split(META_SEP, 4);
  return {
    ...input,
    playlist: clean(realPlaylist),
    duration: validDuration(input.duration) || validDuration(duration),
    badges: normalizeBadges(input.badges?.length ? input.badges : badgeBlob.split(BADGE_SEP)),
  };
}

function isWeakTitle(value, id = '') {
  const text = clean(value);
  if (!text) return true;
  if (/^(?:current track|track \d+|джем|jam|mix|radio)$/i.test(text)) return true;
  if (id && text.toLowerCase() === `youtube ${id}`.toLowerCase()) return true;
  return false;
}

function normalizeTrack(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') return null;
  const input = unpackLegacyMetadata(rawInput);
  const id = clean(input.id);
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  const parsed = splitLeadingDuration(input.title, input.duration || input.durationText);
  return {
    id,
    title: clean(parsed.title || `YouTube ${id}`).slice(0, 500),
    artist: clean(input.artist || input.channel || 'YouTube').slice(0, 250),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    thumbnail: typeof input.thumbnail === 'string' ? input.thumbnail : '',
    playlist: clean(input.playlist).slice(0, 250),
    duration: parsed.duration,
    badges: normalizeBadges(input.badges || input.youtubeBadges || input.labels),
    importedAt: input.importedAt || new Date().toISOString(),
  };
}

function humanPlaylist(value) {
  const text = clean(value);
  if (isNoiseLabel(text)) return '';
  if (/^(?:RD|PL|UU|LL|FL|OLAK5uy)[\w-]+$/i.test(text)) return '';
  return text;
}

function visibleLabels(track) {
  const labels = [...normalizeBadges(track.badges)];
  const playlist = humanPlaylist(track.playlist);
  if (playlist && playlist.toLocaleLowerCase() !== track.title.toLocaleLowerCase()) labels.push(playlist);
  const hashtags = track.title.match(/#[\p{L}\p{N}_-]+/gu) || [];
  labels.push(...hashtags);
  return normalizeBadges(labels).slice(0, 4);
}

let library = loadJson(STORAGE_KEY, []).map(normalizeTrack).filter(Boolean);
localStorage.setItem(STORAGE_KEY, JSON.stringify(library));

function saveLibrary({ render = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  if (render) renderLibrary();
}

function mergeTrack(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing, ...incoming };
  if (isWeakTitle(incoming.title, incoming.id) && !isWeakTitle(existing.title, existing.id)) merged.title = existing.title;
  if ((!incoming.artist || incoming.artist === 'YouTube') && existing.artist && existing.artist !== 'YouTube') merged.artist = existing.artist;
  if (!incoming.duration && existing.duration) merged.duration = existing.duration;
  if (!incoming.playlist && existing.playlist) merged.playlist = existing.playlist;
  merged.badges = normalizeBadges([...(existing.badges || []), ...(incoming.badges || [])]);
  return normalizeTrack(merged);
}

function importTracks(rawTracks) {
  if (!Array.isArray(rawTracks)) return { added: 0, total: library.length };
  const byId = new Map(library.map((track) => [track.id, track]));
  let added = 0;
  for (const rawTrack of rawTracks) {
    const track = normalizeTrack(rawTrack);
    if (!track) continue;
    const existing = byId.get(track.id);
    if (!existing) added += 1;
    byId.set(track.id, mergeTrack(existing, track));
  }
  library = [...byId.values()];
  saveLibrary();
  ui.status.textContent = added ? `IMPORTED ${added}` : 'LIBRARY UP TO DATE';
  return { added, total: library.length };
}

function searchText(track) {
  return [
    track.title,
    track.artist,
    humanPlaylist(track.playlist),
    ...(track.badges || []),
    track.id,
  ].join(' ').toLocaleLowerCase();
}

function encodeSharePayload(payload) {
  const json = JSON.stringify(payload);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

function decodeSharePayload(value) {
  if (!value) return [];
  try {
    const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return [];
  }
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('playlist', encodeSharePayload(library));
  url.hash = '';
  return url.toString();
}

async function sharePlaylist() {
  if (!library.length) {
    ui.status.textContent = 'NO TRACKS TO SHARE';
    return;
  }

  const shareUrl = buildShareUrl();
  const shareData = {
    title: 'Winamp Music playlist',
    text: `Listen to my ${library.length}-track Winamp Music playlist`,
    url: shareUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      ui.status.textContent = 'PLAYLIST SHARED';
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      ui.status.textContent = 'LINK COPIED';
      return;
    }
    window.prompt('Copy playlist URL', shareUrl);
    ui.status.textContent = 'SHARE LINK READY';
  } catch {
    ui.status.textContent = 'SHARE CANCELLED';
  }
}

function renderLibrary() {
  const q = clean(ui.search.value).toLocaleLowerCase();
  const visible = library
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !q || searchText(track).includes(q));

  ui.count.textContent = q ? `${visible.length}/${library.length}` : library.length;
  ui.empty.hidden = library.length > 0;
  ui.search.hidden = false;
  ui.clear.hidden = library.length === 0;
  ui.list.replaceChildren();

  const fragment = document.createDocumentFragment();
  for (const { track, index } of visible) {
    const li = document.createElement('li');
    li.className = `track${index === currentIndex ? ' active' : ''}`;
    li.dataset.index = index;

    const number = document.createElement('span');
    number.className = 'track-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const main = document.createElement('button');
    main.className = 'track-main';
    main.type = 'button';
    main.setAttribute('aria-label', `Play ${track.title}`);
    main.addEventListener('click', () => playIndex(index));

    const title = document.createElement('span');
    title.className = 'track-title';
    title.textContent = track.title;
    title.title = track.title;

    const meta = document.createElement('span');
    meta.className = 'track-meta';
    const artist = document.createElement('span');
    artist.className = 'track-artist';
    artist.textContent = track.artist || 'YouTube';
    meta.appendChild(artist);

    const labels = visibleLabels(track);
    if (labels.length) {
      const labelWrap = document.createElement('span');
      labelWrap.className = 'track-youtube-labels';
      for (const value of labels) {
        const badge = document.createElement('span');
        badge.className = 'youtube-label';
        badge.textContent = value;
        badge.title = value;
        labelWrap.appendChild(badge);
      }
      meta.appendChild(labelWrap);
    }

    main.append(title, meta);

    const duration = document.createElement('span');
    duration.className = 'track-duration';
    duration.textContent = track.duration || '—';
    duration.title = track.duration ? `Length ${track.duration}` : 'Length unknown until played';

    li.append(number, main, duration);
    fragment.appendChild(li);
  }
  ui.list.appendChild(fragment);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setNowPlaying(track) {
  ui.title.textContent = track?.title || 'No track selected';
  ui.artist.textContent = track?.artist || 'Import a YouTube playlist to begin';
  if ('mediaSession' in navigator && track) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: humanPlaylist(track.playlist) || 'YouTube',
      artwork: track.thumbnail ? [{ src: track.thumbnail }] : [],
    });
  }
}

function playIndex(index) {
  if (!library.length) return;
  const safeIndex = ((index % library.length) + library.length) % library.length;
  currentIndex = safeIndex;
  const track = library[currentIndex];
  lastDurationSaved = track.duration || '';
  setNowPlaying(track);
  renderLibrary();
  localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ currentId: track.id }));

  if (!playerReady) {
    ui.status.textContent = 'PLAYER LOADING';
    return;
  }
  player.loadVideoById(track.id);
  player.setVolume(Number(ui.volume.value));
  ui.status.textContent = 'PLAYING';
  ui.play.textContent = '⏸';
  startProgressUpdates();
}

function playPrevious() {
  if (!library.length) return;
  playIndex(currentIndex <= 0 ? library.length - 1 : currentIndex - 1);
}

function playNext() {
  if (!library.length) return;
  playIndex(currentIndex < 0 ? 0 : currentIndex + 1);
}

function playRandom() {
  if (!library.length) return;
  if (library.length === 1) return playIndex(0);
  let next = currentIndex;
  while (next === currentIndex) next = Math.floor(Math.random() * library.length);
  playIndex(next);
}

function togglePlayback() {
  if (!library.length) return openImportDialog();
  if (currentIndex < 0) return playIndex(0);
  if (!playerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
}

function startProgressUpdates() {
  clearInterval(progressTimer);
  progressTimer = setInterval(updateProgress, 500);
}

function refreshCurrentMetadata() {
  if (!playerReady || currentIndex < 0) return;
  const data = player.getVideoData?.();
  const track = library[currentIndex];
  if (!track || !data || data.video_id !== track.id) return;
  const title = clean(data.title);
  const artist = clean(data.author);
  let changed = false;
  if (title && title !== track.title) {
    track.title = title;
    changed = true;
  }
  if (artist && artist !== track.artist) {
    track.artist = artist;
    changed = true;
  }
  if (changed) {
    library[currentIndex] = normalizeTrack(track);
    saveLibrary();
    setNowPlaying(library[currentIndex]);
  }
}

function updateProgress() {
  if (!playerReady || !player?.getDuration) return;
  const duration = Number(player.getDuration()) || 0;
  const current = Number(player.getCurrentTime()) || 0;
  const formattedDuration = formatTime(duration);
  ui.elapsed.textContent = formatTime(current);
  ui.duration.textContent = formattedDuration;
  ui.seek.value = duration ? Math.round((current / duration) * 1000) : 0;

  if (duration > 0 && currentIndex >= 0 && formattedDuration !== lastDurationSaved) {
    library[currentIndex] = normalizeTrack({ ...library[currentIndex], duration: formattedDuration });
    lastDurationSaved = formattedDuration;
    saveLibrary();
  }

  if ('mediaSession' in navigator && duration > 0 && current <= duration) {
    try {
      navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.max(0, current) });
    } catch {}
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    ui.status.textContent = 'PLAYING';
    ui.play.textContent = '⏸';
    setTimeout(refreshCurrentMetadata, 250);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  } else if (event.data === YT.PlayerState.PAUSED) {
    ui.status.textContent = 'PAUSED';
    ui.play.textContent = '▶';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  } else if (event.data === YT.PlayerState.ENDED) {
    playNext();
  }
}

function initYouTubePlayer() {
  if (player || !window.YT?.Player) return;
  player = new YT.Player('youtubePlayer', {
    width: '1',
    height: '1',
    playerVars: { playsinline: 1, controls: 0, rel: 0, origin: location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        player.setVolume(Number(ui.volume.value));
        ui.status.textContent = 'READY';
        const saved = loadJson(PLAYER_STATE_KEY, {});
        const savedIndex = library.findIndex((track) => track.id === saved.currentId);
        if (savedIndex >= 0) {
          currentIndex = savedIndex;
          setNowPlaying(library[savedIndex]);
          renderLibrary();
        }
      },
      onStateChange: onPlayerStateChange,
      onError: () => {
        ui.status.textContent = 'TRACK UNAVAILABLE';
        setTimeout(playNext, 900);
      },
    },
  });
}

window.onYouTubeIframeAPIReady = initYouTubePlayer;
if (window.YT?.Player) initYouTubePlayer();

function buildBookmarklet() {
  const appUrl = 'https://bambuchastudent.github.io/winampmusic/';
  const scriptUrl = new URL('./youtube-import.js', appUrl).toString();
  return `javascript:(function(){if(!/(^|\.)youtube\.com$/.test(location.hostname)&&!/(^|\.)music\.youtube\.com$/.test(location.hostname)){alert('Open this on YouTube or YouTube Music before running the importer.');return;}var s=document.createElement('script');s.src=${JSON.stringify(scriptUrl + '?t=' + Date.now())};s.onload=function(){console.log('[Winamp Music] importer loaded');};document.body.appendChild(s);})();`;
}

async function openImportDialog() {
  ui.dialog.showModal();
  if (!ui.script.value) {
    try {
      const response = await fetch('./youtube-import.js', { cache: 'no-store' });
      if (!response.ok) throw new Error('Importer unavailable');
      ui.script.value = await response.text();
    } catch {
      ui.script.value = '// Could not load importer. Reload this page and try again.';
    }
  }
  if (!ui.bookmarklet.value) ui.bookmarklet.value = buildBookmarklet();
}

window.addEventListener('message', (event) => {
  if (!ALLOWED_IMPORT_ORIGINS.has(event.origin)) return;
  const payload = event.data;
  if (!payload || payload.type !== 'WINAMP_MUSIC_IMPORT' || payload.version !== 1) return;
  const result = importTracks(payload.tracks);
  if (event.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage({ type: 'WINAMP_MUSIC_IMPORT_ACK', version: 1, added: result.added, total: result.total }, event.origin);
  }
  if (library.length && currentIndex < 0) setNowPlaying(library[0]);
});

ui.play.addEventListener('click', togglePlayback);
ui.prev.addEventListener('click', playPrevious);
ui.next.addEventListener('click', playNext);
ui.shuffle.addEventListener('click', playRandom);
ui.search.addEventListener('input', renderLibrary);
ui.importHelp.addEventListener('click', openImportDialog);
ui.emptyImport.addEventListener('click', openImportDialog);
ui.copyScript.addEventListener('click', async () => {
  await navigator.clipboard.writeText(ui.script.value);
  const original = ui.copyScript.textContent;
  ui.copyScript.textContent = 'Copied';
  setTimeout(() => { ui.copyScript.textContent = original; }, 1200);
});
ui.copyBookmarklet?.addEventListener('click', async () => {
  if (!ui.bookmarklet.value) ui.bookmarklet.value = buildBookmarklet();
  await navigator.clipboard.writeText(ui.bookmarklet.value);
  const original = ui.copyBookmarklet.textContent;
  ui.copyBookmarklet.textContent = 'Copied';
  setTimeout(() => { ui.copyBookmarklet.textContent = original; }, 1200);
});
ui.share.addEventListener('click', sharePlaylist);
ui.youtubeOpen?.addEventListener('click', (event) => {
  event.preventDefault();
  window.open('https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Ffeed%2Flibrary', '_blank', 'noopener,noreferrer');
  ui.status.textContent = 'YOUTUBE LOGIN';
});
ui.youtubeOpenLibrary?.addEventListener('click', (event) => {
  event.preventDefault();
  window.open('https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F', '_blank', 'noopener,noreferrer');
  ui.status.textContent = 'YOUTUBE MUSIC LOGIN';
});
ui.clear.addEventListener('click', async () => {
  if (!confirm(`Reset the ${library.length}-track playlist and cached player state?`)) return;
  library = [];
  currentIndex = -1;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PLAYER_STATE_KEY);
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('winampmusic-shell-')).map((key) => caches.delete(key)));
  }
  player?.stopVideo?.();
  setNowPlaying(null);
  ui.status.textContent = 'CACHE RESET';
  ui.play.textContent = '▶';
  ui.search.value = '';
  renderLibrary();
});
ui.volume.addEventListener('input', () => playerReady && player.setVolume(Number(ui.volume.value)));
ui.seek.addEventListener('change', () => {
  if (!playerReady) return;
  const duration = Number(player.getDuration()) || 0;
  if (duration) player.seekTo((Number(ui.seek.value) / 1000) * duration, true);
});

if ('mediaSession' in navigator) {
  const actions = {
    play: () => playerReady && player.playVideo(),
    pause: () => playerReady && player.pauseVideo(),
    previoustrack: playPrevious,
    nexttrack: playNext,
    seekbackward: (details) => playerReady && player.seekTo(Math.max(0, player.getCurrentTime() - (details.seekOffset || 10)), true),
    seekforward: (details) => playerReady && player.seekTo(Math.min(player.getDuration(), player.getCurrentTime() + (details.seekOffset || 10)), true),
    seekto: (details) => playerReady && player.seekTo(details.seekTime, true),
  };
  for (const [action, handler] of Object.entries(actions)) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  ui.install.hidden = false;
});
ui.install.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  deferredInstallPrompt = null;
  ui.install.hidden = true;
});

function loadSharedPlaylistFromUrl() {
  const shared = new URLSearchParams(window.location.search).get('playlist');
  if (!shared) return;
  const payload = decodeSharePayload(shared);
  if (!Array.isArray(payload) || !payload.length) return;
  const result = importTracks(payload);
  if (library.length && currentIndex < 0) setNowPlaying(library[0]);
  ui.status.textContent = result.added ? `SHARED PLAYLIST IMPORTED (${result.total})` : 'SHARED PLAYLIST LOADED';
}

window.importTracks = importTracks;
window.renderLibrary = renderLibrary;
window.playIndex = playIndex;
window.sharePlaylist = sharePlaylist;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

ui.clear.textContent = 'Reset cache';
ui.clear.title = 'Clear playlist, player state, and app cache';
loadSharedPlaylistFromUrl();
renderLibrary();
