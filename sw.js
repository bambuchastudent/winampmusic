const BUILD = 'v1.3.6-runtime-self-heal';
const CACHE = 'winampmusic-shell-v28';
const NETWORK_TIMEOUT_MS = 6000;

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

    // One activation = one reload of an already-open player. Do not reload the
    // dedicated recovery page or it would unregister the worker we just fixed.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(async (client) => {
      try {
        const url = new URL(client.url);
        if (url.pathname.endsWith('/recover.html')) return;
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

  // Never intentionally serve yesterday's JavaScript while online. This is the
  // invariant that prevents a deploy from looking successful while the UI still
  // runs the previous runtime.
  event.respondWith(networkFirst(event.request));
});
