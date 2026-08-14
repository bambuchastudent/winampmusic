const CACHE = 'winampmusic-shell-v6';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './youtube-player.css',
  './winamp-features.css',
  './paste-import.css',
  './playlist-metadata.css',
  './manifest.webmanifest',
  './icon.svg',
];
const NETWORK_FIRST = new Set([
  'index.html',
  'styles.css',
  'youtube-player.css',
  'winamp-features.css',
  'paste-import.css',
  'playlist-metadata.css',
  'app.js',
  'youtube-import.js',
  'paste-import.js',
  'winamp-features.js',
  'sw.js',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  const fileName = url.pathname.split('/').pop() || 'index.html';
  if (NETWORK_FIRST.has(fileName)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
