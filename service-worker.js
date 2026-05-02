// Service Worker — Cache-first للسرعة، تحديث في الخلفية
const CACHE_NAME = 'agradi-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/supabase.js',
  './js/auth.js',
  './js/family.js',
  './js/locations.js',
  './js/items.js',
  './js/search.js',
  './js/realtime.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // استثناء أي طلبات API/Supabase
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  // Cache-first: نخدم من الكاش فوراً ونحدّث في الخلفية
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkPromise = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      // ارجع الكاش فوراً، أو الشبكة لو ما فيه كاش
      return cached || networkPromise;
    })
  );
});
