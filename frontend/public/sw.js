// public/sw.js — Spendly Service Worker (network-first with offline cache fallback)
const CACHE_NAME = 'spendly-v1';
const OFFLINE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests; skip cross-origin API calls
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Let backend API calls pass through without caching
  if (url.hostname !== location.hostname) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a copy of valid responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});
