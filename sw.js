const CACHE_NAME = 'bolech-dynamic-cache';

// Základní soubory pro okamžitý offline běh
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-512.png',
  './logo-transparent.png'
];

// Instalace: stáhne základní kostru a ihned aktivuje nový worker
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Okamžitě nahradí starý SW bez čekání na zavření oken
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Některé statické soubory se nepodařilo přednačíst:', err);
      });
    })
  );
});

// Aktivace: okamžitě převezme kontrolu nad všemi otevřenými taby
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Odstranění jakýchkoliv starých verzovaných cache z minulosti
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// Fetch: NETWORK FIRST strategie pro statické soubory, bypass pro API
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Požadavky mimo GET (POST do Apps Scriptu) necháváme čistě síti
  if (req.method !== 'GET') {
    return;
  }

  // 2. Požadavky na Google skripty nebo externí API jdou přímo na síť
  if (req.url.includes('script.google.com') || req.url.includes('googleusercontent.com')) {
    return;
  }

  // 3. Network-First pro všechny lokální soubory aplikace
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Pokud síť vrátí validní odpověď, uložíme kopii do cache
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Síť je nedostupná (offline) -> vrátíme verzi z cache
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Pokud jde o navigaci na stránku a není v cache konkrétní URL, vrátíme index.html
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});