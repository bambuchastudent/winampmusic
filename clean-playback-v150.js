(() => {
  'use strict';
  if (window.__AMP_MUSIC_CLEAN_PLAYBACK_150__) return;
  window.__AMP_MUSIC_CLEAN_PLAYBACK_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const PIPED_APIS = [
    'https://pipedapi.adminforge.de',
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
    'https://api.piped.yt',
  ];
  const NOISY_RE = /\b(?:ad|advert|advertisement|commercial|promo|sponsored|trailer|teaser|review|reaction|interview|podcast|karaoke)\b|(?:реклама|промо|тизер|трейлер|обзор|реакция)/i;
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $('status'), title: $('nowTitle'), artist: $('nowArtist'), elapsed: $('elapsed'),
    duration: $('duration'), seek: $('seek'), volume: $('volume'), play: $('playButton'),
    prev: $('prevButton'), next: $('nextButton'), shuffle: $('shuffleButton'), radio: $('radioButton'),
    list: $('trackList'),
  };

  let directActive = false;
  let directIndex = -1;
  let directVideoId = '';
  let directPayload = null;
  let bypassLegacyPause = false;
  let audio = null;

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveLibrary(library) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch {}
  }

  function currentIndex() {
    const value = Number(localStorage.getItem(CURRENT_KEY));
    const library = readLibrary();
    return Number.isInteger(value) && value >= 0 && value < library.length ? value : -1;
  }

  function trackIsApple(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    return badges.includes('Apple Music') || Boolean(track?.appleTrackId) || /music\.apple\.com/i.test(clean(track?.sourceUrl));
  }

  function trackIsRadio(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    return badges.includes('Radio') || clean(track?.playlist) === 'Radio';
  }

  function wantsDirect(track) {
    return trackIsApple(track) || trackIsRadio(track);
  }

  function parseVideoId(value) {
    const text = clean(value);
    if (VIDEO_ID_RE.test(text)) return text;
    try {
      const url = new URL(text, 'https://www.youtube.com');
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return VIDEO_ID_RE.test(id) ? id : '';
      }
      const id = clean(url.searchParams.get('v'));
      return VIDEO_ID_RE.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  function formatTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function setStatus(text) {
    if (ui.status) ui.status.textContent = text;
  }

  function markCurrent(index, playing = directActive && !audio?.paused) {
    if (!ui.list) return;
    ui.list.querySelectorAll('.track').forEach((row) => {
      const rowIndex = Number(row.dataset.index);
      row.classList.toggle('active', rowIndex === index);
      const marker = row.querySelector('.track-play');
      if (marker) marker.textContent = rowIndex === index && playing ? '⏸' : '▶';
    });
  }

  function updateNow(track, index) {
    if (ui.title) ui.title.textContent = clean(track?.title) || `YouTube ${parseVideoId(track?.id)}`;
    if (ui.artist) ui.artist.textContent = clean(track?.artist) || 'YouTube';
    try { localStorage.setItem(CURRENT_KEY, String(index)); } catch {}
    markCurrent(index);
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'metadata';
    audio.playsInline = true;
    audio.volume = Math.max(0, Math.min(1, Number(ui.volume?.value || 75) / 100));
    audio.addEventListener('play', () => {
      directActive = true;
      if (ui.play) ui.play.textContent = '⏸';
      setStatus(trackIsRadio(readLibrary()[directIndex]) ? 'RADIO · PLAYING' : 'PLAYING · DIRECT');
      markCurrent(directIndex, true);
    });
    audio.addEventListener('pause', () => {
      if (!directActive) return;
      if (ui.play) ui.play.textContent = '▶';
      if (!audio.ended) setStatus('PAUSED · DIRECT');
      markCurrent(directIndex, false);
    });
    audio.addEventListener('timeupdate', () => {
      if (!directActive) return;
      const current = Number(audio.currentTime) || 0;
      const total = Number(audio.duration) || 0;
      if (ui.elapsed) ui.elapsed.textContent = formatTime(current);
      if (ui.duration) ui.duration.textContent = formatTime(total);
      if (ui.seek && total > 0 && document.activeElement !== ui.seek) ui.seek.value = String(Math.round((current / total) * 1000));
    });
    audio.addEventListener('ended', () => {
      const next = directIndex + 1;
      directActive = false;
      if (ui.play) ui.play.textContent = '▶';
      void playBestIndex(next);
    });
    audio.addEventListener('error', () => {
      if (!directActive) return;
      const index = directIndex;
      const exactId = directVideoId;
      directActive = false;
      setStatus('DIRECT AUDIO FAILED · YOUTUBE FALLBACK');
      if (exactId && index >= 0) window.playIndex?.(index);
    });
    return audio;
  }

  function stopDirect() {
    if (!audio) return;
    try { audio.pause(); } catch {}
    directActive = false;
    directIndex = -1;
    directVideoId = '';
    directPayload = null;
    try { audio.removeAttribute('src'); audio.load?.(); } catch {}
  }

  function pauseLegacyIfPlaying() {
    if (directActive || bypassLegacyPause || !ui.play || !ui.status) return;
    if (clean(ui.status.textContent) !== 'PLAYING') return;
    bypassLegacyPause = true;
    try { ui.play.click(); } catch {}
    bypassLegacyPause = false;
  }

  async function fetchJson(url, timeoutMs = 5500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchStreamPayload(videoId) {
    let lastError = null;
    for (const base of PIPED_APIS) {
      try {
        const url = new URL(`/streams/${encodeURIComponent(videoId)}`, base);
        const payload = await fetchJson(url);
        const audioStreams = Array.isArray(payload?.audioStreams) ? payload.audioStreams : [];
        if (!audioStreams.some((stream) => clean(stream?.url))) throw new Error('No audio stream');
        return { ...payload, __ampBase: base };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No Piped stream source available');
  }

  function pickAudioStream(payload) {
    const streams = (Array.isArray(payload?.audioStreams) ? payload.audioStreams : [])
      .filter((stream) => clean(stream?.url) && stream?.videoOnly !== true)
      .map((stream) => ({ ...stream, __score: (/audio\/mp4|m4a/i.test(`${stream?.mimeType || ''} ${stream?.format || ''}`) ? 100000000 : 0) + Number(stream?.bitrate || 0) }))
      .sort((a, b) => b.__score - a.__score);
    return streams[0] || null;
  }

  function loadScript(src, marker) {
    const existing = document.querySelector(`script[data-amp-clean-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const done = () => { script.dataset.loaded = '1'; resolve(); };
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error(`${marker} failed`)), { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.ampCleanModule = marker;
        document.head.appendChild(script);
      }
    });
  }

  async function ensureAppleMatcher() {
    if (window.winampMusicAppleImport?.findYouTubeMatch && window.winampMusicAppleImport?.__ampStrict150) return window.winampMusicAppleImport;
    await loadScript('./apple-music-import-v064.js?v=150', 'apple-import');
    const api = window.winampMusicAppleImport;
    if (!api?.findYouTubeMatch) throw new Error('Apple matcher unavailable');
    return api;
  }

  async function strictVideoIdForTrack(track, index) {
    if (!trackIsApple(track)) return parseVideoId(track?.id);
    const api = await ensureAppleMatcher();
    const match = await api.findYouTubeMatch({
      title: clean(track?.title),
      artist: clean(track?.artist),
      durationMs: Number(track?.duration || 0) * 1000,
    }, new AbortController().signal);
    const id = parseVideoId(match?.id);
    if (!id) throw new Error('Strict Apple source unavailable');

    // The FAST core owns an in-memory working library. Feed the resolved source
    // through its existing provider-independent recording adoption path before
    // any direct-audio fallback can call playIndex with stale state.
    window.importTracks?.([{ id, title: clean(track?.title), artist: clean(track?.artist) }]);

    const library = readLibrary();
    if (library[index]) {
      library[index] = {
        ...library[index],
        id,
        thumbnail: clean(match?.thumbnail) || library[index].thumbnail,
        strictMatchedAt: new Date().toISOString(),
      };
      saveLibrary(library);
      window.renderLibrary?.();
    }
    return id;
  }

  async function playDirectIndex(index) {
    const library = readLibrary();
    if (!library.length) return false;
    const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
    const track = library[safeIndex];
    if (!track) return false;

    pauseLegacyIfPlaying();
    updateNow(track, safeIndex);
    setStatus(trackIsRadio(track) ? 'RADIO · RESOLVING' : 'RESOLVING DIRECT AUDIO…');
    if (ui.play) ui.play.textContent = '…';

    try {
      const videoId = await strictVideoIdForTrack(track, safeIndex);
      if (!VIDEO_ID_RE.test(videoId)) throw new Error('No exact video id');
      const payload = await fetchStreamPayload(videoId);
      const stream = pickAudioStream(payload);
      if (!stream) throw new Error('No playable audio stream');

      const direct = ensureAudio();
      try { direct.pause(); } catch {}
      directActive = true;
      directIndex = safeIndex;
      directVideoId = videoId;
      directPayload = payload;
      direct.src = stream.url;
      direct.volume = Math.max(0, Math.min(1, Number(ui.volume?.value || 75) / 100));
      direct.currentTime = 0;
      updateNow(readLibrary()[safeIndex] || track, safeIndex);
      try {
        await direct.play();
      } catch (error) {
        if (error?.name === 'NotAllowedError') {
          if (ui.play) ui.play.textContent = '▶';
          setStatus('DIRECT READY · TAP ▶');
          markCurrent(safeIndex, false);
          return true;
        }
        throw error;
      }
      return true;
    } catch (error) {
      console.warn('[AmpMusic direct playback]', error);
      directActive = false;
      if (ui.play) ui.play.textContent = '▶';
      setStatus('DIRECT UNAVAILABLE · YOUTUBE FALLBACK');
      window.playIndex?.(safeIndex);
      return false;
    }
  }

  async function playBestIndex(index) {
    const library = readLibrary();
    if (!library.length) return;
    const safeIndex = ((Number(index) % library.length) + library.length) % library.length;
    const track = library[safeIndex];
    if (wantsDirect(track)) {
      await playDirectIndex(safeIndex);
      return;
    }
    stopDirect();
    window.playIndex?.(safeIndex);
  }

  function relatedVideoId(item) {
    return parseVideoId(item?.url) || parseVideoId(item?.id);
  }

  function chooseRadioCandidate(payload, currentId) {
    const related = Array.isArray(payload?.relatedStreams) ? payload.relatedStreams : [];
    const candidates = related.filter((item) => {
      const id = relatedVideoId(item);
      const duration = Number(item?.duration || 0);
      return VIDEO_ID_RE.test(id) && id !== currentId && duration >= 60 && duration <= 1800 && !NOISY_RE.test(`${item?.title || ''} ${item?.uploader || item?.uploaderName || ''}`);
    });
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * Math.min(candidates.length, 8))];
  }

  async function startRadio() {
    const library = readLibrary();
    let index = currentIndex();
    if (index < 0 && library.length) index = 0;
    const track = library[index];
    if (!track) return setStatus('RADIO · LIBRARY EMPTY');
    if (ui.radio) ui.radio.textContent = '…';
    setStatus('RADIO · FINDING NEXT');
    try {
      const videoId = await strictVideoIdForTrack(track, index);
      const payload = directActive && directVideoId === videoId && directPayload ? directPayload : await fetchStreamPayload(videoId);
      const candidate = chooseRadioCandidate(payload, videoId);
      if (!candidate) throw new Error('No radio candidate');
      const id = relatedVideoId(candidate);
      const radioTrack = {
        id,
        title: clean(candidate?.title) || `YouTube ${id}`,
        artist: clean(candidate?.uploader || candidate?.uploaderName) || 'Radio',
        thumbnail: clean(candidate?.thumbnail),
        duration: Number(candidate?.duration || 0),
        playlist: 'Radio',
        badges: ['Radio', 'YouTube'],
        importedAt: new Date().toISOString(),
        radioSeedId: videoId,
      };
      window.importTracks?.([radioTrack]);
      const updated = readLibrary();
      const radioIndex = updated.findIndex((item) => parseVideoId(item?.id) === id);
      if (radioIndex < 0) throw new Error('Radio track was not saved');
      await playDirectIndex(radioIndex);
    } catch (error) {
      console.warn('[AmpMusic Radio]', error);
      setStatus('RADIO · NOTHING SAFE FOUND');
    } finally {
      if (ui.radio) ui.radio.textContent = '📻';
    }
  }

  function patchPlaylistApi(api) {
    if (!api || api.__ampDirectWrapped150 || typeof api.importPlaylistUrl !== 'function') return api;
    const original = api.importPlaylistUrl.bind(api);
    api.importPlaylistUrl = async (value, options = {}) => {
      const shouldPlay = options.play !== false;
      const result = await original(value, { ...options, play: false });
      if (shouldPlay && result?.tracks?.length) {
        const firstId = parseVideoId(result.tracks[0]?.id);
        const library = readLibrary();
        const index = library.findIndex((track) => parseVideoId(track?.id) === firstId);
        if (index >= 0) void playDirectIndex(index);
      }
      return result;
    };
    api.__ampDirectWrapped150 = true;
    return api;
  }

  let storedPlaylistApi = patchPlaylistApi(window.ampMusicApplePlaylist150);
  try {
    Object.defineProperty(window, 'ampMusicApplePlaylist150', {
      configurable: true,
      enumerable: true,
      get: () => storedPlaylistApi,
      set: (value) => { storedPlaylistApi = patchPlaylistApi(value); },
    });
  } catch {
    if (storedPlaylistApi) window.ampMusicApplePlaylist150 = storedPlaylistApi;
  }

  ui.list?.addEventListener('click', (event) => {
    const button = event.target.closest?.('.track-main');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;
    const track = readLibrary()[index];
    if (!wantsDirect(track) && !directActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (wantsDirect(track)) void playDirectIndex(index);
    else { stopDirect(); window.playIndex?.(index); }
  }, true);

  ui.play?.addEventListener('click', (event) => {
    if (bypassLegacyPause) return;
    const index = directActive ? directIndex : currentIndex();
    const track = readLibrary()[index];
    if (!directActive && !wantsDirect(track)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!directActive) { void playDirectIndex(index); return; }
    const direct = ensureAudio();
    if (direct.paused) void direct.play().catch(() => setStatus('DIRECT READY · TAP ▶'));
    else direct.pause();
  }, true);

  ui.prev?.addEventListener('click', (event) => {
    if (!directActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void playBestIndex(directIndex - 1);
  }, true);

  ui.next?.addEventListener('click', (event) => {
    if (!directActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void playBestIndex(directIndex + 1);
  }, true);

  ui.shuffle?.addEventListener('click', (event) => {
    if (!directActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const library = readLibrary();
    if (!library.length) return;
    let index = directIndex;
    while (library.length > 1 && index === directIndex) index = Math.floor(Math.random() * library.length);
    void playBestIndex(index);
  }, true);

  ui.seek?.addEventListener('change', () => {
    if (!directActive || !audio) return;
    const total = Number(audio.duration) || 0;
    if (total > 0) audio.currentTime = (Number(ui.seek.value) / 1000) * total;
  });

  ui.volume?.addEventListener('input', () => {
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, Number(ui.volume.value || 0) / 100));
  }, { passive: true });

  ui.radio?.addEventListener('click', () => { void startRadio(); });

  window.ampMusicPlayDirectIndex = playDirectIndex;
  window.ampMusicRadio150 = { start: startRadio, fetchStreamPayload, chooseRadioCandidate, wantsDirect };
  console.info('[AmpMusic] direct playback + Radio 1.5 ready');
})();