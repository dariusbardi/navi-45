// Marker
function pinEl(cat, small, color) {
  const w = document.createElement('div');
  w.className = 'pinw';
  w.dataset.size = small ? 26 : 34;
  const d = document.createElement('div');
  d.className = 'pin' + (small ? ' sm' : '');
  d.style.background = color || (cat ? cat.bg : '#ff3b30');
  d.style.color = cat ? cat.fg : '#fff';
  d.innerHTML = `<span>${glyphOf(cat)}</span>`;
  w.appendChild(d);
  return w;
}
function addMarker(el, lat, lon, onClick) {
  const sz = +el.dataset.size || 0;
  const m = new maplibregl.Marker({ element: el, anchor: 'center', offset: [0, sz ? -Math.round(sz * 0.71) : 0] })
    .setLngLat([lon, lat])
    .addTo(map);
  m._cb = onClick;
  m._dy = sz ? -Math.round(sz * 0.71) : 0;
  if (onClick)
    el.addEventListener('click', e => {
      e.stopPropagation();
      S.clickGuard = Date.now();
      onClick();
    });
  return m;
}
function clearMarkers() {
  S.markers.forEach(m => m.remove());
  S.markers = [];
}
const favOf = k => S.favs.find(f => f.kind === k);
const favIcon = f => (f.kind === 'home' ? IC.house : f.kind === 'work' ? IC.work : IC.star);
const favColor = f => (f.kind === 'home' ? '#007aff' : f.kind === 'work' ? '#8e5a2b' : '#ff9f0a');
function sortedFavs() {
  return S.favs
    .map((f, i) => [f, i])
    .sort((a, b) => (({ home: 0, work: 1 })[a[0].kind] ?? 2) - ({ home: 0, work: 1 }[b[0].kind] ?? 2));
}
const favIdx = p => S.favs.findIndex(f => Math.abs(f.lat - p.lat) < 2e-5 && Math.abs(f.lon - p.lon) < 2e-5);
function drawFavs() {
  S.favMarkers.forEach(m => m.remove());
  S.favMarkers = S.navi
    ? []
    : S.favs.map(f => {
        const d = document.createElement('div');
        d.className = 'star';
        d.style.color = '#fff';
        d.style.background = favColor(f);
        d.innerHTML = favIcon(f);
        return addMarker(d, f.lat, f.lon, () => place(f));
      });
}
function saveFavs() {
  LS.set('favs', S.favs);
  drawFavs();
}
let mDest = null,
  mFrom = null;
function setDestMarker(p) {
  mDest?.remove();
  mDest = p ? addMarker(pinEl(p.cat ? CATS.find(c => c.id === p.cat) : null, false), p.lat, p.lon) : null;
}
function setFromMarker(p) {
  mFrom?.remove();
  mFrom = null;
  if (p) {
    const d = document.createElement('div');
    d.className = 'dotm';
    mFrom = addMarker(d, p.lat, p.lon);
  }
}
