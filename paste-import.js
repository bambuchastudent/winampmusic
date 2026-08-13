(() => {
  const LIBRARY_KEY = 'winampmusic.library.v1';
  const MAX_PICKER_ITEMS = 100;
  const SEARCH = document.getElementById('search');
  const STATUS = document.getElementById('status');

  if (!SEARCH || typeof window.importTracks !== 'function') return;

  let probePlayer = null;
  let probeElement = null;
  let activeToken = 0;
  let pickerState = null;

  function setStatus(text) {
    if (STATUS) STATUS.textContent = text;
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
    const isYoutube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com';
    const isShort = host === 'youtu.be';
    if (!isYoutube && !isShort) return null;

    let videoId = isShort ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (!videoId && isYoutube) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) videoId = parts[1];
    }
    if (!validVideoId(videoId)) videoId = null;

    let playlistId = url.searchParams.get('list');
    if (!validListId(playlistId)) playlistId = null;

    if (!videoId && !playlistId) return null;
    return { url: url.href, videoId, playlistId };
  }

  function trackFromId(id, playlistId = '', metadata = {}) {
    return {
      id,
      title: String(metadata.title || `YouTube ${id}`).trim(),
      artist: String(metadata.author || metadata.artist || 'YouTube').trim(),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      playlist: playlistId || '',
      importedAt: new Date().toISOString(),
    };
  }

  function libraryIndexFor(id) {
    try {
      const items = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      return Array.isArray(items) ? items.findIndex((track) => track?.id === id) : -1;
    } catch {
      return -1;
    }
  }

  function finishUrlMode() {
    SEARCH.value = '';
    SEARCH.hidden = false;
    window.renderLibrary?.();
  }

  function keepSearchAvailable() {
    SEARCH.hidden = false;
    SEARCH.placeholder = 'Search or paste YouTube URL…';
  }

  keepSearchAvailable();
  new MutationObserver(keepSearchAvailable).observe(SEARCH, {
    attributes: true,
    attributeFilter: ['hidden'],
  });

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

  async function createProbe(parsed = {}) {
    await waitForYouTubeApi();
    destroyProbe();

    const iframe = document.createElement('iframe');
    iframe.className = 'playlist-probe';
    iframe.width = '200';
    iframe.height = '200';
    iframe.title = 'YouTube playlist metadata probe';
    iframe.allow = 'autoplay; encrypted-media';

    const params = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      controls: '0',
      autoplay: '0',
      origin: location.origin,
    });
    if (parsed.playlistId) params.set('list', parsed.playlistId);
    if (parsed.playlistId && !parsed.videoId) params.set('listType', 'playlist');

    const path = parsed.videoId ? `/embed/${encodeURIComponent(parsed.videoId)}` : '/embed';
    iframe.src = `https://www.youtube.com${path}?${params}`;
    document.body.appendChild(iframe);
    probeElement = iframe;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('YouTube did not initialize the playlist reader'));
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

  async function waitForValue(read, timeoutMs = 6500, intervalMs = 120) {
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

  async function readVideoMetadata(player, id) {
    try {
      player.cueVideoById(id);
    } catch {
      return null;
    }

    return waitForValue(() => {
      const data = player.getVideoData?.();
      if (!data || data.video_id !== id || !data.title) return null;
      return { title: data.title, author: data.author || 'YouTube' };
    }, 2800, 100);
  }

  async function importSingle(parsed) {
    const token = ++activeToken;
    setStatus('READING YOUTUBE LINK');

    let track = trackFromId(parsed.videoId, parsed.playlistId);
    try {
      const probe = await createProbe(parsed);
      const metadata = await readVideoMetadata(probe, parsed.videoId);
      if (token !== activeToken) return;
      if (metadata) track = trackFromId(parsed.videoId, parsed.playlistId, metadata);
    } catch (error) {
      console.warn('[Winamp Music URL import]', error);
    } finally {
      destroyProbe();
    }

    if (token !== activeToken) return;
    const result = window.importTracks([track]);
    finishUrlMode();
    const index = libraryIndexFor(parsed.videoId);
    if (index >= 0) window.playIndex?.(index);
    setStatus(result.added ? 'ADDED FROM YOUTUBE' : 'TRACK READY');
  }

  function ensurePickerDialog() {
    let dialog = document.getElementById('playlistPickerDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'playlistPickerDialog';
    dialog.innerHTML = `
      <form method="dialog" class="dialog-card playlist-picker-card">
        <div class="dialog-heading">
          <div><div class="eyebrow">WINAMP PLAYLIST</div><h2>Choose tracks to add</h2></div>
          <button class="icon-button" value="cancel" aria-label="Close">✕</button>
        </div>
        <p id="playlistPickerStatus">Reading playlist from YouTube…</p>
        <div class="playlist-picker-tools">
          <button type="button" id="playlistSelectAll" class="ghost">Select all</button>
          <button type="button" id="playlistSelectNone" class="ghost">None</button>
          <span id="playlistSelectionCount" class="playlist-selection-count"></span>
        </div>
        <div id="playlistPickerItems" class="playlist-picker-items"></div>
        <div class="dialog-actions playlist-picker-actions">
          <button type="button" id="playlistAddSelected">Add selected</button>
          <button value="cancel" class="ghost">Cancel</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    dialog.addEventListener('close', () => {
      activeToken += 1;
      pickerState = null;
      destroyProbe();
      finishUrlMode();
    });

    dialog.querySelector('#playlistSelectAll').addEventListener('click', () => {
      dialog.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = true; });
      updateSelectionCount(dialog);
    });
    dialog.querySelector('#playlistSelectNone').addEventListener('click', () => {
      dialog.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = false; });
      updateSelectionCount(dialog);
    });
    dialog.querySelector('#playlistPickerItems').addEventListener('change', () => updateSelectionCount(dialog));
    dialog.querySelector('#playlistAddSelected').addEventListener('click', () => addPickerSelection(dialog));

    return dialog;
  }

  function updateSelectionCount(dialog) {
    const all = [...dialog.querySelectorAll('#playlistPickerItems input[type="checkbox"]')];
    const selected = all.filter((box) => box.checked).length;
    dialog.querySelector('#playlistSelectionCount').textContent = `${selected}/${all.length} selected`;
  }

  function createPickerRows(dialog, ids, currentVideoId, playlistId) {
    const root = dialog.querySelector('#playlistPickerItems');
    root.innerHTML = '';
    const fragment = document.createDocumentFragment();

    ids.forEach((id, index) => {
      const label = document.createElement('label');
      label.className = `playlist-picker-row${id === currentVideoId ? ' current' : ''}`;
      label.dataset.videoId = id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.value = id;

      const thumb = document.createElement('img');
      thumb.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
      thumb.alt = '';
      thumb.loading = 'lazy';

      const text = document.createElement('span');
      text.className = 'playlist-picker-text';
      const title = document.createElement('strong');
      title.className = 'playlist-picker-title';
      title.textContent = id === currentVideoId ? 'Current track' : `Track ${index + 1}`;
      const artist = document.createElement('small');
      artist.className = 'playlist-picker-artist';
      artist.textContent = 'Reading YouTube metadata…';
      text.append(title, artist);

      label.append(checkbox, thumb, text);
      fragment.appendChild(label);
    });

    root.appendChild(fragment);
    pickerState = {
      playlistId,
      currentVideoId,
      tracks: new Map(ids.map((id) => [id, trackFromId(id, playlistId)])),
    };
    updateSelectionCount(dialog);
  }

  function updatePickerRow(dialog, track) {
    if (!track) return;
    const row = [...dialog.querySelectorAll('.playlist-picker-row')]
      .find((candidate) => candidate.dataset.videoId === track.id);
    if (!row) return;
    row.querySelector('.playlist-picker-title').textContent = track.title;
    row.querySelector('.playlist-picker-artist').textContent = track.artist;
  }

  async function discoverPlaylistIds(player, parsed) {
    let ids = await waitForValue(() => {
      const value = player.getPlaylist?.();
      return Array.isArray(value) && value.length ? value : null;
    }, 4500, 150);

    if ((!ids || !ids.length) && parsed.playlistId) {
      try {
        player.cuePlaylist({ listType: 'playlist', list: parsed.playlistId, index: 0 });
      } catch {}
      ids = await waitForValue(() => {
        const value = player.getPlaylist?.();
        return Array.isArray(value) && value.length ? value : null;
      }, 4500, 150);
    }

    const unique = [];
    for (const id of ids || []) {
      if (validVideoId(id) && !unique.includes(id)) unique.push(id);
      if (unique.length >= MAX_PICKER_ITEMS) break;
    }
    if (parsed.videoId && !unique.includes(parsed.videoId)) unique.unshift(parsed.videoId);
    return unique.slice(0, MAX_PICKER_ITEMS);
  }

  async function hydratePicker(dialog, probe, ids, token) {
    const status = dialog.querySelector('#playlistPickerStatus');
    for (let index = 0; index < ids.length; index += 1) {
      if (token !== activeToken || !dialog.open || !pickerState) return;
      const id = ids[index];
      const metadata = await readVideoMetadata(probe, id);
      if (token !== activeToken || !dialog.open || !pickerState) return;
      if (metadata) {
        const track = trackFromId(id, pickerState.playlistId, metadata);
        pickerState.tracks.set(id, track);
        updatePickerRow(dialog, track);
      }
      status.textContent = `Playlist ready — ${index + 1}/${ids.length} names read. Choose what goes into Winamp.`;
    }
  }

  async function openPlaylistPicker(parsed) {
    const token = ++activeToken;
    const dialog = ensurePickerDialog();
    const status = dialog.querySelector('#playlistPickerStatus');
    status.textContent = 'Reading playlist from YouTube…';
    dialog.querySelector('#playlistPickerItems').innerHTML = '<div class="playlist-picker-loading">Loading queue…</div>';
    dialog.showModal();
    setStatus('READING PLAYLIST');

    try {
      const probe = await createProbe(parsed);
      if (token !== activeToken) return;
      const ids = await discoverPlaylistIds(probe, parsed);
      if (token !== activeToken) return;

      if (!ids.length) {
        if (parsed.videoId) {
          status.textContent = 'YouTube did not expose this Mix queue to the embedded player. The current track is still available.';
          createPickerRows(dialog, [parsed.videoId], parsed.videoId, parsed.playlistId);
          await hydratePicker(dialog, probe, [parsed.videoId], token);
          return;
        }
        status.textContent = 'YouTube did not expose any tracks for this playlist link.';
        dialog.querySelector('#playlistPickerItems').innerHTML = '';
        return;
      }

      createPickerRows(dialog, ids, parsed.videoId, parsed.playlistId);
      const kind = parsed.playlistId?.startsWith('RD') ? 'Mix' : 'playlist';
      status.textContent = `${kind}: ${ids.length} tracks exposed by YouTube. All are selected for now.`;
      hydratePicker(dialog, probe, ids, token).catch((error) => console.warn('[Winamp Music playlist metadata]', error));
    } catch (error) {
      console.error('[Winamp Music playlist import]', error);
      if (parsed.videoId) {
        status.textContent = `Could not read the queue (${error.message}). The current track is still selectable.`;
        createPickerRows(dialog, [parsed.videoId], parsed.videoId, parsed.playlistId);
      } else {
        status.textContent = `Could not read this playlist: ${error.message}`;
        dialog.querySelector('#playlistPickerItems').innerHTML = '';
      }
    }
  }

  function addPickerSelection(dialog) {
    if (!pickerState) return;
    const ids = [...dialog.querySelectorAll('#playlistPickerItems input[type="checkbox"]:checked')]
      .map((box) => box.value);
    if (!ids.length) {
      dialog.querySelector('#playlistPickerStatus').textContent = 'Select at least one track.';
      return;
    }

    const tracks = ids.map((id) => pickerState.tracks.get(id) || trackFromId(id, pickerState.playlistId));
    const currentId = pickerState.currentVideoId;
    const result = window.importTracks(tracks);
    dialog.close();

    if (currentId && ids.includes(currentId)) {
      const index = libraryIndexFor(currentId);
      if (index >= 0) window.playIndex?.(index);
    }
    setStatus(result.added ? `ADDED ${result.added}` : 'PLAYLIST READY');
  }

  async function handleUrl(value) {
    const parsed = parseYouTubeUrl(value);
    if (!parsed) return false;
    SEARCH.value = value.trim();
    if (parsed.playlistId) await openPlaylistPicker(parsed);
    else if (parsed.videoId) await importSingle(parsed);
    return true;
  }

  SEARCH.addEventListener('paste', (event) => {
    const value = event.clipboardData?.getData('text')?.trim() || '';
    if (!parseYouTubeUrl(value)) return;
    event.preventDefault();
    handleUrl(value).catch((error) => {
      console.error('[Winamp Music URL import]', error);
      setStatus('YOUTUBE LINK ERROR');
      finishUrlMode();
    });
  });

  SEARCH.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const value = SEARCH.value.trim();
    if (!parseYouTubeUrl(value)) return;
    event.preventDefault();
    handleUrl(value).catch((error) => {
      console.error('[Winamp Music URL import]', error);
      setStatus('YOUTUBE LINK ERROR');
      finishUrlMode();
    });
  });
})();
