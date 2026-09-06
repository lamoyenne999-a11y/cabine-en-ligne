/* ============================================================
   Cabine En Ligne — Service Worker (PWA)
   - pré-cache l'app shell (statique) pour un démarrage instantané
   - `network-first` pour la navigation (HTML)
   - on ne cache JAMAIS /api ni /health : l'app garde le mode
     "connecté" basé sur la disponibilité de l'API.
   ============================================================ */
const CACHE = 'cabine-en-ligne-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne jamais intercepter les appels API ni la santé
  if (url.pathname.startsWith('/api') || url.pathname === '/health') return;

  if (event.request.mode === 'navigate') {
    // Navigation : réseau d'abord, repli cache
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Autres requêtes : cache d'abord, puis réseau (et on met en cache)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
