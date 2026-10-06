const CACHE_NAME = 'mateuna-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './spotflix.css',
    './manifest.json',
    './spotflix_logo.png',
    'https://cdn.tailwindcss.com'
];

// Instalar Service Worker y guardar recursos esenciales en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Precargando recursos...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activar y limpiar cachés antiguas si se actualiza la versión
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Borrando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia: Red primero con caída a Caché (Stale-While-Revalidate / Network First)
self.addEventListener('fetch', (event) => {
    // Si la petición es hacia Google Script (Apps Script) o Google Auth, no la forzamos a caché
    if (event.request.url.includes('script.google.com') || event.request.url.includes('accounts.google.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es válida, clonamos y actualizamos la caché
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si no hay internet, devolvemos la versión guardada en caché
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Fallback para navegación de páginas si está offline
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
