// ---------- Blatt mit drei Höhen ----------
const isLand = () => innerWidth > innerHeight && innerHeight < 560;
const H = {
  peek: () => (isLand() ? innerHeight * 0.5 : Math.min(300, innerHeight * 0.42)),
  half: () => innerHeight * (isLand() ? 0.78 : 0.52),
  full: () =>
    innerHeight - Math.max(60, (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0) + 60)
};
let sheetState = 'peek';
function sheetTo(s) {
  sheetState = s;
  $('sheet').style.setProperty('--h', Math.round(H[s]()) + 'px');
}
const pad = b =>
  isLand()
    ? { top: 30, left: Math.round(Math.min(390, innerWidth * 0.46)) + 30, right: 70, bottom: 20 }
    : { top: 70, left: 20, right: 70, bottom: Math.round(Math.min(b ?? H[sheetState](), innerHeight * 0.6)) + 10 };
function fitTo(b, bottom, maxZoom = 17) {
  map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  const P = isLand()
    ? { top: 30, bottom: 30, left: Math.round(Math.min(390, innerWidth * 0.46)) + 40, right: 70 }
    : { top: 90, bottom: Math.round(bottom) + 30, left: 40, right: 70 };
  map.fitBounds(b, { padding: P, maxZoom, duration: 800, bearing: 0, pitch: 0 });
}
{
  let y0 = 0,
    h0 = 0,
    drag = false;
  const g = $('grab'),
    sh = $('sheet');
  g.addEventListener('pointerdown', e => {
    drag = true;
    y0 = e.clientY;
    h0 = sh.getBoundingClientRect().height;
    sh.classList.add('drag');
    g.setPointerCapture(e.pointerId);
  });
  g.addEventListener('pointermove', e => {
    if (!drag) return;
    const h = Math.max(120, Math.min(H.full(), h0 + (y0 - e.clientY)));
    sh.style.setProperty('--h', h + 'px');
  });
  const up = e => {
    if (!drag) return;
    drag = false;
    sh.classList.remove('drag');
    const h = sh.getBoundingClientRect().height,
      moved = Math.abs(e.clientY - y0);
    if (moved < 6) {
      sheetTo(sheetState === 'peek' ? 'half' : sheetState === 'half' ? 'full' : 'peek');
      return;
    }
    const opts = ['peek', 'half', 'full'].map(k => [k, Math.abs(H[k]() - h)]).sort((a, b) => a[1] - b[1]);
    sheetTo(opts[0][0]);
  };
  g.addEventListener('pointerup', up);
  g.addEventListener('pointercancel', up);
  addEventListener('resize', () => sheetTo(sheetState));
}
// Eine laufende Kategoriesuche darf eine andere Ansicht nicht mehr überschreiben
const killCat = () => {
  if (S.catState) S.catState.dead = true;
};
const body = (h, state) => {
  $('body').innerHTML = h;
  $('body').scrollTop = 0;
  if (state) sheetTo(state);
};
