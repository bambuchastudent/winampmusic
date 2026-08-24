(() => {
  'use strict';
  if (window.__AMPULA_UNIFIED_ENTRY_152__) return;
  window.__AMPULA_UNIFIED_ENTRY_152__ = true;

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const form = $('fastImportForm');
  const input = $('fastImportInput');
  const button = $('fastImportButton');
  const hint = $('fastImportHint');
  const importPanel = form?.closest('.fast-import');
  const libraryFilter = $('search');
  const libraryHeader = document.querySelector('.library-header');

  if (!form || !input || !button || !hint || !importPanel) return;

  const style = document.createElement('style');
  style.id = 'ampulaUnifiedEntry152Styles';
  style.textContent = `
    #songSearchBar{display:none!important}
    #unifiedSearchResults.song-search-results{margin-top:10px;max-height:390px;overflow:auto}
    .library-search-toggle{width:38px;min-width:38px;height:38px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:900;display:grid;place-items:center;touch-action:manipulation}
    .library-search-toggle[aria-expanded="true"]{border-color:#8f7724;color:#f7d95d;background:#2f2a19}
    #search[hidden]{display:none!important}
    .fast-note{display:none!important}
    .bottle15{flex:0 0 78px;align-self:flex-start;animation:none!important;transition:none!important;transform:none!important}
    .bottle15 *{animation:none!important;transition:none!important}
    .bottle15-label{transform:none!important}
    @media(max-width:520px){.library-search-toggle{width:42px;min-width:42px;height:42px}.bottle15{flex-basis:64px}}
  `;
  document.head.appendChild(style);

  function isUrlLike(value) {
    return /^https?:\/\//i.test(clean(value));
  }

  function setMode() {
    if (button.disabled && button.dataset.unifiedSearchBusy === '1') return;
    button.textContent = isUrlLike(input.value) ? 'Add & Play' : 'Search';
    const results = $('unifiedSearchResults');
    if (results && isUrlLike(input.value)) results.hidden = true;
  }

  function rewritePrimaryCopy() {
    input.type = 'search';
    input.inputMode = 'search';
    input.placeholder = 'Song, artist, or YouTube / Apple Music link…';
    input.setAttribute('aria-label', 'Search music or paste a YouTube or Apple Music link');
    const head = importPanel.querySelector('.fast-import-head');
    const eyebrow = head?.querySelector('.eyebrow');
    const strong = head?.querySelector('strong');
    if (eyebrow) eyebrow.textContent = 'MUSIC';
    if (strong) strong.textContent = 'Search or paste a track, album, or playlist';
    hint.textContent = 'Type a song or paste a YouTube / Apple Music link';
    setMode();
  }

  function polishUi() {
    document.querySelector('.fast-note')?.remove();
    const share = $('sharePlaylistButton');
    if (!share) return;
    if (clean(share.textContent) === 'Gift / QR') share.textContent = 'Share / QR';
    share.setAttribute('aria-label', 'Share playlist by link or QR code');
  }

  function waitForSearchUi(timeoutMs = 4500) {
    const existing = $('songSearchForm');
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const next = $('songSearchForm');
        if (next) {
          clearInterval(timer);
          resolve(next);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Search UI did not mount'));
        }
      }, 50);
    });
  }

  function ensureSearchModule() {
    if ($('songSearchForm')) return Promise.resolve();
    if (!document.querySelector('script[data-fast-search],script[data-unified-search-loader]')) {
      const script = document.createElement('script');
      script.src = './v059.js?v=152';
      script.async = true;
      script.dataset.unifiedSearchLoader = '1';
      document.head.appendChild(script);
    }
    return waitForSearchUi().then(() => undefined);
  }

  function prepareSearchUi() {
    const panel = $('songSearchBar');
    const results = $('songSearchResults') || $('unifiedSearchResults');
    const status = $('songSearchStatus');
    if (!panel || !results) return false;

    if (results.id !== 'unifiedSearchResults') results.id = 'unifiedSearchResults';
    if (results.parentElement !== importPanel) importPanel.appendChild(results);
    panel.hidden = true;

    if (status && status.dataset.unifiedMirror !== '1') {
      status.dataset.unifiedMirror = '1';
      const sync = () => {
        const text = clean(status.textContent);
        if (!text) return;
        hint.textContent = text;
        const busy = /searching/i.test(text);
        button.dataset.unifiedSearchBusy = busy ? '1' : '0';
        button.disabled = busy;
        button.textContent = busy ? 'Searching…' : 'Search';
      };
      new MutationObserver(sync).observe(status, { childList: true, characterData: true, subtree: true });
      sync();
    }
    return true;
  }

  async function runTextSearch(query) {
    button.dataset.unifiedSearchBusy = '1';
    button.disabled = true;
    button.textContent = 'Searching…';
    hint.textContent = 'Searching YouTube…';
    try {
      await ensureSearchModule();
      prepareSearchUi();
      const searchForm = $('songSearchForm');
      const searchInput = $('songSearchInput');
      if (!searchForm || !searchInput) throw new Error('Search unavailable');
      searchInput.value = query;
      searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    } catch (error) {
      console.warn('[ÁmpulaMP] unified search unavailable', error);
      button.dataset.unifiedSearchBusy = '0';
      button.disabled = false;
      button.textContent = 'Search';
      hint.textContent = 'Music search unavailable · links still work';
    }
  }

  form.addEventListener('submit', (event) => {
    const value = clean(input.value);
    if (!value || isUrlLike(value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void runTextSearch(value);
  }, true);

  input.addEventListener('input', setMode, { passive: true });

  function mountLibraryFilterToggle() {
    if (!libraryFilter || !libraryHeader || $('librarySearchToggle')) return;
    libraryFilter.hidden = true;
    const toggle = document.createElement('button');
    toggle.id = 'librarySearchToggle';
    toggle.type = 'button';
    toggle.className = 'library-search-toggle';
    toggle.textContent = '🔍';
    toggle.title = 'Search your library';
    toggle.setAttribute('aria-label', 'Search your library');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'search');

    const titleBox = libraryHeader.firstElementChild;
    if (titleBox) titleBox.insertAdjacentElement('afterend', toggle);
    else libraryHeader.prepend(toggle);

    const closeFilter = () => {
      libraryFilter.value = '';
      libraryFilter.dispatchEvent(new Event('input', { bubbles: true }));
      libraryFilter.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      if (libraryFilter.hidden) {
        libraryFilter.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        libraryFilter.focus();
        return;
      }
      closeFilter();
    });

    libraryFilter.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFilter();
        toggle.focus();
      }
    });
  }

  const observer = new MutationObserver(() => {
    prepareSearchUi();
    polishUi();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  rewritePrimaryCopy();
  mountLibraryFilterToggle();
  prepareSearchUi();
  polishUi();
  console.info('[ÁmpulaMP] unified music entry 1.5.3 polish ready');
})();
