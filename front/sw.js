const CACHE_NAME = 'screen-ads-v1';
const ASSETS = [
  '/index.html',
  '/admin.html',
  '/admin_manifest.json',
  '/screens_manifest.json',
  '/logo2.png',
  '/Untitled-1.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network first strategy
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Skip API calls and websocket connections
  if (url.pathname.startsWith('/api') || e.request.url.startsWith('ws')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If valid response, clone and update cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(e.request);
      })
  );
});
