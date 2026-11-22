// ---------- Navigation ----------
async function keepAwake() {
  try {
    if (S.navi && !document.hidden) S.wake = await navigator.wakeLock?.request('screen');
  } catch (e) {}
}
document.addEventListener('visibilitychange', keepAwake);
function startNavi(sim) {
  if (!route()) return;
  unlockSpeech();
  document.body.classList.add('navi');
  document.body.classList.remove('free');
  S.navi = true;
  S.lastIdx = 0;
  S.off = 0;
  S.said = {};
  S.isSim = sim;
  NV.zAdj = 0;
  carShow(false);
  BAT.start = CFG.battery;
  BAT.odo = 0;
  BAT.last = null;
  BAT.askedAt = 0;
  BAT.askedPct = 999;
  $('chargeAsk').hidden = true;
  S.camFree = false;
  S.camB = null;
  S.fbHits = 0;
  NV.carH = NV.camB = null;
  NV.off = null;
  NV.camZ = map.getZoom();
  NV.zT = 17;
  if (meEl) meEl.style.visibility = 'hidden';
  keepAwake();
  drawFavs();
  showSign(0);
  loadAttrs(route());
  setGeo('alt', null);
  const first = route().man[0];
  say((sim ? 'Probefahrt. ' : '') + (first?.verbal_pre_transition_instruction || first?.instruction || 'Los geht’s.'));
  S.said[0] = { far: 1, mid: 1, now: 1 };
  if (sim) {
    let d = 0;
    const v = isAM() ? 45 : 50;
    const step = () => {
      d += (v / 3.6) * 2;
      const r = route(),
        p = pointAt(d);
      if (!p || !S.navi) {
        if (S.navi) stopNavi();
        return;
      }
      S.kmh = v;
      onPos(p[0], p[1]);
    };
    step();
    S.sim = setInterval(step, 1000);
  } else {
    startWatch();
    if (S.me) onPos(S.me.lat, S.me.lon);
  }
}
function stopNavi() {
  S.navi = false;
  S.isSim = false;
  document.body.classList.remove('navi', 'free');
  clearInterval(S.sim);
  S.sim = null;
  drawFavs();
  showSign(0);
  carShow(false);
  routeProgress(null);
  [...sigMarkers, ...limMarkers].forEach(m => (m.getElement().style.display = ''));
  $('warn').hidden = true;
  $('chargeAsk').hidden = true;
  clearTimeout(BAT.timer);
  if (isEV() && BAT.odo > 200) {
    CFG.battery = Math.max(5, Math.round(batNow()));
    LS.set('cfg', CFG);
  }
  if (meEl) meEl.style.visibility = '';
  try {
    S.wake?.release();
  } catch (e) {}
  try {
    speechSynthesis.cancel();
  } catch (e) {}
  if (S.me && mMe) drawMe(S.me.lat, S.me.lon);
  if (route() && S.dest) {
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    drawRoutes(true);
    preview();
  } else home();
}
$('btnStop').onclick = stopNavi;
$('zIn').onclick = () => {
  NV.zAdj = Math.min(2.5, NV.zAdj + 0.6);
  NV.zFast = true;
  setTimeout(() => (NV.zFast = false), 600);
};
$('zOut').onclick = () => {
  NV.zAdj = Math.max(-3.5, NV.zAdj - 0.6);
  NV.zFast = true;
  setTimeout(() => (NV.zFast = false), 600);
};
$('recenter').onclick = () => {
  document.body.classList.remove('free');
  S.camFree = false;
  NV.camB = null;
};
map.on('dragstart', e => {
  if (S.navi && e.originalEvent) S.camFree = true;
});
function pointAt(d) {
  const { coords: c, cum } = route();
  if (d >= cum[cum.length - 1]) return null;
  let i = 1;
  while (cum[i] < d) i++;
  const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * f, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * f];
}
function project(p) {
  const { coords: c, cum } = route(),
    k = Math.cos(rad(p[0])) * 111320,
    kl = 110540;
  let best = { off: 1e12, idx: 0, along: 0, pt: p };
  const scan = (a, b) => {
    for (let i = a; i < b; i++) {
      const ax = c[i][1] * k,
        ay = c[i][0] * kl,
        dx = c[i + 1][1] * k - ax,
        dy = c[i + 1][0] * kl - ay,
        px = p[1] * k,
        py = p[0] * kl,
        L2 = dx * dx + dy * dy;
      let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const o = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (o < best.off)
        best = {
          off: o,
          idx: i,
          along: cum[i] + t * (cum[i + 1] - cum[i]),
          pt: [c[i][0] + t * (c[i + 1][0] - c[i][0]), c[i][1] + t * (c[i + 1][1] - c[i][1])]
        };
    }
  };
  scan(Math.max(0, S.lastIdx - 30), Math.min(c.length - 1, S.lastIdx + 400));
  if (best.off > 80) scan(0, c.length - 1);
  return best;
}
function alertText(m) {
  return m.verbal_transition_alert_instruction || m.verbal_succinct_transition_instruction || m.instruction;
}
async function onPos(lat, lon) {
  if (!S.navi || !route()) {
    drawMe(lat, lon);
    return;
  }
  batTrack(lat, lon);
  const kmh = S.kmh;
  $('nSpd').innerHTML = (kmh != null ? Math.round(kmh) : '–') + '<small>km/h</small>';
  const pr = project([lat, lon]);
  if (pr.off > 40) {
    mMe?.setLngLat([lon, lat]);
    navOff(lat, lon, S.heading);
    checkForbidden(lat, lon, S.heading);
    if (++S.off >= 3 && !S.rerouting && !S.isSim) {
      S.rerouting = true;
      $('nText').textContent = 'Neue Route wird berechnet …';
      say('Route wird neu berechnet.');
      try {
        S.from = null;
        S.routes = await getRoutes({ lat, lon }, S.dest, 0);
        S.sel = 0;
        drawRoutes(false);
        S.lastIdx = 0;
        S.said = {};
      } catch (e) {}
      S.rerouting = false;
      S.off = 0;
    }
    return;
  }
  S.off = 0;
  S.lastIdx = pr.idx;
  const r = route(),
    total = r.cum[r.cum.length - 1],
    left = total - pr.along;
  if (!r.edges) loadAttrs(r);
  const lim = limitAt(r, pr.idx);
  showSign(lim);
  $('nSpd').classList.toggle('over', speedCheck(kmh, lim || (isAM() ? 45 : 0)));
  const ahead = pointAt(Math.min(total - 0.5, pr.along + 25)) || [lat, lon],
    hd = brg(pr.pt, ahead);
  mMe?.setLngLat([pr.pt[1], pr.pt[0]]);
  checkForbidden(pr.pt[0], pr.pt[1], hd);
  navAlong(pr.along);
  if (left < 25) {
    $('nDist').textContent = 'Angekommen';
    $('nText').textContent = S.dest.name;
    $('nIcon').innerHTML = arrow(4);
    $('nThen').hidden = true;
    const dm = r.man[r.man.length - 1];
    say(dm?.verbal_pre_transition_instruction || 'Sie haben Ihr Ziel erreicht.');
    clearInterval(S.sim);
    S.navi = false;
    setTimeout(() => {
      S.navi = true;
      stopNavi();
    }, 6000);
    return;
  }
  let mi = r.man.findIndex((m, i) => i > 0 && r.cum[m.begin_shape_index] > pr.along + 3);
  if (mi < 0) mi = r.man.length - 1;
  const m = r.man[mi],
    nx = r.man[mi + 1],
    dNext = r.cum[m.begin_shape_index] - pr.along;
  NV.zT = dNext < 180 ? 17.6 : kmh > 35 ? 16.7 : 17.1;
  const sigAt = r.sig ? r.sig.find(i => r.cum[i] > pr.along + 3) : null,
    sigD = sigAt != null ? r.cum[sigAt] - pr.along : null;
  $('nSig').hidden = !(sigD != null && sigD < 600);
  if (sigD != null) $('nSig').innerHTML = TL + ' Ampel in ' + fmtDist(sigD);
  const atSig = r.sig && r.sig.some(i => Math.abs(r.cum[i] - r.cum[m.begin_shape_index]) < 25) && ![4, 5, 6].includes(m.type);
  $('nIcon').innerHTML = arrow(m.type);
  $('nDist').textContent = fmtDist(dNext);
  const street = (m.street_names || m.begin_street_names || [])[0];
  $('nText').textContent = street && ![4, 5, 6].includes(m.type) ? street : m.instruction;
  if (nx && m.length < 0.2) {
    $('nThen').hidden = false;
    $('nThen').innerHTML = 'Danach ' + arrow(nx.type, 22, '#fff', 7);
  } else $('nThen').hidden = true;
  batUI(left);
  const rest = (left / total) * r.sec;
  $('nEta').textContent = clock(rest);
  $('nMin').textContent = mins(rest);
  $('nKm').textContent = comma((left / 1000).toFixed(1));
  const sd = S.said[mi] || (S.said[mi] = {}),
    prevLen = mi > 0 ? r.man[mi - 1].length * 1000 : 0;
  const amp = atSig ? 'an der Ampel ' : '';
  if (dNext <= 1100 && dNext > 700 && prevLen > 1500 && !sd.far) {
    sd.far = 1;
    say('In ' + spokenDist(dNext) + ' ' + amp + lowFirst(alertText(m)));
  } else if (dNext <= 350 && dNext > 90 && !sd.mid) {
    sd.mid = sd.far = 1;
    say('In ' + spokenDist(dNext) + ' ' + amp + lowFirst(alertText(m)));
  } else if (dNext <= (kmh > 30 ? 45 : 30) && !sd.now) {
    sd.now = sd.mid = sd.far = 1;
    say(
      (atSig ? 'An der Ampel ' : '') +
        (atSig
          ? lowFirst(m.verbal_pre_transition_instruction || m.instruction)
          : m.verbal_pre_transition_instruction || m.instruction)
    );
  }
}
