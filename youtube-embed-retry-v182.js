(() => {
  'use strict';
  if (window.__AMPULA_YOUTUBE_EMBED_RETRY_182__) return;
  window.__AMPULA_YOUTUBE_EMBED_RETRY_182__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const ERROR_RE = /^YOUTUBE ERROR (101|150)$/i;
  const MAX_ATTEMPTS = 6;
  const SEARCH_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
    'https://invidious.tiekoetter.com',
  ];

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalized = (value) => clean(value).normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const attemptedByRecording = new Map();
  let repairing = false;
  let generation = 0;

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeLibrary(library) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch {}
  }

  function currentIndex(library) {
    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 && index < library.length ? index : -1;
  }

  function recordingKey(track) {
    return `${normalized(track?.title)}\u0000${normalized(track?.artist)}`;
  }

  function attemptedSet(track) {
    const key = recordingKey(track);
    if (!attemptedByRecording.has(key)) attemptedByRecording.set(key, new Set());
    return attemptedByRecording.get(key);
  }

  function queryTokens(value) {
    return normalized(value).split(' ').filter((token) => token.length > 1);
  }

  function candidateMatches(track, item) {
    const haystack = normalized(`${item?.title || ''} ${item?.author || item?.authorId || ''}`);
    if (!haystack) return false;
    const titleTokens = queryTokens(track?.title);
    const artistTokens = queryTokens(track?.artist);
    const titleHits = titleTokens.filter((token) => haystack.includes(token)).length;
    const artistHits = artistTokens.filter((token) => haystack.includes(token)).length;
    const titleNeeded = titleTokens.length <= 2 ? titleTokens.length : Math.ceil(titleTokens.length * 0.67);
    return titleHits >= Math.max(1, titleNeeded) && (artistTokens.length === 0 || artistHits >= 1);
  }

  async function searchInstance(base, query, track, attempted) {
    try {
      const url = new URL('/api/v1/search', base);
      url.search = new URLSearchParams({
        q: query,
        type: 'video',
        sort: 'relevance',
        hl: navigator.language?.split('-')[0] || 'en',
      });
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return '';
      const payload = await response.json();
      if (!Array.isArray(payload)) return '';
      for (const item of payload.slice(0, 12)) {
        const videoId = clean(item?.videoId);
        if (item?.type !== 'video' || !VIDEO_ID_RE.test(videoId) || attempted.has(videoId)) continue;
        if (!candidateMatches(track, item)) continue;
        return videoId;
      }
    } catch {}
    return '';
  }

  async function findAlternate(track, attempted) {
    const title = clean(track?.title);
    const artist = clean(track?.artist);
    if (!title || !artist) return '';
    const queries = [`${artist} ${title}`, `${artist} ${title} official audio`];
    for (const query of queries) {
      const searches = SEARCH_INSTANCES.map((base) => searchInstance(base, query, track, attempted));
      const settled = await Promise.allSettled(searches);
      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value) return result.value;
      }
    }
    return '';
  }

  function setStatus(value) {
    const status = $('status');
    if (status) status.textContent = value;
  }

  async function repairEmbedFailure() {
    if (repairing) return;
    const library = readLibrary();
    const index = currentIndex(library);
    const track = library[index];
    if (!track || !clean(track.title) || !clean(track.artist)) return;

    const attempted = attemptedSet(track);
    const failedId = clean(track.id);
    if (VIDEO_ID_RE.test(failedId)) attempted.add(failedId);
    if (attempted.size >= MAX_ATTEMPTS) {
      setStatus('YOUTUBE UNAVAILABLE · TRY LATER');
      return;
    }

    repairing = true;
    const request = ++generation;
    setStatus('RETRYING YOUTUBE…');
    try {
      const videoId = await findAlternate(track, attempted);
      if (request !== generation) return;
      const freshLibrary = readLibrary();
      const freshIndex = currentIndex(freshLibrary);
      const freshTrack = freshLibrary[freshIndex];
      if (freshIndex !== index || !freshTrack || recordingKey(freshTrack) !== recordingKey(track)) return;
      if (!videoId) {
        setStatus('YOUTUBE UNAVAILABLE · TRY LATER');
        return;
      }
      attempted.add(videoId);
      freshTrack.id = videoId;
      writeLibrary(freshLibrary);
      setStatus('RETRYING YOUTUBE · ALTERNATE…');
      if (typeof window.playIndex === 'function') await Promise.resolve(window.playIndex(freshIndex));
    } finally {
      if (request === generation) repairing = false;
    }
  }

  function inspectStatus() {
    const text = clean($('status')?.textContent);
    if (ERROR_RE.test(text)) void repairEmbedFailure();
  }

  function install() {
    const status = $('status');
    if (!status || window.__AMPULA_YOUTUBE_EMBED_RETRY_182_INSTALLED__) return false;
    window.__AMPULA_YOUTUBE_EMBED_RETRY_182_INSTALLED__ = true;
    new MutationObserver(inspectStatus).observe(status, { childList: true, characterData: true, subtree: true });
    inspectStatus();
    return true;
  }

  window.ampulaYouTubeEmbedRetry182 = {
    findAlternate,
    candidateMatches,
    attemptedByRecording,
    repairEmbedFailure,
  };

  if (!install()) window.addEventListener('DOMContentLoaded', install, { once: true });
})();
