const BUILD = 'ampmusic-v1.5-stable';
const CACHE = 'winampmusic-shell-v161-share-recovery';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
  './fast-player-v141.js',
  './fast-release-v150.js',
  './fast-import-v150.js',
  './apple-music-import-v064.js',
  './apple-playlist-import-v150.js',
  './stable-v150.js',
  './fast-actions-v143.js',
  './fast-background-v150.js',
  './unified-entry-v152.js',
  './compact-share.js',
  './share-ui-cleanup-v161.js',
  './legacy-share-v1.js',
  './qr-share-v1.js',
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
