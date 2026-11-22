// ---------- Route ----------
const mopedOpts = (up = CFG.noUnpaved) =>
  isAM()
    ? { top_speed: 45, use_primary: CFG.quiet ? 0.1 : 0.45, use_hills: 0.5, exclude_unpaved: up }
    : { use_highways: CFG.quiet ? 0.3 : 1, exclude_unpaved: up };
const costOpts = up => ({ [COST()]: mopedOpts(up) });
function encode6(cs) {
  let o = '',
    pla = 0,
    plo = 0;
  const enc = v => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let r = '';
    while (v >= 0x20) {
      r += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return r + String.fromCharCode(v + 63);
  };
  for (const [la, lo] of cs) {
    const a = Math.round(la * 1e6),
      b = Math.round(lo * 1e6);
    o += enc(a - pla) + enc(b - plo);
    pla = a;
    plo = b;
  }
  return o;
}
// Lange Strecken (über ~170 km) in Etappen rechnen – der Routendienst rechnet höchstens 200 km am Stück
async function getLong(a, b) {
  const D = hav([a.lat, a.lon], [b.lat, b.lon]),
    n = Math.ceil(D / 110000),
    pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  }
  let coords = [],
    man = [],
    km = 0,
    sec = 0,
    fallback = false;
  for (let i = 0; i < n; i++) {
    const loc = (p, k) =>
      Object.assign({ lat: p.lat, lon: p.lon }, k > 0 && k < n ? { radius: 3000, minimum_reachability: 400 } : {});
    const ask = async up =>
      (
        await fetch(
          `${VALHALLA}/route?json=${encodeURIComponent(JSON.stringify({ locations: [loc(pts[i], i), loc(pts[i + 1], i + 1)], costing: COST(), costing_options: costOpts(up), directions_options: { units: 'kilometers', language: 'de-DE' } }))}`,
          { signal: withTimeout(30000) }
        )
      ).json();
    let j = await ask(CFG.noUnpaved);
    if (!j.trip && CFG.noUnpaved) {
      j = await ask(false);
      if (j.trip) fallback = true;
    }
    // Zwischenpunkt liegt ungünstig (Wald, See, Privatweg): etwas verschieben und neu versuchen
    for (const dy of [0.06, -0.06, 0.12, -0.12]) {
      if (j.trip || i === n - 1) break;
      const keep = pts[i + 1];
      pts[i + 1] = { lat: keep.lat + dy, lon: keep.lon };
      j = await ask(false);
      if (!j.trip) pts[i + 1] = keep;
    }
    if (!j.trip) throw new Error(j.error || 'Etappe ' + (i + 1) + ' nicht gefunden');
    const leg = j.trip.legs[0];
    let c = decode6(leg.shape);
    const off = coords.length ? coords.length - 1 : 0;
    if (coords.length) c = c.slice(1);
    // Anschluss: Etappen-Endpunkte liegen auf derselben Straße, Lücke wird überbrückt
    coords = coords.concat(c);
    leg.maneuvers.forEach((m, k) => {
      if (i < n - 1 && [4, 5, 6].includes(m.type)) return;
      if (i > 0 && k === 0 && [1, 2, 3].includes(m.type)) return;
      man.push(Object.assign({}, m, { begin_shape_index: m.begin_shape_index + off, end_shape_index: m.end_shape_index + off }));
    });
    km += j.trip.summary.length;
    sec += j.trip.summary.time;
    if (i === 0)
      body(
        `<h2><span class="spin"></span>Lange Strecke wird berechnet …</h2><div class="sub">Etappe ${i + 1} von ${n}</div>`,
        'peek'
      );
    else if ($('body').querySelector('.sub')) $('body').querySelector('.sub').textContent = `Etappe ${i + 1} von ${n}`;
  }
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + hav(coords[i - 1], coords[i]);
  return [{ coords, cum, shape: encode6(coords), man, km, sec, fallback, long: n }];
}
function joinLegs(legs) {
  let coords = [],
    man = [];
  legs.forEach((leg, i) => {
    let c = decode6(leg.shape);
    const off = coords.length ? coords.length - 1 : 0;
    if (coords.length) c = c.slice(1);
    coords = coords.concat(c);
    leg.maneuvers.forEach((m, k) => {
      if (i > 0 && k === 0 && [1, 2, 3].includes(m.type)) return;
      const mm = Object.assign({}, m, { begin_shape_index: m.begin_shape_index + off, end_shape_index: m.end_shape_index + off });
      if (i < legs.length - 1 && [4, 5, 6].includes(m.type)) {
        mm.instruction = 'Zwischenhalt erreicht: ' + (S.via?.name || 'Halt') + '.';
        mm.verbal_pre_transition_instruction = 'Sie haben Ihren Zwischenhalt erreicht. Danach geht es weiter.';
        mm.via = true;
      }
      man.push(mm);
    });
  });
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + hav(coords[i - 1], coords[i]);
  return { coords, cum, man };
}
async function getRoutes(a, b, alts = 2) {
  const via = S.via;
  if (via) alts = 0;
  if (hav([a.lat, a.lon], [b.lat, b.lon]) > 170000 && !via) return getLong(a, b);
  if (via && (hav([a.lat, a.lon], [via.lat, via.lon]) > 170000 || hav([via.lat, via.lon], [b.lat, b.lon]) > 170000)) {
    const r1 = await getLong(a, via),
      r2 = await getLong(via, b);
    const A = r1[0],
      B = r2[0],
      off = A.coords.length - 1;
    const coords = A.coords.concat(B.coords.slice(1)),
      man = A.man
        .map(m =>
          [4, 5, 6].includes(m.type)
            ? Object.assign({}, m, {
                instruction: 'Zwischenhalt erreicht: ' + via.name + '.',
                verbal_pre_transition_instruction: 'Sie haben Ihren Zwischenhalt erreicht.',
                via: true
              })
            : m
        )
        .concat(
          B.man
            .filter((m, k) => !(k === 0 && [1, 2, 3].includes(m.type)))
            .map(m =>
              Object.assign({}, m, { begin_shape_index: m.begin_shape_index + off, end_shape_index: m.end_shape_index + off })
            )
        );
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + hav(coords[i - 1], coords[i]);
    return [
      {
        coords,
        cum,
        shape: encode6(coords),
        man,
        km: A.km + B.km,
        sec: A.sec + B.sec,
        fallback: A.fallback || B.fallback,
        long: A.long + B.long
      }
    ];
  }
  const ask = async up => {
    const q = {
      locations: [
        { lat: a.lat, lon: a.lon },
        ...(via ? [{ lat: via.lat, lon: via.lon, type: 'break' }] : []),
        { lat: b.lat, lon: b.lon }
      ],
      costing: COST(),
      costing_options: costOpts(up),
      directions_options: { units: 'kilometers', language: 'de-DE' },
      alternates: alts
    };
    return (
      await fetch(`${VALHALLA}/route?json=${encodeURIComponent(JSON.stringify(q))}`, { signal: withTimeout(20000) })
    ).json();
  };
  let j = await ask(CFG.noUnpaved),
    fallback = false;
  if (!j.trip && CFG.noUnpaved) {
    j = await ask(false);
    fallback = true;
  }
  if (!j.trip) throw new Error(j.error || 'Keine Route gefunden');
  return [j, ...(j.alternates || [])].map(x => {
    const J = joinLegs(x.trip.legs);
    return Object.assign(J, {
      shape: x.trip.legs.length > 1 ? encode6(J.coords) : x.trip.legs[0].shape,
      km: x.trip.summary.length,
      sec: x.trip.summary.time,
      fallback
    });
  });
}
// Tempolimits und Straßenbelag je Abschnitt (aus OpenStreetMap über Valhalla)
const TL =
  '<svg viewBox="0 0 12 24"><rect x="0.5" y="0.5" width="11" height="23" rx="3" fill="#1c1c1e" stroke="#fff"/><circle cx="6" cy="5.5" r="2.6" fill="#ff3b30"/><circle cx="6" cy="12" r="2.6" fill="#ffcc00"/><circle cx="6" cy="18.5" r="2.6" fill="#34c759"/></svg>';
