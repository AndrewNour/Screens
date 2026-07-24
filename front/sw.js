// Self-destructing service worker to clear obsolete caches and unregister itself
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.registration.unregister();
});
