(() => {
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const COMMENTS_CACHE_KEY = 'winampmusic.comments.v2';
  const GOOGLE_CLIENT_ID_KEY = 'winampmusic.googleClientId.v1';
  const TOKEN_KEY = 'winampmusic.youtubeOAuthToken.v1';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const MAX_COMMENTS = 20;
  const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

  if (window.__WINAMP_YOUTUBE_COMMENTS_V4__) return;
  window.__WINAMP_YOUTUBE_COMMENTS_V4__ = true;

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
  let tokenClient = null;
  let tokenPromiseResolve = null;
  let tokenPromiseReject = null;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readJson(storage, key, fallback) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currentVideoId() {
    const saved = readJson(localStorage, PLAYER_STATE_KEY, {});
    return /^[\w-]{6,20}$/.test(saved.currentId || '') ? saved.currentId : '';
  }

  function configuredClientId() {
    return clean(window.WINAMP_MUSIC_GOOGLE_CLIENT_ID || localStorage.getItem(GOOGLE_CLIENT_ID_KEY));
  }

  function tokenState() {
    const token = readJson(sessionStorage, TOKEN_KEY, null);
    if (!token?.accessToken || !Number(token.expiresAt)) return null;
    if (Date.now() > Number(token.expiresAt) - 30000) return null;
    return token;
  }

  function saveToken(payload) {
    const expiresIn = Math.max(60, Number(payload?.expires_in || 3600));
    const state = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      scope: payload.scope || YOUTUBE_SCOPE,
    };
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(state));
    return state;
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    tokenClient = null;
  }

  function readCache() {
    return readJson(localStorage, COMMENTS_CACHE_KEY, {});
  }

  function saveCache(videoId, comments) {
    const cache = readCache();
    cache[videoId] = { savedAt: Date.now(), comments };
    const entries = Object.entries(cache)
      .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
      .slice(0, 40);
    localStorage.setItem(COMMENTS_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  function cachedComments(videoId) {
    const entry = readCache()[videoId];
    if (!entry || Date.now() - Number(entry.savedAt || 0) > CACHE_TTL_MS) return null;
    return Array.isArray(entry.comments) ? entry.comments : null;
  }

  async function waitForGoogleIdentity() {
    const started = Date.now();
    while (!window.google?.accounts?.oauth2?.initTokenClient) {
      if (Date.now() - started > 12000) throw new Error('Google sign-in did not load. Reload the page and try again.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function oauthToken({ prompt = '' } = {}) {
    const existing = tokenState();
    if (existing && !prompt) return existing.accessToken;
    const clientId = configuredClientId();
    if (!clientId) throw Object.assign(new Error('YouTube OAuth client is not configured yet.'), { kind: 'setup' });
    await waitForGoogleIdentity();

    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: YOUTUBE_SCOPE,
        callback: (response) => {
          if (response?.error) {
            tokenPromiseReject?.(Object.assign(new Error(response.error_description || response.error), { kind: 'oauth' }));
          } else if (response?.access_token) {
            const state = saveToken(response);
            tokenPromiseResolve?.(state.accessToken);
          } else {
            tokenPromiseReject?.(Object.assign(new Error('YouTube sign-in returned no access token.'), { kind: 'oauth' }));
          }
          tokenPromiseResolve = null;
          tokenPromiseReject = null;
        },
        error_callback: (error) => {
          tokenPromiseReject?.(Object.assign(new Error(error?.message || error?.type || 'YouTube sign-in failed.'), { kind: 'oauth' }));
          tokenPromiseResolve = null;
          tokenPromiseReject = null;
        },
      });
    }

    return new Promise((resolve, reject) => {
      tokenPromiseResolve = resolve;
      tokenPromiseReject = reject;
      tokenClient.requestAccessToken({ prompt: prompt || (tokenState() ? '' : 'consent') });
    });
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

  function setConnectedUi(connected) {
    if (connectButton) connectButton.hidden = connected;
    if (disconnectButton) disconnectButton.hidden = !connected;
    if (refreshButton) refreshButton.disabled = !connected;
    panel.classList.toggle('comments-connected', connected);
  }

  function renderConnectState(message = '') {
    setConnectedUi(false);
    commentsList.replaceChildren();
    commentsStatus.textContent = message || (configuredClientId()
      ? 'Connect your YouTube account to show public comments for the current video.'
      : 'One-time site setup is needed, then comments use a normal YouTube login.');
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'comments-connect';
    action.textContent = configuredClientId() ? 'Connect YouTube' : 'Set up YouTube login';
    action.addEventListener('click', () => {
      if (configuredClientId()) connectYouTube().catch(() => {});
      else openSetupDialog();
    });
    commentsList.appendChild(action);
  }

  function renderComments(items, { cached = false } = {}) {
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

  function normalizeApiError(payload, status) {
    const reason = payload?.error?.errors?.[0]?.reason || '';
    const message = payload?.error?.message || `YouTube API HTTP ${status}`;
    if (reason === 'commentsDisabled') return { kind: 'disabled', message: 'Comments are disabled for this video.' };
    if (reason === 'quotaExceeded') return { kind: 'quota', message: 'YouTube API quota is exhausted for today.' };
    if (status === 401 || ['authError', 'unauthorized'].includes(reason)) return { kind: 'auth', message: 'YouTube login expired. Connect again.' };
    if (status === 403 && reason === 'forbidden') return { kind: 'forbidden', message: 'YouTube did not allow comments for this request.' };
    return { kind: 'other', message };
  }

  async function fetchComments(videoId, signal, accessToken) {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('maxResults', String(MAX_COMMENTS));
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('textFormat', 'plainText');
    url.searchParams.set('fields', 'items(id,snippet(totalReplyCount,topLevelComment(snippet(authorDisplayName,authorProfileImageUrl,textDisplay,likeCount,publishedAt))))');

    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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

  async function connectYouTube() {
    commentsStatus.textContent = 'Opening YouTube login…';
    try {
      await oauthToken({ prompt: 'consent' });
      setConnectedUi(true);
      await loadComments({ force: true });
    } catch (error) {
      if (error.kind === 'setup') openSetupDialog();
      else renderConnectState(error.message || 'Could not connect YouTube.');
    }
  }

  async function disconnectYouTube() {
    const token = tokenState()?.accessToken;
    clearToken();
    localStorage.removeItem(COMMENTS_CACHE_KEY);
    if (token && window.google?.accounts?.oauth2?.revoke) {
      try { google.accounts.oauth2.revoke(token, () => {}); } catch {}
    }
    renderConnectState('YouTube disconnected from this browser session.');
  }

  async function loadComments({ force = false } = {}) {
    const videoId = currentVideoId();
    activeVideoId = videoId;
    commentsTitle.textContent = titleNode.textContent?.trim() || 'Current track';
    requestController?.abort();

    if (!videoId) {
      commentsStatus.textContent = 'Play a track to load its YouTube comments.';
      commentsList.replaceChildren();
      setConnectedUi(Boolean(tokenState()));
      return;
    }

    if (!configuredClientId()) {
      renderConnectState();
      return;
    }

    const cached = !force && cachedComments(videoId);
    if (cached && tokenState()) {
      renderComments(cached, { cached: true });
      return;
    }

    let accessToken = tokenState()?.accessToken;
    if (!accessToken) {
      renderConnectState();
      return;
    }

    requestController = new AbortController();
    commentsStatus.textContent = 'Loading YouTube comments in background…';
    if (force) commentsList.replaceChildren();
    try {
      const items = await fetchComments(videoId, requestController.signal, accessToken);
      if (videoId !== activeVideoId) return;
      saveCache(videoId, items);
      renderComments(items);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.kind === 'auth') {
        clearToken();
        renderConnectState(error.message);
        return;
      }
      commentsList.replaceChildren();
      commentsStatus.textContent = error.message || 'Could not load YouTube comments.';
    }
  }

  function ensureSetupDialog() {
    let dialog = document.getElementById('youtubeOAuthSetupDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'youtubeOAuthSetupDialog';
    dialog.innerHTML = `
      <form method="dialog" class="dialog-card comments-dialog-card">
        <div class="dialog-heading">
          <div><div class="eyebrow">ONE-TIME YOUTUBE LOGIN SETUP</div><h2>Connect Winamp Music to YouTube</h2></div>
          <button class="icon-button" value="cancel" aria-label="Close">✕</button>
        </div>
        <p>Comments now use Google/YouTube OAuth instead of an API key. The site owner needs one public <strong>Web OAuth Client ID</strong>; after that users only press <strong>Connect YouTube</strong>.</p>
        <label class="comments-key-label">Google OAuth Client ID<input id="youtubeOAuthClientId" type="text" autocomplete="off" spellcheck="false" placeholder="1234567890-….apps.googleusercontent.com" /></label>
        <p class="fine-print">In Google Cloud enable YouTube Data API v3, create a Web application OAuth client, and add <strong>https://bambuchastudent.github.io</strong> as an authorized JavaScript origin. The client ID is public; no client secret is stored in Winamp Music.</p>
        <div class="dialog-actions">
          <button id="youtubeOAuthSave" type="button">Save & connect</button>
          <button id="youtubeOAuthClear" type="button" class="ghost danger">Clear setup</button>
          <button value="cancel" class="ghost">Cancel</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const input = dialog.querySelector('#youtubeOAuthClientId');
    dialog.querySelector('#youtubeOAuthSave').addEventListener('click', async () => {
      const value = clean(input.value);
      if (!/\.apps\.googleusercontent\.com$/i.test(value)) {
        input.focus();
        return;
      }
      localStorage.setItem(GOOGLE_CLIENT_ID_KEY, value);
      clearToken();
      dialog.close();
      await connectYouTube();
    });
    dialog.querySelector('#youtubeOAuthClear').addEventListener('click', () => {
      localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
      localStorage.removeItem(COMMENTS_CACHE_KEY);
      clearToken();
      input.value = '';
      dialog.close();
      renderConnectState();
    });
    return dialog;
  }

  function openSetupDialog() {
    const dialog = ensureSetupDialog();
    const input = dialog.querySelector('#youtubeOAuthClientId');
    input.value = configuredClientId();
    dialog.showModal();
    setTimeout(() => input.focus(), 0);
  }

  connectButton?.addEventListener('click', () => connectYouTube().catch(() => {}));
  refreshButton?.addEventListener('click', () => loadComments({ force: true }).catch(() => {}));
  disconnectButton?.addEventListener('click', () => disconnectYouTube().catch(() => {}));
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

  setConnectedUi(Boolean(tokenState()));
  setTimeout(() => loadComments().catch(() => {}), 300);
})();
