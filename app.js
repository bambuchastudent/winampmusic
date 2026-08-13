const STORAGE_KEY = 'winampmusic.library.v1';
const PLAYER_STATE_KEY = 'winampmusic.player.v1';
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
  install: $('installButton'),
};

let library = loadJson(STORAGE_KEY, []);
let currentIndex = -1;
let player = null;
let playerReady = false;
let deferredInstallPrompt = null;
let progressTimer = null;

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  renderLibrary();
}

function normalizeTrack(input) {
  if (!input || typeof input !== 'object') return null;
  const id = String(input.id || '').trim();
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  return {
    id,
    title: String(input.title || 'Untitled video').trim().slice(0, 500),
    artist: String(input.artist || input.channel || 'YouTube').trim().slice(0, 250),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    thumbnail: typeof input.thumbnail === 'string' ? input.thumbnail : '',
    playlist: typeof input.playlist === 'string' ? input.playlist.slice(0, 250) : '',
    importedAt: input.importedAt || new Date().toISOString(),
  };
}

function importTracks(rawTracks) {
  if (!Array.isArray(rawTracks)) return { added: 0, total: library.length };
  const byId = new Map(library.map((track) => [track.id, track]));
  let added = 0;
  for (const rawTrack of rawTracks) {
    const track = normalizeTrack(rawTrack);
    if (!track) continue;
    if (!byId.has(track.id)) added += 1;
    byId.set(track.id, { ...byId.get(track.id), ...track });
  }
  library = [...byId.values()];
  saveLibrary();
  ui.status.textContent = added ? `IMPORTED ${added}` : 'LIBRARY UP TO DATE';
  return { added, total: library.length };
}

function renderLibrary() {
  const q = ui.search.value.trim().toLowerCase();
  const visible = library
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !q || `${track.title} ${track.artist}`.toLowerCase().includes(q));

  ui.count.textContent = library.length;
  ui.empty.hidden = library.length > 0;
  ui.search.hidden = library.length === 0;
  ui.clear.hidden = library.length === 0;
  ui.list.innerHTML = '';

  const fragment = document.createDocumentFragment();
  for (const { track, index } of visible) {
    const li = document.createElement('li');
    li.className = `track${index === currentIndex ? ' active' : ''}`;
    li.dataset.index = index;

    const number = document.createElement('span');
    number.className = 'track-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const main = document.createElement('button');
    main.className = 'track-main track-play';
    main.type = 'button';
    main.setAttribute('aria-label', `Play ${track.title}`);
    main.innerHTML = `<div class="track-title"></div><div class="track-artist"></div>`;
    main.querySelector('.track-title').textContent = track.title;
    main.querySelector('.track-artist').textContent = track.artist;
    main.addEventListener('click', () => playIndex(index));

    const icon = document.createElement('button');
    icon.className = 'track-play';
    icon.type = 'button';
    icon.textContent = index === currentIndex ? '▶' : '›';
    icon.setAttribute('aria-label', `Play ${track.title}`);
    icon.addEventListener('click', () => playIndex(index));

    li.append(number, main, icon);
    fragment.appendChild(li);
  }
  ui.list.appendChild(fragment);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setNowPlaying(track) {
  ui.title.textContent = track?.title || 'No track selected';
  ui.artist.textContent = track?.artist || 'Import a YouTube playlist to begin';
  if ('mediaSession' in navigator && track) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.playlist || 'YouTube',
      artwork: track.thumbnail ? [{ src: track.thumbnail }] : [],
    });
  }
}

function playIndex(index) {
  if (!library.length) return;
  const safeIndex = ((index % library.length) + library.length) % library.length;
  currentIndex = safeIndex;
  const track = library[currentIndex];
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

function updateProgress() {
  if (!playerReady || !player?.getDuration) return;
  const duration = Number(player.getDuration()) || 0;
  const current = Number(player.getCurrentTime()) || 0;
  ui.elapsed.textContent = formatTime(current);
  ui.duration.textContent = formatTime(duration);
  ui.seek.value = duration ? Math.round((current / duration) * 1000) : 0;

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
    playerVars: {
      playsinline: 1,
      controls: 0,
      rel: 0,
      origin: location.origin,
    },
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

async function openImportDialog() {
  ui.dialog.showModal();
  if (ui.script.value) return;
  try {
    const response = await fetch('./youtube-import.js', { cache: 'no-store' });
    if (!response.ok) throw new Error('Importer unavailable');
    ui.script.value = await response.text();
  } catch {
    ui.script.value = '// Could not load importer. Reload this page and try again.';
  }
}

window.addEventListener('message', (event) => {
  if (!ALLOWED_IMPORT_ORIGINS.has(event.origin)) return;
  const payload = event.data;
  if (!payload || payload.type !== 'WINAMP_MUSIC_IMPORT' || payload.version !== 1) return;
  const result = importTracks(payload.tracks);
  if (event.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage({
      type: 'WINAMP_MUSIC_IMPORT_ACK',
      version: 1,
      added: result.added,
      total: result.total,
    }, event.origin);
  }
  if (library.length && currentIndex < 0) {
    setNowPlaying(library[0]);
  }
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
ui.clear.addEventListener('click', () => {
  if (!confirm(`Remove ${library.length} imported tracks from this browser?`)) return;
  library = [];
  currentIndex = -1;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PLAYER_STATE_KEY);
  player?.stopVideo?.();
  setNowPlaying(null);
  ui.status.textContent = 'READY';
  ui.play.textContent = '▶';
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

// Small public bridge used by feature modules loaded after app.js.
// Keep the canonical library/player state owned by this file; helpers call through here.
window.importTracks = importTracks;
window.renderLibrary = renderLibrary;
window.playIndex = playIndex;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

renderLibrary();
