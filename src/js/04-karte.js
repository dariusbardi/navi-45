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
const wantStyle = () =>
  CFG.mapType === 'sat' ? 'sat' : CFG.theme === 'dark' || (CFG.theme === 'auto' && darkQ.matches) ? 'dark' : 'light';
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
function setTheme() {
  const w = wantStyle();
  if (w !== curStyle) {
    curStyle = w;
    map.setStyle(STYLE[w], { diff: false });
  }
}
darkQ.addEventListener?.('change', setTheme);
const EMPTY = { type: 'FeatureCollection', features: [] };
const GEO = { alt: EMPTY, route: EMPTY };
