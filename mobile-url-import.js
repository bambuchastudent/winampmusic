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
      return { href: url.href, videoId, playlistId };
    } catch {
      return null;
    }
  }

  function dispatchImport() {
    const parsed = parseYouTubeUrl(search.value);
    if (!parsed || parsed.href === lastHandled) return;

    if (parsed.videoId && !parsed.playlistId && window.winampMusicDirectYouTubeImport?.handleUrl) {
      lastHandled = parsed.href;
      window.winampMusicDirectYouTubeImport.handleUrl(parsed.href);
      if (status) status.textContent = 'READING YOUTUBE LINK';
      return;
    }

    // Playlist links still use the existing playlist picker. Trigger a real
    // buttonless Enter path only as a fallback after direct URL handlers had
    // a chance to claim the input.
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(event);
  }

  function scheduleImport() {
    clearTimeout(timer);
    timer = setTimeout(dispatchImport, 80);
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
