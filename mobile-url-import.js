(() => {
  const search = document.getElementById('search');
  const count = document.getElementById('trackCount');
  const status = document.getElementById('status');
  if (!search) return;

  let lastHandled = '';
  let timer = null;
  let sharedCleanupDone = false;

  function parseYouTubeUrl(value) {
    const text = String(value || '').trim();
    if (!/^https?:\/\//i.test(text)) return null;
    try {
      const url = new URL(text);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const okHost = host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com';
      if (!okHost) return null;
      const shortId = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : '';
      const videoId = shortId || url.searchParams.get('v') || '';
      const playlistId = url.searchParams.get('list') || '';
      if (!/^[\w-]{6,20}$/.test(videoId) && !/^[\w-]{6,160}$/.test(playlistId)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function dispatchImport() {
    const value = search.value.trim();
    const url = parseYouTubeUrl(value);
    if (!url || url === lastHandled) return;
    lastHandled = url;

    // Android Chrome / keyboards can insert clipboard text without exposing
    // clipboardData to a paste listener. The existing Enter handlers already
    // own all import behavior, so route the inserted URL through them.
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(event);
    if (status && search.value.trim()) status.textContent = 'READING YOUTUBE LINK';
  }

  function scheduleImport() {
    clearTimeout(timer);
    timer = setTimeout(dispatchImport, 60);
  }

  search.addEventListener('input', scheduleImport, true);
  search.addEventListener('change', scheduleImport, true);

  function isSharedPage() {
    const params = new URLSearchParams(location.search);
    return Boolean(params.get('s') || params.get('p'));
  }

  function cleanupSharedSearch() {
    if (sharedCleanupDone || !isSharedPage()) return;
    const countText = String(count?.textContent || '');
    const value = search.value.trim();
    const libraryLoaded = /\d+/.test(countText) && !/^0(?:\/0)?$/.test(countText);
    if (!libraryLoaded) return;

    // A mobile browser may restore the long #k share secret into the search
    // field. A shared playlist should always open unfiltered.
    if (value || countText.includes('/')) {
      search.value = '';
      lastHandled = '';
      window.renderLibrary?.();
    }
    sharedCleanupDone = true;
  }

  if (isSharedPage()) {
    cleanupSharedSearch();
    const observer = new MutationObserver(() => {
      cleanupSharedSearch();
      if (sharedCleanupDone) observer.disconnect();
    });
    if (count) observer.observe(count, { childList: true, subtree: true, characterData: true });
    setTimeout(cleanupSharedSearch, 500);
    setTimeout(cleanupSharedSearch, 1500);
  }
})();
