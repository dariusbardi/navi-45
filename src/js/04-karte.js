// ---------- Karte ----------
const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  sat: {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      sat: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Satellitenbild: Esri, Maxar, Earthstar Geographics'
      }
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }]
  }
};
const darkQ = matchMedia('(prefers-color-scheme: dark)');

// Sonnenhöhe über dem Horizont in Grad (vereinfachte Sonnenbahn, auf etwa 1° genau)
function sunAlt(lat, lon, date = new Date()) {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const g = rad(357.529 + 0.98560028 * d);
  const q = 280.459 + 0.98564736 * d;
  const L = rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const e = rad(23.439 - 0.00000036 * d);
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  const ha = rad(gmst * 15 + lon) - ra;
  return deg(Math.asin(Math.sin(rad(lat)) * Math.sin(dec) + Math.cos(rad(lat)) * Math.cos(dec) * Math.cos(ha)));
}
const NIGHT_ALT = -3; // ab hier (Sonne 3° unter dem Horizont) Nachtkarte
let mapReady = false; // wird true, sobald die Karte angelegt ist (vorher Kartenmitte aus dem Speicher)
function sunNow() {
  const v = LS.get('view', { c: [11.575, 48.137] });
  const c = S.me || (mapReady ? center() : { lat: v.c[1], lon: v.c[0] });
  return sunAlt(c.lat, c.lon);
}
const isNight = () =>
  CFG.theme === 'dark' || (CFG.theme === 'system' && darkQ.matches) || (CFG.theme === 'auto' && sunNow() < NIGHT_ALT);
const wantStyle = () => (CFG.mapType === 'sat' ? 'sat' : isNight() ? 'dark' : 'light');
// Farben für Route und App
const COLORS = {
  blue: ['Blau', '#1d8cff', '#0a4fb8', '#007aff'],
  orange: ['Orange', '#ff8a00', '#c25e00', '#f57c00'],
  green: ['Grün', '#2fbf5b', '#1b8a3d', '#1fa34a'],
  purple: ['Lila', '#a259ff', '#6d2fd1', '#8e44ec'],
  pink: ['Pink', '#ff3b8d', '#c4125d', '#e0246f'],
  red: ['Rot', '#ff4b3e', '#b8231a', '#e5372b'],
  teal: ['Türkis', '#18c2d6', '#0b8796', '#0aa3b5']
};
const routeCol = () => COLORS[CFG.routeColor] || COLORS.blue;
function applyAccent() {
  document.documentElement.style.setProperty('--blue', (COLORS[CFG.accent] || COLORS.blue)[3]);
}
applyAccent();
let curStyle = wantStyle();
const last = LS.get('view', { c: [11.575, 48.137], z: 12 });
const map = new maplibregl.Map({
  container: 'map',
  style: STYLE[curStyle],
  center: last.c,
  zoom: last.z,
  attributionControl: false,
  maxPitch: 70,
  dragRotate: true,
  touchPitch: true
});
map.addControl(
  new maplibregl.AttributionControl({ compact: true, customAttribution: 'Route: Valhalla/FOSSGIS · Suche: Photon' }),
  'top-left'
);
map.touchZoomRotate.enableRotation();
mapReady = true;
// Oberfläche hell/dunkel, Karte sanft dimmen und erst in der Nacht auf die Nachtkarte wechseln
function applyUi() {
  const dark = isNight();
  document.documentElement.dataset.ui = dark ? 'dark' : 'light';
  document.querySelectorAll('meta[name=theme-color]').forEach(m => (m.content = dark ? '#1c1c1e' : '#ffffff'));
  // Dämmerung: von Sonne +4° bis -3° langsam bis auf 65 % Helligkeit abdunkeln (nur bei heller Karte)
  let b = 1;
  if (CFG.theme === 'auto' && curStyle !== 'dark') {
    const t = Math.max(0, Math.min(1, (4 - sunNow()) / 7));
    b = 1 - 0.35 * t;
  }
  const cv = map.getCanvas();
  cv.style.filter = b < 0.99 ? `brightness(${b.toFixed(3)})` : '';
}
function setTheme() {
  const w = wantStyle();
  applyUi();
  if (w === curStyle) return;
  curStyle = w;
  const box = map.getContainer();
  box.style.opacity = '0.35'; // kurz ausblenden, dann neuen Stil laden – kein harter Sprung
  setTimeout(() => {
    map.setStyle(STYLE[w], { diff: false });
    map.once('idle', () => (box.style.opacity = '1'));
    setTimeout(() => (box.style.opacity = '1'), 2500);
  }, 450);
}
darkQ.addEventListener?.('change', setTheme);
setInterval(setTheme, 60000); // Sonnenstand jede Minute neu prüfen
applyUi();
const EMPTY = { type: 'FeatureCollection', features: [] };
const GEO = { alt: EMPTY, route: EMPTY };
