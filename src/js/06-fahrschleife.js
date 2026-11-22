// Flüssige Navigation: ein Bildschleife bewegt Auto und Kamera entlang der Straße
const lerpAng = (a, b, t) => {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
};
const NV = {
  zAdj: 0,
  userZ: false,
  loop: false,
  a0: 0,
  a1: 0,
  t0: 0,
  dur: 1000,
  off: null,
  carH: null,
  camB: null,
  camZ: 17,
  zT: 17,
  last: 0,
  carLast: 0,
  lineLast: 0
};
function animAlong(now) {
  const t = Math.min(1, (now - NV.t0) / NV.dur);
  return NV.a0 + (NV.a1 - NV.a0) * t;
}
function navAlong(along) {
  const now = performance.now();
  let cur = NV.loop && !NV.off ? animAlong(now) : along;
  if (along < cur - 8 || along - cur > 250) cur = along;
  NV.off = null;
  NV.a0 = cur;
  NV.a1 = along;
  NV.t0 = now;
  NV.dur = 1050;
  startLoop();
}
function navOff(lat, lon, h) {
  const now = performance.now();
  const p0 = NV.off ? offNow(now) : [lat, lon];
  NV.off = { p0, p1: [lat, lon], h, t0: now };
  startLoop();
}
function offNow(now) {
  const o = NV.off,
    t = Math.min(1, (now - o.t0) / 1050);
  return [o.p0[0] + (o.p1[0] - o.p0[0]) * t, o.p0[1] + (o.p1[1] - o.p0[1]) * t];
}
function startLoop() {
  if (NV.loop) return;
  NV.loop = true;
  NV.last = performance.now();
  carShow(true);
  requestAnimationFrame(navFrame);
}
function navFrame(now) {
  if (!S.navi || !route()) {
    NV.loop = false;
    NV.carH = NV.camB = null;
    carShow(false);
    return;
  }
  const dt = Math.min(100, now - NV.last);
  NV.last = now;
  const r = route(),
    total = r.cum[r.cum.length - 1];
  let pos, tan, look;
  if (NV.off) {
    pos = offNow(now);
    tan = look = NV.off.h ?? NV.carH ?? 0;
  } else {
    const a = Math.max(0, Math.min(total, animAlong(now)));
    pos = pointAt(a) || r.coords[r.coords.length - 1];
    const b = pointAt(Math.max(0, a - 3)) || pos,
      f = pointAt(Math.min(total - 0.1, a + 6)) || pos;
    tan = hav(b, f) > 0.5 ? brg(b, f) : (NV.carH ?? 0);
    const far = pointAt(Math.min(total - 0.1, a + 40)) || f;
    look = hav(pos, far) > 2 ? brg(pos, far) : tan;
    if (now - NV.lineLast > 250) {
      NV.lineLast = now;
      routeProgress(a / total);
    }
    if (now - (NV.mkLast || 0) > 1000) {
      NV.mkLast = now;
      [...sigMarkers, ...limMarkers].forEach(m => {
        const ll = m.getLngLat();
        m.getElement().style.display = hav(pos, [ll.lat, ll.lng]) < 2200 ? '' : 'none';
      });
    }
  }
  NV.carH = NV.carH == null ? tan : lerpAng(NV.carH, tan, 1 - Math.exp(-dt / 110));
  NV.camB = NV.camB == null ? look : lerpAng(NV.camB, look, 1 - Math.exp(-dt / 650));
  const zGoal = Math.max(13, Math.min(19.5, NV.zT + NV.zAdj));
  NV.camZ += (zGoal - NV.camZ) * (1 - Math.exp(-dt / (NV.zFast ? 250 : 900)));
  S.me = { lat: pos[0], lon: pos[1] };
  if (!S.camFree && !NV.userZ)
    map.jumpTo({ center: [pos[1], pos[0]], bearing: NV.camB, pitch: 55, zoom: NV.camZ, padding: navPad() });
  carDraw(pos[0], pos[1], NV.carH);
  requestAnimationFrame(navFrame);
}
