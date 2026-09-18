(() => {
  'use strict';
  if (window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181__) return;
  window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const YOUTUBEJS_ONLY = window.__AMPULA_YOUTUBEJS_ONLY__ === true || new URLSearchParams(window.location.search).get('playback') === 'youtubejs';
  const MODULE_URL = 'https://esm.sh/youtubei.js@18.0.0/web?bundle';
  const RELAY_BASE = 'https://seep.eu.org/';
  const ALLOWED_HOST = /(^|\.)youtube\.com$|^youtubei\.googleapis\.com$|(^|\.)googlevideo\.com$|(^|\.)ytimg\.com$/i;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.playsInline = true;
  audio.crossOrigin = 'anonymous';

  let innertubePromise = null;
  let directActive = false;
  let generation = 0;
  let currentIndex = -1;
  let originalPlayIndex = null;
  let primeObjectUrl = '';

  const $ = (id) => document.getElementById(id);
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const status = (text) => { const el = $('status'); if (el) el.textContent = text; };
  const readLibrary = () => { try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const savedIndex = () => Number(localStorage.getItem(CURRENT_KEY));
  const errorText = (error) => clean(error?.message || error || 'unknown error').slice(0, 120);

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

  function isAllowedTarget(value) {
    try {
      const url = value instanceof URL ? value : new URL(String(value));
      return url.protocol === 'https:' && ALLOWED_HOST.test(url.hostname);
    } catch {
      return false;
    }
  }

  function relayUrl(value) {
    const url = value instanceof URL ? value : new URL(String(value));
    if (!isAllowedTarget(url)) throw new Error(`YouTube.js blocked relay target: ${url.hostname}`);
    return `${RELAY_BASE}${url.href}`;
  }

  async function relayFetch(input, init = {}) {
    const source = input instanceof Request ? input : new Request(input, init);
    const target = new URL(source.url);
    if (!isAllowedTarget(target)) throw new Error(`YouTube.js blocked request target: ${target.hostname}`);

    const headers = new Headers(source.headers);
    for (const header of [
      'authorization', 'cookie', 'proxy-authorization', 'x-goog-authuser',
      'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'
    ]) headers.delete(header);

    const method = String(init.method || source.method || 'GET').toUpperCase();
    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      if (init.body != null) body = init.body;
      else body = await source.clone().arrayBuffer();
    }

    return fetch(relayUrl(target), {
      method,
      headers,
      body,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });
  }

  function installInterpreter(Platform) {
    if (!Platform?.shim) return;
    Platform.shim.eval = async (data) => new Function(data.output)();
  }

  async function getInnertube() {
    if (!innertubePromise) {
      innertubePromise = import(MODULE_URL).then(async ({ Innertube, Platform }) => {
        installInterpreter(Platform);
        return Innertube.create({
          fetch: relayFetch,
          generate_session_locally: true,
          retrieve_player: true,
          enable_session_cache: true,
        });
      });
    }
    return innertubePromise;
  }

  async function resolveAudio(videoId) {
    const yt = await getInnertube();
    const format = await yt.getStreamingData(videoId, { type: 'audio', quality: 'best' });
    if (!format?.url) throw new Error('YouTube.js returned no audio URL');
    return {
      url: relayUrl(format.url),
      mimeType: clean(format.mime_type || format.mimeType),
      bitrate: Number(format.bitrate) || 0,
    };
  }

  function makeSilentWavUrl() {
    const sampleRate = 8000;
    const samples = 1600;
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const write = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    write(36, 'data');
    view.setUint32(40, samples, true);
    new Uint8Array(buffer, 44).fill(128);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  function clearPrimeUrl() {
    if (!primeObjectUrl) return;
    try { URL.revokeObjectURL(primeObjectUrl); } catch {}
    primeObjectUrl = '';
  }

  function primeAudio() {
    directActive = false;
    clearPrimeUrl();
    primeObjectUrl = makeSilentWavUrl();
    audio.loop = true;
    audio.src = primeObjectUrl;
    audio.volume = 0;
    const started = audio.play();
    started?.catch?.(() => {});
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
    mediaAction('previoustrack', () => $('prevButton')?.click());
    mediaAction('nexttrack', () => $('nextButton')?.click());
    mediaAction('seekbackward', (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); });
    mediaAction('seekforward', (d) => { audio.currentTime = Math.min(Number.isFinite(audio.duration) ? audio.duration : Infinity, audio.currentTime + (d.seekOffset || 10)); });
    mediaAction('seekto', (d) => { if (Number.isFinite(d.seekTime)) audio.currentTime = d.seekTime; });
  }

  async function fallback(index, reason) {
    directActive = false;
    audio.loop = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    clearPrimeUrl();
    if (YOUTUBEJS_ONLY) {
      status(`YOUTUBEJS ERROR · ${errorText(reason)}`);
      console.error('[ÁmpulaMP] YouTube.js-only playback failed', reason);
      return false;
    }
    status('YOUTUBE · FALLBACK');
    console.warn('[ÁmpulaMP] YouTube.js audio fallback', reason);
    return originalPlayIndex(index);
  }

  async function playAudioFirst(index) {
    const library = readLibrary();
    if (!library.length) {
      if (YOUTUBEJS_ONLY) { status('YOUTUBEJS ERROR · LIBRARY EMPTY'); return false; }
      return originalPlayIndex(index);
    }
    const normalized = ((Number(index) % library.length) + library.length) % library.length;
    const track = library[normalized];
    const videoId = clean(track?.id);
    if (!VIDEO_ID_RE.test(videoId)) {
      if (YOUTUBEJS_ONLY) { status('YOUTUBEJS ERROR · NO YOUTUBE ID'); return false; }
      return originalPlayIndex(index);
    }

    const request = ++generation;
    primeAudio();
    setUi(normalized, track, false);
    status('YOUTUBEJS · RESOLVING AUDIO…');

    try {
      const resolved = await resolveAudio(videoId);
      if (request !== generation) return;

      window.ampMusicYouTube150?.suspend?.();
      audio.loop = false;
      audio.src = resolved.url;
      audio.volume = Math.max(0, Math.min(1, (Number($('volume')?.value) || 75) / 100));
      mediaMetadata(track);
      bindMediaSession();
      await audio.play();
      clearPrimeUrl();
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
      if (YOUTUBEJS_ONLY) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (directActive) {
          if (audio.paused) void audio.play(); else audio.pause();
          return;
        }
        const rows = readLibrary();
        if (!rows.length) { status('YOUTUBEJS ERROR · LIBRARY EMPTY'); return; }
        const saved = savedIndex();
        const index = Number.isInteger(saved) && saved >= 0 && saved < rows.length ? saved : 0;
        void playAudioFirst(index);
        return;
      }
      if (!directActive) return;
      event.stopImmediatePropagation();
      if (audio.paused) void audio.play(); else audio.pause();
    }, true);
    $('volume')?.addEventListener('input', () => {
      if (directActive) audio.volume = Math.max(0, Math.min(1, Number($('volume').value) / 100));
    }, true);
    $('seek')?.addEventListener('change', () => {
      if (directActive && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Number($('seek').value) / 1000 * audio.duration;
      }
    }, true);
    return true;
  }

  audio.addEventListener('play', () => {
    if (directActive) {
      setUi(currentIndex, readLibrary()[currentIndex], true);
      status('PLAYING · YOUTUBEJS · AUDIO');
    }
  });
  audio.addEventListener('pause', () => {
    if (directActive) {
      setUi(currentIndex, readLibrary()[currentIndex], false);
      status('PAUSED · YOUTUBEJS · AUDIO');
    }
  });
  audio.addEventListener('timeupdate', () => {
    if (!directActive) return;
    const elapsed = $('elapsed'); const duration = $('duration'); const seek = $('seek');
    const fmt = (v) => { const s = Math.max(0, Math.floor(Number(v) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    if (elapsed) elapsed.textContent = fmt(audio.currentTime);
    if (duration && Number.isFinite(audio.duration)) duration.textContent = fmt(audio.duration);
    if (seek && Number.isFinite(audio.duration) && audio.duration > 0 && document.activeElement !== seek) {
      seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
    }
  });
  audio.addEventListener('ended', () => {
    if (directActive) $('nextButton')?.click();
  });
  audio.addEventListener('error', () => {
    if (directActive) void fallback(currentIndex, new Error('native audio playback error'));
  });

  window.ampulaYouTubeJsAudio181 = {
    onlyMode: YOUTUBEJS_ONLY,
    audio,
    resolveAudio,
    relayFetch,
    isActive: () => directActive,
    relay: RELAY_BASE,
  };
  function installWithRetry(attempt = 0) {
    if (install()) return;
    if (attempt < 80) setTimeout(() => installWithRetry(attempt + 1), 50);
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => installWithRetry(), { once: true });
  else installWithRetry();
})();
