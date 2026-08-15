(() => {
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const MAX_PLAYLIST_SCAN_INDEX = 5000;
  const PLAYLIST_SCAN_STEP = 100;
  const PLAYLIST_POLL_MS = 500;

  let activeImport = 0;
  let lastHandledUrl = '';
  let legacyBypass = false;

  function clean(value) {
    return String(value || '').trim();
  }

  function validVideoId(value) {
    return /^[\w-]{6,20}$/.test(value || '');
  }

  function validPlaylistId(value) {
    return /^[\w-]{6,160}$/.test(value || '');
  }

  function parsePlaylistUrl(value) {
    const text = clean(value);
    if (!text) return null;
    let url;
    try { url = new URL(text); } catch { return null; }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) return null;
    const playlistId = url.searchParams.get('list') || '';
    if (!validPlaylistId(playlistId)) return null;
    let videoId = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (!validVideoId(videoId)) videoId = '';
    return { url: url.href, playlistId, videoId };
  }

  function currentVideoId() {
    try {
      const state = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) || '{}');
      return validVideoId(state.currentId) ? state.currentId : '';
    } catch {
      return '';
    }
  }

  function placeholderTrack(id, playlistId) {
    return {
      id,
      title: `YouTube ${id}`,
      artist: 'YouTube',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      playlist: playlistId,
      badges: ['YouTube playlist'],
      importedAt: new Date().toISOString(),
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForYouTubeApi(timeoutMs = 12000) {
    const started = Date.now();
    while (!window.YT?.Player) {
      if (Date.now() - started > timeoutMs) throw new Error('YouTube playlist reader did not load');
      await sleep(100);
    }
  }

  function makeProbe(parsed) {
    const iframe = document.createElement('iframe');
    iframe.width = '2';
    iframe.height = '2';
    iframe.title = 'Winamp Music full playlist reader';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;opacity:0;pointer-events:none';
    const params = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      controls: '0',
      autoplay: '0',
      origin: location.origin,
      listType: 'playlist',
      list: parsed.playlistId,
    });
    const path = parsed.videoId ? `/embed/${encodeURIComponent(parsed.videoId)}` : '/embed';
    iframe.src = `https://www.youtube.com${path}?${params}`;
    document.body.appendChild(iframe);
    return iframe;
  }

  async function createProbe(parsed) {
    await waitForYouTubeApi();
    const node = makeProbe(parsed);
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { node.remove(); } catch {}
        reject(new Error('YouTube did not expose this playlist'));
      }, 10000);
      const player = new YT.Player(node, {
        events: {
          onReady: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ player, node });
          },
          onError: () => {},
        },
      });
    });
  }

  function addVisibleIds(player, ids) {
    try {
      for (const id of player.getPlaylist?.() || []) {
        if (validVideoId(id)) ids.add(id);
      }
    } catch {}
  }

  async function pollPlaylist(player, ids, durationMs = PLAYLIST_POLL_MS) {
    const started = Date.now();
    let previousSize = -1;
    while (Date.now() - started < durationMs) {
      addVisibleIds(player, ids);
      if (ids.size === previousSize) await sleep(80);
      else await sleep(120);
      previousSize = ids.size;
    }
  }

  async function discoverAllPlaylistIds(player, parsed, token) {
    const ids = new Set();
    await pollPlaylist(player, ids, 1400);

    let staleWindows = 0;
    for (let index = 0; index <= MAX_PLAYLIST_SCAN_INDEX; index += PLAYLIST_SCAN_STEP) {
      if (token !== activeImport) return [];
      const before = ids.size;
      try {
        player.cuePlaylist({ listType: 'playlist', list: parsed.playlistId, index });
      } catch {}
      await pollPlaylist(player, ids);
      staleWindows = ids.size === before ? staleWindows + 1 : 0;
      if (index > ids.size + 500 && staleWindows >= 6) break;
    }

    if (parsed.videoId) ids.add(parsed.videoId);
    return [...ids];
  }

  async function enrichCurrent(player, id, playlistId) {
    if (!id) return;
    try { player.cueVideoById(id); } catch { return; }
    const started = Date.now();
    while (Date.now() - started < 2200) {
      try {
        const data = player.getVideoData?.();
        if (data?.video_id === id && data.title) {
          window.importTracks?.([{
            ...placeholderTrack(id, playlistId),
            title: data.title,
            artist: data.author || 'YouTube',
          }]);
          return;
        }
      } catch {}
      await sleep(100);
    }
  }

  function releaseToLegacy(url) {
    if (!search) return;
    legacyBypass = true;
    search.value = url;
    search.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
    }));
    legacyBypass = false;
  }

  async function importPlaylist(parsed) {
    if (!search || typeof window.importTracks !== 'function') return false;
    if (parsed.url === lastHandledUrl) return true;

    const token = ++activeImport;
    lastHandledUrl = parsed.url;
    search.value = '';
    if (status) status.textContent = 'READING FULL YOUTUBE PLAYLIST';

    let probe = null;
    try {
      probe = await createProbe(parsed);
      const ids = await discoverAllPlaylistIds(probe.player, parsed, token);
      if (token !== activeImport) return true;
      if (!ids.length) throw new Error('No playlist tracks were exposed');

      const tracks = ids.map((id) => placeholderTrack(id, parsed.playlistId));
      const result = window.importTracks(tracks);
      window.renderLibrary?.();

      const preferred = parsed.videoId || currentVideoId() || ids[0];
      await enrichCurrent(probe.player, preferred, parsed.playlistId);
      window.renderLibrary?.();
      setTimeout(() => window.refreshWinampMetadata?.(), 200);

      if (status) {
        status.textContent = `PLAYLIST IMPORTED · ${ids.length} TRACKS${result.added ? ` · ${result.added} NEW` : ''}`;
      }
      return true;
    } catch (error) {
      console.warn('[Winamp Music full playlist import]', error);
      lastHandledUrl = '';
      if (status) status.textContent = 'FULL PLAYLIST READER FAILED · OPENING FALLBACK';
      setTimeout(() => releaseToLegacy(parsed.url), 0);
      return false;
    } finally {
      try { probe?.player?.destroy?.(); } catch {}
      try { probe?.node?.remove?.(); } catch {}
    }
  }

  function claimValue(value, event) {
    if (legacyBypass) return false;
    const parsed = parsePlaylistUrl(value);
    if (!parsed) return false;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (search) search.value = parsed.url;
    importPlaylist(parsed).catch(() => {});
    return true;
  }

  search?.addEventListener('paste', (event) => {
    claimValue(event.clipboardData?.getData('text') || '', event);
  }, true);

  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') claimValue(search.value, event);
  }, true);

  search?.addEventListener('input', (event) => {
    claimValue(search.value, event);
  }, true);

  search?.addEventListener('change', (event) => {
    claimValue(search.value, event);
  }, true);

  function initLyricsVisibility() {
    const panel = document.getElementById('lyricsBar');
    const header = panel?.querySelector('.lyrics-panel-header');
    const embedHost = document.getElementById('geniusEmbedHost');
    if (!panel || !embedHost) return;

    panel.querySelector('.genius-link-row')?.remove();

    const refresh = () => {
      const hasGenius = Boolean(embedHost.querySelector('iframe, .genius-lyrics-frame'));
      const hasSynced = Boolean(panel.querySelector('#lyricsSyncHost .lyrics-line, #lyricsSyncHost .lyrics-plain'));
      panel.hidden = !(hasGenius || hasSynced);
      if (header) header.hidden = !hasGenius;
    };

    window.winampMusicRefreshLyricsVisibility = refresh;
    new MutationObserver(refresh).observe(panel, { childList: true, subtree: true });
    refresh();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initLyricsVisibility, { once: true });
  } else {
    initLyricsVisibility();
  }
})();
