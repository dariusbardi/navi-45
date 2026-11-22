// ---------- Offline-Karte: München und Umgebung ----------
// Lädt die Kartenkacheln (Zoom 5–14) für ein festes Gebiet in einen eigenen Speicher.
// Der Service Worker (sw.js) liefert sie aus, wenn kein Netz da ist. Routen und Suche brauchen weiter Internet.
const OFF = {
  cache: 'navi45-offline',
  name: 'München und Umgebung',
  hint: 'bis Landshut, Freising, Erding, Dachau und Starnberg',
  bbox: [11.15, 47.9, 12.25, 48.6], // West, Süd, Ost, Nord
  zMin: 5,
  zMax: 14,
  avgKB: 42, // Erfahrungswert pro Kachel für die Schätzung vorab
  run: null
};
const offKey = (z, x, y) => `https://offline.navi45/planet/${z}/${x}/${y}.pbf`; // gleiche Schreibweise wie in sw.js
function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat, z) {
  const r = rad(lat);
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}
function offTiles() {
  const [w, s, e, n] = OFF.bbox,
    list = [];
  for (let z = OFF.zMin; z <= OFF.zMax; z++) {
    const x0 = lon2tile(w, z),
      x1 = lon2tile(e, z),
      y0 = lat2tile(n, z),
      y1 = lat2tile(s, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push([z, x, y]);
  }
  return list;
}
const fmtBytes = b =>
  b >= 1e9
    ? comma((b / 1e9).toFixed(2)) + ' GB'
    : b >= 1e6
      ? Math.round(b / 1e6) + ' MB'
      : Math.max(1, Math.round(b / 1e3)) + ' KB';
const fmtGB = b => comma((b / 1e9).toFixed(2)) + ' GB';
// Schriften und Symbole der Kartenstile, damit Beschriftungen auch offline erscheinen
async function offStyleAssets() {
  const urls = new Set(['https://tiles.openfreemap.org/planet']);
  for (const st of [STYLE.light, STYLE.dark]) {
    urls.add(st);
    try {
      const j = await (await fetch(st, { signal: withTimeout(15000) })).json();
      if (j.sprite) for (const suf of ['.json', '.png', '@2x.json', '@2x.png']) urls.add(j.sprite + suf);
      const fonts = new Set();
      j.layers.forEach(l => {
        const f = l.layout && l.layout['text-font'];
        if (Array.isArray(f) && f.every(x => typeof x === 'string')) fonts.add(f.join(','));
      });
      for (const f of fonts)
        for (const r of ['0-255', '256-511', '8192-8447'])
          urls.add(j.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r));
    } catch (e) {}
  }
  return [...urls];
}
async function offTemplate() {
  const j = await (await fetch('https://tiles.openfreemap.org/planet', { signal: withTimeout(15000) })).json();
  return j.tiles[0];
}
async function offDownload(onProgress, refresh) {
  if (OFF.run) return;
  const run = (OFF.run = { stop: false, done: 0, bytes: 0, total: 0, failed: 0 });
  try {
    try {
      await navigator.storage?.persist?.();
    } catch (e) {}
    const cache = await caches.open(OFF.cache);
    const tpl = await offTemplate();
    const tiles = offTiles(),
      assets = await offStyleAssets();
    run.total = tiles.length + assets.length;
    onProgress(run);
    for (const u of assets) {
      if (run.stop) break;
      try {
        const r = await fetch(u, { signal: withTimeout(20000) });
        if (r.ok) {
          const b = await r.blob();
          run.bytes += b.size;
          await cache.put(u, new Response(b, { headers: { 'Content-Type': r.headers.get('Content-Type') || '' } }));
        } else run.failed++;
      } catch (e) {
        run.failed++;
      }
      run.done++;
    }
    let i = 0;
    const worker = async () => {
      while (!run.stop && i < tiles.length) {
        const [z, x, y] = tiles[i++];
        const key = offKey(z, x, y);
        try {
          const have = refresh ? null : await cache.match(key);
          if (have) run.bytes += +(have.headers.get('X-Size') || 0);
          else {
            let r = null;
            for (let t = 0; t < 3 && !(r && r.ok); t++) {
              try {
                r = await fetch(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal: withTimeout(20000) });
              } catch (e) {
                r = null;
              }
            }
            if (r && r.ok) {
              const b = await r.blob();
              run.bytes += b.size;
              await cache.put(
                key,
                new Response(b, { headers: { 'Content-Type': 'application/x-protobuf', 'X-Size': String(b.size) } })
              );
            } else run.failed++;
          }
        } catch (e) {
          run.failed++;
        }
        run.done++;
        if (run.done % 10 === 0) onProgress(run);
      }
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
    if (!run.stop) LS.set('offline', { t: Date.now(), bytes: run.bytes, tiles: tiles.length, failed: run.failed });
  } catch (e) {
    run.error = true;
  }
  OFF.run = null;
  onProgress(run, true);
}
async function offDelete() {
  if (OFF.run) OFF.run.stop = true;
  try {
    await caches.delete(OFF.cache);
  } catch (e) {}
  LS.set('offline', null);
}
// Einstellungs-Abschnitt (wird in settings() eingesetzt)
function offlineSection() {
  const info = LS.get('offline', null),
    n = offTiles().length,
    est = n * OFF.avgKB * 1000;
  return `<div class="sec">Offline-Karte</div>
  <div class="group" id="offBox"><div class="set" style="display:block">
    <b>${OFF.name}</b><div class="sub" style="font-size:13px">${OFF.hint}</div>
    <div id="offStat" class="sub" style="margin-top:8px">${
      info
        ? `Gespeichert am ${new Date(info.t).toLocaleDateString('de-DE')} · belegt <b style="color:var(--ink)">${fmtGB(info.bytes)}</b> (${fmtBytes(info.bytes)})`
        : `Nicht gespeichert · Größe etwa <b style="color:var(--ink)">${fmtGB(est)}</b> (ca. ${fmtBytes(est)}, ${n.toLocaleString('de-DE')} Kartenstücke)`
    }</div>
    <div class="bar" id="offBar" style="margin-top:8px;display:none"><i style="width:0%;background:var(--blue)"></i></div>
    <div class="row" id="offBtns">${
      info
        ? '<button class="btn soft" id="offGo">Aktualisieren</button><button class="btn soft" id="offDel" style="color:var(--red)">Löschen</button>'
        : '<button class="btn" id="offGo">Herunterladen</button>'
    }</div>
    <div class="sub" style="font-size:12px;margin-top:8px">Am besten im WLAN laden. Offline gehen Karte und laufende Navigation weiter; neue Routen, Suche und Tempolimits brauchen Internet.</div>
  </div></div>`;
}
function offlineWire() {
  const stat = $('offStat'),
    bar = $('offBar'),
    btns = $('offBtns');
  if (!stat) return;
  const show = (run, end) => {
    if (!$('offStat')) return;
    if (end) {
      settings();
      return;
    }
    bar.style.display = 'block';
    bar.firstElementChild.style.width = (run.total ? (run.done / run.total) * 100 : 0).toFixed(1) + '%';
    stat.innerHTML = `Lädt … ${run.done.toLocaleString('de-DE')} von ${run.total.toLocaleString('de-DE')} · bisher <b style="color:var(--ink)">${fmtBytes(run.bytes)}</b>`;
    btns.innerHTML = '<button class="btn soft" id="offStop">Abbrechen</button>';
    $('offStop').onclick = () => {
      if (OFF.run) OFF.run.stop = true;
    };
  };
  if (OFF.run) show(OFF.run);
  if ($('offGo')) $('offGo').onclick = () => offDownload(show, !!LS.get('offline', null));
  if ($('offDel'))
    $('offDel').onclick = async () => {
      await offDelete();
      settings();
    };
}
