// ---------- Standort ----------
function setLocIcon() {
  $('locIc').setAttribute('fill', S.follow ? 'currentColor' : 'none');
  $('locIc').style.transform = S.follow === 2 ? 'rotate(-45deg)' : '';
}
let mMe = null,
  meEl = null;
function startWatch() {
  if (S.watch != null || !navigator.geolocation) return;
  S.watch = navigator.geolocation.watchPosition(
    p => {
      const c = p.coords;
      S.acc = c.accuracy;
      S.kmh = c.speed != null && c.speed >= 0 ? c.speed * 3.6 : null;
      if (c.heading != null && !isNaN(c.heading) && (S.kmh ?? 0) > 3) S.heading = c.heading;
      else if (S.me && S.kmh > 3) {
        const b = brg([S.me.lat, S.me.lon], [c.latitude, c.longitude]);
        if (hav([S.me.lat, S.me.lon], [c.latitude, c.longitude]) > 3) S.heading = b;
      }
      const lp = S.trail.at(-1);
      if (!lp || hav(lp, [c.latitude, c.longitude]) > 8) {
        S.trail.push([c.latitude, c.longitude]);
        if (S.trail.length > 8) S.trail.shift();
      }
      if (!S.sim) onPos(c.latitude, c.longitude);
      tacho();
    },
    e => {
      if (e.code === 1) {
        S.watch = null;
        if (S.pending && !S.me) fromUI(S.pending, true);
        else if (!S.navi)
          (body(
            `<div class="head"><div><h2>Standort nicht erlaubt</h2></div><button class="x" id="x">✕</button></div><div class="note err">Bitte den Standort erlauben – iPhone: Einstellungen › Datenschutz › Ortungsdienste › Safari-Websites (bzw. Navi 45) › „Beim Verwenden“.</div>`,
            'peek'
          ),
            $('x') && ($('x').onclick = () => home()));
      }
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
  );
}
$('btnLoc').onclick = () => {
  unlockSpeech();
  startWatch();
  if (!S.me) {
    S.follow = 1;
    setLocIcon();
    return;
  }
  S.follow = S.follow === 0 ? 1 : S.follow === 1 ? 2 : 0;
  setLocIcon();
  if (S.follow === 1)
    map.easeTo({ center: [S.me.lon, S.me.lat], zoom: Math.max(map.getZoom(), 15.5), bearing: 0, padding: pad(), duration: 700 });
  if (S.follow === 2)
    map.easeTo({
      center: [S.me.lon, S.me.lat],
      zoom: Math.max(map.getZoom(), 16),
      bearing: S.heading || 0,
      pitch: 45,
      padding: pad(),
      duration: 700
    });
};
function drawMe(lat, lon, bearing) {
  S.me = { lat, lon };
  if (!mMe) {
    meEl = document.createElement('div');
    meEl.className = 'puck';
    meEl.innerHTML = '<div class="arr"></div><div class="d"></div>';
    mMe = new maplibregl.Marker({ element: meEl, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([lon, lat])
      .addTo(map);
    if (!S.dest && !route()) {
      S.follow = 1;
      setLocIcon();
      map.jumpTo({ center: [lon, lat], zoom: 15.5 });
    }
    setTimeout(favTimes, 300);
  } else mMe.setLngLat([lon, lat]);
  const hd = bearing ?? S.heading;
  meEl.style.visibility = S.navi ? 'hidden' : '';

  meEl.classList.toggle('dir', hd != null && !S.navi);
  if (hd != null) mMe.setRotation(hd);
  if (!S.navi && S.follow)
    map.easeTo({
      center: [lon, lat],
      bearing: S.follow === 2 && hd != null ? smoothBearing(hd) : map.getBearing(),
      padding: pad(),
      duration: 900,
      easing: t => t
    });
  checkForbidden(lat, lon, hd);
}

// Warnung, wenn man auf eine verbotene Straße fährt (nur AM)
function angDiff(a, b) {
  return Math.abs(((b - a + 540) % 360) - 180);
}
function checkForbidden(lat, lon, hd) {
  if (!isAM() || !CFG.warnForbidden || !map.getLayer('forbidden') || hd == null || !((S.kmh ?? 0) > 8)) {
    S.fbHits = 0;
    return;
  }
  let hit = false;
  try {
    const pt = map.project([lon, lat]);
    const fs = map.queryRenderedFeatures(
      [
        [pt.x - 10, pt.y - 10],
        [pt.x + 10, pt.y + 10]
      ],
      { layers: ['forbidden'] }
    );
    for (const f of fs) {
      const g = f.geometry,
        lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const c of lines)
        for (let i = 0; i < c.length - 1; i++) {
          const a = [c[i][1], c[i][0]],
            b = [c[i + 1][1], c[i + 1][0]];
          if (hav(a, [lat, lon]) + hav(b, [lat, lon]) > hav(a, b) + 40) continue;
          const lb = brg(a, b);
          if (Math.min(angDiff(lb, hd), angDiff((lb + 180) % 360, hd)) < 30) hit = true;
        }
    }
  } catch (e) {}
  S.fbHits = hit ? (S.fbHits || 0) + 1 : Math.max(0, (S.fbHits || 0) - 1);
  if (S.fbHits >= 3 && $('warn').hidden) {
    $('warn').hidden = false;
    say('Achtung! Diese Straße ist mit dem AM-Führerschein verboten. Bitte bei der nächsten Möglichkeit abfahren.', true);
    try {
      navigator.vibrate?.([300, 150, 300]);
    } catch (e) {}
  }
  if (S.fbHits === 0 && !$('warn').hidden) $('warn').hidden = true;
}
$('warn').onclick = () => {
  $('warn').hidden = true;
};
// weiche Drehung der Karte
const navPad = () =>
  isLand()
    ? { top: Math.round(innerHeight * 0.35), bottom: 20, left: Math.round(Math.min(390, innerWidth * 0.46)), right: 0 }
    : { top: Math.round(innerHeight * 0.42), bottom: 110, left: 0, right: 0 };
function smoothBearing(target) {
  if (S.camB == null) S.camB = target;
  const d = ((target - S.camB + 540) % 360) - 180;
  S.camB = (S.camB + d * (Math.abs(d) > 60 ? 0.85 : 0.55) + 360) % 360;
  return S.camB;
}
