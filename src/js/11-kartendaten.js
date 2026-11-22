// ---------- Orte direkt aus den Kartendaten (unsichtbare Zweitkarte) ----------
let scout = null;
function scoutMap() {
  if (scout) return scout;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:-5000px;top:0;width:1600px;height:1600px;pointer-events:none;opacity:0';
  d.setAttribute('aria-hidden', 'true');
  document.body.appendChild(d);
  scout = new maplibregl.Map({
    container: d,
    style: {
      version: 8,
      sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers: [
        { id: 'p', type: 'circle', source: 'omt', 'source-layer': 'poi', paint: { 'circle-radius': 1, 'circle-opacity': 0.01 } }
      ]
    },
    center: [11.5, 48.1],
    zoom: 14,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0
  });
  return scout;
}
async function scoutAt(lat, lon, subs) {
  const m = scoutMap();
  if (!m.isStyleLoaded())
    await new Promise(r => {
      const t = setTimeout(r, 8000);
      m.once('load', () => {
        clearTimeout(t);
        r();
      });
    });
  m.jumpTo({ center: [lon, lat], zoom: 14 });
  await new Promise(r => {
    const t = setTimeout(r, 9000);
    m.once('idle', () => {
      clearTimeout(t);
      r();
    });
  });
  return m
    .querySourceFeatures('omt', { sourceLayer: 'poi' })
    .filter(f => subs.includes(f.properties.subclass))
    .map(f => ({
      id: f.id,
      name: f.properties.name_de || f.properties.name || '',
      sub: f.properties.subclass,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));
}
const num = v => (v == null || v === 'no' ? 0 : v === 'yes' ? 1 : parseInt(v) || 0);
async function loadSockets(list) {
  const nodes = list.filter(x => x.id % 10 === 1).map(x => Math.floor(x.id / 10)),
    ways = list.filter(x => x.id % 10 === 2).map(x => Math.floor(x.id / 10)),
    tags = {};
  const get = async (kind, ids) => {
    for (let i = 0; i < ids.length; i += 100) {
      try {
        const j = await (
          await fetch(`https://api.openstreetmap.org/api/0.6/${kind}s.json?${kind}s=${ids.slice(i, i + 100).join(',')}`, {
            signal: withTimeout(12000)
          })
        ).json();
        j.elements.forEach(e => (tags[e.id * 10 + (kind === 'node' ? 1 : 2)] = e.tags || {}));
      } catch (e) {}
    }
  };
  await Promise.all([get('node', nodes), get('way', ways)]);
  list.forEach(x => {
    const t = tags[x.id];
    if (!t) return;
    const s = {
      schuko: num(t['socket:schuko']),
      t2: num(t['socket:type2']),
      t2c: num(t['socket:type2_cable']),
      ccs: num(t['socket:type2_combo']),
      cha: num(t['socket:chademo']),
      access: t.access,
      fee: t.fee,
      op: t.operator || t.network || t.brand
    };
    s.known = s.schuko + s.t2 + s.t2c + s.ccs + s.cha > 0;
    x.sock = s;
    if (!x.name || /^[A-Z]{2}[A-Z0-9*]{6,}$/.test(x.name)) x.name = t.name || s.op || 'Ladestation';
  });
}
function sockFit(s) {
  if (!s || !s.known) return 'unknown';
  if (s.schuko > 0 || s.t2 > 0 || (CFG.plug === 'type2' && s.t2c > 0)) return 'ok';
  return 'no';
}
function sockBadges(s) {
  if (!s || !s.known) return '<span class="bdg">Anschlüsse unbekannt</span>';
  const b = [];
  if (s.schuko) b.push(`<span class="bdg ok">Schuko-Steckdose</span>`);
  if (s.t2) b.push(`<span class="bdg ok">Typ-2-Steckdose ×${s.t2}</span>`);
  if (s.t2c) b.push(`<span class="bdg ${CFG.plug === 'type2' ? 'ok' : ''}">Typ 2 mit festem Kabel</span>`);
  if (s.ccs || s.cha)
    b.push(
      `<span class="bdg ${s.schuko || s.t2 ? '' : 'no'}">Schnelllader${s.schuko || s.t2 || s.t2c ? '' : ' – passt nicht'}</span>`
    );
  if (s.access === 'private' || s.access === 'customers')
    b.push(`<span class="bdg">${s.access === 'private' ? 'privat' : 'nur Kunden'}</span>`);
  return b.join('');
}
const osmNum = (type, id) => id * 10 + (type === 'N' || type === 'node' ? 1 : 2);
