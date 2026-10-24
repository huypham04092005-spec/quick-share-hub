// public/sw.js
const CACHE_NAME = 'quick-share-hub-v2-cloud';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/qrcode.min.js',
  './js/cloud-adapter.js',
  './js/app.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Always bypass cache for API, Gist, ntfy, and WebSocket endpoints
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/ws') ||
    url.hostname.includes('github.com') ||
    url.hostname.includes('ntfy.sh')
  ) {
    return;
  }

  // Network-first with cache fallback for HTML and static shell
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
