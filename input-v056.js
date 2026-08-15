(() => {
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  if (!search) return;

  let routedValue = '';
  let routedAt = 0;

  function parseYouTubeUrl(value) {
    const text = String(value || '').trim();
    if (!/^https?:\/\//i.test(text)) return null;
    try {
      const url = new URL(text);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const allowed = ['youtu.be', 'youtube.com', 'm.youtube.com', 'music.youtube.com'];
      if (!allowed.includes(host)) return null;
      const videoId = host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0] || ''
        : url.searchParams.get('v') || '';
      const playlistId = url.searchParams.get('list') || '';
      const goodVideo = /^[\w-]{6,20}$/.test(videoId);
      const goodPlaylist = /^[\w-]{6,160}$/.test(playlistId);
      if (!goodVideo && !goodPlaylist) return null;
      return { href: url.href, videoId: goodVideo ? videoId : '', playlistId: goodPlaylist ? playlistId : '' };
    } catch {
      return null;
    }
  }

  function dispatchEnter() {
    search.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
  }

  function route(value) {
    const parsed = parseYouTubeUrl(value);
    if (!parsed) return false;

    const now = Date.now();
    if (parsed.href === routedValue && now - routedAt < 700) return true;
    routedValue = parsed.href;
    routedAt = now;
    search.value = parsed.href;
    if (status) status.textContent = parsed.playlistId ? 'READING YOUTUBE PLAYLIST' : 'READING YOUTUBE LINK';

    if (!parsed.playlistId && window.winampMusicDirectYouTubeImport?.handleUrl) {
      if (window.winampMusicDirectYouTubeImport.handleUrl(parsed.href)) return true;
    }

    // Playlist URLs are claimed by the full-playlist importer loaded earlier.
    // Dispatching Enter gives us a deterministic fallback even when Android
    // long-press paste did not expose clipboardData on the original event.
    dispatchEnter();
    return true;
  }

  function routeCurrentSoon() {
    setTimeout(() => route(search.value), 0);
    setTimeout(() => route(search.value), 80);
  }

  search.addEventListener('paste', (event) => {
    const pasted = event.clipboardData?.getData('text')?.trim() || '';
    if (!parseYouTubeUrl(pasted)) {
      routeCurrentSoon();
      return;
    }
    event.preventDefault();
    search.value = pasted;
    route(pasted);
  }, false);

  search.addEventListener('beforeinput', (event) => {
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertText') routeCurrentSoon();
  }, false);

  search.addEventListener('input', routeCurrentSoon, false);
  search.addEventListener('change', routeCurrentSoon, false);

  function mountTopImportBar() {
    if (document.getElementById('youtubeImportBar')) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar?.parentNode) return;

    const bar = document.createElement('section');
    bar.id = 'youtubeImportBar';
    bar.className = 'youtube-import-bar';
    bar.innerHTML = `
      <div class="youtube-import-copy">
        <div class="eyebrow">YOUTUBE IMPORT</div>
        <strong>Paste a track or playlist</strong>
      </div>
      <div class="youtube-import-row"></div>
      <div class="youtube-import-actions">
        <a class="youtube-playlists-link" href="https://www.youtube.com/feed/playlists" target="_blank" rel="noopener noreferrer">YouTube playlists ↗</a>
      </div>`;

    topbar.insertAdjacentElement('afterend', bar);
    const row = bar.querySelector('.youtube-import-row');
    search.placeholder = 'Paste YouTube track or playlist URL…';
    search.setAttribute('aria-label', 'Paste YouTube track or playlist URL');
    row.appendChild(search);

    const style = document.createElement('style');
    style.id = 'youtubeImportBarStyles';
    style.textContent = `
      .youtube-import-bar{margin:0 0 10px;padding:12px;border:1px solid #343a46;border-radius:12px;background:linear-gradient(180deg,#22262d,#15181e);box-shadow:0 12px 30px rgba(0,0,0,.25)}
      .youtube-import-copy{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}.youtube-import-copy strong{font-size:13px}
      .youtube-import-row .search{width:100%;margin:0;min-height:48px;font-size:15px}
      .youtube-import-actions{display:flex;justify-content:flex-end;margin-top:8px}.youtube-playlists-link{display:inline-flex;align-items:center;min-height:34px;padding:0 11px;border:1px solid #c53030;border-radius:999px;background:#b91c1c;color:#fff;text-decoration:none;font-size:12px;font-weight:800}
      @media(max-width:520px){.youtube-import-bar{position:relative;margin-left:0;margin-right:0}.youtube-import-copy{display:grid;gap:2px}.youtube-import-row .search{font-size:16px}}
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTopImportBar, { once: true });
  } else {
    mountTopImportBar();
  }
})();
