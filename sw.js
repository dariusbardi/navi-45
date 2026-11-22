// Navi 45 – Service Worker
// - App-Dateien und vorgerenderte Fahrzeugbilder: sofort aus dem Speicher (schneller Start)
// - Seite selbst: immer zuerst die neueste Version aus dem Netz
// - Kartenkacheln: erst die Offline-Karte (navi45-offline), dann der laufende Kartenspeicher, dann das Netz
// - Routen, Suche, Tempolimits: immer direkt ins Netz (nicht gespeichert)
const VERSION = 'navi45-v12';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './sprites/rocks.png',
  './sprites/car.png',
  './sprites/arrow.png',
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js'
];
const TILES = 'navi45-tiles2'; // laufender Kartenspeicher, wird klein gehalten
const OFFLINE = 'navi45-offline'; // Offline-Karte, wird nie automatisch gelöscht
const MAX_TILES = 800;

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES && k !== OFFLINE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

let trimming = false;
async function trimTiles() {
  if (trimming) return;
  trimming = true;
  try {
    const c = await caches.open(TILES);
    const keys = await c.keys();
    for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
  } finally {
    trimming = false;
  }
}

// Kachel-Adressen enthalten einen Datenstand (z. B. /planet/20251119_001001_pt/14/8723/5682.pbf).
// Für die Offline-Karte zählt nur z/x/y – so passt sie auch nach einem Datenstand-Wechsel.
function offlineKey(url) {
  const m = url.pathname.match(/^\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
  return m ? `https://offline.navi45/planet/${m[1]}/${m[2]}/${m[3]}.pbf` : null;
}

const networkFirst = (req, cacheName, key) =>
  fetch(req)
    .then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(cacheName).then(c => c.put(key || req, copy));
      }
      return r;
    })
    .catch(async () => (await caches.match(key || req)) || Response.error());

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Seite selbst: immer neueste Version, sonst gespeicherte
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(new Request(req.url, { cache: 'no-cache' }), VERSION, './index.html'));
    return;
  }

  if (url.hostname === 'tiles.openfreemap.org') {
    // Kartenstil und Kachel-Beschreibung: erst Netz, offline aus dem Speicher (auch aus der Offline-Karte)
    if (url.pathname.startsWith('/styles') || url.pathname === '/planet') {
      e.respondWith(networkFirst(req, TILES));
      return;
    }
    // Kacheln, Schriften, Symbole: Offline-Karte → laufender Speicher → Netz
    e.respondWith(
      (async () => {
        const off = await caches.open(OFFLINE);
        const ok = offlineKey(url);
        const hitOff = (ok && (await off.match(ok))) || (await off.match(req));
        if (hitOff) return hitOff;
        const c = await caches.open(TILES);
        const hit = await c.match(req);
        if (hit) return hit;
        const r = await fetch(req);
        if (r.ok) {
          c.put(req, r.clone());
          trimTiles();
        }
        return r;
      })()
    );
    return;
  }

  // Satellitenbilder: laufender Speicher → Netz
  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(
      caches.open(TILES).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const r = await fetch(req);
        if (r.ok) {
          c.put(req, r.clone());
          trimTiles();
        }
        return r;
      })
    );
    return;
  }

  // App-Dateien und Kartenbibliothek: gespeicherte zuerst
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
