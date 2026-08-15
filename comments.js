(() => {
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const COMMENTS_CACHE_KEY = 'winampmusic.comments.v4';
  const COMMENTS_ENABLED_KEY = 'winampmusic.commentsEnabled.v1';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const MAX_COMMENTS = 20;
  const YOUTUBE_LOGIN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Ffeed%2Flibrary';
  const INVIDIOUS_INSTANCES = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yt.chocolatemoo53.com'];
  const PIPED_INSTANCES = ['https://pipedapi.kavin.rocks'];

  if (window.__WINAMP_YOUTUBE_COMMENTS_V5__) return;
  window.__WINAMP_YOUTUBE_COMMENTS_V5__ = true;

  if (!document.querySelector('script[data-winamp-lyrics-sync]')) {
    const syncScript = document.createElement('script');
    syncScript.src = './lyrics-sync.js?v=0.6';
    syncScript.defer = true;
    syncScript.dataset.winampLyricsSync = '1';
    document.head.appendChild(syncScript);
  }

  const titleNode = document.getElementById('nowTitle');
  const panel = document.getElementById('commentsPanel');
  const commentsTitle = document.getElementById('commentsTitle');
  const commentsStatus = document.getElementById('commentsStatus');
  const commentsList = document.getElementById('commentsList');
  const connectButton = document.getElementById('commentsConnect');
  const refreshButton = document.getElementById('commentsRefresh');
  const disconnectButton = document.getElementById('commentsDisconnect');
  const setupButton = document.getElementById('commentsSetup');
  if (!titleNode || !panel || !commentsStatus || !commentsList) return;

  let activeVideoId = '';
  let requestController = null;

  setupButton?.remove();
  if (connectButton) connectButton.textContent = 'YouTube login';
  if (disconnectButton) disconnectButton.textContent = 'Hide comments';

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currentVideoId() {
    const saved = readJson(PLAYER_STATE_KEY, {});
    return /^[\w-]{6,20}$/.test(saved.currentId || '') ? saved.currentId : '';
  }

  function commentsEnabled() {
    return localStorage.getItem(COMMENTS_ENABLED_KEY) === '1';
  }

  function setCommentsEnabled(enabled) {
    if (enabled) localStorage.setItem(COMMENTS_ENABLED_KEY, '1');
    else localStorage.removeItem(COMMENTS_ENABLED_KEY);
  }

  function readCache() {
    return readJson(COMMENTS_CACHE_KEY, {});
  }

  function saveCache(videoId, comments, source) {
    const cache = readCache();
    cache[videoId] = { savedAt: Date.now(), comments, source };
    const entries = Object.entries(cache)
      .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
      .slice(0, 40);
    localStorage.setItem(COMMENTS_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  function cachedComments(videoId) {
    const entry = readCache()[videoId];
    if (!entry || Date.now() - Number(entry.savedAt || 0) > CACHE_TTL_MS) return null;
    return Array.isArray(entry.comments) ? entry : null;
  }

  function setConnectedUi(connected) {
    if (connectButton) connectButton.hidden = connected;
    if (disconnectButton) disconnectButton.hidden = !connected;
    if (refreshButton) refreshButton.disabled = !connected;
    panel.classList.toggle('comments-connected', connected);
  }

  function renderConnectState(message = '') {
    setConnectedUi(false);
    commentsList.replaceChildren();
    commentsStatus.textContent = message || 'Open YouTube login once, then public comments load here for the current track.';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'comments-connect comments-login-primary';
    action.textContent = '▶ Login with YouTube';
    action.addEventListener('click', enableComments);
    commentsList.appendChild(action);
  }

  function renderComments(items, { cached = false, source = 'YouTube' } = {}) {
    setConnectedUi(true);
    commentsList.replaceChildren();
    if (!items.length) {
      commentsStatus.textContent = 'No public comments returned for this video.';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement('article');
      row.className = 'youtube-comment';

      if (item.avatar) {
        const avatar = document.createElement('img');
        avatar.className = 'comment-avatar';
        avatar.src = item.avatar;
        avatar.alt = '';
        avatar.loading = 'lazy';
        avatar.referrerPolicy = 'no-referrer';
        row.appendChild(avatar);
      } else {
        const avatar = document.createElement('span');
        avatar.className = 'comment-avatar comment-avatar-placeholder';
        avatar.textContent = '▶';
        row.appendChild(avatar);
      }

      const body = document.createElement('div');
      body.className = 'comment-body';
      const head = document.createElement('div');
      head.className = 'comment-head';
      const author = document.createElement('strong');
      author.textContent = item.author || 'YouTube user';
      const age = document.createElement('span');
      age.textContent = item.age || '';
      head.append(author, age);

      const text = document.createElement('div');
      text.className = 'comment-text';
      text.textContent = item.text || '';

      const meta = document.createElement('div');
      meta.className = 'comment-meta';
      const bits = [];
      if (Number(item.likes) > 0) bits.push(`♥ ${Number(item.likes).toLocaleString()}`);
      if (Number(item.replies) > 0) bits.push(`↳ ${Number(item.replies).toLocaleString()} replies`);
      meta.textContent = bits.join('  ·  ');

      body.append(head, text, meta);
      row.appendChild(body);
      fragment.appendChild(row);
    }
    commentsList.appendChild(fragment);
    commentsStatus.textContent = cached ? `${items.length} comments · cached` : `${items.length} comments · ${source}`;
  }

  function normalizeInvidious(payload) {
    return (payload?.comments || []).slice(0, MAX_COMMENTS).map((item) => ({
      id: item.commentId || '',
      author: item.author || 'YouTube user',
      avatar: item.authorThumbnails?.at?.(-1)?.url || item.authorThumbnails?.[0]?.url || '',
      text: clean(item.content || ''),
      likes: Number(item.likeCount || 0),
      replies: Number(item.replies?.replyCount || item.replyCount || 0),
      age: clean(item.publishedText || ''),
    })).filter((item) => item.text);
  }

  function normalizePiped(payload) {
    return (payload?.comments || []).slice(0, MAX_COMMENTS).map((item) => ({
      id: item.commentId || '',
      author: item.author || 'YouTube user',
      avatar: item.thumbnail || '',
      text: clean(item.commentText || ''),
      likes: Number(item.likeCount || 0),
      replies: item.creatorReplied ? 1 : 0,
      age: clean(item.commentedTime || ''),
    })).filter((item) => item.text);
  }

  async function fetchFromInstances(videoId, signal) {
    let lastError = null;
    for (const base of INVIDIOUS_INSTANCES) {
      try {
        const url = new URL(`/api/v1/comments/${encodeURIComponent(videoId)}`, base);
        url.searchParams.set('hl', navigator.language?.split('-')[0] || 'en');
        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = normalizeInvidious(await response.json());
        if (items.length) return { items, source: 'YouTube' };
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
      }
    }

    for (const base of PIPED_INSTANCES) {
      try {
        const url = new URL(`/comments/${encodeURIComponent(videoId)}`, base);
        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = normalizePiped(await response.json());
        if (items.length) return { items, source: 'YouTube' };
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
      }
    }

    throw lastError || new Error('Public YouTube comments are unavailable right now.');
  }

  async function enableComments() {
    window.open(YOUTUBE_LOGIN_URL, '_blank', 'noopener,noreferrer');
    setCommentsEnabled(true);
    setConnectedUi(true);
    commentsStatus.textContent = 'YouTube opened. Loading public comments…';
    await loadComments({ force: true }).catch(() => {});
  }

  function disableComments() {
    setCommentsEnabled(false);
    requestController?.abort();
    renderConnectState('Comments hidden. Use YouTube login to enable them again.');
  }

  async function loadComments({ force = false } = {}) {
    const videoId = currentVideoId();
    activeVideoId = videoId;
    commentsTitle.textContent = titleNode.textContent?.trim() || 'Current track';
    requestController?.abort();

    if (!videoId) {
      commentsStatus.textContent = 'Play a track to load its YouTube comments.';
      commentsList.replaceChildren();
      setConnectedUi(commentsEnabled());
      return;
    }

    if (!commentsEnabled()) {
      renderConnectState();
      return;
    }

    const cached = !force && cachedComments(videoId);
    if (cached) {
      renderComments(cached.comments, { cached: true, source: cached.source || 'YouTube' });
      return;
    }

    requestController = new AbortController();
    commentsStatus.textContent = 'Loading YouTube comments…';
    if (force) commentsList.replaceChildren();

    try {
      const result = await fetchFromInstances(videoId, requestController.signal);
      if (videoId !== activeVideoId) return;
      saveCache(videoId, result.items, result.source);
      renderComments(result.items, { source: result.source });
    } catch (error) {
      if (error.name === 'AbortError') return;
      commentsList.replaceChildren();
      commentsStatus.textContent = 'Could not load comments right now. Try Refresh.';
    }
  }

  connectButton?.addEventListener('click', () => enableComments().catch(() => {}));
  refreshButton?.addEventListener('click', () => loadComments({ force: true }).catch(() => {}));
  disconnectButton?.addEventListener('click', disableComments);

  let lastSeenId = '';
  setInterval(() => {
    const id = currentVideoId();
    if (id === lastSeenId) return;
    lastSeenId = id;
    loadComments().catch(() => {});
  }, 700);

  new MutationObserver(() => {
    commentsTitle.textContent = titleNode.textContent?.trim() || 'Current track';
  }).observe(titleNode, { childList: true, subtree: true, characterData: true });

  setConnectedUi(commentsEnabled());
  setTimeout(() => loadComments().catch(() => {}), 300);
})();
