(() => {
  if (window.__WINAMP_MUSIC_V059__) return;
  window.__WINAMP_MUSIC_V059__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
  ];
  const MAX_RESULTS = 12;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function formatDuration(seconds) {
    const total = Number(seconds || 0);
    if (!Number.isFinite(total) || total <= 0) return '';
    const whole = Math.floor(total);
    const hours = Math.floor(whole / 3600);
    const mins = Math.floor((whole % 3600) / 60);
    const secs = whole % 60;
    return hours
      ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function thumbnailFor(item) {
    const thumbnails = Array.isArray(item?.videoThumbnails) ? item.videoThumbnails : [];
    const preferred = thumbnails.find((thumb) => /medium|mqdefault/i.test(thumb?.quality || thumb?.url || ''))
      || thumbnails.find((thumb) => Number(thumb?.width || 0) >= 320)
      || thumbnails.at?.(-1)
      || thumbnails[0];
    return preferred?.url || (item?.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg` : '');
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
    } catch {
      return -1;
    }
  }

  function installFavicon() {
    const href = './icon.svg?v=0.5.9';
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.type = 'image/svg+xml';
    icon.href = href;

    let shortcut = document.querySelector('link[rel="shortcut icon"]');
    if (!shortcut) {
      shortcut = document.createElement('link');
      shortcut.rel = 'shortcut icon';
      document.head.appendChild(shortcut);
    }
    shortcut.type = 'image/svg+xml';
    shortcut.href = href;

    let mask = document.querySelector('link[rel="mask-icon"]');
    if (!mask) {
      mask = document.createElement('link');
      mask.rel = 'mask-icon';
      document.head.appendChild(mask);
    }
    mask.href = './safari-pinned-tab.svg?v=0.5.9';
    mask.setAttribute('color', '#fca600');
  }

  async function searchInstance(base, query, signal) {
    const url = new URL('/api/v1/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('sort', 'relevance');
    url.searchParams.set('hl', navigator.language?.split('-')[0] || 'en');
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Invalid search response');
    return payload
      .filter((item) => item?.type === 'video' && /^[\w-]{6,20}$/.test(clean(item.videoId)))
      .slice(0, MAX_RESULTS);
  }

  async function searchYouTube(query, signal) {
    let lastError = null;
    for (const base of INVIDIOUS_INSTANCES) {
      try {
        const items = await searchInstance(base, query, signal);
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
    const importBar = document.getElementById('youtubeImportBar');
    const player = document.querySelector('.player');
    const anchor = importBar || player;
    if (!anchor?.parentNode) return;

    const panel = document.createElement('section');
    panel.id = 'songSearchBar';
    panel.className = 'song-search-bar';
    panel.innerHTML = `
      <div class="song-search-head">
        <div>
          <div class="eyebrow">SEARCH YOUTUBE</div>
          <strong>Find a song and keep it in your playlist</strong>
        </div>
        <span id="songSearchStatus" class="song-search-status">Type artist or track</span>
      </div>
      <form id="songSearchForm" class="song-search-form">
        <input id="songSearchInput" class="search song-search-input" type="search" autocomplete="off" placeholder="Artist, song, remix…" aria-label="Search YouTube songs" />
        <button id="songSearchButton" class="song-search-button" type="submit">Search</button>
      </form>
      <div id="songSearchResults" class="song-search-results" hidden></div>`;

    if (importBar) importBar.insertAdjacentElement('afterend', panel);
    else anchor.insertAdjacentElement('beforebegin', panel);

    const form = panel.querySelector('#songSearchForm');
    const input = panel.querySelector('#songSearchInput');
    const button = panel.querySelector('#songSearchButton');
    const status = panel.querySelector('#songSearchStatus');
    const results = panel.querySelector('#songSearchResults');
    const playerStatus = document.getElementById('status');
    let controller = null;

    function setBusy(busy) {
      button.disabled = busy;
      input.setAttribute('aria-busy', busy ? 'true' : 'false');
      if (busy) button.textContent = 'Searching…';
      else button.textContent = 'Search';
    }

    function addTrack(item, query, play) {
      const track = trackFromResult(item, query);
      const outcome = window.importTracks?.([track]);
      if (!outcome) {
        status.textContent = 'Player is still loading';
        return false;
      }
      status.textContent = outcome.added ? 'Saved to playlist' : 'Already in playlist';
      if (playerStatus) playerStatus.textContent = outcome.added ? 'SEARCH TRACK SAVED' : 'TRACK ALREADY SAVED';
      if (play) {
        const index = savedIndex(track.id);
        if (index >= 0) window.playIndex?.(index);
      }
      return true;
    }

    function render(items, query) {
      results.replaceChildren();
      if (!items.length) {
        results.hidden = false;
        const empty = document.createElement('div');
        empty.className = 'song-search-empty';
        empty.textContent = 'No videos found. Try artist + song title.';
        results.appendChild(empty);
        status.textContent = 'No results';
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const item of items) {
        const row = document.createElement('article');
        row.className = 'song-search-result';

        const image = document.createElement('img');
        image.className = 'song-search-thumb';
        image.src = thumbnailFor(item);
        image.alt = '';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';

        const info = document.createElement('div');
        info.className = 'song-search-info';
        const title = document.createElement('strong');
        title.textContent = clean(item.title) || 'Untitled video';
        const meta = document.createElement('span');
        const duration = formatDuration(item.lengthSeconds);
        meta.textContent = [clean(item.author) || 'YouTube', duration].filter(Boolean).join(' · ');
        info.append(title, meta);

        const actions = document.createElement('div');
        actions.className = 'song-search-actions';
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'mini-button song-add-button';
        const alreadySaved = savedIndex(clean(item.videoId)) >= 0;
        add.textContent = alreadySaved ? 'Saved' : 'Add';
        add.disabled = alreadySaved;
        add.addEventListener('click', () => {
          if (addTrack(item, query, false)) {
            add.textContent = 'Saved';
            add.disabled = true;
          }
        });

        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'mini-button song-play-button';
        play.textContent = '▶ Play';
        play.addEventListener('click', () => {
          if (addTrack(item, query, true)) {
            add.textContent = 'Saved';
            add.disabled = true;
          }
        });

        actions.append(add, play);
        row.append(image, info, actions);
        fragment.appendChild(row);
      }
      results.appendChild(fragment);
      results.hidden = false;
      status.textContent = `${items.length} results`;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = clean(input.value);
      if (query.length < 2) {
        status.textContent = 'Enter at least 2 characters';
        input.focus();
        return;
      }

      controller?.abort();
      controller = new AbortController();
      setBusy(true);
      status.textContent = 'Searching YouTube…';
      results.hidden = true;
      if (playerStatus) playerStatus.textContent = 'SEARCHING YOUTUBE';

      try {
        const items = await searchYouTube(query, controller.signal);
        render(items, query);
        if (playerStatus) playerStatus.textContent = 'SEARCH READY';
      } catch (error) {
        if (error?.name === 'AbortError') return;
        results.replaceChildren();
        results.hidden = false;
        const fallback = document.createElement('a');
        fallback.className = 'song-search-fallback';
        fallback.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        fallback.target = '_blank';
        fallback.rel = 'noopener noreferrer';
        fallback.textContent = 'Search directly on YouTube ↗';
        results.appendChild(fallback);
        status.textContent = 'Search service unavailable';
        if (playerStatus) playerStatus.textContent = 'SEARCH UNAVAILABLE';
      } finally {
        setBusy(false);
      }
    });

    const style = document.createElement('style');
    style.id = 'songSearchStyles';
    style.textContent = `
      .song-search-bar{margin:0 0 10px;padding:12px;border:1px solid #343a46;border-radius:12px;background:linear-gradient(180deg,#23272f,#15181e);box-shadow:0 12px 30px rgba(0,0,0,.24)}
      .song-search-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:8px}.song-search-head strong{font-size:13px}.song-search-status{font-size:11px;color:#9aa3b2;text-align:right}
      .song-search-form{display:grid;grid-template-columns:1fr auto;gap:8px}.song-search-input{min-width:0;margin:0;min-height:48px;font-size:15px}.song-search-button{min-width:92px;border:1px solid #fca600;border-radius:9px;background:#fca600;color:#111;font-weight:900;padding:0 14px}.song-search-button:disabled{opacity:.65}
      .song-search-results{display:grid;gap:6px;margin-top:9px;max-height:390px;overflow:auto;overscroll-behavior:contain}.song-search-result{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px;border:1px solid #303640;border-radius:9px;background:#111419}.song-search-thumb{width:72px;aspect-ratio:16/9;object-fit:cover;border-radius:5px;background:#090b0e}.song-search-info{display:grid;gap:3px;min-width:0}.song-search-info strong{font-size:12px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.song-search-info span{font-size:10px;color:#9aa3b2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.song-search-actions{display:flex;gap:5px}.song-add-button,.song-play-button{white-space:nowrap}.song-play-button{border-color:#fca600;color:#fca600}.song-search-empty,.song-search-fallback{padding:12px;border:1px dashed #3a414d;border-radius:8px;color:#b6beca;font-size:12px;text-align:center}.song-search-fallback{display:block;color:#fca600;text-decoration:none}
      @media(max-width:620px){.song-search-head{display:grid;gap:3px}.song-search-status{text-align:left}.song-search-form{grid-template-columns:1fr auto}.song-search-input{font-size:16px}.song-search-result{grid-template-columns:60px minmax(0,1fr);}.song-search-thumb{width:60px}.song-search-actions{grid-column:1/-1;justify-content:flex-end}.song-search-results{max-height:460px}}
      @media(max-width:390px){.song-search-form{grid-template-columns:1fr}.song-search-button{min-height:42px}.song-search-result{grid-template-columns:52px minmax(0,1fr)}.song-search-thumb{width:52px}}
    `;
    document.head.appendChild(style);
  }

  installFavicon();
  const version = document.querySelector('.app-version');
  if (version) version.textContent = 'v0.5.9';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSongSearch, { once: true });
  } else {
    mountSongSearch();
  }
})();
