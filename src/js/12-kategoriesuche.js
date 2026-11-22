// ---------- Kategorien: viele Filialen ----------
// Ergebnisse merken: beim nächsten Mal sofort da, im Hintergrund aktualisieren
const CK = 'navi45.cat.';
function catCacheGet(cat, c) {
  let best = null,
    bd = 2500;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith(CK + cat.id + ':' + COST() + ':')) continue;
      const v = JSON.parse(localStorage.getItem(k));
      const d = hav([c.lat, c.lon], [v.c.lat, v.c.lon]);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
  } catch (e) {}
  return best;
}
function catCachePut(cat, c, list) {
  try {
    const k = CK + cat.id + ':' + COST() + ':' + c.lat.toFixed(2) + ',' + c.lon.toFixed(2);
    localStorage.setItem(
      k,
      JSON.stringify({
        t: Date.now(),
        c: { lat: c.lat, lon: c.lon },
        list: list.slice(0, 40).map(x => ({
          id: x.id,
          cat: x.cat,
          name: x.name,
          sub: x.sub,
          lat: x.lat,
          lon: x.lon,
          air: x.air,
          sec: x.sec,
          km: x.km,
          dt: x.dt,
          sock: x.sock
        }))
      })
    );
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const kk = localStorage.key(i);
      if (kk.startsWith(CK)) keys.push([kk, JSON.parse(localStorage.getItem(kk)).t]);
    }
    keys
      .sort((a, b) => b[1] - a[1])
      .slice(60)
      .forEach(([kk]) => localStorage.removeItem(kk));
  } catch (e) {}
}
function catSort(cat, list) {
  if (cat.id === 'charge' && isEV())
    list.sort(
      (a, b) =>
        ({ ok: 0, unknown: 1, no: 2 })[sockFit(a.sock)] - { ok: 0, unknown: 1, no: 2 }[sockFit(b.sock)] ||
        (a.sec ?? a.air / 9) - (b.sec ?? b.air / 9)
    );
  else list.sort((a, b) => (a.sec ?? a.air / 9) - (b.sec ?? b.air / 9));
  return list;
}
function catRender(cat, list, near, state) {
  const shown = Math.min(list.length, state.shown);
  const busy = state.busy;
  clearMarkers();
  list.forEach((x, i) => {
    const el = pinEl(cat, i >= shown || i > 4);
    S.markers.push(addMarker(el, x.lat, x.lon, () => place(x)));
  });
  if (state.fit) {
    state.fit = false;
    const b = new maplibregl.LngLatBounds();
    list.slice(0, Math.max(5, Math.min(8, shown))).forEach(x => b.extend([x.lon, x.lat]));
    const c = state.c;
    b.extend([c.lon, c.lat]);
    fitTo(b, H.half(), 15);
  }
  const dtLine = x => (cat.dt && x.dt === 'yes' ? '<span class="tag">Drive-in</span>' : '');
  const keepScroll = $('body').scrollTop;
  body(
    `<div class="head"><div><h2>${esc(cat.label)}</h2><div class="sub">${busy ? '<span class="spin" style="width:14px;height:14px;border-width:2px;vertical-align:-2px"></span>' : ''}${list.length} Treffer ${near}${busy ? ' · wird aktualisiert …' : ' · ' + (cat.id === 'charge' && isEV() ? 'passende zuerst' : 'sortiert nach Fahrzeit ' + vehTxt())}</div></div><button class="x" id="x" aria-label="Schließen">✕</button></div>
  ${cat.id === 'charge' && isEV() ? `<div class="note" style="background:var(--card)">Für Ihren Rocks-e passen Schuko-Steckdosen und Typ-2-Steckdosen (mit Adapter)${CFG.plug === 'type2' ? ' sowie Typ-2-Säulen mit festem Kabel' : ''}. Passende stehen oben.</div>` : ''}
  <div class="group" style="margin-top:12px"><ul class="list">${list
    .slice(0, shown)
    .map(
      (x, i) =>
        `<li data-i="${i}">${catIcon(cat, 'ic')}<span class="tx"><b>${esc(x.name)}</b>${dtLine(x)}<small>${esc(x.sub || '')}</small>${cat.id === 'charge' ? `<div>${sockBadges(x.sock)}</div>` : ''}</span><span class="rt">${x.sec != null ? `<b>${fmtTime(x.sec)}</b>${comma(x.km.toFixed(1))} km` : fmtDist(x.air)}</span></li>`
    )
    .join('')}</ul></div>
  ${list.length > shown ? `<button class="btn soft" id="more" style="margin-top:12px">Mehr laden (${list.length - shown} weitere)</button>` : ''}`,
    state.first ? 'half' : null
  );
  state.first = false;
  $('body').scrollTop = keepScroll;
  $('x').onclick = () => {
    state.dead = true;
    clearMarkers();
    home();
  };
  $('body')
    .querySelectorAll('[data-i]')
    .forEach(
      li =>
        (li.onclick = () => {
          state.dead = true;
          place(list[+li.dataset.i]);
        })
    );
  if ($('more'))
    $('more').onclick = () => {
      state.shown += 10;
      catRender(cat, list, near, state);
    };
}
async function catSearch(cat) {
  document.activeElement?.blur();
  S.pickKind = null;
  const c = origin(),
    near = S.me ? 'in Ihrer Nähe' : 'rund um die Kartenmitte';
  clearMarkers();
  setDestMarker(null);
  clearRoute();
  const state = { shown: 5, busy: true, fit: true, first: true, c, dead: false };
  S.catState = state;
  const cached = catCacheGet(cat, c);
  if (cached && cached.list.length) {
    const L = cached.list.map(x => Object.assign({}, x, { air: hav([c.lat, c.lon], [x.lat, x.lon]) }));
    catRender(cat, catSort(cat, L), near, state);
  } else {
    body(
      `<div class="head"><div><h2>${esc(cat.label)}</h2><div class="sub"><span class="spin"></span>Suche ${near} …</div></div><button class="x" id="x" aria-label="Schließen">✕</button></div>`,
      'half'
    );
    state.first = false;
    $('x').onclick = () => {
      state.dead = true;
      clearMarkers();
      home();
    };
  }
  const alive = () => !state.dead && S.catState === state;
  // 1) Orte sammeln: Kartendaten (schnell) + Photon (weiter)
  const dLat = 0.25,
    dLon = 0.36,
    bbox = [c.lon - dLon, c.lat - dLat, c.lon + dLon, c.lat + dLat].map(n => n.toFixed(4)).join(',');
  let list = [];
  const addOne = x => {
    if (x.air > 30000 || list.some(y => y.id === x.id || hav([y.lat, y.lon], [x.lat, x.lon]) < 25)) return;
    list.push(x);
  };
  const SUBS = cat.scout || cat.subs;
  const pScout = SUBS
    ? scoutAt(c.lat, c.lon, SUBS)
        .then(got =>
          got
            .filter(g => !cat.match || cat.match.test(g.name))
            .forEach(g =>
              addOne({
                id: g.id,
                cat: cat.id,
                name: g.name || cat.label,
                sub: '',
                lat: g.lat,
                lon: g.lon,
                air: hav([c.lat, c.lon], [g.lat, g.lon])
              })
            )
        )
        .catch(() => {})
    : Promise.resolve();
  const pPhoton = Promise.all(
    cat.q.map(async q => {
      try {
        const j = await (
          await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&osm_tag=${cat.tag}&bbox=${bbox}&limit=40&lang=de`, {
            signal: withTimeout(7000)
          })
        ).json();
        for (const f of j.features) {
          const p = f.properties;
          if (cat.match && !cat.match.test(p.name || '')) continue;
          const lat = f.geometry.coordinates[1],
            lon = f.geometry.coordinates[0];
          addOne({
            id: osmNum(p.osm_type, p.osm_id),
            cat: cat.id,
            name: p.name || cat.label,
            sub: [[p.street, p.housenumber].filter(Boolean).join(' '), p.city || p.town || p.village].filter(Boolean).join(', '),
            lat,
            lon,
            air: hav([c.lat, c.lon], [lat, lon])
          });
        }
      } catch (e) {}
    })
  );
  await pScout;
  // Ohne gemerkte Ergebnisse: schon mal die nahen Treffer zeigen
  if (!cached && list.length && alive()) {
    catRender(
      cat,
      catSort(
        cat,
        list.slice().sort((a, b) => a.air - b.air)
      ),
      near,
      state
    );
  }
  await pPhoton;
  if (!alive()) return;
  list = list.sort((a, b) => a.air - b.air).slice(0, cat.scout ? 40 : 30);
  // Alte Namen/Adressen aus dem Speicher übernehmen, wo neue fehlen
  if (cached)
    list.forEach(x => {
      const o = cached.list.find(y => y.id === x.id);
      if (o) {
        if (!x.sub && o.sub) x.sub = o.sub;
        if (o.dt) x.dt = o.dt;
      }
    });
  if (cat.id === 'charge') {
    list.forEach(x => {
      x.name = (x.name || '').replace(/\b[A-Z]{2}\*?[A-Z0-9]{3}\*?[A-Z0-9]{3,}\b[;,\s]*/g, '').trim() || cat.label;
    });
    await loadSockets(list);
  }
  if (!alive()) return;
  if (!list.length) {
    if (cached && cached.list.length) {
      state.busy = false;
      catRender(cat, catSort(cat, cached.list), near, state);
    } else {
      body(
        `<div class="head"><div><h2>${esc(cat.label)}</h2><div class="sub">Nichts gefunden ${near}.</div></div><button class="x" id="x">✕</button></div>`,
        'peek'
      );
      $('x').onclick = () => home();
    }
    return;
  }
  // 2) Fahrzeiten für alle auf einmal
  try {
    const q = {
      sources: [{ lat: c.lat, lon: c.lon }],
      targets: list.map(x => ({ lat: x.lat, lon: x.lon })),
      costing: COST(),
      costing_options: costOpts()
    };
    const j = await (
      await fetch(`${VALHALLA}/sources_to_targets?json=${encodeURIComponent(JSON.stringify(q))}`, { signal: withTimeout(15000) })
    ).json();
    j.sources_to_targets[0].forEach(r => {
      const x = list[r.to_index];
      if (x && r.time != null) {
        x.sec = r.time;
        x.km = r.distance;
      }
    });
  } catch (e) {}
  if (!alive()) return;
  state.busy = false;
  catSort(cat, list);
  catRender(cat, list, near, state);
  catCachePut(cat, c, list);
  // 3) Drive-in-Angaben nachladen (falls der Dienst gerade geht)
  if (cat.dt) {
    try {
      const q = `[out:json][timeout:8];nwr["amenity"="fast_food"]["drive_through"](around:30000,${c.lat},${c.lon});out tags 200;`;
      const j = await (await fetch(OVERPASS + '?data=' + encodeURIComponent(q), { signal: withTimeout(8000) })).json();
      const m = {};
      j.elements.forEach(e => (m[osmNum(e.type, e.id)] = e.tags.drive_through));
      list.forEach(x => {
        if (m[x.id]) x.dt = m[x.id];
      });
      if (alive()) {
        catRender(cat, list, near, state);
        catCachePut(cat, c, list);
      }
    } catch (e) {}
  }
}
