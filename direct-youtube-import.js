(() => {
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const CONTEXT_KEY = 'winampmusic.youtubeContext.v1';
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const shuffleButton = document.getElementById('shuffleButton');

  if (!search || typeof window.importTracks !== 'function' || typeof window.playIndex !== 'function') return;

  let queue = null;
  let probe = null;
  let probeNode = null;
  let token = 0;
  let lastUrl = '';
  let lastObservedId = currentVideoId();

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function validVideoId(value) {
    return /^[\w-]{6,20}$/.test(value || '');
  }

  function parsePlainYouTubeUrl(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    let url;
    try { url = new URL(text); } catch { return null; }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const youtube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com';
    const short = host === 'youtu.be';
    if (!youtube && !short) return null;
    if (url.searchParams.get('list')) return null;

    let id = short ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (!id && youtube) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
    }
    if (!validVideoId(id)) return null;
    return { id, url: url.href, mixId: `RD${id}` };
  }

  function readJson(storage, key, fallback) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function library() {
    const value = readJson(localStorage, LIBRARY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function libraryIndexFor(id) {
    return library().findIndex((track) => track?.id === id);
  }

  function currentVideoId() {
    const state = readJson(localStorage, PLAYER_STATE_KEY, {});
    return validVideoId(state.currentId) ? state.currentId : '';
  }

  function placeholderTrack(id, playlist = '') {
    return {
      id,
      title: `YouTube ${id}`,
      artist: 'YouTube',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      playlist,
      badges: playlist ? ['YouTube Mix'] : [],
      importedAt: new Date().toISOString(),
    };
  }

  function saveQueue() {
    if (!queue) {
      sessionStorage.removeItem(CONTEXT_KEY);
      return;
    }
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(queue));
  }

  function stopProbe() {
    try { probe?.destroy?.(); } catch {}
    probe = null;
    probeNode?.remove?.();
    probeNode = null;
  }

  function playId(id, label = '') {
    const index = libraryIndexFor(id);
    if (index < 0) return false;
    const pos = queue?.ids?.indexOf(id) ?? -1;
    if (queue && pos >= 0) {
      queue.position = pos;
      saveQueue();
    }
    lastObservedId = id;
    window.playIndex(index);
    if (label) setStatus(label);
    return true;
  }

  function move(delta) {
    if (!queue?.ids?.length) return false;
    const next = ((queue.position + delta) % queue.ids.length + queue.ids.length) % queue.ids.length;
    queue.position = next;
    saveQueue();
    return playId(queue.ids[next], `YOUTUBE MIX · ${queue.ids.length}`);
  }

  async function waitForYouTubeApi(timeoutMs = 10000) {
    const started = Date.now();
    while (!window.YT?.Player) {
      if (Date.now() - started > timeoutMs) throw new Error('YouTube API timeout');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function createProbe(parsed) {
    await waitForYouTubeApi();
    stopProbe();

    const iframe = document.createElement('iframe');
    iframe.width = '2';
    iframe.height = '2';
    iframe.title = 'YouTube Mix reader';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;opacity:0;pointer-events:none';
    const params = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      controls: '0',
      autoplay: '0',
      origin: location.origin,
      list: parsed.mixId,
    });
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(parsed.id)}?${params}`;
    document.body.appendChild(iframe);
    probeNode = iframe;

    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('YouTube Mix reader timeout'));
      }, 9000);
      probe = new YT.Player(iframe, {
        events: {
          onReady: (event) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(event.target);
          },
          onError: () => {},
        },
      });
    });
  }

  async function waitForPlaylist(player, mixId) {
    const started = Date.now();
    while (Date.now() - started < 6000) {
      try {
        const ids = player.getPlaylist?.();
        if (Array.isArray(ids) && ids.length) return ids;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    try { player.cuePlaylist({ listType: 'playlist', list: mixId, index: 0 }); } catch {}
    const retry = Date.now();
    while (Date.now() - retry < 5000) {
      try {
        const ids = player.getPlaylist?.();
        if (Array.isArray(ids) && ids.length) return ids;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return [];
  }

  async function enrichCurrent(player, id, mixId) {
    try { player.cueVideoById(id); } catch { return; }
    const started = Date.now();
    while (Date.now() - started < 2200) {
      try {
        const data = player.getVideoData?.();
        if (data?.video_id === id && data.title) {
          window.importTracks([{
            ...placeholderTrack(id, mixId),
            title: data.title,
            artist: data.author || 'YouTube',
          }]);
          window.renderLibrary?.();
          return;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function buildMix(parsed, ownToken) {
    try {
      const player = await createProbe(parsed);
      if (ownToken !== token) return;
      const raw = await waitForPlaylist(player, parsed.mixId);
      if (ownToken !== token) return;
      const ids = [];
      for (const id of raw) {
        if (validVideoId(id) && !ids.includes(id)) ids.push(id);
        if (ids.length >= 100) break;
      }
      if (!ids.includes(parsed.id)) ids.unshift(parsed.id);
      if (ids.length > 1) {
        window.importTracks(ids.map((id) => placeholderTrack(id, parsed.mixId)));
        queue = {
          ids,
          playlistId: parsed.mixId,
          generatedMix: true,
          sourceUrl: parsed.url,
          position: Math.max(0, ids.indexOf(parsed.id)),
        };
        saveQueue();
        window.renderLibrary?.();
        setStatus(`YOUTUBE MIX · ${ids.length} TRACKS`);
      } else {
        setStatus('PLAYING YOUTUBE TRACK');
      }
      await enrichCurrent(player, parsed.id, parsed.mixId);
    } catch (error) {
      console.warn('[Winamp Music direct URL import]', error);
      setStatus('PLAYING YOUTUBE TRACK');
    } finally {
      if (ownToken === token) stopProbe();
    }
  }

  function importImmediately(parsed) {
    const ownToken = ++token;
    lastUrl = parsed.url;
    search.value = '';
    window.importTracks([placeholderTrack(parsed.id, parsed.mixId)]);
    window.renderLibrary?.();
    playId(parsed.id, 'PLAYING YOUTUBE TRACK');
    buildMix(parsed, ownToken).catch(() => {});
  }

  function handleValue(value) {
    const parsed = parsePlainYouTubeUrl(value);
    if (!parsed || parsed.url === lastUrl) return false;
    importImmediately(parsed);
    return true;
  }

  search.addEventListener('input', () => {
    handleValue(search.value);
  }, true);

  search.addEventListener('change', () => {
    handleValue(search.value);
  }, true);

  // Expose one real handler for tests and any other UI entry point.
  window.winampMusicDirectYouTubeImport = {
    handleUrl: handleValue,
    parseUrl: parsePlainYouTubeUrl,
  };

  prevButton?.addEventListener('click', (event) => {
    if (!queue) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    move(-1);
  }, true);

  nextButton?.addEventListener('click', (event) => {
    if (!queue) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    move(1);
  }, true);

  shuffleButton?.addEventListener('click', (event) => {
    if (!queue?.ids?.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (queue.ids.length < 2) return;
    let pos = queue.position;
    while (pos === queue.position) pos = Math.floor(Math.random() * queue.ids.length);
    queue.position = pos;
    saveQueue();
    playId(queue.ids[pos], `YOUTUBE MIX · ${queue.ids.length} · SHUFFLE`);
  }, true);

  document.addEventListener('click', (event) => {
    const trackButton = event.target.closest?.('.track-main');
    if (!trackButton || !queue) return;
    const row = trackButton.closest('.track');
    const index = Number(row?.dataset?.index);
    const id = library()[index]?.id || '';
    if (!queue.ids.includes(id)) {
      queue = null;
      saveQueue();
    } else {
      queue.position = queue.ids.indexOf(id);
      saveQueue();
      lastObservedId = id;
    }
  }, true);

  setInterval(() => {
    if (!queue?.ids?.length) {
      lastObservedId = currentVideoId();
      return;
    }
    const id = currentVideoId();
    if (!id || id === lastObservedId) return;
    const previous = lastObservedId;
    lastObservedId = id;
    const pos = queue.ids.indexOf(id);
    if (pos >= 0) {
      queue.position = pos;
      saveQueue();
      return;
    }
    if (queue.ids.includes(previous)) {
      setTimeout(() => {
        const current = currentVideoId();
        if (queue && !queue.ids.includes(current)) move(1);
      }, 80);
    }
  }, 220);
})();
