(() => {
  const APP_URL = 'https://bambuchastudent.github.io/winampmusic/';
  const APP_ORIGIN = new URL(APP_URL).origin;
  const MAX_SCROLL_ROUNDS = 240;
  const STABLE_ROUNDS_TO_STOP = 5;
  const SCROLL_DELAY_MS = 450;

  if (!/(^|\.)youtube\.com$/.test(location.hostname)) {
    alert('Winamp Music importer: run this script on youtube.com or music.youtube.com.');
    return;
  }

  const playerWindow = window.open(APP_URL, 'winampmusic-import');
  if (!playerWindow) {
    alert('Winamp Music importer: allow popups for YouTube, then run the script again.');
    return;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const tracks = new Map();
  let currentTrackId = null;

  function videoIdFromHref(href) {
    if (!href) return null;
    try {
      const url = new URL(href, location.href);
      const id = url.searchParams.get('v');
      return id && /^[\w-]{6,20}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function bestText(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      const text = clean(element?.getAttribute?.('title') || element?.textContent);
      if (text) return text;
    }
    return '';
  }

  function currentVideoId() {
    try {
      return new URL(location.href).searchParams.get('v');
    } catch {
      return null;
    }
  }

  function collectCurrentTrack() {
    const id = currentVideoId();
    if (!id || !/^[\w-]{6,20}$/.test(id)) return;

    const title = bestText(document, [
      'h1.ytd-watch-metadata yt-formatted-string',
      'h1.title yt-formatted-string',
      'ytmusic-player-bar .title',
      'ytmusic-player-bar yt-formatted-string.title',
      'meta[name="title"]',
    ]) || clean(document.querySelector('meta[property="og:title"]')?.content) || clean(document.title.replace(/\s*-\s*YouTube.*$/i, ''));

    const artist = bestText(document, [
      'ytd-watch-metadata ytd-channel-name a',
      '#owner ytd-channel-name a',
      'ytmusic-player-bar .byline a',
      'ytmusic-player-bar .subtitle a',
      'ytmusic-player-bar a[href*="/channel/"]',
      'ytmusic-player-bar a[href*="/@"]',
    ]) || clean(document.querySelector('meta[itemprop="author"]')?.content) || 'YouTube';

    if (!title) return;
    currentTrackId = id;
    tracks.set(id, {
      id,
      title,
      artist,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      playlist: clean(document.querySelector('h1 yt-formatted-string, ytmusic-detail-header-renderer h2, h1')?.textContent),
      importedAt: new Date().toISOString(),
      current: true,
    });
  }

  function collectFromRow(row) {
    const link = row.querySelector(
      'a#video-title[href*="watch?v="], a#video-title-link[href*="watch?v="], a[href*="watch?v="]'
    );
    const id = videoIdFromHref(link?.href);
    if (!id) return;

    const title = clean(
      link?.getAttribute('title') ||
      link?.textContent ||
      bestText(row, ['#video-title', 'yt-formatted-string.title', '.title'])
    );
    if (!title) return;

    const artist = bestText(row, [
      'ytd-channel-name a',
      '#channel-name a',
      '#byline a',
      '.yt-simple-endpoint.style-scope.yt-formatted-string',
      'ytmusic-flex-column:nth-child(2) a',
      'ytmusic-responsive-list-item-renderer a[href*="/channel/"]',
      'ytmusic-responsive-list-item-renderer a[href*="/@"]',
    ]) || 'YouTube';

    const image = row.querySelector('img');
    const thumbnail = image?.currentSrc || image?.src || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const previous = tracks.get(id);

    tracks.set(id, {
      id,
      title,
      artist,
      thumbnail,
      playlist: clean(document.querySelector('h1 yt-formatted-string, ytmusic-detail-header-renderer h2, h1')?.textContent),
      importedAt: new Date().toISOString(),
      current: previous?.current || id === currentTrackId,
    });
  }

  function collectVisible() {
    collectCurrentTrack();
    const selectors = [
      'ytd-playlist-video-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-rich-item-renderer',
      'ytmusic-responsive-list-item-renderer',
      'ytmusic-two-row-item-renderer',
    ];
    document.querySelectorAll(selectors.join(',')).forEach(collectFromRow);

    if (!tracks.size) {
      document.querySelectorAll('a[href*="watch?v="]').forEach((link) => {
        const id = videoIdFromHref(link.href);
        const title = clean(link.getAttribute('title') || link.textContent);
        if (!id || !title || tracks.has(id)) return;
        tracks.set(id, {
          id,
          title,
          artist: 'YouTube',
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          playlist: clean(document.title.replace(/\s*-\s*YouTube.*$/i, '')),
          importedAt: new Date().toISOString(),
          current: id === currentTrackId,
        });
      });
    }
  }

  function showBadge(text) {
    let badge = document.getElementById('winampmusic-import-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'winampmusic-import-badge';
      Object.assign(badge.style, {
        position: 'fixed',
        zIndex: '2147483647',
        right: '16px',
        bottom: '16px',
        maxWidth: 'min(360px, calc(100vw - 32px))',
        padding: '12px 14px',
        borderRadius: '10px',
        background: '#17191f',
        color: '#a9f08b',
        border: '1px solid #485247',
        boxShadow: '0 10px 40px rgba(0,0,0,.45)',
        font: '600 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
      });
      document.body.appendChild(badge);
    }
    badge.textContent = text;
  }

  async function scrollAndCollect() {
    let stableRounds = 0;
    let previousCount = -1;
    let previousHeight = -1;

    for (let round = 0; round < MAX_SCROLL_ROUNDS; round += 1) {
      collectVisible();
      showBadge(`Winamp Music: scanning… ${tracks.size} tracks${currentTrackId ? ' + current' : ''}`);

      const scrollingElement = document.scrollingElement || document.documentElement;
      const currentHeight = scrollingElement.scrollHeight;
      if (tracks.size === previousCount && currentHeight === previousHeight) stableRounds += 1;
      else stableRounds = 0;

      if (stableRounds >= STABLE_ROUNDS_TO_STOP) break;
      previousCount = tracks.size;
      previousHeight = currentHeight;

      window.scrollTo({ top: currentHeight, behavior: 'instant' });
      await sleep(SCROLL_DELAY_MS);
    }

    collectVisible();
  }

  async function sendToPlayer(payload) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const timeout = setInterval(() => {
        attempts += 1;
        try {
          playerWindow.postMessage(payload, APP_ORIGIN);
        } catch {}
        if (attempts >= 30) {
          clearInterval(timeout);
          window.removeEventListener('message', onMessage);
          reject(new Error('Player did not acknowledge import'));
        }
      }, 500);

      function onMessage(event) {
        if (event.origin !== APP_ORIGIN) return;
        if (event.source !== playerWindow) return;
        if (event.data?.type !== 'WINAMP_MUSIC_IMPORT_ACK') return;
        clearInterval(timeout);
        window.removeEventListener('message', onMessage);
        resolve(event.data);
      }
      window.addEventListener('message', onMessage);
      playerWindow.postMessage(payload, APP_ORIGIN);
    });
  }

  (async () => {
    try {
      showBadge('Winamp Music: scanning current YouTube page…');
      collectCurrentTrack();
      await scrollAndCollect();
      if (!tracks.size) {
        showBadge('Winamp Music: no tracks found. Open a playing track, playlist, or Liked videos first.');
        return;
      }

      const payload = {
        type: 'WINAMP_MUSIC_IMPORT',
        version: 1,
        source: location.href,
        title: document.title,
        currentTrackId,
        tracks: [...tracks.values()],
      };

      showBadge(`Winamp Music: sending ${tracks.size} tracks${currentTrackId ? ' including current' : ''}…`);
      const ack = await sendToPlayer(payload);
      showBadge(`Winamp Music: done — ${ack.added} new, ${ack.total} total${currentTrackId ? ', current track included' : ''}.`);
      setTimeout(() => document.getElementById('winampmusic-import-badge')?.remove(), 7000);
    } catch (error) {
      console.error('[Winamp Music importer]', error);
      showBadge(`Winamp Music: ${error.message}. Keep the player tab open and run the script again.`);
    }
  })();
})();
