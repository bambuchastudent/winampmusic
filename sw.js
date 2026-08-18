const BUILD = 'v1.4.0-core-safe';
const CACHE = 'winampmusic-shell-v31';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './playlist-metadata.css',
  './youtube-player.css',
  './app.js',
  './boot-v140.js',
  './v059.js',
  './recover-fresh-140.html',
];

async function fresh(request) {
  return fetch(new Request(request, {
    cache: 'no-store',
    credentials: 'same-origin',
  }));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fresh(request);
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
      const response = await fresh(request);
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
  event.respondWith(networkFirst(event.request));
});
