function addLayers() {
  for (const k of ['alt', 'route'])
    if (!map.getSource(k)) map.addSource(k, { type: 'geojson', data: GEO[k], lineMetrics: k === 'route' });
  const before = map.getLayer('poi_r20') ? 'poi_r20' : undefined;
  const L = (id, src, paint) => {
    if (!map.getLayer(id))
      map.addLayer({ id, type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint }, before);
  };
  L('alt-case', 'alt', { 'line-color': '#7d8a99', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 16, 13] });
  L('alt-line', 'alt', { 'line-color': '#b8c4d2', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9] });
  L('route-case', 'route', {
    'line-color': '#0a4fb8',
    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 16, 15, 19, 24]
  });
  L('route-line', 'route', {
    'line-color': '#1d8cff',
    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 16, 10, 19, 17]
  });
}
function germanLabels() {
  try {
    for (const l of map.getStyle().layers) {
      if (l.type !== 'symbol') continue;
      const tf = map.getLayoutProperty(l.id, 'text-field');
      if (!tf) continue;
      const js = JSON.stringify(tf);
      if (/name/.test(js) && !/housenumber|ref/.test(js))
        map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:de'], ['get', 'name'], ['get', 'name:latin']]);
    }
  } catch (e) {}
}
function forbiddenLayer() {
  try {
    if (map.getLayer('forbidden')) map.removeLayer('forbidden');
    if (!isAM() || !(CFG.showForbidden || CFG.warnForbidden)) return;
    let src = 'openmaptiles';
    if (!map.getSource(src)) {
      src = 'omt';
      if (!map.getSource(src)) map.addSource(src, { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
    }
    map.addLayer(
      {
        id: 'forbidden',
        type: 'line',
        source: src,
        'source-layer': 'transportation',
        filter: ['any', ['==', ['get', 'class'], 'motorway'], ['==', ['get', 'expressway'], 1]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ff1f3d',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 3, 14, 6, 18, 14],
          'line-opacity': CFG.showForbidden ? 0.8 : 0.01
        }
      },
      map.getLayer('alt-case') ? 'alt-case' : undefined
    );
  } catch (e) {}
}
map.on('style.load', () => {
  addLayers();
  germanLabels();
  forbiddenLayer();
  if (S.navi) carShow(true);
});
map.on('load', () => document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
const setGeo = (k, coords) => {
  GEO[k] = coords
    ? {
        type: 'FeatureCollection',
        features: (Array.isArray(coords[0][0]) ? coords : [coords]).map(c => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: c.map(p => [p[1], p[0]]) }
        }))
      }
    : EMPTY;
  map.getSource(k)?.setData(GEO[k]);
};
map.on('moveend', () => {
  const c = map.getCenter();
  LS.set('view', { c: [c.lng, c.lat], z: map.getZoom() });
});
map.on('rotate', () => {
  const b = map.getBearing();
  $('compass').classList.toggle('on', Math.abs(b) > 2 && !S.navi);
  $('compIc').style.transform = `rotate(${-b}deg)`;
});
$('compass').onclick = () => map.easeTo({ bearing: 0, pitch: 0 });
const userMove = e => {
  if (e.originalEvent) {
    if (S.follow) {
      S.follow = 0;
      setLocIcon();
    }
    if (S.navi) document.body.classList.add('free');
  }
};
map.on('dragstart', userMove);
map.on('zoomstart', e => {
  if (!e.originalEvent) return;
  if (S.navi) {
    NV.userZ = true;
    return;
  }
  userMove(e);
});
map.on('zoomend', e => {
  if (S.navi && NV.userZ) {
    NV.userZ = false;
    NV.zAdj += map.getZoom() - NV.camZ;
    NV.camZ = map.getZoom();
  }
});
$('btn3d').onclick = () => {
  const p = map.getPitch() > 10 ? 0 : 62;
  map.easeTo({
    pitch: p,
    zoom: p ? Math.max(map.getZoom(), 16) : map.getZoom(),
    bearing: p ? map.getBearing() - 20 : map.getBearing(),
    duration: 900
  });
  $('btn3d').textContent = p ? '2D' : '3D';
};
$('btnType').onclick = () => {
  CFG.mapType = CFG.mapType === 'sat' ? 'std' : 'sat';
  LS.set('cfg', CFG);
  setTheme();
  $('btnType').style.color = CFG.mapType === 'sat' ? '#ff9f0a' : '';
};
if (CFG.mapType === 'sat') $('btnType').style.color = '#ff9f0a';
