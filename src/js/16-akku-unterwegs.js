// ---------- Akku und Reichweite (Opel Rocks-e) ----------
const kmPerPct = () => CFG.rangeFull / 100;
function batAt(via) {
  if (!via || !route()) return CFG.battery;
  const r = route();
  let best = 0,
    bd = 1e12;
  for (let i = 0; i < r.coords.length; i += 2) {
    const d = hav(r.coords[i], [via.lat, via.lon]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return Math.max(0, Math.round(CFG.battery - r.cum[best] / 1000 / kmPerPct()));
}
function rangeBox(r) {
  const avail = (CFG.rangeFull * CFG.battery) / 100,
    need = r.km;
  const viaCharge = S.via && S.via.cat === 'charge';
  const arrive = Math.round(CFG.battery - need / kmPerPct());
  const stops = Math.ceil((need - avail * 0.85) / (CFG.rangeFull * 0.8));
  let msg;
  if (viaCharge) {
    msg = `<div class="reach ok">Mit Ladestopp unterwegs eingeplant.</div>`;
  } else if (need <= avail * 0.85) msg = `<div class="reach ok">Reicht – Ankunft mit etwa ${arrive} % Akku.</div>`;
  else if (need <= avail)
    msg = `<div class="reach bad">Wird knapp – Ankunft mit etwa ${Math.max(0, arrive)} %. Lieber unterwegs laden.</div><button class="btn soft" id="rangeFind" style="margin-top:8px;height:42px">Ladestation auf dem Weg suchen</button>`;
  else
    msg = `<div class="reach bad">Reicht nicht – Sie kommen etwa ${Math.round(avail)} km weit, die Strecke hat ${Math.round(need)} km.${stops > 1 ? ` Etwa ${stops} Ladestopps nötig.` : ''}</div><button class="btn soft" id="rangeFind" style="margin-top:8px;height:42px">Ladestation auf dem Weg suchen</button>`;
  return `<div class="batt"><button id="bm" aria-label="Akku weniger">−</button><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:15px"><span>Akku jetzt</span><b>${CFG.battery} % · ~${Math.round(avail)} km</b></div><div class="bar" style="margin-top:6px"><i style="width:${CFG.battery}%;background:${CFG.battery < 25 ? 'var(--red)' : CFG.battery < 50 ? '#ff9f0a' : 'var(--green)'}"></i></div></div><button id="bp" aria-label="Akku mehr">+</button></div>${msg}`;
}

// ---------- Entlang der Route suchen (Laden, Pause, Tanken) ----------
const ALONG = {
  charge: { t: 'Laden unterwegs', subs: ['charging_station'], cat: 'charge' },
  pause: { t: 'Pause unterwegs', subs: ['cafe', 'bakery', 'fast_food', 'restaurant', 'ice_cream', 'biergarten'], cat: null },
  fuel: { t: 'Tanken unterwegs', subs: ['fuel'], cat: 'fuel' }
};
async function alongRoute(kind, maxKm) {
  const r = route(),
    A = ALONG[kind];
  if (!r) return;
  const total = r.cum[r.cum.length - 1] / 1000,
    limit = Math.min(total, maxKm || total);
  const step = Math.max(3.5, limit / 10),
    pts = [];
  for (let k = Math.min(2, limit / 2); k <= limit + 0.01; k += step) pts.push(k);
  if (!pts.length) pts.push(limit / 2);
  body(
    `<div class="head"><div><h2>${A.t}</h2><div class="sub" id="alProg"><span class="spin"></span>Suche entlang der Strecke …</div></div><button class="x" id="x" aria-label="Zurück">✕</button></div>`,
    'half'
  );
  $('x').onclick = () => preview();
  let cancel = false;
  $('x').addEventListener('click', () => (cancel = true));
  const found = new Map();
  for (let i = 0; i < pts.length && !cancel; i++) {
    const d = pts[i] * 1000;
    let idx = r.cum.findIndex(c => c >= d);
    if (idx < 0) idx = r.coords.length - 1;
    const [la, lo] = r.coords[idx];
    if ($('alProg')) $('alProg').innerHTML = `<span class="spin"></span>Suche entlang der Strecke … ${i + 1} von ${pts.length}`;
    try {
      const got = await scoutAt(la, lo, A.subs);
      for (const g of got) {
        if (found.has(g.id)) continue;
        let bd = 1e12,
          bi = 0;
        for (let k = Math.max(0, idx - 400); k < Math.min(r.coords.length, idx + 400); k += 2) {
          const dd = hav(r.coords[k], [g.lat, g.lon]);
          if (dd < bd) {
            bd = dd;
            bi = k;
          }
        }
        if (bd < 700 && r.cum[bi] / 1000 <= limit + 1)
          found.set(
            g.id,
            Object.assign(g, {
              off: bd,
              at: r.cum[bi] / 1000,
              cat: A.cat || (g.sub === 'fast_food' ? 'mc' : g.sub === 'bakery' ? 'baker' : g.sub === 'cafe' ? 'cafe' : 'rest')
            })
          );
      }
    } catch (e) {}
  }
  if (cancel || !$('alProg')) return;
  let list = [...found.values()];
  if (kind === 'charge') {
    await loadSockets(list);
    if (isEV()) list = list.filter(x => sockFit(x.sock) !== 'no');
  }
  list.forEach(x => {
    if (!x.name) x.name = kind === 'charge' ? 'Ladestation' : kind === 'fuel' ? 'Tankstelle' : KIND[x.sub] || 'Pause';
  });
  list.sort((a, b) => (kind === 'charge' && maxKm ? b.at - a.at : a.at - b.at));
  list = list.slice(0, 25);
  const catOf = x => CATS.find(c => c.id === x.cat) || CATS.find(c => c.id === 'cafe');
  body(
    `<div class="head"><div><h2>${A.t}</h2><div class="sub">${list.length ? `${list.length} Treffer direkt an Ihrer Strecke${maxKm ? ` (in den ersten ${Math.round(limit)} km)` : ''}` : 'Nichts direkt an der Strecke gefunden.'}</div></div><button class="x" id="x" aria-label="Zurück">✕</button></div>
  ${kind === 'charge' && isEV() ? '<div class="note" style="background:var(--card)">Gezeigt werden Ladestationen mit Schuko- oder Typ-2-Steckdose bzw. unbekannten Anschlüssen. Reine Schnelllader sind ausgeblendet.</div>' : ''}
  <div class="group" style="margin-top:12px"><ul class="list">${list.map((x, i) => `<li data-v="${i}">${catIcon(catOf(x), 'ic')}<span class="tx"><b>${esc(x.name)}</b><small>nach ${comma(x.at.toFixed(1))} km · ${Math.round(x.off)} m neben der Strecke${kind === 'pause' ? ' · ' + (KIND[x.sub] || '') : ''}</small>${kind === 'charge' ? `<div>${sockBadges(x.sock)}</div>` : ''}</span><span class="rt" style="color:var(--blue);font-weight:600">Halt</span></li>`).join('')}</ul></div>`,
    'half'
  );
  $('x').onclick = () => preview();
  $('body')
    .querySelectorAll('[data-v]')
    .forEach(
      li =>
        (li.onclick = () => {
          const x = list[+li.dataset.v];
          S.via = { name: x.name, lat: x.lat, lon: x.lon, cat: x.cat, sock: x.sock };
          routeTo(S.dest);
        })
    );
}

// ---------- Akku während der Fahrt (Schätzung über gefahrene Kilometer) ----------
const BAT = { start: 100, odo: 0, last: null, askedAt: 0, askedPct: 999, timer: null };
function batNow() {
  return Math.max(0, BAT.start - BAT.odo / 1000 / kmPerPct());
}
function batTrack(lat, lon) {
  if (BAT.last) {
    const d = hav(BAT.last, [lat, lon]);
    if (d < 400) BAT.odo += d;
  }
  BAT.last = [lat, lon];
}
function batUI(leftM) {
  if (!isEV()) {
    $('nBatBox').hidden = true;
    return;
  }
  $('nBatBox').hidden = false;
  const b = batNow();
  $('nBat').textContent = Math.round(b) + ' %';
  $('nBat').style.color = b < 20 ? 'var(--red)' : b < 35 ? '#ff9f0a' : '';
  if ($('chargeAsk').hidden && !S.chargeBusy && !(S.via && S.via.cat === 'charge')) {
    const rangeLeft = b * kmPerPct(),
      need = leftM / 1000;
    const low = rangeLeft < need * 1.1 + 3 || b <= 15;
    const again = Date.now() - BAT.askedAt > 10 * 60000 || b < BAT.askedPct - 10;
    if (low && again) askCharge(b, rangeLeft, need);
  }
}
function askCharge(b, rangeLeft, need) {
  BAT.askedAt = Date.now();
  BAT.askedPct = b;
  $('caT').textContent = `Akku wird knapp – ${Math.round(b)} %`;
  $('caS').textContent =
    rangeLeft < need
      ? `Reicht noch etwa ${Math.round(rangeLeft)} km, bis zum Ziel sind es ${Math.round(need)} km.`
      : `Noch etwa ${Math.round(rangeLeft)} km Reichweite.`;
  const box = $('chargeAsk'),
    bar = $('caBar');
  box.hidden = false;
  ping();
  setTimeout(ping, 700);
  say('Akku wird knapp. Soll ich eine Ladestation anfahren?', true);
  bar.style.transition = 'none';
  bar.style.transform = 'scaleX(1)';
  requestAnimationFrame(() => {
    bar.style.transition = 'transform 10s linear';
    bar.style.transform = 'scaleX(0)';
  });
  clearTimeout(BAT.timer);
  BAT.timer = setTimeout(() => {
    box.hidden = true;
  }, 10000); // keine Reaktion = Nein
  $('caYes').onclick = () => {
    clearTimeout(BAT.timer);
    box.hidden = true;
    chargeNow();
  };
}
async function chargeNow() {
  if (!S.me) return;
  S.chargeBusy = true;
  $('nText').textContent = 'Suche Ladestation …';
  try {
    const me = S.me;
    let got = await scoutAt(me.lat, me.lon, ['charging_station']);
    got.forEach(g => (g.air = hav([me.lat, me.lon], [g.lat, g.lon])));
    got.sort((a, b) => a.air - b.air);
    got = got.slice(0, 25);
    await loadSockets(got);
    const ok = got.filter(g => sockFit(g.sock) === 'ok');
    const pick = (ok.length ? ok : got.filter(g => sockFit(g.sock) === 'unknown'))[0];
    if (!pick) {
      say('Leider keine passende Ladestation in der Nähe gefunden.', true);
      S.chargeBusy = false;
      return;
    }
    pick.name = (pick.name || '').replace(/\b[A-Z]{2}\*?[A-Z0-9]{3}\*?[A-Z0-9]{3,}\b[;,\s]*/g, '').trim() || 'Ladestation';
    S.via = { name: pick.name, lat: pick.lat, lon: pick.lon, cat: 'charge', sock: pick.sock };
    S.from = null;
    S.routes = await getRoutes({ lat: me.lat, lon: me.lon }, S.dest, 0);
    S.sel = 0;
    drawRoutes(false);
    S.lastIdx = 0;
    S.said = {};
    NV.a0 = NV.a1 = 0;
    say(
      `Neue Route über ${pick.name}, ${fmtDist(pick.air).replace(' m', ' Meter').replace(' km', ' Kilometer')} entfernt.`,
      true
    );
  } catch (e) {
    say('Die Ladestation konnte gerade nicht gesucht werden.', true);
  }
  S.chargeBusy = false;
}
