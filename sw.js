// Service worker: la app abre al instante y funciona sin conexión (las fotos ya están en el dispositivo).
const VERSION = 'recuerdo-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'icons/icon.svg',
  'js/app.js', 'js/views.js', 'js/viewer.js', 'js/story.js', 'js/ui.js', 'js/util.js', 'js/store.js',
  'js/exif.js', 'js/geo.js', 'js/places.js', 'js/identify.js', 'js/trips.js', 'js/voice.js', 'js/ai.js', 'js/demo.js',
  'js/demo-art.js', 'js/onboarding.js', 'js/locate.js', 'js/backup.js', 'js/analytics.js', 'js/native.js',
];
const RUNTIME_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'upload.wikimedia.org', 'tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return;
  const sameOrigin = url.origin === self.location.origin;
  const runtime = RUNTIME_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));
  if (!sameOrigin && !runtime) return;
  // Stale-while-revalidate: responde desde caché y actualiza en segundo plano.
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
