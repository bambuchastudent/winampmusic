(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_KIT_150__) return;
  window.__AMP_MUSIC_APPLE_KIT_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const MUSIC_KIT_SRC = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $('status'), title: $('nowTitle'), artist: $('nowArtist'), elapsed: $('elapsed'),
    duration: $('duration'), seek: $('seek'), volume: $('volume'), play: $('playButton'),
  };

  const legacyPlayIndex = window.playIndex;
  const directFallback = window.ampMusicPlayDirectIndex;
  let music = null;
  let musicPromise = null;
  let active = false;
  let paused = false;
  let activeIndex = -1;
  let fallbackDepth = 0;
  let progressTimer = null;
  let generation = 0;
  let musicCommands = Promise.resolve();

  function config() {
    return window.AMP_MUSIC_APPLE_CONFIG || {};
  }

  function configured() {
    return Boolean(config()?.enabled && clean(config()?.developerToken));
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function currentIndex() {
    const library = readLibrary();
    const value = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(value) && value >= 0 && value < library.length ? value : -1;
  }

  function isApple(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    return badges.includes('Apple Music') || Boolean(clean(track?.appleTrackId)) || /music\.apple\.com/i.test(clean(track?.sourceUrl));
  }

  function setStatus(text) {
    if (ui.status) ui.status.textContent = text;
  }

  function formatTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function updateNow(track, index) {
    if (ui.title) ui.title.textContent = clean(track?.title) || 'Apple Music';
    if (ui.artist) ui.artist.textContent = clean(track?.artist) || 'Apple Music';
    try { localStorage.setItem(CURRENT_KEY, String(index)); } catch {}
    document.querySelectorAll('#trackList .track').forEach((row) => {
      const rowIndex = Number(row.dataset.index);
      row.classList.toggle('active', rowIndex === index);
      const marker = row.querySelector('.track-play');
      if (marker) marker.textContent = rowIndex === index && active && !paused ? '⏸' : '▶';
    });
  }

  function loadMusicKitScript() {
    if (window.MusicKit?.configure) return Promise.resolve(window.MusicKit);
    const existing = document.querySelector('script[data-amp-musickit-150]');
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const done = () => window.MusicKit?.configure ? resolve(window.MusicKit) : reject(new Error('MusicKit loaded without API'));
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error('MusicKit failed to load')), { once: true });
      if (!existing) {
        script.src = MUSIC_KIT_SRC;
        script.async = true;
        script.dataset.ampMusickit150 = '1';
        document.head.appendChild(script);
      }
    });
  }

  async function ensureMusicKit() {
    if (!configured()) throw new Error('MusicKit developer token is not configured');
    if (music) return music;
    if (musicPromise) return musicPromise;
    musicPromise = (async () => {
      const MusicKit = await loadMusicKitScript();
      const cfg = config();
      const instance = await MusicKit.configure({
        developerToken: clean(cfg.developerToken),
        app: cfg.app || { name: 'AmpMusic', build: '1.5.0' },
      });
      music = instance || MusicKit.getInstance?.();
      if (!music) throw new Error('MusicKit instance unavailable');
      return music;
    })().catch((error) => {
      musicPromise = null;
      throw error;
    });
    return musicPromise;
  }

  async function authorize(instance) {
    if (instance?.isAuthorized) return true;
    if (typeof instance?.authorize !== 'function') return false;
    setStatus('APPLE MUSIC · AUTHORIZE…');
    const token = await instance.authorize();
    return Boolean(token || instance.isAuthorized);
  }

  function startProgress() {
    if (progressTimer) return;
    progressTimer = setInterval(() => {
      if (!active || !music) return;
      const current = Number(music.currentPlaybackTime || 0);
      const total = Number(music.currentPlaybackDuration || 0);
      if (ui.elapsed) ui.elapsed.textContent = formatTime(current);
      if (ui.duration) ui.duration.textContent = formatTime(total);
      if (ui.seek && total > 0 && document.activeElement !== ui.seek) {
        ui.seek.value = String(Math.round((current / total) * 1000));
      }
    }, 600);
  }

  async function stopMusicKit() {
    if (!music || !active) return;
    const stopping = music;
    active = false;
    paused = false;
    activeIndex = -1;
    if (ui.play) ui.play.textContent = '▶';
    try { await stopping.stop?.(); } catch {}
  }

  async function tryMusicKit(index, request = generation) {
    const library = readLibrary();
    const track = library[index];
    const appleTrackId = clean(track?.appleTrackId);
    if (!track || !isApple(track) || !/^\d+$/.test(appleTrackId) || !configured()) return false;

    updateNow(track, index);
    setStatus('APPLE MUSIC · CONNECTING…');
    if (ui.play) ui.play.textContent = '…';

    try {
      const instance = await ensureMusicKit();
      if (request !== generation) return null;
      const authorized = await authorize(instance);
      if (request !== generation) return null;
      if (!authorized) throw new Error('Apple Music authorization was not granted');
      // MusicKit owns one mutable queue: serialize mutations, then recheck intent.
      const command = musicCommands.then(async () => {
        if (request !== generation) return false;
        await instance.setQueue({ song: appleTrackId });
        if (request !== generation) return false;
        if (ui.volume) instance.volume = Math.max(0, Math.min(1, Number(ui.volume.value || 75) / 100));
        await instance.play();
        if (request !== generation) { await instance.stop?.(); return false; }
        return true;
      });
      musicCommands = command.catch(() => {});
      if (!await command || request !== generation) return null;
      active = true;
      paused = false;
      activeIndex = index;
      updateNow(track, index);
      if (ui.play) ui.play.textContent = '⏸';
      setStatus('APPLE MUSIC · PLAYING');
      startProgress();
      return true;
    } catch (error) {
      if (request !== generation) return null;
      console.warn('[AmpMusic MusicKit]', error);
      active = false;
      paused = false;
      if (ui.play) ui.play.textContent = '▶';
      return false;
    }
  }

  async function fallbackInsidePlayer(index, request = generation) {
    if (fallbackDepth > 0) {
      setStatus('TRACK UNAVAILABLE · STAYING IN AMP MUSIC');
      return false;
    }
    fallbackDepth += 1;
    try {
      setStatus('YOUTUBE DIRECT · RESOLVING…');
      if (typeof directFallback !== 'function') {
        setStatus('TRACK UNAVAILABLE · STAYING IN AMP MUSIC');
        return false;
      }
      const result = await directFallback(index);
      if (request !== generation) return null;
      if (result === null) return null;
      if (result) setStatus('YOUTUBE DIRECT · PLAYING');
      else setStatus('TRACK UNAVAILABLE · STAYING IN AMP MUSIC');
      return Boolean(result);
    } catch (error) {
      if (request !== generation) return null;
      console.warn('[AmpMusic Apple fallback]', error);
      setStatus('TRACK UNAVAILABLE · STAYING IN AMP MUSIC');
      return false;
    } finally {
      fallbackDepth -= 1;
    }
  }

  async function playPreferred(index) {
    const library = readLibrary();
    if (!library.length) return false;
    const request = ++generation;
    const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
    const track = library[safeIndex];
    window.ampMusicDirect150?.stop();
    window.ampMusicYouTube150?.suspend();
    if (!isApple(track)) {
      await stopMusicKit();
      if (request !== generation) return null;
      if (window.ampMusicRadio150?.wantsDirect(track)) return directFallback?.(safeIndex);
      return typeof legacyPlayIndex === 'function' ? legacyPlayIndex(safeIndex) : false;
    }

    updateNow(track, safeIndex);
    await stopMusicKit();
    if (request !== generation) return null;
    if (await tryMusicKit(safeIndex, request)) return true;
    if (request !== generation) return null;
    return fallbackInsidePlayer(safeIndex, request);
  }

  async function toggleMusicKit() {
    if (!active || !music) {
      const index = currentIndex();
      if (index >= 0) return playPreferred(index);
      return false;
    }
    try {
      if (paused) {
        await music.play();
        paused = false;
        if (ui.play) ui.play.textContent = '⏸';
        setStatus('APPLE MUSIC · PLAYING');
      } else {
        await music.pause();
        paused = true;
        if (ui.play) ui.play.textContent = '▶';
        setStatus('APPLE MUSIC · PAUSED');
      }
      updateNow(readLibrary()[activeIndex], activeIndex);
      return true;
    } catch {
      return false;
    }
  }

  const preferredDirect = async (index) => {
    const track = readLibrary()[Number(index)];
    if (isApple(track)) return playPreferred(index);
    return typeof directFallback === 'function' ? directFallback(index) : legacyPlayIndex?.(index);
  };

  window.ampMusicPlayPreferredIndex = playPreferred;
  window.ampMusicPlayDirectIndex = preferredDirect;
  window.playIndex = (index) => {
    const library = readLibrary();
    if (!library.length) return legacyPlayIndex?.(index);
    const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
    const track = library[safeIndex];
    if (isApple(track)) {
      if (fallbackDepth > 0) {
        setStatus('TRACK UNAVAILABLE · STAYING IN AMP MUSIC');
        return false;
      }
      void playPreferred(safeIndex);
      return true;
    }
    return playPreferred(safeIndex);
  };

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('button, .track-main');
    if (!target) return;

    if (target.classList?.contains('track-main')) {
      const index = Number(target.dataset.index);
      const track = readLibrary()[index];
      if (!Number.isInteger(index) || (!isApple(track) && !active)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void playPreferred(index);
      return;
    }

    const id = target.id;
    const index = active ? activeIndex : currentIndex();
    const track = readLibrary()[index];
    const appleContext = active || isApple(track);
    if (!appleContext) return;

    if (id === 'playButton') {
      if (!active && (window.ampMusicDirect150?.isActive() || window.ampMusicDirect150?.isPending() || window.ampMusicYouTube150?.isActive())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void toggleMusicKit();
      return;
    }

    if (id === 'prevButton' || id === 'nextButton') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const delta = id === 'prevButton' ? -1 : 1;
      void playPreferred(index + delta);
      return;
    }

    if (id === 'shuffleButton') {
      const library = readLibrary();
      if (!library.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      let next = index;
      while (library.length > 1 && next === index) next = Math.floor(Math.random() * library.length);
      void playPreferred(next);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (!active || !music || event.target !== ui.seek) return;
    const total = Number(music.currentPlaybackDuration || 0);
    if (total <= 0) return;
    const seconds = (Number(ui.seek.value) / 1000) * total;
    try { music.seekToTime?.(seconds); } catch {}
  }, true);

  ui.volume?.addEventListener('input', () => {
    if (!active || !music) return;
    try { music.volume = Math.max(0, Math.min(1, Number(ui.volume.value || 0) / 100)); } catch {}
  }, { passive: true });

  function patchPlaylistApi() {
    const api = window.ampMusicApplePlaylist150;
    if (!api || api.__ampMusicKitPreferred150 || typeof api.importPlaylistUrl !== 'function') return;
    const original = api.importPlaylistUrl.bind(api);
    api.importPlaylistUrl = async (value, options = {}) => {
      const shouldPlay = options.play !== false;
      const result = await original(value, { ...options, play: false });
      if (shouldPlay && result?.tracks?.length) {
        const first = result.tracks[0];
        const library = readLibrary();
        const index = library.findIndex((track) =>
          (clean(first?.appleTrackId) && clean(track?.appleTrackId) === clean(first.appleTrackId)) ||
          clean(track?.id) === clean(first?.id));
        if (index >= 0) void playPreferred(index);
      }
      return result;
    };
    api.__ampMusicKitPreferred150 = true;
  }

  patchPlaylistApi();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node?.tagName === 'SCRIPT' && /apple-playlist-import-v150\.js/i.test(node.src || '')) {
          node.addEventListener('load', () => queueMicrotask(patchPlaylistApi), { once: true });
        }
      }
    }
    queueMicrotask(patchPlaylistApi);
  });
  observer.observe(document.head, { childList: true });

  window.ampMusicAppleKit150 = {
    configured,
    isActive: () => active,
    playPreferred,
    tryMusicKit,
    stop: stopMusicKit,
  };

  console.info('[AmpMusic] MusicKit-first in-player bridge 1.5 ready', { configured: configured() });
})();
