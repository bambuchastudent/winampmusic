(() => {
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const status = document.getElementById('status');
  const search = document.getElementById('search');
  const fallback = document.getElementById('mobilePlaybackActions');
  const openLink = document.getElementById('mobileOpenYoutube');
  const fallbackText = document.getElementById('mobilePlaybackHint');

  let blockedVideoId = '';

  function validVideoId(value) {
    return /^[\w-]{6,20}$/.test(value || '');
  }

  function currentVideoId() {
    try {
      const state = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) || '{}');
      return validVideoId(state.currentId) ? state.currentId : '';
    } catch {
      return '';
    }
  }

  function serviceForUrl(value) {
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
      if (['youtu.be', 'youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return 'YOUTUBE';
      if (host === 'music.apple.com') return 'APPLE MUSIC';
      if (host === 'open.spotify.com') return 'SPOTIFY';
      if (['vk.com', 'm.vk.com', 'vk.ru', 'm.vk.ru'].includes(host)) return 'VK';
      return '';
    } catch { return ''; }
  }

  function extractMusicUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const urls = text.match(/https?:\/\/[^\s]+/gi) || [];
    for (const item of urls) {
      const direct = item.replace(/[),.;!?]+$/g, '');
      if (serviceForUrl(direct)) return direct;
    }
    return '';
  }

  // Keep the original helper name for older regression checks and callers.
  function extractYouTubeUrl(value) {
    const url = extractMusicUrl(value);
    return serviceForUrl(url) === 'YOUTUBE' ? url : '';
  }

  function sharedMusic() {
    const params = new URLSearchParams(location.search);
    const candidates = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean);
    for (const candidate of candidates) {
      const url = extractMusicUrl(candidate);
      if (url) return { url, raw: candidates.join(' ') };
    }
    return { url: '', raw: '' };
  }

  function clearShareTargetParams() {
    const url = new URL(location.href);
    let changed = false;
    for (const key of ['url', 'text', 'title']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  async function importSharedUrl(url, raw = url) {
    if (!url) return false;
    const service = serviceForUrl(url);
    const started = Date.now();
    while (Date.now() - started < 12000) {
      if (service === 'YOUTUBE') {
        const handler = window.winampMusicDirectYouTubeImport?.handleUrl;
        if (typeof handler === 'function' && handler(url)) {
          if (status) status.textContent = 'SHARED FROM YOUTUBE';
          clearShareTargetParams();
          return true;
        }
      } else if (service === 'APPLE MUSIC') {
        const handler = window.winampMusicAppleImport?.handleUrl;
        if (typeof handler === 'function') {
          await handler(url, { play: true });
          if (status) status.textContent = 'SHARED FROM APPLE MUSIC';
          clearShareTargetParams();
          return true;
        }
      } else if (service === 'SPOTIFY' || service === 'VK') {
        const handler = window.winampMusicUniversalImport?.handleUrl;
        if (typeof handler === 'function') {
          await handler(`${raw} ${url}`, { play: true });
          if (status) status.textContent = `SHARED FROM ${service}`;
          clearShareTargetParams();
          return true;
        }
      }

      if (search && service === 'YOUTUBE') {
        search.value = url;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        if (!search.value) {
          if (status) status.textContent = 'SHARED FROM YOUTUBE';
          clearShareTargetParams();
          return true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  }

  function setOpenLink(id, { blocked = false } = {}) {
    if (!fallback || !openLink) return;
    const videoId = validVideoId(id) ? id : '';
    fallback.hidden = !videoId;
    if (!videoId) return;
    openLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    openLink.dataset.videoId = videoId;
    fallback.classList.toggle('blocked', blocked);
    if (fallbackText) {
      fallbackText.textContent = blocked
        ? 'YouTube blocks this video in embedded players. Open the same track in the YouTube app.'
        : 'If YouTube blocks embedded playback, open the current track in the YouTube app.';
    }
  }

  function parseYouTubeMessage(data) {
    try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return null; }
  }

  window.addEventListener('message', (event) => {
    if (!/youtube(?:-nocookie)?\.com$/i.test(new URL(event.origin || 'https://invalid.local').hostname)) return;
    const payload = parseYouTubeMessage(event.data);
    const code = Number(payload?.info);
    if (payload?.event !== 'onError' || ![101, 150].includes(code)) return;
    blockedVideoId = currentVideoId();
    setOpenLink(blockedVideoId, { blocked: true });
    if (status) status.textContent = 'YOUTUBE APP REQUIRED';
  });

  openLink?.addEventListener('click', () => {
    if (status) status.textContent = 'OPENING YOUTUBE';
  });

  setInterval(() => {
    if (blockedVideoId) {
      setOpenLink(blockedVideoId, { blocked: true });
      return;
    }
    setOpenLink(currentVideoId());
  }, 500);

  const shared = sharedMusic();
  if (shared.url) setTimeout(() => importSharedUrl(shared.url, shared.raw).catch(() => {}), 50);
})();