let sigMarkers = [],
  limMarkers = [];
function drawLimits(r) {
  limMarkers.forEach(m => m.remove());
  limMarkers = [];
  if (!r?.edges) return;
  let prev = -1,
    lastPos = null;
  for (const e of r.edges) {
    if (!(e.sl > 0 && e.sl < 200) || e.sl === prev) continue;
    prev = e.sl;
    const c = r.coords[e.b];
    if (!c) continue;
    if (lastPos && hav(lastPos, c) < 120 && limMarkers.length) limMarkers.pop().remove();
    lastPos = c;
    const el = document.createElement('div');
    el.className = 'lim';
    el.textContent = e.sl;
    el.title = 'Tempo ' + e.sl;
    limMarkers.push(
      new maplibregl.Marker({ element: el, anchor: 'center', offset: [-16, 0] }).setLngLat([c[1], c[0]]).addTo(map)
    );
    if (limMarkers.length > 120) break;
  }
}
function drawSignals(r) {
  sigMarkers.forEach(m => m.remove());
  sigMarkers = [];
  if (!r?.sig) return;
  r.sig.slice(0, 150).forEach(i => {
    const el = document.createElement('div');
    el.className = 'tl';
    el.innerHTML = TL;
    el.title = 'Ampel';
    sigMarkers.push(
      new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [10, -2] })
        .setLngLat([r.coords[i][1], r.coords[i][0]])
        .addTo(map)
    );
  });
}
const ATTRS = [
  'node.traffic_signal',
  'edge.speed_limit',
  'edge.unpaved',
  'edge.surface',
  'edge.length',
  'edge.begin_shape_index',
  'edge.end_shape_index'
];
async function loadAttrs(r) {
  if (!r || r.edges || r.attrBusy) return;
  r.attrBusy = true;
  try {
    const q = {
      encoded_polyline: r.shape,
      shape_match: 'edge_walk',
      costing: COST(),
      filters: { attributes: ATTRS, action: 'include' }
    };
    const j = await (
      await fetch(`${VALHALLA}/trace_attributes`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(q),
        signal: withTimeout(20000)
      })
    ).json();
    r.edges = (j.edges || []).map(e => ({
      b: e.begin_shape_index,
      e: e.end_shape_index,
      sl: +e.speed_limit || 0,
      up: !!e.unpaved,
      len: (e.length || 0) * 1000
    }));
    r.unpavedM = r.edges.filter(e => e.up).reduce((a, e) => a + e.len, 0);
    r.sig = [...new Set((j.edges || []).filter(e => e.end_node && e.end_node.traffic_signal).map(e => e.end_shape_index))].sort(
      (a, b) => a - b
    );
    const sl = r.edges.map(e => e.sl).filter(v => v > 0 && v < 200);
    r.slMin = sl.length ? Math.min(...sl) : 0;
    r.slMax = sl.length ? Math.max(...sl) : 0;
  } catch (e) {}
  r.attrBusy = false;
  if (r === route()) {
    drawSignals(r);
    drawLimits(r);
    if ($('upNote')) fillRouteNote();
  }
}
function limitAt(r, idx) {
  if (!r?.edges) return 0;
  let k = r._ek || 0;
  const E = r.edges;
  if (!E[k] || E[k].b > idx) k = 0;
  while (k < E.length - 1 && E[k].e <= idx) k++;
  r._ek = k;
  return E[k] && E[k].b <= idx ? E[k].sl : 0;
}
function showSign(v) {
  const el = $('roadSign');
  if (v > 0 && v < 200) {
    el.hidden = false;
    el.textContent = v;
  } else el.hidden = true;
}
function fillRouteNote() {
  const r = route(),
    n = $('upNote');
  if (!n || !r) return;
  const parts = [];
  if (r.long) parts.push(`Lange Strecke: in ${r.long} Etappen berechnet. Planen Sie Pausen ein.`);
  if (r.sig?.length) parts.push(`${r.sig.length} Ampeln auf der Strecke.`);
  if (r.slMax) parts.push(`Tempolimits auf der Strecke: ${r.slMin === r.slMax ? r.slMin : r.slMin + '–' + r.slMax} km/h`);
  if (r.fallback) parts.push('<b>Ohne Schotterwege gibt es hier keine Route</b> – diese Route nutzt unbefestigte Wege.');
  else if (r.unpavedM > 30) parts.push(`Enthält etwa ${fmtDist(r.unpavedM)} unbefestigte Wege.`);
  n.innerHTML = parts.length
    ? `<div class="note${r.fallback || r.unpavedM > 30 ? '' : ''}" style="${r.fallback || r.unpavedM > 30 ? '' : 'background:var(--card)'}">${parts.join('<br>')}</div>`
    : '';
}
// Tempolimit auch ohne Navigation: letzte Positionen auf die Straße legen
async function freeLimit() {
  if (S.navi || S.trail.length < 2 || !((S.kmh ?? 0) > 4)) return;
  try {
    const q = {
      shape: S.trail.slice(-5).map(p => ({ lat: p[0], lon: p[1] })),
      shape_match: 'map_snap',
      costing: COST(),
      filters: { attributes: ['edge.speed_limit'], action: 'include' }
    };
    const j = await (
      await fetch(`${VALHALLA}/trace_attributes`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(q),
        signal: withTimeout(8000)
      })
    ).json();
    const e = (j.edges || []).at(-1);
    S.freeLim = e ? +e.speed_limit : 0;
    if (!S.navi) showSign(S.freeLim);
  } catch (e) {}
}
setInterval(freeLimit, 8000);
function clearRoute() {
  drawSignals(null);
  drawLimits(null);
  S.routes = [];
  S.sel = 0;
  setGeo('alt', null);
  setGeo('route', null);
  setFromMarker(null);
}
function drawRoutes(fit) {
  const r = route();
  if (!r) return;
  const others = S.routes.filter((_, i) => i !== S.sel).map(x => x.coords);
  setGeo('alt', others.length ? others : null);
  setGeo('route', r.coords);
  if (!S.navi) routeProgress(null);
  drawSignals(r.sig ? r : null);
  drawLimits(r.edges ? r : null);
  if (fit) {
    const b = new maplibregl.LngLatBounds();
    S.routes.forEach(x => x.coords.forEach(p => b.extend([p[1], p[0]])));
    fitTo(b, H.half());
  }
}
map.on('click', 'alt-line', e => {
  if (S.navi || S.routes.length < 2) return;
  S.clickGuard = Date.now();
  const pt = [e.lngLat.lat, e.lngLat.lng];
  let best = 0,
    bd = 1e12;
  S.routes.forEach((r, i) => {
    if (i === S.sel) return;
    for (let k = 0; k < r.coords.length; k += 3) {
      const d = hav(pt, r.coords[k]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  });
  S.sel = best;
  drawRoutes(false);
  preview();
});
async function routeTo(p) {
  unlockSpeech();
  S.dest = p;
  S.recent = [
    { name: p.name, sub: p.sub || '', lat: p.lat, lon: p.lon, cat: p.cat || null },
    ...S.recent.filter(r => r.name !== p.name || Math.abs(r.lat - p.lat) > 1e-4)
  ].slice(0, 6);
  LS.set('recent', S.recent);
  if (!S.from && !S.me) {
    S.pending = p;
    fromUI(p, false);
    startWatch();
    return;
  }
  S.pending = null;
  clearMarkers();
  const from = S.from || { ...S.me, name: 'Mein Standort' };
  body(
    `<h2><span class="spin"></span>Route wird berechnet …</h2><div class="sub">${isAM() ? 'Nur Straßen, die mit 45 km/h erlaubt sind.' : 'Mit dem Auto.'}</div>`,
    'peek'
  );
  try {
    S.routes = await getRoutes(from, p);
    S.sel = 0;
    setFromMarker(S.from);
    drawRoutes(true);
    preview();
  } catch (e) {
    body(
      `<div class="head"><div><h2>Keine Route</h2></div><button class="x" id="x">✕</button></div><div class="note err">${/No path|nicht gefunden/i.test(e.message) ? (isAM() ? 'Zu diesem Punkt gibt es keinen Weg, den Sie mit 45 km/h fahren dürfen – er liegt vermutlich direkt an einer Autobahn, Kraftfahrstraße oder Fußgängerzone. Tippen Sie auf einen Punkt in der Nähe (z. B. einen Parkplatz).' : 'Zu diesem Punkt gibt es keinen Weg mit dem Auto. Tippen Sie auf einen Punkt in der Nähe.') : 'Der Routendienst ist gerade nicht erreichbar. Bitte gleich nochmal versuchen.'}</div><div class="row"><button class="btn soft" id="again">Nochmal versuchen</button></div>`,
      'peek'
    );
    $('x').onclick = () => place(p, true);
    $('again').onclick = () => routeTo(p);
  }
}
function fromUI(p, denied) {
  body(
    `<div class="head"><div><h2>${denied ? 'Standort nicht erlaubt' : '<span class="spin"></span>Standort wird gesucht …'}</h2><div class="sub">${denied ? 'Erlauben Sie den Standort in den Einstellungen – oder tippen Sie den Start ein:' : 'Bitte „Erlauben“ tippen – oder den Start eintippen:'}</div></div><button class="x" id="x" aria-label="Schließen">✕</button></div>
  <div class="from"><span class="dot"></span><input id="fq" placeholder="Startadresse eintippen" autocomplete="off"></div>
  ${
    S.favs.length
      ? `<div class="chips2">${sortedFavs()
          .filter(([f]) => hav([f.lat, f.lon], [p.lat, p.lon]) > 50)
          .slice(0, 6)
          .map(
            ([f, i]) =>
              `<button class="chip2" data-sf="${i}"><i style="background:${favColor(f)};color:#fff">${favIcon(f)}</i>Von ${esc(f.name)}</button>`
          )
          .join('')}</div>`
      : ''
  }<div id="fr"></div>`,
    'half'
  );
  $('body')
    .querySelectorAll('[data-sf]')
    .forEach(
      b =>
        (b.onclick = () => {
          const f = S.favs[+b.dataset.sf];
          S.from = { name: f.name, lat: f.lat, lon: f.lon };
          routeTo(p);
        })
    );
  $('x').onclick = () => {
    S.pending = null;
    place(p, true);
  };
  const fq = $('fq');
  let t;
  fq.onfocus = () => sheetTo('full');
  fq.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      try {
        const c = center();
        const j = { features: await geo(fq.value, c, 6) };
        const it = j.features.map(f => {
          const l = label(f);
          return { name: l.main, sub: l.sub, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
        });
        $('fr').innerHTML =
          `<div class="group" style="margin-top:12px"><ul class="list">${it.map((r, i) => `<li data-i="${i}"><span class="ic"><span class="dotm" style="width:14px;height:14px;border-width:3px"></span></span><span class="tx"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span></li>`).join('')}</ul></div>`;
        $('fr')
          .querySelectorAll('[data-i]')
          .forEach(
            li =>
              (li.onclick = () => {
                fq.blur();
                S.from = it[+li.dataset.i];
                routeTo(p);
              })
          );
      } catch (e) {}
    }, 300);
  };
  const iv = setInterval(() => {
    if (!$('fq')) {
      clearInterval(iv);
      return;
    }
    if (S.me && !S.from) {
      clearInterval(iv);
      routeTo(p);
    }
  }, 700);
}
function preview() {
  const r = route(),
    from = S.from || { name: 'Mein Standort' },
    p = S.dest,
    fastest = Math.min(...S.routes.map(x => x.sec));
  body(
    `<div class="head"><div><div class="time">${fmtTime(r.sec)}</div><div class="sub">${comma(r.km.toFixed(1))} km · Ankunft ${clock(r.sec)}${isAM() ? ' · max. 45 km/h' : ''}</div></div><button class="x" id="x" aria-label="Schließen">✕</button></div>
  ${S.routes.length > 1 ? `<div class="alts">${S.routes.map((x, i) => `<button class="alt${i === S.sel ? ' on' : ''}" data-a="${i}"><b>${fmtTime(x.sec)}</b><span>${comma(x.km.toFixed(1))} km${x.sec === fastest ? ' · Schnellste' : ''}</span></button>`).join('')}</div>` : ''}
  <div class="from"><span class="dot"></span><span style="flex:1">Von <b>${esc(from.name)}</b> nach <b>${esc(p.name)}</b></span>${S.from ? '<button id="useMe">Mein Standort</button>' : ''}</div>
  ${S.via ? `<div class="via"><span class="dotv"></span><span style="flex:1">Halt: <b>${esc(S.via.name)}</b>${S.via.cat === 'charge' && isEV() ? ` · laden ca. ${fmtTime(Math.max(0, 100 - batAt(S.via)) * 2.1 * 60)}` : ''}</span><button id="viaX" class="x" aria-label="Halt entfernen">✕</button></div>` : ''}
  ${isEV() ? rangeBox(r) : ''}
  <div class="chips2" style="margin-top:12px">${isEV() ? `<button class="chip2" id="alCharge"><i style="background:#30b0c7;color:#fff">${IC.bolt}</i>Laden unterwegs</button>` : ''}<button class="chip2" id="alPause"><i style="background:#8e5a2b;color:#fff">${IC.cup}</i>Pause unterwegs</button>${!isEV() ? `<button class="chip2" id="alFuel"><i style="background:#34c759;color:#fff">${IC.fuel}</i>Tanken unterwegs</button>` : ''}</div>
  <div id="upNote"></div>
  <div class="row"><button class="btn go" id="go">Los</button><button class="btn soft" id="sim" style="flex:.6">Probefahrt</button></div>
  <div class="sec">Strecke</div>
  <div class="group"><ul class="list">${r.man.map(m => `<li style="cursor:default"><span class="ic" style="color:var(--ink)">${arrow(m.type, 18, 'currentColor', 6)}</span><span class="tx">${esc(m.instruction)}</span><span class="rt">${m.length ? fmtDist(m.length * 1000) : ''}</span></li>`).join('')}</ul></div>`,
    'half'
  );
  $('x').onclick = () => {
    clearRoute();
    S.from = null;
    place(p, true);
  };
  $('go').onclick = () => startNavi(false);
  $('sim').onclick = () => startNavi(true);
  $('body')
    .querySelectorAll('[data-a]')
    .forEach(
      b =>
        (b.onclick = () => {
          S.sel = +b.dataset.a;
          drawRoutes(false);
          preview();
        })
    );
  if ($('useMe'))
    $('useMe').onclick = () => {
      S.from = null;
      routeTo(p);
    };
  if ($('viaX'))
    $('viaX').onclick = () => {
      S.via = null;
      routeTo(p);
    };
  if ($('alCharge')) $('alCharge').onclick = () => alongRoute('charge');
  if ($('alPause')) $('alPause').onclick = () => alongRoute('pause');
  if ($('alFuel')) $('alFuel').onclick = () => alongRoute('fuel');
  if ($('bm')) {
    const upd = d => {
      CFG.battery = Math.max(5, Math.min(100, CFG.battery + d));
      LS.set('cfg', CFG);
      preview();
    };
    $('bm').onclick = () => upd(-10);
    $('bp').onclick = () => upd(10);
  }
  if ($('rangeFind')) $('rangeFind').onclick = () => alongRoute('charge', ((CFG.rangeFull * CFG.battery) / 100) * 0.85);
  if (r.edges) fillRouteNote();
  else loadAttrs(r);
}
