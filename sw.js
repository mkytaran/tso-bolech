const CACHE_NAME = 'bolech-portal-v5';

// Zde můžete vypsat soubory, které se mají uložit pro rychlejší načítání
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
  // Můžete přidat i cesty k vašim obrázkům/ikonám nebo CSS souborům
];

// Instalace Service Workeru
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Zajištění komunikace při načítání dat
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Buď vrátí uloženou verzi, nebo si stáhne novou z internetu
      return cachedResponse || fetch(event.request);
    })
  );
});