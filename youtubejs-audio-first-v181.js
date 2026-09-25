(() => {
  'use strict';
  if (window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181__) return;
  window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const YOUTUBEJS_ONLY = window.__AMPULA_YOUTUBEJS_ONLY__ === true || new URLSearchParams(window.location.search).get('playback') === 'youtubejs';
  const MODULE_URL = 'https://esm.sh/youtubei.js@18.0.0/web?bundle';
  const firstPartyRelayBase = () => clean(window.AMPULA_YOUTUBEJS_RELAY);
  const firstPartyRelay = (url) => {
    const base = firstPartyRelayBase();
    if (!base) return '';
    const relay = new URL(`youtubejs${url.pathname}`, base.endsWith('/') ? base : `${base}/`);
    relay.search = url.search;
    relay.searchParams.set('__host', url.host);
    return relay.href;
  };
  const RELAY_BUILDERS = [
    (url) => `https://test.cors.workers.dev/?${encodeURIComponent(url.href)}`,
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url.href)}`,
    (url) => `https://seep.eu.org/${url.href}`,
  ];
  const ALLOWED_HOST = /(^|\.)youtube\.com$|^youtubei\.googleapis\.com$|(^|\.)googlevideo\.com$|(^|\.)ytimg\.com$/i;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.playsInline = true;

  let innertubePromise = null;
  let directActive = false;
  let generation = 0;
  let currentIndex = -1;
  let originalPlayIndex = null;
  let primeObjectUrl = '';
  let lastDiagnostics = null;

  const $ = (id) => document.getElementById(id);
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const status = (text) => { const el = $('status'); if (el) el.textContent = text; };
  const readLibrary = () => { try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const savedIndex = () => Number(localStorage.getItem(CURRENT_KEY));
  const errorText = (error) => clean(error?.message || error || 'unknown error').slice(0, 120);

  function errorCode(error) {
    const message = clean(error?.message || error);
    if (/Streaming data not available/i.test(message)) return 'STREAM_DATA_UNAVAILABLE';
    if (/no audio URL/i.test(message)) return 'AUDIO_URL_MISSING';
    if (/all relays failed/i.test(message)) return 'RELAY_UNAVAILABLE';
    if (/decipher|signature|No valid URL/i.test(message)) return 'URL_DECIPHER_FAILED';
    return 'RESOLUTION_FAILED';
  }

  function playabilityCode(value) {
    const code = clean(value);
    return /^[A-Z_]{2,32}$/.test(code) ? code : 'UNKNOWN';
  }

  function diagnosticView() {
    let details = $('youtubeJsDiagnostics');
    if (details) return details;
    const screen = $('status')?.closest('.screen');
    if (!screen) return null;
    details = document.createElement('details');
    details.id = 'youtubeJsDiagnostics';
    details.style.cssText = 'margin-top:8px;color:#aeb7c4;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
    const summary = document.createElement('summary');
    summary.textContent = 'Audio diagnostics';
    details.appendChild(summary);
    const content = document.createElement('pre');
    content.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0';
    details.appendChild(content);
    screen.appendChild(details);
    return details;
  }

  function showDiagnostics() {
    const details = diagnosticView();
    if (!details || !lastDiagnostics) return;
    details.hidden = false;
    details.querySelector('pre').textContent = JSON.stringify(lastDiagnostics, null, 2);
  }

  function clearDiagnostics() {
    lastDiagnostics = null;
    const details = $('youtubeJsDiagnostics');
    if (details) details.hidden = true;
  }

  function hasFirstPartyRelay() {
    try {
      return new URL(firstPartyRelayBase()).protocol === 'https:';
    } catch {
      return false;
    }
  }

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

  function requestCandidates(value, headers) {
    const url = value instanceof URL ? value : new URL(String(value));
    if (!isAllowedTarget(url)) throw new Error(`YouTube.js blocked relay target: ${url.hostname}`);
    const candidates = [];
    const projectRelay = firstPartyRelay(url);
    if (projectRelay) candidates.push({ label: 'first-party', url: projectRelay, headers: new Headers(headers) });
    candidates.push({ label: 'direct', url: url.href, headers: new Headers(headers) });

    if (/\/youtubei\//.test(url.pathname)) {
      const googleapis = new URL(url.href);
      googleapis.hostname = 'youtubei.googleapis.com';
      const apiKey = headers.get('x-goog-api-key');
      const googleHeaders = new Headers(headers);
      if (apiKey) {
        googleapis.searchParams.set('key', apiKey);
        googleHeaders.delete('x-goog-api-key');
      }
      googleHeaders.delete('x-origin');
      candidates.push({ label: 'youtubei.googleapis.com', url: googleapis.href, headers: googleHeaders });
    }

    for (const build of RELAY_BUILDERS) {
      const relay = build(url);
      candidates.push({ label: new URL(relay).hostname, url: relay, headers: new Headers(headers) });
    }
    return candidates;
  }

  async function relayFetch(input, init = {}) {
    const source = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const target = new URL(source.url);
    if (!isAllowedTarget(target)) throw new Error(`YouTube.js blocked request target: ${target.hostname}`);

    const headers = new Headers(source.headers);
    for (const header of [
      'authorization', 'cookie', 'proxy-authorization', 'x-goog-authuser',
      'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'
    ]) headers.delete(header);

    const method = String(source.method || 'GET').toUpperCase();
    let bodyBytes = null;
    if (method !== 'GET' && method !== 'HEAD') bodyBytes = await source.clone().arrayBuffer();

    const failures = [];
    for (const candidate of requestCandidates(target, headers)) {
      try {
        const response = await fetch(candidate.url, {
          method,
          headers: candidate.headers,
          body: bodyBytes ? bodyBytes.slice(0) : undefined,
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'follow',
          referrerPolicy: 'no-referrer',
        });
        if (response.ok) return response;
        failures.push(`${candidate.label} HTTP ${response.status}`);
      } catch (error) {
        failures.push(`${candidate.label} ${errorText(error)}`);
      }
    }
    throw new Error(`all relays failed: ${failures.join(' | ')}`);
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
      }).catch((error) => { innertubePromise = null; throw error; });
    }
    return innertubePromise;
  }

  async function resolveAudio(videoId, suppliedInnertube) {
    const report = { videoId: VIDEO_ID_RE.test(videoId) ? videoId : 'INVALID', stage: 'resolution', attempts: [], errorCode: null };
    lastDiagnostics = report;
    let format;
    try {
      const yt = suppliedInnertube || await getInnertube();
      const primary = { client: 'WEB', playability: 'UNKNOWN', audioFormats: null, errorCode: null };
      report.attempts.push(primary);
      try {
        format = await yt.getStreamingData(videoId, { type: 'audio', quality: 'best' });
      } catch (error) {
        primary.errorCode = errorCode(error);
        if (primary.errorCode !== 'STREAM_DATA_UNAVAILABLE') throw error;
        let info;
        try { info = await yt.getBasicInfo(videoId); }
        catch { throw error; }
        primary.playability = playabilityCode(info?.playability_status?.status);
        const formats = info?.streaming_data;
        primary.audioFormats = [...(formats?.adaptive_formats || []), ...(formats?.formats || [])]
          .filter((item) => item?.has_audio || /^audio\//i.test(clean(item?.mime_type || item?.mimeType))).length;
        if (primary.playability !== 'OK' || primary.audioFormats !== 0) throw error;

        const music = { client: 'YTMUSIC', playability: 'UNKNOWN', audioFormats: null, errorCode: null };
        report.attempts.push(music);
        try { format = await yt.getStreamingData(videoId, { type: 'audio', quality: 'best', client: 'YTMUSIC' }); }
        catch (musicError) { music.errorCode = errorCode(musicError); throw musicError; }
      }
      if (!format?.url) throw new Error('YouTube.js returned no audio URL');
    } catch (error) {
      report.errorCode = errorCode(error);
      if (lastDiagnostics === report) showDiagnostics();
      throw error;
    }
    return {
      url: format.url,
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
    if (!lastDiagnostics) lastDiagnostics = { videoId: clean(readLibrary()[index]?.id).slice(0, 11), stage: 'media', attempts: [], errorCode: null };
    if (!lastDiagnostics.errorCode) lastDiagnostics.errorCode = lastDiagnostics.stage === 'media' ? 'MEDIA_PLAY_FAILED' : errorCode(reason);
    showDiagnostics();
    directActive = false;
    audio.loop = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    clearPrimeUrl();
    if (YOUTUBEJS_ONLY) {
      status(`YOUTUBEJS ERROR · ${lastDiagnostics.errorCode}`);
      console.error('[ÁmpulaMP] YouTube.js-only playback failed', lastDiagnostics);
      return false;
    }
    status('YOUTUBE · FALLBACK');
    console.warn('[ÁmpulaMP] YouTube.js audio fallback', lastDiagnostics);
    return originalPlayIndex(index);
  }

  async function playAudioFirst(index, suppliedInnertube) {
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
      const resolved = await resolveAudio(videoId, suppliedInnertube);
      if (request !== generation) return;

      window.ampMusicYouTube150?.suspend?.();
      audio.loop = false;
      audio.src = resolved.url;
      audio.volume = Math.max(0, Math.min(1, (Number($('volume')?.value) || 75) / 100));
      mediaMetadata(track);
      bindMediaSession();
      if (lastDiagnostics) lastDiagnostics.stage = 'media';
      await audio.play();
      clearPrimeUrl();
      if (request !== generation) { audio.pause(); return; }

      directActive = true;
      clearDiagnostics();
      setUi(normalized, track, true);
      status('PLAYING · YOUTUBEJS · AUDIO');
    } catch (error) {
      if (request === generation) return fallback(normalized, error);
    }
  }

  function install() {
    if (window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181_INSTALLED__ || typeof window.playIndex !== 'function') return false;
    window.__AMPULA_YOUTUBEJS_AUDIO_FIRST_181_INSTALLED__ = true;
    if (!hasFirstPartyRelay()) {
      if (YOUTUBEJS_ONLY) {
        status('YOUTUBEJS ERROR · RELAY NOT CONFIGURED');
        console.error('[ÁmpulaMP] YouTube.js-only playback requires the dedicated relay');
      } else {
        console.info('[ÁmpulaMP] YouTube.js relay unavailable; keeping YouTube iframe playback');
      }
      return true;
    }
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
    if (directActive) {
      lastDiagnostics = { videoId: VIDEO_ID_RE.test(clean(readLibrary()[currentIndex]?.id)) ? clean(readLibrary()[currentIndex].id) : 'INVALID', stage: 'media', attempts: [], errorCode: `MEDIA_ERROR_${Math.max(0, Math.min(4, Number(audio.error?.code) || 0))}` };
      void fallback(currentIndex, new Error('native audio playback error'));
    }
  });

  window.ampulaYouTubeJsAudio181 = {
    onlyMode: YOUTUBEJS_ONLY,
    audio,
    resolveAudio,
    diagnostics: () => lastDiagnostics ? JSON.parse(JSON.stringify(lastDiagnostics)) : null,
    relayFetch,
    isActive: () => directActive,
    relays: ['first-party', 'direct', 'youtubei.googleapis.com', ...RELAY_BUILDERS.map((build) => new URL(build(new URL('https://www.youtube.com/'))).hostname)],
  };
  function installWithRetry(attempt = 0) {
    if (install()) return;
    if (attempt < 80) setTimeout(() => installWithRetry(attempt + 1), 50);
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => installWithRetry(), { once: true });
  else installWithRetry();
})();
