(() => {
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const CONTEXT_KEY = 'winampmusic.youtubeContext.v1';
  const MAX_QUEUE_ITEMS = 100;
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const shuffleButton = document.getElementById('shuffleButton');

  if (!search || typeof window.importTracks !== 'function' || typeof window.playIndex !== 'function') return;

  let context = readContext();
  let probePlayer = null;
  let probeElement = null;
  let operationToken = 0;
  let lastObservedId = currentVideoId();
  let manualLibraryClick = false;

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function validVideoId(value) {
    return /^[\w-]{6,20}$/.test(value || '');
  }

  function validListId(value) {
    return /^[\w-]{6,160}$/.test(value || '');
  }

  function parseYouTubeUrl(value) {
    const input = String(value || '').trim();
    if (!input) return null;
    let url;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const youtube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com';
    const short = host === 'youtu.be';
    if (!youtube && !short) return null;

    let videoId = short ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (!videoId && youtube) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) videoId = parts[1];
    }
    if (!validVideoId(videoId)) videoId = '';

    let playlistId = url.searchParams.get('list') || '';
    if (!validListId(playlistId)) playlistId = '';
    if (!videoId && !playlistId) return null;
    return { sourceUrl: url.href, videoId, playlistId };
  }

  function readJson(storage, key, fallback) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currentVideoId() {
    const saved = readJson(localStorage, PLAYER_STATE_KEY, {});
    return validVideoId(saved.currentId) ? saved.currentId : '';
  }

  function library() {
    const value = readJson(localStorage, LIBRARY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function libraryIndexFor(id) {
    return library().findIndex((track) => track?.id === id);
  }

  function normalizeContext(value) {
    if (!value || !Array.isArray(value.ids)) return null;
    const ids = [...new Set(value.ids.filter(validVideoId))].slice(0, MAX_QUEUE_ITEMS);
    if (!ids.length) return null;
    return {
      ids,
      playlistId: validListId(value.playlistId) ? value.playlistId : '',
      generatedMix: Boolean(value.generatedMix),
      sourceUrl: String(value.sourceUrl || ''),
      position: Math.max(0, Math.min(ids.length - 1, Number(value.position) || 0)),
    };
  }

  function readContext() {
    return normalizeContext(readJson(sessionStorage, CONTEXT_KEY, null));
  }

  function saveContext() {
    if (!context) {
      sessionStorage.removeItem(CONTEXT_KEY);
      return;
    }
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  }

  function deactivateContext(message = '') {
    context = null;
    saveContext();
    if (message) setStatus(message);
  }

  function contextLabel() {
    if (!context) return '';
    return context.generatedMix ? `YOUTUBE MIX · ${context.ids.length}` : `YOUTUBE PLAYLIST · ${context.ids.length}`;
  }

  function trackFromId(id, playlistId, metadata = {}) {
    return {
      id,
      title: String(metadata.title || `YouTube ${id}`).trim(),
      artist: String(metadata.author || 'YouTube').trim(),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      playlist: playlistId || '',
      badges: [playlistId?.startsWith('RD') ? 'YouTube Mix' : 'YouTube playlist'].filter(Boolean),
      importedAt: new Date().toISOString(),
    };
  }

  function playContextPosition(position, label = '') {
    if (!context?.ids?.length) return false;
    const safe = ((position % context.ids.length) + context.ids.length) % context.ids.length;
    const id = context.ids[safe];
    const index = libraryIndexFor(id);
    if (index < 0) return false;
    context.position = safe;
    saveContext();
    lastObservedId = id;
    window.playIndex(index);
    setStatus(label || contextLabel());
    return true;
  }

  function moveContext(delta) {
    if (!context) return false;
    return playContextPosition(context.position + delta);
  }

  async function waitForYouTubeApi(timeoutMs = 10000) {
    const started = Date.now();
    while (!window.YT?.Player) {
      if (Date.now() - started > timeoutMs) throw new Error('YouTube player API is still loading');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function destroyProbe() {
    try { probePlayer?.destroy?.(); } catch {}
    probePlayer = null;
    probeElement?.remove?.();
    probeElement = null;
  }

  async function createProbe(parsed) {
    await waitForYouTubeApi();
    destroyProbe();

    const iframe = document.createElement('iframe');
    iframe.className = 'playlist-probe';
    iframe.width = '2';
    iframe.height = '2';
    iframe.title = 'YouTube queue reader';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;opacity:0;pointer-events:none';

    const params = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      controls: '0',
      autoplay: '0',
      origin: location.origin,
      list: parsed.playlistId,
    });
    const path = parsed.videoId ? `/embed/${encodeURIComponent(parsed.videoId)}` : '/embed';
    iframe.src = `https://www.youtube.com${path}?${params}`;
    document.body.appendChild(iframe);
    probeElement = iframe;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('YouTube did not initialize the queue reader'));
      }, 10000);

      probePlayer = new YT.Player(iframe, {
        events: {
          onReady: (event) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(event.target);
          },
          onError: () => {},
        },
      });
    });
  }

  async function waitForValue(read, timeoutMs = 6000, intervalMs = 140) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      try {
        const value = read();
        if (value) return value;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return null;
  }

  async function discoverIds(player, parsed) {
    let ids = await waitForValue(() => {
      const value = player.getPlaylist?.();
      return Array.isArray(value) && value.length ? value : null;
    }, 3500);

    if (!ids?.length) {
      try {
        player.cuePlaylist({ listType: 'playlist', list: parsed.playlistId, index: 0 });
      } catch {}
      ids = await waitForValue(() => {
        const value = player.getPlaylist?.();
        return Array.isArray(value) && value.length ? value : null;
      }, 5000);
    }

    const unique = [];
    for (const id of ids || []) {
      if (validVideoId(id) && !unique.includes(id)) unique.push(id);
      if (unique.length >= MAX_QUEUE_ITEMS) break;
    }
    if (parsed.videoId && !unique.includes(parsed.videoId)) unique.unshift(parsed.videoId);
    return unique.slice(0, MAX_QUEUE_ITEMS);
  }

  async function readVideoMetadata(player, id) {
    try { player.cueVideoById(id); } catch { return null; }
    return waitForValue(() => {
      const data = player.getVideoData?.();
      if (!data || data.video_id !== id || !data.title) return null;
      return { title: data.title, author: data.author || 'YouTube' };
    }, 1500, 100);
  }

  async function hydrateSome(player, ids, playlistId, token) {
    const targets = ids.slice(0, 16);
    for (const id of targets) {
      if (token !== operationToken || !context) return;
      const metadata = await readVideoMetadata(player, id);
      if (metadata) window.importTracks([trackFromId(id, playlistId, metadata)]);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  async function startGeneratedMix(parsed) {
    const token = ++operationToken;
    const playlistId = `RD${parsed.videoId}`;
    const source = { ...parsed, playlistId };
    search.value = '';
    setStatus('READING YOUTUBE MIX');

    try {
      const probe = await createProbe(source);
      if (token !== operationToken) return;
      const ids = await discoverIds(probe, source);
      if (token !== operationToken) return;

      if (ids.length <= 1) {
        window.importTracks([trackFromId(parsed.videoId, playlistId)]);
        const index = libraryIndexFor(parsed.videoId);
        if (index >= 0) window.playIndex(index);
        deactivateContext('PLAYING · YOUTUBE DID NOT EXPOSE MIX');
        destroyProbe();
        return;
      }

      window.importTracks(ids.map((id) => trackFromId(id, playlistId)));
      const currentPosition = Math.max(0, ids.indexOf(parsed.videoId));
      context = {
        ids,
        playlistId,
        generatedMix: true,
        sourceUrl: parsed.sourceUrl,
        position: currentPosition,
      };
      saveContext();
      window.renderLibrary?.();
      playContextPosition(currentPosition, `YOUTUBE MIX · ${ids.length} TRACKS`);
      hydrateSome(probe, ids, playlistId, token)
        .catch((error) => console.warn('[Winamp Music mix metadata]', error))
        .finally(() => destroyProbe());
    } catch (error) {
      console.warn('[Winamp Music YouTube mix]', error);
      destroyProbe();
      window.importTracks([trackFromId(parsed.videoId, playlistId)]);
      const index = libraryIndexFor(parsed.videoId);
      if (index >= 0) window.playIndex(index);
      deactivateContext('PLAYING SINGLE YOUTUBE TRACK');
    }
  }

  function activatePickerSelection(button) {
    const dialog = button.closest('#playlistPickerDialog');
    if (!dialog) return;
    const ids = [...dialog.querySelectorAll('#playlistPickerItems input[type="checkbox"]:checked')]
      .map((box) => box.value)
      .filter(validVideoId);
    if (!ids.length) return;

    const currentRow = dialog.querySelector('.playlist-picker-row.current');
    const currentId = currentRow?.dataset?.videoId || ids[0];
    const parsed = parseYouTubeUrl(search.value);
    const playlistId = parsed?.playlistId || '';
    context = {
      ids,
      playlistId,
      generatedMix: playlistId.startsWith('RD'),
      sourceUrl: parsed?.sourceUrl || '',
      position: Math.max(0, ids.indexOf(currentId)),
    };
    saveContext();
    lastObservedId = currentId;
  }

  function handlePlainVideoPaste(value, event) {
    const parsed = parseYouTubeUrl(value);
    if (!parsed?.videoId || parsed.playlistId) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    startGeneratedMix(parsed).catch((error) => {
      console.error('[Winamp Music context queue]', error);
      setStatus('YOUTUBE MIX ERROR');
    });
    return true;
  }

  search.addEventListener('paste', (event) => {
    const value = event.clipboardData?.getData('text')?.trim() || '';
    handlePlainVideoPaste(value, event);
  }, true);

  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    handlePlainVideoPaste(search.value.trim(), event);
  }, true);

  document.addEventListener('click', (event) => {
    const addSelected = event.target.closest?.('#playlistAddSelected');
    if (addSelected) {
      activatePickerSelection(addSelected);
      return;
    }

    const trackButton = event.target.closest?.('.track-main');
    if (trackButton) {
      const row = trackButton.closest('.track');
      const index = Number(row?.dataset?.index);
      const id = library()[index]?.id || '';
      manualLibraryClick = true;
      if (context && context.ids.includes(id)) {
        context.position = context.ids.indexOf(id);
        saveContext();
        lastObservedId = id;
      } else if (context) {
        deactivateContext();
      }
      setTimeout(() => { manualLibraryClick = false; }, 0);
    }
  }, true);

  prevButton?.addEventListener('click', (event) => {
    if (!context) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    moveContext(-1);
  }, true);

  nextButton?.addEventListener('click', (event) => {
    if (!context) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    moveContext(1);
  }, true);

  shuffleButton?.addEventListener('click', (event) => {
    if (!context) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (context.ids.length < 2) return;
    let next = context.position;
    while (next === context.position) next = Math.floor(Math.random() * context.ids.length);
    playContextPosition(next, `${contextLabel()} · SHUFFLE`);
  }, true);

  setInterval(() => {
    if (!context || manualLibraryClick) {
      lastObservedId = currentVideoId();
      return;
    }

    const id = currentVideoId();
    if (!id || id === lastObservedId) return;
    const previousId = lastObservedId;
    lastObservedId = id;

    const position = context.ids.indexOf(id);
    if (position >= 0) {
      context.position = position;
      saveContext();
      return;
    }

    if (context.ids.includes(previousId)) {
      const expected = context.position + 1;
      setTimeout(() => {
        if (!context || manualLibraryClick) return;
        const current = currentVideoId();
        if (context.ids.includes(current)) return;
        playContextPosition(expected, contextLabel());
      }, 80);
    }
  }, 220);

  if (context) {
    const id = currentVideoId();
    const position = context.ids.indexOf(id);
    if (position >= 0) {
      context.position = position;
      saveContext();
      setStatus(contextLabel());
    }
  }
})();
