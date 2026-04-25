// Service Worker بسيط لتطبيق أغراضي
const CACHE_NAME = 'agradi-v1';
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
  './icons/icon-192.png',
  './icons/icon-512.png',
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

  // استثناء طلبات Supabase والـ APIs
  if (url.origin !== location.origin) return;

  // Network first للـ HTML/JS، Cache fallback
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
  );
});
