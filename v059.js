(() => {
  if (window.__WINAMP_MUSIC_V059__) return;
  window.__WINAMP_MUSIC_V059__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const MAX_RESULTS = 12;
  const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
  ];
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.syncpundit.io',
  ];

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const formatDuration = (seconds) => {
    const total = Math.floor(Number(seconds) || 0);
    if (total <= 0) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  function idFromUrl(value) {
    try {
      const url = new URL(value, 'https://www.youtube.com');
      const id = clean(url.searchParams.get('v')) || url.pathname.split('/').filter(Boolean).at(-1) || '';
      return VIDEO_ID_RE.test(id) ? id : '';
    } catch { return ''; }
  }

  function thumbnailFor(item) {
    if (clean(item?.thumbnail)) return clean(item.thumbnail);
    const thumbs = Array.isArray(item?.videoThumbnails) ? item.videoThumbnails : [];
    return clean(thumbs.find((thumb) => Number(thumb?.width || 0) >= 320)?.url || thumbs.at(-1)?.url)
      || (item?.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg` : '');
  }

  function trackFromResult(item, query) {
    return {
      id: clean(item.videoId),
      title: clean(item.title) || `YouTube ${clean(item.videoId)}`,
      artist: clean(item.author) || 'YouTube',
      thumbnail: thumbnailFor(item),
      duration: formatDuration(item.lengthSeconds),
      playlist: `Search: ${clean(query).slice(0, 180)}`,
      badges: ['YouTube search'],
      importedAt: new Date().toISOString(),
    };
  }

  function savedIndex(videoId) {
    try {
      const library = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(library) ? library.findIndex((track) => track?.id === videoId) : -1;
    } catch { return -1; }
  }

  async function searchInvidious(base, query, signal) {
    const url = new URL('/api/v1/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('sort', 'relevance');
    url.searchParams.set('hl', navigator.language?.split('-')[0] || 'en');
    const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Invalid Invidious response');
    return payload.filter((item) => item?.type === 'video' && VIDEO_ID_RE.test(clean(item.videoId))).slice(0, MAX_RESULTS);
  }

  async function searchPiped(base, query, signal) {
    const url = new URL('/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', 'videos');
    const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => ({
      type: 'video',
      videoId: idFromUrl(item?.url),
      title: clean(item?.title),
      author: clean(item?.uploaderName),
      lengthSeconds: Number(item?.duration) || 0,
      thumbnail: clean(item?.thumbnail),
    })).filter((item) => VIDEO_ID_RE.test(item.videoId)).slice(0, MAX_RESULTS);
  }

  async function searchYouTube(query, signal) {
    let lastError = null;
    for (const base of INVIDIOUS_INSTANCES) {
      try {
        const items = await searchInvidious(base, query, signal);
        if (items.length) return items;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        lastError = error;
      }
    }
    for (const base of PIPED_INSTANCES) {
      try {
        const items = await searchPiped(base, query, signal);
        if (items.length) return items;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        lastError = error;
      }
    }
    throw lastError || new Error('Search unavailable');
  }

  function mountSongSearch() {
    if (document.getElementById('songSearchBar')) return;
    const anchor = document.querySelector('.player');
    if (!anchor?.parentNode) return;
    const panel = document.createElement('section');
    panel.id = 'songSearchBar';
    panel.className = 'song-search-bar';
    panel.innerHTML = `
      <div class="song-search-head"><div><div class="eyebrow">SEARCH YOUTUBE</div><strong>Find a song and keep it in your playlist</strong></div><span id="songSearchStatus" class="song-search-status">Type artist or track</span></div>
      <form id="songSearchForm" class="song-search-form"><input id="songSearchInput" class="search song-search-input" type="search" autocomplete="off" placeholder="Artist, song, remix…" aria-label="Search YouTube songs" /><button id="songSearchButton" class="song-search-button" type="submit">Search</button></form>
      <div id="songSearchResults" class="song-search-results" hidden></div>`;
    anchor.insertAdjacentElement('beforebegin', panel);

    const form = panel.querySelector('#songSearchForm');
    const input = panel.querySelector('#songSearchInput');
    const button = panel.querySelector('#songSearchButton');
    const status = panel.querySelector('#songSearchStatus');
    const results = panel.querySelector('#songSearchResults');
    const playerStatus = document.getElementById('status');
    let controller = null;

    const setBusy = (busy) => { button.disabled = busy; button.textContent = busy ? 'Searching…' : 'Search'; input.setAttribute('aria-busy', busy ? 'true' : 'false'); };
    const addTrack = (item, query, play) => {
      const track = trackFromResult(item, query);
      const outcome = window.importTracks?.([track]);
      if (!outcome) { status.textContent = 'Player is still loading'; return false; }
      status.textContent = outcome.added ? 'Saved to playlist' : 'Already in playlist';
      if (playerStatus) playerStatus.textContent = outcome.added ? 'SEARCH TRACK SAVED' : 'TRACK ALREADY SAVED';
      if (play) { const index = savedIndex(track.id); if (index >= 0) window.playIndex?.(index); }
      return true;
    };

    function render(items, query) {
      results.replaceChildren();
      results.hidden = false;
      if (!items.length) { results.textContent = 'No videos found. Try artist + song title.'; status.textContent = 'No results'; return; }
      for (const item of items) {
        const row = document.createElement('article'); row.className = 'song-search-result';
        const image = document.createElement('img'); image.className = 'song-search-thumb'; image.src = thumbnailFor(item); image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
        const info = document.createElement('div'); info.className = 'song-search-info';
        const title = document.createElement('strong'); title.textContent = clean(item.title) || 'Untitled video';
        const meta = document.createElement('span'); meta.textContent = [clean(item.author) || 'YouTube', formatDuration(item.lengthSeconds)].filter(Boolean).join(' · '); info.append(title, meta);
        const actions = document.createElement('div'); actions.className = 'song-search-actions';
        const add = document.createElement('button'); add.type = 'button'; add.className = 'mini-button song-add-button'; add.textContent = savedIndex(item.videoId) >= 0 ? 'Saved' : 'Add'; add.disabled = add.textContent === 'Saved'; add.onclick = () => { if (addTrack(item, query, false)) { add.textContent = 'Saved'; add.disabled = true; } };
        const play = document.createElement('button'); play.type = 'button'; play.className = 'mini-button song-play-button'; play.textContent = '▶ Play'; play.onclick = () => { if (addTrack(item, query, true)) { add.textContent = 'Saved'; add.disabled = true; } };
        actions.append(add, play); row.append(image, info, actions); results.appendChild(row);
      }
      status.textContent = `${items.length} results`;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = clean(input.value);
      if (query.length < 2) { status.textContent = 'Enter at least 2 characters'; input.focus(); return; }
      controller?.abort(); controller = new AbortController(); setBusy(true); status.textContent = 'Searching YouTube…'; results.hidden = true;
      if (playerStatus) playerStatus.textContent = 'SEARCHING YOUTUBE';
      try { const items = await searchYouTube(query, controller.signal); render(items, query); if (playerStatus) playerStatus.textContent = 'SEARCH READY'; }
      catch (error) {
        if (error?.name === 'AbortError') return;
        results.replaceChildren(); results.hidden = false;
        const fallback = document.createElement('a'); fallback.className = 'song-search-fallback'; fallback.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; fallback.textContent = 'Search directly on YouTube ↗'; results.appendChild(fallback);
        status.textContent = 'Search temporarily unavailable'; if (playerStatus) playerStatus.textContent = 'SEARCH UNAVAILABLE';
      } finally { setBusy(false); }
    });

    const style = document.createElement('style');
    style.id = 'songSearchStyles';
    style.textContent = `.song-search-bar{margin:0 0 10px;padding:12px;border:1px solid #343a46;border-radius:12px;background:linear-gradient(180deg,#23272f,#15181e)}.song-search-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:8px}.song-search-head strong{font-size:13px}.song-search-status{font-size:11px;color:#9aa3b2}.song-search-form{display:grid;grid-template-columns:1fr auto;gap:8px}.song-search-input{min-width:0;margin:0;min-height:48px}.song-search-button{min-width:92px;border:1px solid #fca600;border-radius:9px;background:#fca600;color:#111;font-weight:900}.song-search-results{display:grid;gap:6px;margin-top:9px;max-height:390px;overflow:auto}.song-search-result{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px;border:1px solid #303640;border-radius:9px;background:#111419}.song-search-thumb{width:72px;aspect-ratio:16/9;object-fit:cover;border-radius:5px}.song-search-info{display:grid;gap:3px;min-width:0}.song-search-info strong,.song-search-info span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.song-search-info span{font-size:10px;color:#9aa3b2}.song-search-actions{display:flex;gap:5px}.song-search-fallback{display:block;padding:12px;border:1px dashed #3a414d;border-radius:8px;color:#fca600;text-align:center;text-decoration:none}@media(max-width:620px){.song-search-head{display:grid}.song-search-form{grid-template-columns:1fr auto}.song-search-result{grid-template-columns:60px minmax(0,1fr)}.song-search-thumb{width:60px}.song-search-actions{grid-column:1/-1;justify-content:flex-end}}@media(max-width:390px){.song-search-form{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  window.ampMusicSearch150 = { searchYouTube, searchInvidious, searchPiped };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountSongSearch, { once: true });
  else mountSongSearch();
})();
