(() => {
  const STORAGE_KEY = 'winampmusic.library.v1';
  const PARAM = 'p';
  const ID_PATTERN = /^[\w-]{6,20}$/;
  const STATUS = document.getElementById('status');

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function compactIds() {
    const seen = new Set();
    const ids = [];
    for (const track of readLibrary()) {
      const id = String(track?.id || '').trim();
      if (!ID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function parseCompactIds(value) {
    if (!value) return [];
    const seen = new Set();
    const ids = [];
    for (const id of String(value).split('.')) {
      if (!ID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function buildCompactShareUrl(ids = compactIds()) {
    const url = new URL(window.location.href);
    url.searchParams.delete('playlist');
    url.searchParams.delete(PARAM);
    url.searchParams.set(PARAM, ids.join('.'));
    url.hash = '';
    return url.toString();
  }

  async function shareCompactPlaylist() {
    const ids = compactIds();
    if (!ids.length) {
      if (STATUS) STATUS.textContent = 'NO TRACKS TO SHARE';
      return;
    }

    const shareUrl = buildCompactShareUrl(ids);
    const shareData = {
      title: 'Winamp Music playlist',
      text: `Listen to my ${ids.length}-track Winamp Music playlist`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        if (STATUS) STATUS.textContent = 'PLAYLIST SHARED';
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        if (STATUS) STATUS.textContent = 'SHORT LINK COPIED';
        return;
      }
      window.prompt('Copy playlist URL', shareUrl);
      if (STATUS) STATUS.textContent = 'SHORT SHARE LINK READY';
    } catch {
      if (STATUS) STATUS.textContent = 'SHARE CANCELLED';
    }
  }

  function installShareButton() {
    const oldButton = document.getElementById('sharePlaylistButton');
    if (!oldButton || oldButton.dataset.compactShare === '1') return;

    const button = oldButton.cloneNode(true);
    button.dataset.compactShare = '1';
    oldButton.replaceWith(button);
    button.addEventListener('click', shareCompactPlaylist);
  }

  function loadCompactPlaylist() {
    if (typeof window.importTracks !== 'function') return false;
    const value = new URLSearchParams(window.location.search).get(PARAM);
    const ids = parseCompactIds(value);
    if (!ids.length) return true;

    const result = window.importTracks(ids.map((id) => ({ id })));
    if (STATUS) {
      STATUS.textContent = result.added
        ? `SHARED PLAYLIST IMPORTED (${result.total})`
        : 'SHARED PLAYLIST LOADED';
    }

    if (typeof window.refreshWinampMetadata === 'function') {
      setTimeout(() => window.refreshWinampMetadata(), 0);
    }
    return true;
  }

  function boot(attempt = 0) {
    installShareButton();
    if (loadCompactPlaylist()) return;
    if (attempt < 40) setTimeout(() => boot(attempt + 1), 50);
  }

  window.winampMusicCompactShare = {
    buildUrl: buildCompactShareUrl,
    share: shareCompactPlaylist,
  };
  window.sharePlaylist = shareCompactPlaylist;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
})();