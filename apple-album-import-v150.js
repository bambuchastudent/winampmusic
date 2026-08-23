(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_ALBUM_150__) return;
  window.__AMP_MUSIC_APPLE_ALBUM_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function parseAlbumUrl(value) {
    try {
      const url = new URL(clean(value));
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const albumIndex = parts.indexOf('album');
      if (albumIndex < 0) return null;
      if (/^\d+$/.test(clean(url.searchParams.get('i')))) return null;
      const albumId = clean(parts.at(-1));
      if (!/^\d+$/.test(albumId)) return null;
      const storefront = /^[a-z]{2}$/i.test(parts[0] || '') ? parts[0].toUpperCase() : 'US';
      return {
        href: url.href,
        storefront,
        albumId,
        slug: clean(parts[albumIndex + 1] || 'Apple Music album'),
      };
    } catch {
      return null;
    }
  }

  function lookupAlbumJsonp(parsed, signal) {
    return new Promise((resolve, reject) => {
      const callback = `__ampAppleAlbum_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('Apple album metadata timeout')), 10000);

      function cleanup() {
        clearTimeout(timeout);
        script.remove();
        try { delete window[callback]; } catch { window[callback] = undefined; }
        signal?.removeEventListener('abort', onAbort);
      }

      function finish(error, value) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(value);
      }

      function onAbort() {
        finish(new DOMException('Aborted', 'AbortError'));
      }

      window[callback] = (payload) => {
        const results = Array.isArray(payload?.results) ? payload.results : [];
        const collection = results.find((item) => String(item?.collectionId || '') === parsed.albumId && item?.wrapperType === 'collection');
        const songs = results
          .filter((item) => item?.kind === 'song' && String(item?.collectionId || '') === parsed.albumId)
          .sort((a, b) => Number(a?.trackNumber || 0) - Number(b?.trackNumber || 0));
        if (!songs.length) {
          finish(new Error('Apple album contained no songs'));
          return;
        }
        finish(null, {
          name: clean(collection?.collectionName || songs[0]?.collectionName || parsed.slug),
          artist: clean(collection?.artistName || songs[0]?.artistName),
          tracks: songs.map((item) => ({
            appleTrackId: String(item.trackId || ''),
            title: clean(item.trackName || item.trackCensoredName),
            artist: clean(item.artistName),
            album: clean(item.collectionName || item.collectionCensoredName),
            durationMs: Number(item.trackTimeMillis || 0),
            artwork: clean(item.artworkUrl100 || '').replace(/100x100bb/i, '600x600bb'),
            appleUrl: clean(item.trackViewUrl) || parsed.href,
            trackNumber: Number(item.trackNumber || 0),
          })).filter((track) => track.appleTrackId && track.title && track.artist),
        });
      };

      script.onerror = () => finish(new Error('Apple album metadata request failed'));
      const url = new URL('https://itunes.apple.com/lookup');
      url.searchParams.set('id', parsed.albumId);
      url.searchParams.set('entity', 'song');
      url.searchParams.set('country', parsed.storefront);
      url.searchParams.set('callback', callback);
      script.src = url.toString();
      script.async = true;
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      document.head.appendChild(script);
    });
  }

  function libraryIndex(videoId) {
    try {
      const library = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(library) ? library.findIndex((track) => track?.id === videoId) : -1;
    } catch {
      return -1;
    }
  }

  async function resolveTracks(album, parsed, signal, onProgress) {
    const finder = window.winampMusicAppleImport?.findYouTubeMatch;
    if (typeof finder !== 'function') throw new Error('Strict Apple matcher is not ready');
    const results = new Array(album.tracks.length).fill(null);
    let cursor = 0;
    let completed = 0;
    const workers = Math.min(4, album.tracks.length);

    await Promise.all(Array.from({ length: workers }, async () => {
      while (!signal.aborted) {
        const index = cursor;
        cursor += 1;
        if (index >= album.tracks.length) return;
        const appleTrack = album.tracks[index];
        try {
          const match = await finder({
            title: appleTrack.title,
            artist: appleTrack.artist,
            durationMs: appleTrack.durationMs,
          }, signal);
          const videoId = clean(match?.id);
          if (VIDEO_ID_RE.test(videoId)) {
            results[index] = {
              id: videoId,
              title: appleTrack.title,
              artist: appleTrack.artist,
              thumbnail: appleTrack.artwork || clean(match?.thumbnail),
              duration: appleTrack.durationMs > 0 ? Math.round(appleTrack.durationMs / 1000) : Number(match?.duration || 0),
              playlist: album.name,
              badges: ['Apple Music', 'Album', 'Strict match'],
              sourceUrl: parsed.href,
              appleTrackId: appleTrack.appleTrackId,
              appleTrackUrl: appleTrack.appleUrl,
              importedAt: new Date().toISOString(),
              strictMatchedAt: new Date().toISOString(),
            };
          }
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          console.warn('[AmpMusic] Apple album track unresolved', appleTrack.title, error);
        } finally {
          completed += 1;
          onProgress?.({ completed, total: album.tracks.length, matched: results.filter(Boolean).length });
        }
      }
    }));

    return results.filter(Boolean);
  }

  async function importAlbumUrl(value, options = {}) {
    const parsed = parseAlbumUrl(value);
    if (!parsed) return { handled: false };
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });

    try {
      options.onStatus?.({ phase: 'reading', message: 'Reading Apple Music album…' });
      const album = await lookupAlbumJsonp(parsed, controller.signal);
      options.onStatus?.({ phase: 'matching', message: `Matching 0/${album.tracks.length} tracks…`, total: album.tracks.length });
      const tracks = await resolveTracks(album, parsed, controller.signal, ({ completed, total, matched }) => {
        options.onStatus?.({ phase: 'matching', message: `Matching ${completed}/${total} · ${matched} found`, completed, total, matched });
      });
      if (!tracks.length) throw new Error('No album tracks could be safely matched');

      const result = window.importTracks?.(tracks) || { added: 0 };
      const firstIndex = libraryIndex(tracks[0].id);
      if (options.input) options.input.value = '';
      if (options.play !== false && firstIndex >= 0) {
        if (typeof window.ampMusicPlayDirectIndex === 'function') void window.ampMusicPlayDirectIndex(firstIndex);
        else window.playIndex?.(firstIndex);
      }
      options.onStatus?.({
        phase: 'done',
        message: `${album.tracks.length} tracks · ${tracks.length} matched · ${result.added || 0} new`,
        total: album.tracks.length,
        matched: tracks.length,
        added: result.added || 0,
      });
      return { handled: true, album, tracks, added: result.added || 0 };
    } catch (error) {
      if (error?.name === 'AbortError') return { handled: true, aborted: true };
      console.warn('[AmpMusic] Apple Music album import failed', error);
      options.onStatus?.({ phase: 'error', message: 'Could not import this Apple Music album', error });
      return { handled: true, error };
    } finally {
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  window.ampMusicAppleAlbum150 = { parseAlbumUrl, lookupAlbumJsonp, importAlbumUrl };
  console.info('[AmpMusic] Apple Music album import 1.5 ready');
})();
