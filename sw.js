// sw.js - Spotflix
// Sube el número de VERSION en cada despliegue para que todos reciban los archivos nuevos.
const VERSION = 'spotflix-v2';
const SHELL = ['./', './index.html', './app.js', './spotflix.css', './manifest.json', './icon-192.png', './icon-512.png'];
const MAX_IMAGENES = 150;

self.addEventListener('install', e => {
  // cada archivo por separado: si falta uno, los demás se guardan igual (antes addAll fallaba entero)
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function recortar(cache) {
  const claves = await cache.keys();
  const imgs = claves.filter(r => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(r.url));
  for (let i = 0; i < imgs.length - MAX_IMAGENES; i++) await cache.delete(imgs[i]);
}

// archivos del sitio e imágenes: se sirve lo guardado al instante y se refresca en segundo plano
function guardadoYActualizar(req) {
  return caches.open(VERSION).then(cache => cache.match(req).then(hit => {
    const red = fetch(req).then(res => {
      // solo respuestas legibles (nunca "opacas": ocupan mucho espacio en el teléfono)
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        cache.put(req, res.clone()).then(() => recortar(cache));
      }
      return res;
    }).catch(() => hit);
    return hit || red.then(r => r || Response.error());
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // datos y sesión: siempre a la red (la app guarda su propia copia de la biblioteca)
  if (/(^|\.)script\.google\.com$|script\.googleusercontent\.com$|accounts\.google\.com$|gstatic\.com$/.test(url.hostname)) return;
  // audio y video no pasan por aquí: usan peticiones "Range" (adelantar/retroceder) que el caché rompería
  if (req.destination === 'audio' || req.destination === 'video' || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    // la página: red primero (siempre la versión nueva) y, sin internet, la guardada
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === location.origin || req.destination === 'image') {
    e.respondWith(guardadoYActualizar(req));
  }
});
