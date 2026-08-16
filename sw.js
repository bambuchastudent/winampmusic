const BUILD = 'v1.3.8-hard-controls';
const CACHE = 'winampmusic-shell-v29';
const NETWORK_TIMEOUT_MS = 6000;
const HARD_CONTROLS = './controls-failsafe-v138.js';

const CORE = [
  './',
  './index.html',
  './styles.css',
  './youtube-player.css',
  './winamp-features.css',
  './captions.css',
  './comments.css',
  './paste-import.css',
  './playlist-metadata.css',
  './mobile.css',
  './app.js',
  './boot-v134.js',
  './fixes-v054.js',
  './compact-share.js',
  './paste-import.js',
  './youtube-context.js',
  './direct-youtube-import.js',
  './input-v056.js',
  './apple-v061.js',
  './mobile-url-import.js',
  './mobile-share.js',
  './metadata-refresh.js',
  './winamp-features.js',
  './lyrics.js',
  './comments.js',
  HARD_CONTROLS,
  './recover-fresh-138.html',
];

async function fetchFresh(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(new Request(request, {
      cache: 'no-store',
      signal: controller.signal,
      credentials: 'same-origin',
    }));
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchFresh(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

function isPlayerNavigation(request, url) {
  if (request.mode !== 'navigate') return false;
  return url.pathname.endsWith('/winampmusic/') || url.pathname.endsWith('/winampmusic/index.html');
}

async function playerNavigation(request) {
  const response = await networkFirst(request);
  if (!response.ok) return response;

  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  const marker = "window.__WINAMP_HTML_RUNTIME__='1.3.8'";
  if (!html.includes(marker)) {
    const injection = [
      `<script>${marker};</script>`,
      '<script src="./controls-failsafe-v138.js?v=1.3.8" defer></script>',
    ].join('');
    html = html.includes('</body>') ? html.replace('</body>', `${injection}</body>`) : `${html}${injection}`;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('cache-control', 'no-store, max-age=0');
  headers.set('x-winamp-runtime', BUILD);
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async (url) => {
      const request = new Request(url, { cache: 'no-store', credentials: 'same-origin' });
      const response = await fetchFresh(request);
      if (response.ok) await cache.put(request, response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('winampmusic-shell-') && key !== CACHE)
      .map((key) => caches.delete(key)));

    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(async (client) => {
      try {
        const url = new URL(client.url);
        if (url.pathname.includes('/recover')) return;
        if (!url.pathname.endsWith('/winampmusic/') && !url.pathname.endsWith('/winampmusic/index.html')) return;
        await client.navigate(client.url);
      } catch {}
    }));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_RUNTIME_BUILD') {
    event.source?.postMessage?.({ type: 'WINAMP_RUNTIME_BUILD', build: BUILD });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (isPlayerNavigation(event.request, url)) {
    event.respondWith(playerNavigation(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
