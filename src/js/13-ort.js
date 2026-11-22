// ---------- Ort ----------
function nearPin(pt) {
  let best = null,
    bd = 34;
  for (const m of [...S.markers, ...S.favMarkers, ...(mDest ? [] : [])]) {
    if (!m._cb) continue;
    const q = map.project(m.getLngLat());
    const d = Math.hypot(q.x - pt.x, q.y + (m._dy || 0) - pt.y);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}
map.on('click', async e => {
  if (S.navi || Date.now() - S.clickGuard < 400) return;
  const hit = nearPin(e.point);
  if (hit) {
    hit._cb();
    return;
  }
  if (document.activeElement?.id === 'q') {
    document.activeElement.blur();
    return;
  }
  const { lng: lon, lat } = e.lngLat;
  const poi = map.queryRenderedFeatures(e.point).find(f => /^poi/.test(f.layer.id) && f.properties.name);
  if (poi) {
    const g = poi.geometry.coordinates;
    place(
      {
        name: poi.properties['name:de'] || poi.properties.name,
        sub: (poi.properties.class || '').replace(/_/g, ' '),
        lat: g[1],
        lon: g[0]
      },
      true
    );
    return;
  }
  const p = { name: 'Markierter Ort', sub: '', lat, lon };
  place(p, true);
  try {
    const f = await rgeo(lat, lon);
    if (f && S.dest === p) {
      const l = label(f);
      p.name = l.main;
      p.sub = l.sub;
      place(p, true);
    }
  } catch (e) {}
});
function place(p, keepView) {
  if (S.dest !== p && !S.pickVia) S.via = null;
  S.dest = p;
  S.pending = null;
  clearRoute();
  setDestMarker(p);
  if (!keepView) map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 15), padding: pad(H.peek()), duration: 700 });
  const cat = p.cat && CATS.find(c => c.id === p.cat);
  const d = S.me ? fmtDist(hav([S.me.lat, S.me.lon], [p.lat, p.lon])) : '';
  const info = [cat?.label, p.sub].filter(Boolean).join(' · ');
  body(
    `<div class="head"><div><h2>${esc(p.name)}</h2><div class="sub">${esc(info)}</div>
    ${p.cat === 'charge' ? `<div style="margin-top:4px">${sockBadges(p.sock)}</div>${isEV() ? `<div class="sub" style="margin-top:4px">Rocks-e lädt mit 2,3 kW: von ${CFG.battery} % auf 100 % etwa ${fmtTime(Math.max(0, 100 - CFG.battery) * 2.1 * 60)}${sockFit(p.sock) === 'ok' ? '' : ' – nur wenn ein passender Anschluss frei ist'}.</div>` : ''}` : ''}
    ${p.sec != null ? `<div class="sub" style="margin-top:4px"><b style="color:var(--ink)">${fmtTime(p.sec)}</b> ${vehTxt()} · ${comma(p.km.toFixed(1))} km${p.dt === 'yes' ? ' <span class="tag">Drive-in</span>' : ''}</div>` : d ? `<div class="sub" style="margin-top:4px">${d} Luftlinie</div>` : ''}</div>
    <button class="x" id="x" aria-label="Schließen">✕</button></div>
  <div class="row"><button class="btn" id="bR"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.7 11.3l-9-9a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>Route</button>
    <button class="btn soft" id="bFav" style="flex:.55;color:#ff9f0a">${IC.star.replace('<svg', '<svg width="18" height="18"')}${favIdx(p) >= 0 ? 'Gemerkt' : 'Merken'}</button></div>
  ${S.pickKind ? `<button class="btn go" id="bKind" style="margin-top:10px">${S.pickKind === 'home' ? 'Als Zuhause sichern' : 'Als Arbeit sichern'}</button>` : ''}
  <div id="favForm"></div>
  <div id="near"></div>`,
    'peek'
  );
  $('x').onclick = () => {
    S.dest = null;
    S.pickKind = null;
    setDestMarker(null);
    try {
      LS.set('lastPlace', null);
    } catch (e) {}
    home();
  };
  $('bR').onclick = () => routeTo(p);
  if ($('bKind'))
    $('bKind').onclick = () => {
      const k = S.pickKind;
      S.pickKind = null;
      S.favs = S.favs.filter(x => x.kind !== k);
      const f = {
        name: k === 'home' ? 'Zuhause' : 'Arbeit',
        sub: [p.name !== 'Markierter Ort' ? p.name : '', p.sub].filter(Boolean).join(', '),
        lat: p.lat,
        lon: p.lon,
        kind: k
      };
      const j = favIdx(p);
      if (j >= 0) S.favs[j] = f;
      else S.favs.unshift(f);
      S.favTimes = null;
      saveFavs();
      place(f, true);
    };
  try {
    LS.set('lastPlace', { p: { name: p.name, sub: p.sub, lat: p.lat, lon: p.lon, cat: p.cat, kind: p.kind }, t: Date.now() });
  } catch (e) {}
  $('bFav').onclick = () => {
    const i = favIdx(p);
    let kind = i >= 0 ? S.favs[i].kind || '' : '';
    $('favForm').innerHTML =
      `<div class="chips2"><button class="chip2" data-k="">${IC.star.replace('<svg', '<svg width="15" height="15"')} Favorit</button><button class="chip2" data-k="home">${IC.house.replace('<svg', '<svg width="15" height="15"')} Zuhause</button><button class="chip2" data-k="work">${IC.work.replace('<svg', '<svg width="15" height="15"')} Arbeit</button></div>
      <div class="from"><input id="favName" value="${esc(i >= 0 ? S.favs[i].name : p.name)}" placeholder="Name, z. B. Oma"><button id="favSave">Sichern</button>${i >= 0 ? '<button id="favDel" style="color:var(--red)">Entfernen</button>' : ''}</div>`;
    const marks = () =>
      $('favForm')
        .querySelectorAll('[data-k]')
        .forEach(b => {
          b.style.outline = b.dataset.k === kind ? '2px solid var(--blue)' : '';
        });
    marks();
    $('favForm')
      .querySelectorAll('[data-k]')
      .forEach(
        b =>
          (b.onclick = () => {
            kind = b.dataset.k;
            if (kind) $('favName').value = kind === 'home' ? 'Zuhause' : 'Arbeit';
            marks();
          })
      );
    sheetTo('half');
    const n = $('favName');
    n.focus();
    n.select?.();
    $('favSave').onclick = () => {
      const name = n.value.trim() || p.name;
      const f = { name, sub: p.sub || '', lat: p.lat, lon: p.lon, cat: p.cat || null, kind: kind || undefined };
      if (kind) S.favs = S.favs.filter((x, k) => x.kind !== kind || k === i);
      const j = favIdx(p);
      if (j >= 0) S.favs[j] = f;
      else S.favs.unshift(f);
      S.favTimes = null;
      saveFavs();
      p.name = name;
      place(p, true);
    };
    if ($('favDel'))
      $('favDel').onclick = () => {
        S.favs.splice(i, 1);
        saveFavs();
        place(p, true);
      };
    n.onkeydown = e => {
      if (e.key === 'Enter') $('favSave').click();
    };
  };
  nearby(p);
}

