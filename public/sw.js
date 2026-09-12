// PWA: offline-capable app shell. The app's own static assets are precached;
// the terrain heightmaps and map tiles are same-origin and cached on first use
// by the fetch handler, so a map you have looked at once also works offline.

const CACHE = 'wardogs-fire-solution-v1';
const APP_PREFIX = '/wardogs-fire-solution/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([
      APP_PREFIX,
      APP_PREFIX + 'manifest.webmanifest',
      APP_PREFIX + 'icon.svg'
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Same-origin app assets only, never third-party hosts.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(APP_PREFIX)) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});