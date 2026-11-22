// Navi 45 – Service Worker: App startet schnell und auch bei schlechtem Netz.
// Routen, Suche, Tempolimits und Filialen brauchen weiterhin Internet.
const VERSION = 'navi45-v8';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js'
];
const TILES = 'navi45-tiles2';
const MAX_TILES = 800;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

let trimming = false;
async function trimTiles() {
  if (trimming) return; trimming = true;
  try {
    const c = await caches.open(TILES);
    const keys = await c.keys();
    for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
  } finally { trimming = false; }
}

const networkFirst = (req, cacheName, key) => fetch(req).then(r => {
  if (r.ok) { const copy = r.clone(); caches.open(cacheName).then(c => c.put(key || req, copy)); }
  return r;
}).catch(() => caches.match(key || req));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Seite selbst: immer neueste Version, sonst gespeicherte
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(new Request(req.url, { cache: 'no-cache' }), VERSION, './index.html'));
    return;
  }

  // Kartenstil: erst Netz
  if (url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/styles')) {
    e.respondWith(networkFirst(req, TILES));
    return;
  }

  // Kartenkacheln, Schriften, Symbole, Satellitenbilder: gespeicherte zuerst
  if (url.hostname === 'tiles.openfreemap.org' || url.hostname === 'server.arcgisonline.com') {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) { c.put(req, r.clone()); trimTiles(); }
      return r;
    }));
    return;
  }

  // App-Dateien und Kartenbibliothek: gespeicherte zuerst
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
  // Alles andere (Route, Suche, Tempolimits) geht immer direkt ins Netz.
});