const NEAR_OK =
  /^(shop:(?!vacant$|yes$).+|amenity:(restaurant|fast_food|cafe|bar|pub|biergarten|ice_cream|pharmacy|bank|atm|fuel|cinema|theatre|post_office|library|doctors|dentist|hospital|car_wash|charging_station|marketplace|nightclub|parking))$/;
const KIND = {
  supermarket: 'Supermarkt',
  bakery: 'Bäckerei',
  restaurant: 'Restaurant',
  fast_food: 'Imbiss',
  cafe: 'Café',
  pharmacy: 'Apotheke',
  bank: 'Bank',
  atm: 'Geldautomat',
  fuel: 'Tankstelle',
  chemist: 'Drogerie',
  kiosk: 'Kiosk',
  hairdresser: 'Friseur',
  clothes: 'Kleidung',
  convenience: 'Laden',
  butcher: 'Metzgerei',
  beverages: 'Getränkemarkt',
  doctors: 'Arztpraxis',
  dentist: 'Zahnarzt',
  hospital: 'Krankenhaus',
  post_office: 'Post',
  bar: 'Bar',
  pub: 'Kneipe',
  ice_cream: 'Eisdiele',
  cinema: 'Kino',
  parking: 'Parkplatz',
  florist: 'Blumen',
  greengrocer: 'Obst & Gemüse',
  optician: 'Optiker',
  car_repair: 'Autowerkstatt',
  car_wash: 'Waschanlage',
  charging_station: 'Ladestation',
  library: 'Bücherei',
  books: 'Bücher',
  bag: 'Taschen',
  shoes: 'Schuhe',
  jewelry: 'Schmuck',
  electronics: 'Elektronik',
  mobile_phone: 'Handyladen',
  department_store: 'Kaufhaus',
  gift: 'Geschenke',
  sports: 'Sport',
  toys: 'Spielzeug',
  cosmetics: 'Kosmetik',
  perfumery: 'Parfümerie',
  furniture: 'Möbel',
  hardware: 'Baumarkt',
  doityourself: 'Baumarkt',
  pet: 'Tierbedarf',
  tobacco: 'Tabak',
  alcohol: 'Spirituosen',
  wine: 'Wein',
  confectionery: 'Süßwaren',
  deli: 'Feinkost',
  pastry: 'Konditorei',
  stationery: 'Schreibwaren',
  variety_store: 'Kaufhaus',
  computer: 'Computer',
  bicycle: 'Fahrräder',
  car: 'Autohaus',
  laundry: 'Wäscherei',
  travel_agency: 'Reisebüro',
  beauty: 'Kosmetikstudio',
  tattoo: 'Tattoo',
  photo: 'Foto',
  copyshop: 'Copyshop',
  music: 'Musik',
  art: 'Kunst',
  outdoor: 'Outdoor',
  tea: 'Tee',
  coffee: 'Kaffee',
  chocolate: 'Schokolade',
  organic: 'Bioladen',
  health_food: 'Reformhaus',
  newsagent: 'Zeitschriften',
  lottery: 'Lotto',
  bookmaker: 'Wettbüro'
};
async function nearby(p) {
  try {
    const j = await (
      await fetch(`${PHOTON}/reverse?lat=${p.lat}&lon=${p.lon}&limit=50&radius=0.45&lang=de&osm_tag=shop&osm_tag=amenity`, {
        signal: withTimeout(10000)
      })
    ).json();
    if (S.dest !== p || !$('near')) return;
    const seen = new Set();
    const it = j.features
      .filter(f => f.properties.name && NEAR_OK.test(f.properties.osm_key + ':' + f.properties.osm_value))
      .map(f => {
        const q = f.properties,
          lat = f.geometry.coordinates[1],
          lon = f.geometry.coordinates[0];
        return {
          name: q.name,
          sub: [KIND[q.osm_value] || 'Geschäft', [q.street, q.housenumber].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
          lat,
          lon,
          d: hav([p.lat, p.lon], [lat, lon])
        };
      })
      .filter(x => x.d > 3 && !seen.has(x.name) && seen.add(x.name))
      .sort((a, b) => a.d - b.d)
      .slice(0, 15);
    if (!it.length) return;
    $('near').innerHTML =
      `<div class="sec">In der Nähe</div><div class="group"><ul class="list">${it.map((x, i) => `<li data-n="${i}"><span class="ic" style="background:#ff9500;color:#fff">${IC.bag.replace('<svg', '<svg width="17" height="17"')}</span><span class="tx"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span><span class="rt">${fmtDist(x.d)}</span></li>`).join('')}</ul></div>`;
    $('near')
      .querySelectorAll('[data-n]')
      .forEach(li => (li.onclick = () => place(it[+li.dataset.n])));
  } catch (e) {}
}
