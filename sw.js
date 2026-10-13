/* Service worker: permite abrir la app sin internet (la capa de datos de
   Firebase guarda los registros en la tableta y los sube al volver la señal). */
const VERSION = 'rutinas-v2.3.0';
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
  'js/plantilla.js',
  'js/xlsx.js',
  'js/excel.js',
  'js/app.js',
  'js/vistas/captura.js',
  'js/vistas/comunes.js',
  'js/vistas/config.js',
  'js/vistas/exportar.js',
  'js/vistas/graficas.js',
  'js/vistas/inicio.js',
  'js/vistas/registros.js',
  'js/vistas/visor.js',
  'vendor/firebase.js',
  'vendor/exceljs.min.js',
  'vendor/chart.umd.min.js',
  'vendor/jszip.min.js',
  'vendor/fuentes/arimo-latin-400-italic.woff2',
  'vendor/fuentes/arimo-latin-400-normal.woff2',
  'vendor/fuentes/arimo-latin-700-italic.woff2',
  'vendor/fuentes/arimo-latin-700-normal.woff2',
  'vendor/fuentes/carlito-latin-400-italic.woff2',
  'vendor/fuentes/carlito-latin-400-normal.woff2',
  'vendor/fuentes/carlito-latin-700-italic.woff2',
  'vendor/fuentes/carlito-latin-700-normal.woff2',
  'plantillas/consumo-agua.json',
  'plantillas/lecturas-cfe.json',
  'plantillas/paro-arranque.json',
  'plantillas/presiones.json',
  'plantillas/servicios-turnos.json',
  'plantillas/consumo-agua.xlsx',
  'plantillas/lecturas-cfe.xlsx',
  'plantillas/paro-arranque.xlsx',
  'plantillas/presiones.xlsx',
  'plantillas/servicios-turnos.xlsx',
  'plantillas/img/img-1f3a411fba.png',
  'plantillas/img/img-305b96710c.png',
  'plantillas/img/img-31bbbff312.png',
  'plantillas/img/img-329f07341d.png',
  'plantillas/img/img-5cabf41383.png',
  'plantillas/img/img-810da35735.png',
  'plantillas/img/img-b618b6bdca.png',
  'plantillas/img/img-de73d6dec4.png',
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
