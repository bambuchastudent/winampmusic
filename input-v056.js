(() => {
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  if (!search) return;

  let routedValue = '';
  let routedAt = 0;
  let filterRevision = 0;

  search.addEventListener('input', () => {
    filterRevision += 1;
  }, true);

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

  function restoreFilter(value, revision, importUrl) {
    if (filterRevision !== revision) return false;
    if (search.value !== '' && search.value !== importUrl) return true;
    search.value = value;
    window.renderLibrary?.();
    return true;
  }

  function guardFilter(value, revision, importUrl) {
    restoreFilter(value, revision, importUrl);
    const timer = setInterval(() => {
      if (filterRevision !== revision) {
        clearInterval(timer);
        return;
      }
      restoreFilter(value, revision, importUrl);
    }, 500);
    setTimeout(() => clearInterval(timer), 12000);
  }

  function route(value, input) {
    const parsed = parseYouTubeUrl(value);
    if (!parsed) return false;

    const now = Date.now();
    if (parsed.href === routedValue && now - routedAt < 700) return true;
    routedValue = parsed.href;
    routedAt = now;

    const filterValue = search.value;
    const revision = filterRevision;
    if (status) status.textContent = parsed.playlistId ? 'READING YOUTUBE PLAYLIST' : 'READING YOUTUBE LINK';

    if (!parsed.playlistId && window.winampMusicDirectYouTubeImport?.handleUrl) {
      const handled = window.winampMusicDirectYouTubeImport.handleUrl(parsed.href);
      if (handled) {
        if (input) input.value = '';
        guardFilter(filterValue, revision, parsed.href);
        return true;
      }
    }

    // Full-playlist import is still owned by the existing playlist handler.
    // Feed it through the legacy search event without sacrificing the actual
    // library filter: the filter is restored immediately and kept guarded
    // while async playlist/fallback code finishes.
    search.value = parsed.href;
    dispatchEnter();
    if (input) input.value = '';
    guardFilter(filterValue, revision, parsed.href);
    return true;
  }

  function routeCurrentSoon(input) {
    setTimeout(() => route(input.value, input), 0);
    setTimeout(() => route(input.value, input), 80);
  }

  function bindImportInput(input) {
    input.addEventListener('paste', (event) => {
      const pasted = event.clipboardData?.getData('text')?.trim() || '';
      if (!parseYouTubeUrl(pasted)) {
        routeCurrentSoon(input);
        return;
      }
      event.preventDefault();
      input.value = pasted;
      route(pasted, input);
    }, false);

    input.addEventListener('beforeinput', (event) => {
      if (event.inputType === 'insertFromPaste' || event.inputType === 'insertText') routeCurrentSoon(input);
    }, false);

    input.addEventListener('input', () => routeCurrentSoon(input), false);
    input.addEventListener('change', () => routeCurrentSoon(input), false);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (route(input.value, input)) event.preventDefault();
    }, false);
  }

  function loadV059() {
    if (window.__WINAMP_MUSIC_V059__ || document.querySelector('script[data-winamp-v059]')) return;
    const script = document.createElement('script');
    script.src = './v059.js?v=0.5.9';
    script.defer = true;
    script.dataset.winampV059 = '1';
    document.head.appendChild(script);
  }

  function loadV060Favicon() {
    if (window.__WINAMP_MUSIC_V060_FAVICON__ || document.querySelector('script[data-winamp-v060-favicon]')) return;
    const script = document.createElement('script');
    script.src = './favicon-v060.js?v=0.5.10';
    script.defer = true;
    script.dataset.winampV060Favicon = '1';
    document.head.appendChild(script);
  }

  function mountTopImportBar() {
    loadV060Favicon();
    if (document.getElementById('youtubeImportBar')) {
      loadV059();
      return;
    }
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
    const importInput = document.createElement('input');
    importInput.id = 'youtubeImportInput';
    importInput.className = 'search youtube-import-input';
    importInput.type = 'url';
    importInput.inputMode = 'url';
    importInput.autocomplete = 'off';
    importInput.placeholder = 'Paste YouTube track or playlist URL…';
    importInput.setAttribute('aria-label', 'Paste YouTube track or playlist URL');
    row.appendChild(importInput);
    bindImportInput(importInput);

    // Keep the original field in the playlist where it belongs: it is the
    // library filter, not the YouTube import box.
    search.placeholder = 'Filter title, artist, playlist or tag…';
    search.setAttribute('aria-label', 'Filter library');

    const style = document.createElement('style');
    style.id = 'youtubeImportBarStyles';
    style.textContent = `
      .youtube-import-bar{margin:0 0 10px;padding:12px;border:1px solid #343a46;border-radius:12px;background:linear-gradient(180deg,#22262d,#15181e);box-shadow:0 12px 30px rgba(0,0,0,.25)}
      .youtube-import-copy{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}.youtube-import-copy strong{font-size:13px}
      .youtube-import-row .youtube-import-input{width:100%;margin:0;min-height:48px;font-size:15px}
      .youtube-import-actions{display:flex;justify-content:flex-end;margin-top:8px}.youtube-playlists-link{display:inline-flex;align-items:center;min-height:34px;padding:0 11px;border:1px solid #c53030;border-radius:999px;background:#b91c1c;color:#fff;text-decoration:none;font-size:12px;font-weight:800}
      @media(max-width:520px){.youtube-import-bar{position:relative;margin-left:0;margin-right:0}.youtube-import-copy{display:grid;gap:2px}.youtube-import-row .youtube-import-input{font-size:16px}}
    `;
    document.head.appendChild(style);
    loadV059();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTopImportBar, { once: true });
  } else {
    mountTopImportBar();
  }
})();
