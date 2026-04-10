const CACHE_NAME = 'metrologia-v5';
const assets = [
  './',
  './index.html',
  './app.js',
  './mapa.js',
  './datos.js',
  'https://izbjauurioyavlpmbgzy.supabase.co/storage/v1/object/public/assets/layo240725.png'
];

// Instalar el Service Worker y cachear archivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Estrategia: Primero buscar en Cache, si no, ir a la Red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
