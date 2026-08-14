(() => {
  const API_KEY_STORAGE = 'winampmusic.youtubeApiKey.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const COMMENTS_CACHE_KEY = 'winampmusic.comments.v1';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const MAX_COMMENTS = 20;

  const lyricsBar = document.getElementById('lyricsBar');
  const youtubePlayer = document.getElementById('youtubePlayer');
  const titleNode = document.getElementById('nowTitle');
  if (!titleNode) return;

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = './comments.css';
  document.head.appendChild(css);

  const eyebrow = document.querySelector('.topbar .eyebrow');
  if (eyebrow && !/v0\.3/i.test(eyebrow.textContent || '')) {
    eyebrow.textContent = 'YOUR YOUTUBE. YOUR PLAYER. · v0.3';
  }
  document.title = 'Winamp Music v0.3';

  const panel = document.createElement('section');
  panel.id = 'commentsPanel';
  panel.className = 'comments-panel';
  panel.innerHTML = `
    <div class="comments-header">
      <div>
        <div class="eyebrow">YOUTUBE COMMENTS</div>
        <strong id="commentsTitle">Current track</strong>
      </div>
      <div class="comments-actions">
        <button id="commentsRefresh" class="mini-button" type="button">Refresh</button>
        <button id="commentsSetup" class="mini-button" type="button">API key</button>
      </div>
    </div>
    <div id="commentsStatus" class="comments-status">Waiting for a track…</div>
    <div id="commentsList" class="comments-list"></div>`;
  (lyricsBar || youtubePlayer)?.insertAdjacentElement('afterend', panel);

  const commentsTitle = document.getElementById('commentsTitle');
  const commentsStatus = document.getElementById('commentsStatus');
  const commentsList = document.getElementById('commentsList');
  const refreshButton = document.getElementById('commentsRefresh');
  const setupButton = document.getElementById('commentsSetup');

  let activeVideoId = '';
  let requestController = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currentVideoId() {
    const saved = readJson(PLAYER_STATE_KEY, {});
    return /^[\w-]{6,20}$/.test(saved.currentId || '') ? saved.currentId : '';
  }

  function apiKey() {
    return String(localStorage.getItem(API_KEY_STORAGE) || '').trim();
  }

  function readCache() {
    return readJson(COMMENTS_CACHE_KEY, {});
  }

  function saveCache(videoId, comments) {
    const cache = readCache();
    cache[videoId] = { savedAt: Date.now(), comments };
    const entries = Object.entries(cache).sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0));
    localStorage.setItem(COMMENTS_CACHE_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, 40))));
  }

  function cachedComments(videoId) {
    const entry = readCache()[videoId];
    if (!entry || Date.now() - Number(entry.savedAt || 0) > CACHE_TTL_MS) return null;
    return Array.isArray(entry.comments) ? entry.comments : null;
  }

  function formatAge(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return '';
    const deltaSeconds = Math.round((time - Date.now()) / 1000);
    const abs = Math.abs(deltaSeconds);
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (abs < 60) return formatter.format(deltaSeconds, 'second');
    if (abs < 3600) return formatter.format(Math.round(deltaSeconds / 60), 'minute');
    if (abs < 86400) return formatter.format(Math.round(deltaSeconds / 3600), 'hour');
    if (abs < 2592000) return formatter.format(Math.round(deltaSeconds / 86400), 'day');
    if (abs < 31536000) return formatter.format(Math.round(deltaSeconds / 2592000), 'month');
    return formatter.format(Math.round(deltaSeconds / 31536000), 'year');
  }

  function renderComments(items, { cached = false } = {}) {
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
      age.textContent = formatAge(item.publishedAt);
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
    commentsStatus.textContent = cached ? `${items.length} comments · cached` : `${items.length} comments · YouTube`;
  }

  function renderNeedsKey() {
    commentsList.replaceChildren();
    commentsStatus.textContent = 'Add a YouTube Data API key once to show public comments inside Winamp.';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'comments-connect';
    action.textContent = 'Connect YouTube comments';
    action.addEventListener('click', openSetupDialog);
    commentsList.appendChild(action);
  }

  function normalizeApiError(payload, status) {
    const reason = payload?.error?.errors?.[0]?.reason || '';
    const message = payload?.error?.message || `YouTube API HTTP ${status}`;
    if (reason === 'commentsDisabled') return { kind: 'disabled', message: 'Comments are disabled for this video.' };
    if (['keyInvalid', 'accessNotConfigured', 'forbidden'].includes(reason) || status === 401) {
      return { kind: 'key', message: 'YouTube API key is missing, invalid, or not enabled for YouTube Data API v3.' };
    }
    if (reason === 'quotaExceeded') return { kind: 'quota', message: 'YouTube comments quota is exhausted for today.' };
    return { kind: 'other', message };
  }

  async function fetchComments(videoId, signal) {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('maxResults', String(MAX_COMMENTS));
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('textFormat', 'plainText');
    url.searchParams.set('key', apiKey());
    url.searchParams.set('fields', 'items(id,snippet(totalReplyCount,topLevelComment(snippet(authorDisplayName,authorProfileImageUrl,textDisplay,likeCount,publishedAt))))');

    const response = await fetch(url, { signal, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = normalizeApiError(payload, response.status);
      const exception = new Error(error.message);
      exception.kind = error.kind;
      throw exception;
    }

    return (payload.items || []).map((thread) => {
      const snippet = thread?.snippet?.topLevelComment?.snippet || {};
      return {
        id: thread.id || '',
        author: snippet.authorDisplayName || 'YouTube user',
        avatar: snippet.authorProfileImageUrl || '',
        text: snippet.textDisplay || '',
        likes: Number(snippet.likeCount || 0),
        replies: Number(thread?.snippet?.totalReplyCount || 0),
        publishedAt: snippet.publishedAt || '',
      };
    }).filter((item) => item.text);
  }

  async function loadComments({ force = false } = {}) {
    const videoId = currentVideoId();
    activeVideoId = videoId;
    commentsTitle.textContent = titleNode.textContent?.trim() || 'Current track';
    requestController?.abort();

    if (!videoId) {
      commentsStatus.textContent = 'Play a track to load its YouTube comments.';
      commentsList.replaceChildren();
      return;
    }
    if (!apiKey()) {
      renderNeedsKey();
      return;
    }

    const cached = !force && cachedComments(videoId);
    if (cached) {
      renderComments(cached, { cached: true });
      return;
    }

    requestController = new AbortController();
    commentsStatus.textContent = 'Loading YouTube comments in background…';
    if (force) commentsList.replaceChildren();
    try {
      const items = await fetchComments(videoId, requestController.signal);
      if (videoId !== activeVideoId) return;
      saveCache(videoId, items);
      renderComments(items);
    } catch (error) {
      if (error.name === 'AbortError') return;
      commentsList.replaceChildren();
      commentsStatus.textContent = error.message || 'Could not load YouTube comments.';
      if (error.kind === 'key') {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'comments-connect';
        action.textContent = 'Fix API key';
        action.addEventListener('click', openSetupDialog);
        commentsList.appendChild(action);
      }
    }
  }

  function ensureSetupDialog() {
    let dialog = document.getElementById('commentsSetupDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'commentsSetupDialog';
    dialog.innerHTML = `
      <form method="dialog" class="dialog-card comments-dialog-card">
        <div class="dialog-heading">
          <div><div class="eyebrow">YOUTUBE COMMENTS</div><h2>Connect public comments</h2></div>
          <button class="icon-button" value="cancel" aria-label="Close">✕</button>
        </div>
        <p>Paste a browser API key with <strong>YouTube Data API v3</strong> enabled. Winamp stores it only in this browser.</p>
        <label class="comments-key-label">API key<input id="commentsApiKeyInput" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" /></label>
        <p class="fine-print">Recommended: restrict the key to this GitHub Pages site as an HTTP referrer and restrict the API to YouTube Data API v3.</p>
        <div class="dialog-actions">
          <button id="commentsKeySave" type="button">Save key</button>
          <button id="commentsKeyClear" type="button" class="ghost danger">Clear key</button>
          <button value="cancel" class="ghost">Cancel</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const input = dialog.querySelector('#commentsApiKeyInput');
    dialog.querySelector('#commentsKeySave').addEventListener('click', () => {
      const value = String(input.value || '').trim();
      if (!value) {
        input.focus();
        return;
      }
      localStorage.setItem(API_KEY_STORAGE, value);
      dialog.close();
      loadComments({ force: true }).catch(() => {});
    });
    dialog.querySelector('#commentsKeyClear').addEventListener('click', () => {
      localStorage.removeItem(API_KEY_STORAGE);
      localStorage.removeItem(COMMENTS_CACHE_KEY);
      input.value = '';
      dialog.close();
      renderNeedsKey();
    });
    return dialog;
  }

  function openSetupDialog() {
    const dialog = ensureSetupDialog();
    const input = dialog.querySelector('#commentsApiKeyInput');
    input.value = apiKey();
    dialog.showModal();
    setTimeout(() => input.focus(), 0);
  }

  refreshButton?.addEventListener('click', () => loadComments({ force: true }).catch(() => {}));
  setupButton?.addEventListener('click', openSetupDialog);

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

  setTimeout(() => loadComments().catch(() => {}), 300);
})();
