const CACHE = 'assurtrans-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icone.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copie = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copie));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? Response.error()),
      ),
  );
});