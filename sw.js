/* Jobstronaut 2.0 Service Worker */
const CACHE_NAME = 'jobstronaut-v1';
const OFFLINE_URL = '/offline.html';

// Add or remove assets as your app grows
const ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-180x180.png',
  '/favicon-192x192.png',
  '/favicon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Network-first for navigation; cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // HTML navigations: try network first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        return cached || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        // Optionally: put a copy in cache (stale-while-revalidate-lite)
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
