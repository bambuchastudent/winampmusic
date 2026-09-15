(() => {
  'use strict';
  if (window.__AMPULA_BACKGROUND_MEDIA_SESSION_114__) return;
  window.__AMPULA_BACKGROUND_MEDIA_SESSION_114__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function library() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function currentTrack() {
    const items = library();
    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 && index < items.length ? items[index] : null;
  }

  function artwork(track) {
    const src = clean(track?.thumbnail || track?.artwork || track?.image);
    return src ? [{ src }] : [];
  }

  function publishMetadata() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
    const track = currentTrack();
    if (!track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: clean(track.title) || 'Unknown track',
      artist: clean(track.artist) || 'Unknown artist',
      album: clean(track.album || track.playlist),
      artwork: artwork(track),
    });
  }

  function call(name, fallback) {
    const fn = window[name];
    if (typeof fn === 'function') return fn();
    return fallback?.();
  }

  function bind(action, handler) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
  }

  function install() {
    if (!('mediaSession' in navigator)) return false;
    bind('play', () => call('ampMusicBackgroundPlay', () => document.getElementById('playButton')?.click()));
    bind('pause', () => call('ampMusicBackgroundPause', () => document.getElementById('playButton')?.click()));
    bind('previoustrack', () => document.getElementById('prevButton')?.click());
    bind('nexttrack', () => document.getElementById('nextButton')?.click());
    bind('seekbackward', (details) => window.ampMusicBackgroundSeekBy?.(-Math.max(1, Number(details?.seekOffset) || 10)));
    bind('seekforward', (details) => window.ampMusicBackgroundSeekBy?.(Math.max(1, Number(details?.seekOffset) || 10)));
    bind('seekto', (details) => window.ampMusicBackgroundSeekTo?.(Number(details?.seekTime) || 0));
    publishMetadata();
    return true;
  }

  const observer = new MutationObserver(publishMetadata);
  for (const id of ['nowTitle', 'nowArtist']) {
    const node = document.getElementById(id);
    if (node) observer.observe(node, { childList: true, subtree: true, characterData: true });
  }
  window.addEventListener('storage', publishMetadata);
  window.addEventListener('pageshow', publishMetadata);
  window.ampMusicMediaSession114 = { install, publishMetadata, currentTrack };
  install();
})();
