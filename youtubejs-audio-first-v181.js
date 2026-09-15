(() => {
  'use strict';
  if (window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181__) return;
  window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/youtubei.js@18.0.0/+esm';
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.playsInline = true;
  let innertubePromise = null;
  let directActive = false;
  let generation = 0;
  let currentIndex = -1;
  let originalPlayIndex = null;

  const $ = (id) => document.getElementById(id);
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const status = (text) => { const el = $('status'); if (el) el.textContent = text; };
  const readLibrary = () => { try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const savedIndex = () => Number(localStorage.getItem(CURRENT_KEY));

  function setUi(index, track, playing) {
    currentIndex = index;
    try { localStorage.setItem(CURRENT_KEY, String(index)); } catch {}
    if ($('nowTitle')) $('nowTitle').textContent = clean(track?.title) || 'Unknown track';
    if ($('nowArtist')) $('nowArtist').textContent = clean(track?.artist) || 'Unknown artist';
    if ($('playButton')) $('playButton').textContent = playing ? '⏸' : '▶';
    document.querySelectorAll('.track').forEach((row) => {
      const active = Number(row.dataset.index) === index;
      row.classList.toggle('active', active);
      const marker = row.querySelector('.track-play');
      if (marker) marker.textContent = active && playing ? '⏸' : '▶';
    });
  }

  async function getInnertube() {
    if (!innertubePromise) innertubePromise = import(MODULE_URL).then(({ Innertube }) => Innertube.create());
    return innertubePromise;
  }

  async function resolveAudio(videoId) {
    const yt = await getInnertube();
    const format = await yt.getStreamingData(videoId, { type: 'audio', quality: 'best' });
    if (!format?.url) throw new Error('YouTube.js returned no audio URL');
    return { url: format.url, mimeType: clean(format.mime_type || format.mimeType), bitrate: Number(format.bitrate) || 0 };
  }

  function mediaMetadata(track) {
    if (!navigator.mediaSession || typeof MediaMetadata !== 'function') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: clean(track?.title) || 'Unknown track',
      artist: clean(track?.artist) || 'Unknown artist',
      album: clean(track?.album || track?.playlist),
      artwork: clean(track?.thumbnail) ? [{ src: clean(track.thumbnail) }] : [],
    });
  }

  function mediaAction(name, fn) { try { navigator.mediaSession?.setActionHandler(name, fn); } catch {} }
  function bindMediaSession() {
    mediaAction('play', () => audio.play());
    mediaAction('pause', () => audio.pause());
    mediaAction('previoustrack', () => window.playIndex(Math.max(0, savedIndex() - 1)));
    mediaAction('nexttrack', () => window.playIndex(savedIndex() + 1));
    mediaAction('seekbackward', (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); });
    mediaAction('seekforward', (d) => { audio.currentTime = Math.min(Number.isFinite(audio.duration) ? audio.duration : Infinity, audio.currentTime + (d.seekOffset || 10)); });
    mediaAction('seekto', (d) => { if (Number.isFinite(d.seekTime)) audio.currentTime = d.seekTime; });
  }

  async function fallback(index, reason) {
    directActive = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    status('YOUTUBE · FALLBACK');
    console.warn('[ÁmpulaMP] YouTube.js audio fallback', reason);
    return originalPlayIndex(index);
  }

  async function playAudioFirst(index) {
    const library = readLibrary();
    if (!library.length) return originalPlayIndex(index);
    const normalized = ((Number(index) % library.length) + library.length) % library.length;
    const track = library[normalized];
    const videoId = clean(track?.id);
    if (!VIDEO_ID_RE.test(videoId)) return originalPlayIndex(index);
    const request = ++generation;
    directActive = false;
    setUi(normalized, track, false);
    status('YOUTUBEJS · RESOLVING AUDIO…');
    try {
      const resolved = await resolveAudio(videoId);
      if (request !== generation) return;
      window.ampMusicYouTube150?.suspend?.();
      audio.src = resolved.url;
      audio.volume = Math.max(0, Math.min(1, (Number($('volume')?.value) || 75) / 100));
      mediaMetadata(track);
      bindMediaSession();
      await audio.play();
      if (request !== generation) { audio.pause(); return; }
      directActive = true;
      setUi(normalized, track, true);
      status('PLAYING · YOUTUBEJS · AUDIO');
    } catch (error) {
      if (request === generation) return fallback(normalized, error);
    }
  }

  function install() {
    if (window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181_INSTALLED__ || typeof window.playIndex !== 'function') return false;
    window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181_INSTALLED__ = true;
    originalPlayIndex = window.playIndex.bind(window);
    window.playIndex = playAudioFirst;

    $('playButton')?.addEventListener('click', (event) => {
      if (!directActive) return;
      event.stopImmediatePropagation();
      if (audio.paused) audio.play(); else audio.pause();
    }, true);
    $('volume')?.addEventListener('input', () => { if (directActive) audio.volume = Math.max(0, Math.min(1, Number($('volume').value) / 100)); }, true);
    $('seek')?.addEventListener('change', () => { if (directActive && Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number($('seek').value) / 1000 * audio.duration; }, true);
    return true;
  }

  audio.addEventListener('play', () => { if (directActive) { setUi(currentIndex, readLibrary()[currentIndex], true); status('PLAYING · YOUTUBEJS · AUDIO'); } });
  audio.addEventListener('pause', () => { if (directActive) { setUi(currentIndex, readLibrary()[currentIndex], false); status('PAUSED · YOUTUBEJS · AUDIO'); } });
  audio.addEventListener('timeupdate', () => {
    if (!directActive) return;
    const elapsed = $('elapsed'); const duration = $('duration'); const seek = $('seek');
    const fmt = (v) => { const s = Math.max(0, Math.floor(Number(v) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    if (elapsed) elapsed.textContent = fmt(audio.currentTime);
    if (duration && Number.isFinite(audio.duration)) duration.textContent = fmt(audio.duration);
    if (seek && Number.isFinite(audio.duration) && audio.duration > 0 && document.activeElement !== seek) seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
  });
  audio.addEventListener('ended', () => { if (directActive) window.playIndex(savedIndex() + 1); });
  audio.addEventListener('error', () => { if (directActive) fallback(currentIndex, new Error('native audio playback error')); });

  window.ampulaYouTubeJsAudio181 = { audio, resolveAudio, isActive: () => directActive };
  if (!install()) window.addEventListener('DOMContentLoaded', install, { once: true });
})();
