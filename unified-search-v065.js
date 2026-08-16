(() => {
  if (window.__WINAMP_MUSIC_UNIFIED_SEARCH_V065__) return;
  window.__WINAMP_MUSIC_UNIFIED_SEARCH_V065__ = true;

  const COPY = {
    en: { title: 'Search music', hint: 'Artist, track, YouTube or Apple Music link…', button: 'Search', share: 'Share track', searching: 'Search YouTube or paste a music link' },
    ru: { title: 'Поиск музыки', hint: 'Исполнитель, трек, ссылка YouTube или Apple Music…', button: 'Найти', share: 'Поделиться треком', searching: 'Ищи музыку или вставь ссылку' },
    es: { title: 'Buscar música', hint: 'Artista, canción o enlace de YouTube/Apple Music…', button: 'Buscar', share: 'Compartir canción', searching: 'Busca música o pega un enlace' },
    de: { title: 'Musik suchen', hint: 'Künstler, Titel oder YouTube-/Apple-Music-Link…', button: 'Suchen', share: 'Titel teilen', searching: 'Musik suchen oder Link einfügen' },
    zh: { title: '搜索音乐', hint: '歌手、歌曲或 YouTube / Apple Music 链接…', button: '搜索', share: '分享歌曲', searching: '搜索音乐或粘贴链接' },
    hi: { title: 'संगीत खोजें', hint: 'कलाकार, गाना या YouTube / Apple Music लिंक…', button: 'खोजें', share: 'ट्रैक साझा करें', searching: 'संगीत खोजें या लिंक पेस्ट करें' },
    ur: { title: 'موسیقی تلاش کریں', hint: 'فنکار، گانا یا YouTube / Apple Music لنک…', button: 'تلاش', share: 'ٹریک شیئر کریں', searching: 'موسیقی تلاش کریں یا لنک پیسٹ کریں' },
    ar: { title: 'ابحث عن الموسيقى', hint: 'الفنان أو الأغنية أو رابط YouTube / Apple Music…', button: 'بحث', share: 'مشاركة المقطع', searching: 'ابحث عن الموسيقى أو الصق رابطًا' },
  };

  function locale() {
    const langs = [...(navigator.languages || []), navigator.language || 'en'];
    for (const raw of langs) {
      const lang = String(raw || '').toLowerCase().split('-')[0];
      if (COPY[lang]) return lang;
    }
    return 'en';
  }

  function isMusicUrl(value) {
    const text = String(value || '').trim();
    if (!/^https?:\/\//i.test(text)) return false;
    try {
      const host = new URL(text).hostname.toLowerCase().replace(/^www\./, '');
      return host === 'music.apple.com' || ['youtu.be', 'youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host);
    } catch {
      return false;
    }
  }

  function mount() {
    const lang = locale();
    const copy = COPY[lang];
    const rtl = lang === 'ar' || lang === 'ur';
    const importBar = document.getElementById('youtubeImportBar');
    const input = document.getElementById('youtubeImportInput');
    const songPanel = document.getElementById('songSearchBar');
    const songForm = document.getElementById('songSearchForm');
    const songInput = document.getElementById('songSearchInput');
    const songResults = document.getElementById('songSearchResults');
    const songStatus = document.getElementById('songSearchStatus');
    if (!importBar || !input || !songPanel || !songForm || !songInput || !songResults) return false;
    if (importBar.dataset.unifiedSearchV065 === '1') return true;
    importBar.dataset.unifiedSearchV065 = '1';

    importBar.dir = rtl ? 'rtl' : 'ltr';
    input.type = 'search';
    input.inputMode = 'search';
    input.placeholder = copy.hint;
    input.setAttribute('aria-label', copy.title);

    const copyBox = importBar.querySelector('.youtube-import-copy');
    if (copyBox) {
      copyBox.innerHTML = `<div><div class="eyebrow">${copy.title.toUpperCase()}</div><strong>${copy.searching}</strong></div>`;
    }

    const row = importBar.querySelector('.youtube-import-row');
    let button = document.getElementById('unifiedMusicSearchButton');
    if (!button && row) {
      button = document.createElement('button');
      button.id = 'unifiedMusicSearchButton';
      button.type = 'button';
      button.className = 'unified-music-search-button';
      button.textContent = copy.button;
      row.appendChild(button);
    }

    const runTextSearch = () => {
      const query = String(input.value || '').trim();
      if (!query || isMusicUrl(query)) return false;
      songInput.value = query;
      songForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return true;
    };

    button?.addEventListener('click', runTextSearch);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || isMusicUrl(input.value)) return;
      event.preventDefault();
      runTextSearch();
    });

    const actionBox = importBar.querySelector('.youtube-import-actions');
    if (songStatus && actionBox) {
      songStatus.classList.add('unified-search-status');
      actionBox.insertAdjacentElement('afterbegin', songStatus);
    }
    importBar.appendChild(songResults);
    songPanel.hidden = true;

    const controls = document.querySelector('.player .controls');
    if (controls && !document.getElementById('playerShareCurrentTrackButton')) {
      const share = document.createElement('button');
      share.id = 'playerShareCurrentTrackButton';
      share.type = 'button';
      share.className = 'player-share-track';
      share.textContent = `↗ ${copy.share}`;
      share.setAttribute('aria-label', copy.share);
      share.addEventListener('click', () => window.winampMusicShareCurrentTrack?.());
      controls.insertAdjacentElement('afterend', share);
    }

    const footer = document.querySelector('.app-version');
    if (footer) footer.textContent = 'v0.6.5';

    const style = document.createElement('style');
    style.id = 'unifiedSearchV065Styles';
    style.textContent = `
      .youtube-import-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .unified-music-search-button{min-width:92px;border:1px solid #fca600;border-radius:9px;background:#fca600;color:#111;font-weight:900;padding:0 14px}
      .youtube-import-actions{align-items:center;justify-content:space-between;gap:8px}.unified-search-status{margin-right:auto;text-align:left}
      #songSearchResults{margin-top:10px}.player-share-track{display:block;width:100%;margin:10px 0 2px;min-height:44px;border:1px solid #8f7724;border-radius:9px;background:#2a3039;color:#f7d95d;font-weight:900;font-size:13px}
      #shareCurrentTrackButton{display:none!important}
      [dir="rtl"] .unified-search-status{margin-right:0;margin-left:auto;text-align:right}
      @media(max-width:520px){.youtube-import-row{grid-template-columns:1fr}.unified-music-search-button{min-height:46px}.youtube-import-actions{flex-wrap:wrap}.youtube-playlists-link{margin-left:auto}}
    `;
    document.head.appendChild(style);
    return true;
  }

  let attempts = 0;
  const tryMount = () => {
    if (mount()) return;
    attempts += 1;
    if (attempts < 100) setTimeout(tryMount, 50);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryMount, { once: true });
  else tryMount();
})();
