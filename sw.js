const BUILD = 'v1.3.2-fast-start';
const CACHE = 'winampmusic-shell-v25';
const NETWORK_TIMEOUT_MS = 3500;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './youtube-player.css',
  './winamp-features.css',
  './paste-import.css',
  './playlist-metadata.css',
  './captions.css',
  './comments.css',
  './mobile.css',
  './app.js',
  './boot-v134.js',
  './metadata-refresh.js',
  './fixes-v054.js',
  './input-v056.js',
  './v059.js',
  './favicon-v060.js',
  './apple-v061.js',
  './share-current-v062.js',
  './apple-music-import-v063.js',
  './apple-music-import-v064.js',
  './universal-music-import-v1.js',
  './unified-search-v065.js',
  './support-v1.js',
  './activity-ticker-v1.js',
  './qr-share-v1.js',
  './shared-playlist-onboarding-v1.js',
  './playback-continuity.js',
  './background-playback-v11.js',
  './production-polish-v12.js',
  './core-interactions-v13.js',
  './lyrics-v057.js',
  './compact-share.js',
  './youtube-context.js',
  './direct-youtube-import.js',
  './mobile-url-import.js',
  './mobile-share.js',
  './lyrics.js',
  './lyrics-sync.js',
  './comments.js',
  './manifest.webmanifest',
  './icon.svg',
  './favicon.ico',
  './favicon-16.png',
  './favicon-32.png',
  './apple-touch-icon.png',
  './safari-pinned-tab.svg',
];
const NETWORK_FIRST = new Set([
  'index.html',
  'styles.css',
  'youtube-player.css',
  'winamp-features.css',
  'paste-import.css',
  'playlist-metadata.css',
  'captions.css',
  'comments.css',
  'mobile.css',
  'app.js',
  'boot-v134.js',
  'youtube-import.js',
  'paste-import.js',
  'metadata-refresh.js',
  'fixes-v054.js',
  'input-v056.js',
  'v059.js',
  'favicon-v060.js',
  'apple-v061.js',
  'share-current-v062.js',
  'apple-music-import-v063.js',
  'apple-music-import-v064.js',
  'universal-music-import-v1.js',
  'unified-search-v065.js',
  'support-v1.js',
  'activity-ticker-v1.js',
  'qr-share-v1.js',
  'shared-playlist-onboarding-v1.js',
  'playback-continuity.js',
  'background-playback-v11.js',
  'production-polish-v12.js',
  'core-interactions-v13.js',
  'lyrics-v057.js',
  'compact-share.js',
  'youtube-context.js',
  'direct-youtube-import.js',
  'mobile-url-import.js',
  'mobile-share.js',
  'lyrics.js',
  'lyrics-sync.js',
  'comments.js',
  'winamp-features.js',
  'icon.svg',
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'safari-pinned-tab.svg',
  'sw.js',
]);

self.addEventListener('install', (event) => {
  void BUILD;
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const freshRequest = new Request(request, { cache: 'no-store', signal: controller.signal });
    const response = await fetch(freshRequest);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function cachedShellFirst(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (!cached) return networkFirst(request);

  event.waitUntil(networkFirst(request).then(() => {}).catch(() => {}));
  return cached;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  const fileName = url.pathname.split('/').pop() || 'index.html';
  if (NETWORK_FIRST.has(fileName)) {
    if (fileName === 'index.html' || fileName === 'sw.js') {
      event.respondWith(networkFirst(event.request));
    } else {
      event.respondWith(cachedShellFirst(event.request, event));
    }
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
