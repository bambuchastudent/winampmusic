(() => {
  'use strict';
  if (window.__AMP_MUSIC_APPLE_PLAYLIST_150__) return;
  window.__AMP_MUSIC_APPLE_PLAYLIST_150__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function parsePlaylistUrl(value) {
    try {
      const url = new URL(clean(value));
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const playlistIndex = parts.indexOf('playlist');
      if (playlistIndex < 0) return null;
      const playlistId = clean(parts.at(-1));
      if (!/^pl\.[A-Za-z0-9._-]+$/.test(playlistId)) return null;
      const storefront = /^[a-z]{2}$/i.test(parts[0] || '') ? parts[0].toLowerCase() : 'us';
      return {
        href: url.href,
        storefront,
        playlistId,
        slug: clean(parts[playlistIndex + 1] || 'Apple Music playlist'),
      };
    } catch {
      return null;
    }
  }

  function markdownText(value) {
    return clean(String(value || '')
      .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"));
  }

  function durationMs(value) {
    const match = String(value || '').match(/(?:PREVIEW\s+)?(\d{1,2}):(\d{2})/i);
    if (!match) return 0;
    return (Number(match[1]) * 60 + Number(match[2])) * 1000;
  }

  function playlistNameFromMarkdown(markdown, fallback) {
    const heading = String(markdown || '').match(/(?:^|\n)#\s+([^\n]+)/);
    if (heading?.[1]) return markdownText(heading[1]);
    const title = String(markdown || '').match(/^Title:\s*‎?(.+?)(?:\s+by\s+.+)?\s+-\s+Apple Music\s*$/m);
    return markdownText(title?.[1]) || fallback;
  }

  function parsePlaylistMarkdown(markdown, parsed) {
    const source = String(markdown || '');
    const songRe = /\[([^\]\n]+)\]\((https:\/\/music\.apple\.com\/[^)\s]+\/song\/[^)\s]+\/(\d+)[^)]*)\)/g;
    const matches = [...source.matchAll(songRe)];
    const seen = new Set();
    const tracks = [];

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const appleTrackId = clean(match[3]);
      if (!appleTrackId || seen.has(appleTrackId)) continue;
      seen.add(appleTrackId);
      const tailEnd = index + 1 < matches.length ? matches[index + 1].index : Math.min(source.length, (match.index || 0) + 3000);
      const tail = source.slice((match.index || 0) + match[0].length, tailEnd);
      const artistMatch = tail.match(/\[([^\]\n]+)\]\(https:\/\/music\.apple\.com\/[^)\s]+\/artist\/[^)]+\/\d+[^)]*\)/);
      const albumMatch = tail.match(/\[([^\]\n]+)\]\(https:\/\/music\.apple\.com\/[^)\s]+\/album\/[^)]+\/\d+[^)]*\)/);
      const title = markdownText(match[1]);
      const artist = markdownText(artistMatch?.[1]);
      if (!title || !artist) continue;
      tracks.push({
        appleTrackId,
        title,
        artist,
        album: markdownText(albumMatch?.[1]),
        durationMs: durationMs(tail),
        appleUrl: clean(match[2]),
      });
    }

    return {
      name: playlistNameFromMarkdown(source, parsed.slug || 'Apple Music playlist'),
      tracks,
    };
  }

  async function fetchPublicPlaylist(parsed, signal) {
    const readerUrl = `https://r.jina.ai/${parsed.href}`;
    const response = await fetch(readerUrl, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'text/plain' },
    });
    if (!response.ok) throw new Error(`Apple playlist reader HTTP ${response.status}`);
    const markdown = await response.text();
    const playlist = parsePlaylistMarkdown(markdown, parsed);
    if (!playlist.tracks.length) throw new Error('Apple playlist contained no readable tracks');
    return playlist;
  }

  function libraryIndex(videoId) {
    try {
      const library = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(library) ? library.findIndex((track) => track?.id === videoId) : -1;
    } catch {
      return -1;
    }
  }

  async function resolveTracks(playlist, parsed, signal, onProgress) {
    const finder = window.winampMusicAppleImport?.findYouTubeMatch;
    if (typeof finder !== 'function') throw new Error('Apple Music matcher is not ready');
    const results = new Array(playlist.tracks.length).fill(null);
    let cursor = 0;
    let completed = 0;
    const workers = Math.min(2, playlist.tracks.length);

    await Promise.all(Array.from({ length: workers }, async () => {
      while (!signal.aborted) {
        const index = cursor;
        cursor += 1;
        if (index >= playlist.tracks.length) return;
        const appleTrack = playlist.tracks[index];
        try {
          const match = await finder({
            title: appleTrack.title,
            artist: appleTrack.artist,
            album: appleTrack.album,
            durationMs: appleTrack.durationMs,
          }, signal);
          const videoId = clean(match?.id);
          if (VIDEO_ID_RE.test(videoId)) {
            results[index] = {
              id: videoId,
              title: appleTrack.title,
              artist: appleTrack.artist,
              thumbnail: clean(match?.thumbnail),
              duration: appleTrack.durationMs > 0 ? Math.round(appleTrack.durationMs / 1000) : Number(match?.duration || 0),
              playlist: playlist.name,
              badges: ['Apple Music', 'Playlist', 'YouTube match'],
              sourceUrl: parsed.href,
              appleTrackId: appleTrack.appleTrackId,
              appleTrackUrl: appleTrack.appleUrl,
              importedAt: new Date().toISOString(),
            };
          }
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          console.warn('[AmpMusic] Apple playlist track unresolved', appleTrack.title, error);
        } finally {
          completed += 1;
          onProgress?.({ completed, total: playlist.tracks.length, matched: results.filter(Boolean).length });
        }
      }
    }));

    return results.filter(Boolean);
  }

  async function importPlaylistUrl(value, options = {}) {
    const parsed = parsePlaylistUrl(value);
    if (!parsed) return false;
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });

    try {
      options.onStatus?.({ phase: 'reading', message: 'Reading Apple Music playlist…' });
      const playlist = await fetchPublicPlaylist(parsed, controller.signal);
      options.onStatus?.({ phase: 'matching', message: `Matching 0/${playlist.tracks.length} tracks…`, total: playlist.tracks.length });
      const tracks = await resolveTracks(playlist, parsed, controller.signal, ({ completed, total, matched }) => {
        options.onStatus?.({ phase: 'matching', message: `Matching ${completed}/${total} · ${matched} found`, completed, total, matched });
      });
      if (!tracks.length) throw new Error('No playlist tracks could be matched on YouTube');

      const result = window.importTracks?.(tracks) || { added: 0 };
      const firstIndex = libraryIndex(tracks[0].id);
      if (options.input) options.input.value = '';
      if (options.play !== false && firstIndex >= 0) window.playIndex?.(firstIndex);
      options.onStatus?.({
        phase: 'done',
        message: `${playlist.tracks.length} tracks · ${tracks.length} matched · ${result.added || 0} new`,
        total: playlist.tracks.length,
        matched: tracks.length,
        added: result.added || 0,
      });
      return { handled: true, playlist, tracks, added: result.added || 0 };
    } catch (error) {
      if (error?.name === 'AbortError') return { handled: true, aborted: true };
      console.warn('[AmpMusic] Apple Music playlist import failed', error);
      options.onStatus?.({ phase: 'error', message: 'Could not import this Apple Music playlist', error });
      return { handled: true, error };
    } finally {
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  window.ampMusicApplePlaylist150 = {
    parsePlaylistUrl,
    parsePlaylistMarkdown,
    fetchPublicPlaylist,
    importPlaylistUrl,
  };
  console.info('[AmpMusic] Apple Music playlist import 1.5 ready');
})();
