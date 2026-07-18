const CACHE_NAME = 'admin-ads-v1';
const ASSETS = [
  '/',
  '/admin.html',
  '/admin_manifest.json',
  '/logo2.png'
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
  
  if (url.pathname.startsWith('/api') || e.request.url.startsWith('ws')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request).then((matching) => {
          if (matching) return matching;
          if (url.pathname === '/' || url.pathname === '/admin') {
            return caches.match('/admin.html');
          }
        });
      })
  );
});
