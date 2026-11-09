/* Service worker: guarda la web para que funcione sin internet (salvo la llamada a la IA).
   Al cambiar archivos de la web, sube VERSION para que los móviles descarguen la nueva. */
const VERSION = 'civ-v1';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilos.css',
  'js/utiles.js', 'js/almacen.js', 'js/modelo.js', 'js/ejemplo.js', 'js/asignaturas.js', 'js/checklist.js',
  'js/apuntes.js', 'js/importar.js', 'js/ia.js', 'js/civilizacion.js', 'js/estudio.js', 'js/app.js',
  'vendor/marked.min.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'iconos/icono.svg', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // la IA y lo externo van directos a la red
  // Red primero (para recibir cambios) y caché si no hay conexión.
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
