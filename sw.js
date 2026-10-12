/* Service worker: permite abrir la app sin internet (la capa de datos de
   Firebase guarda los registros en la tableta y los sube al volver la señal). */
const VERSION = 'rutinas-v1.0.0';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/hoja.css',
  'js/config.js',
  'js/formatos.js',
  'js/util.js',
  'js/modelo.js',
  'js/db.js',
  'js/render.js',
  'js/excel.js',
  'js/app.js',
  'js/vistas/comunes.js',
  'js/vistas/inicio.js',
  'js/vistas/captura.js',
  'js/vistas/registros.js',
  'js/vistas/visor.js',
  'js/vistas/exportar.js',
  'js/vistas/graficas.js',
  'js/vistas/config.js',
  'vendor/firebase.js',
  'vendor/exceljs.min.js',
  'vendor/chart.umd.min.js',
  'img/icono.svg',
  'img/icono-192.png',
  'img/icono-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Archivos propios: primero la red (para recibir actualizaciones) y, sin red, la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
