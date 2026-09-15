(() => {
  'use strict';
  if (window.__AMPULA_BACKGROUND_PLAYBACK_114__) return;
  window.__AMPULA_BACKGROUND_PLAYBACK_114__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.playsInline = true;
  let generation = 0;
  let directActive = false;
  let directIndex = -1;
  let ytPromise = null;
  const originalPlayIndex = window.playIndex;
  const clean = value => String(value ?? '').trim();

  function readLibrary() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function videoId(raw) {
    const value = clean(raw);
    if (VIDEO_ID_RE.test(value)) return value;
    try {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      const id = url.hostname.includes('youtu.be') ? parts[0] : url.searchParams.get('v') || (['shorts','embed','live'].includes(parts[0]) ? parts[1] : '');
      return VIDEO_ID_RE.test(id || '') ? id : '';
    } catch { return ''; }
  }

  async function youtube() {
    if (!ytPromise) ytPromise = import('https://esm.sh/youtubei.js@18.0.0?bundle').then(async mod => {
      const Innertube = mod.Innertube || mod.default;
      if (!Innertube?.create) throw new Error('YouTube.js Innertube unavailable');
      return Innertube.create({ retrieve_player: true });
    }).catch(error => { ytPromise = null; throw error; });
    return ytPromise;
  }

  async function resolveAudio(id) {
    const client = await youtube();
    const format = await client.getStreamingData(id, { type: 'audio', quality: 'best' });
    if (!format?.url) throw new Error('No direct audio format');
    return { url: format.url, mimeType: format.mime_type || format.mimeType || '', bitrate: format.bitrate || 0 };
  }

  function publish(track) {
    if (!navigator.mediaSession || typeof MediaMetadata !== 'function') return;
    const artwork = clean(track?.thumbnail || track?.artwork || track?.image);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: clean(track?.title) || 'Unknown track',
      artist: clean(track?.artist) || 'Unknown artist',
      album: clean(track?.album || track?.playlist),
      artwork: artwork ? [{ src: artwork }] : [],
    });
  }

  function syncUi(playing) {
    const button = document.getElementById('playButton');
    const status = document.getElementById('status');
    if (button) button.textContent = playing ? '⏸' : '▶';
    if (status) status.textContent = playing ? 'PLAYING · BACKGROUND AUDIO' : 'PAUSED · BACKGROUND AUDIO';
  }

  async function tryDirect(index, token) {
    const items = readLibrary();
    const track = items[index];
    const id = videoId(track?.id);
    if (!id) return false;
    try {
      const resolved = await resolveAudio(id);
      if (token !== generation) return false;
      window.ampMusicYouTube150?.suspend?.();
      audio.src = resolved.url;
      directIndex = index;
      directActive = true;
      publish(track);
      await audio.play();
      syncUi(true);
      return true;
    } catch (error) {
      if (token === generation) console.info('[ÁmpulaMP] direct audio unavailable; iframe fallback remains active', error);
      return false;
    }
  }

  if (typeof originalPlayIndex === 'function') {
    window.playIndex = function playIndexWithBackground(index) {
      const token = ++generation;
      directActive = false;
      audio.pause();
      const result = originalPlayIndex(index);
      queueMicrotask(() => {
        const saved = Number(localStorage.getItem(CURRENT_KEY));
        const target = Number.isInteger(saved) && saved >= 0 ? saved : Number(index);
        void tryDirect(target, token);
      });
      return result;
    };
  }

  function toggleDirect(event) {
    if (!directActive) return;
    event?.preventDefault?.(); event?.stopImmediatePropagation?.();
    if (audio.paused) void audio.play().then(() => syncUi(true)); else { audio.pause(); syncUi(false); }
  }

  document.getElementById('playButton')?.addEventListener('click', toggleDirect, true);
  document.getElementById('volume')?.addEventListener('input', event => { if (directActive) audio.volume = Math.max(0, Math.min(1, Number(event.target.value || 0) / 100)); }, true);
  document.getElementById('seek')?.addEventListener('change', event => {
    if (!directActive || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    event.preventDefault(); event.stopImmediatePropagation(); audio.currentTime = (Number(event.target.value) / 1000) * audio.duration;
  }, true);

  audio.addEventListener('ended', () => { if (directActive) window.playIndex?.(directIndex + 1); });
  audio.addEventListener('play', () => syncUi(true));
  audio.addEventListener('pause', () => { if (directActive && !audio.ended) syncUi(false); });

  window.ampMusicBackgroundPlay = () => directActive ? audio.play() : document.getElementById('playButton')?.click();
  window.ampMusicBackgroundPause = () => directActive ? audio.pause() : document.getElementById('playButton')?.click();
  window.ampMusicBackgroundSeekBy = delta => { if (directActive) audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + Number(delta || 0))); };
  window.ampMusicBackgroundSeekTo = seconds => { if (directActive && Number.isFinite(seconds)) audio.currentTime = Math.max(0, seconds); };
  window.ampMusicBackgroundPlayback114 = { audio, resolveAudio, isDirectActive: () => directActive };
})();