function carShow(on) {
  const el = carEl();
  el.style.display = on ? 'block' : 'none';
  if (on) el.style.backgroundImage = `url(sprites/${CFG.puck || (isEV() ? 'rocks' : 'arrow')}.png)`;
}
let _carEl = null;
function carEl() {
  if (!_carEl) {
    _carEl = document.createElement('div');
    _carEl.className = 'carsp';
    map.getContainer().appendChild(_carEl);
  }
  return _carEl;
}
// Vorgerendertes 3D-Auto (36 Blickwinkel) – wird pro Bild nur verschoben, das hält die Bewegung flüssig
function carDraw(lat, lon, h) {
  const el = carEl(),
    p = map.project([lon, lat]),
    z = map.getZoom(),
    sz = Math.round(Math.max(44, Math.min(150, 92 * Math.pow(2, (z - 17) * 0.8))));
  const rel = (((h - map.getBearing()) % 360) + 360) % 360;
  let tf = `translate(${(p.x - sz / 2).toFixed(1)}px,${(p.y - sz / 2).toFixed(1)}px)`;
  if (map.getPitch() < 25) {
    el.style.backgroundPosition = '0% 100%';
    tf += ` rotate(${rel.toFixed(1)}deg)`;
  } else {
    const i = Math.round(rel / 10) % 36;
    el.style.backgroundPosition = `${(i % 6) * 20}% ${Math.floor(i / 6) * (100 / 6)}%`;
  }
  if (el._sz !== sz) {
    el.style.width = el.style.height = sz + 'px';
    el._sz = sz;
  }
  el.style.transform = tf;
}
const progGrad = (p, c1, c2) => {
  p = Math.max(0.0002, Math.min(0.9997, p));
  return ['interpolate', ['linear'], ['line-progress'], 0, c1, p, c1, p + 0.0002, c2, 1, c2];
};
function routeProgress(p) {
  try {
    if (p == null) {
      map.setPaintProperty('route-line', 'line-gradient', undefined);
      map.setPaintProperty('route-case', 'line-gradient', undefined);
      return;
    }
    map.setPaintProperty('route-line', 'line-gradient', progGrad(p, '#9aa4b0', routeCol()[1]));
    map.setPaintProperty('route-case', 'line-gradient', progGrad(p, '#7d8691', routeCol()[2]));
  } catch (e) {}
}
