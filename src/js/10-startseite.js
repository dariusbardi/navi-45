// ---------- Startansicht ----------
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installHint() {
  if (standalone || !CFG.hint || !(isIOS || S.bip)) return '';
  return `<div class="group" style="display:flex;gap:12px;align-items:center;padding:12px;margin-top:16px">
    <img src="icons/icon-192.png" alt="" width="42" height="42" style="border-radius:10px;flex:none">
    <span style="flex:1;font-size:15px"><b>Als App installieren</b><br><span class="sub" id="instTxt">Ohne Browserleiste, direkt vom Home-Bildschirm.</span></span>
    <button id="inst" style="color:var(--blue);font-weight:600;font-size:15px">${S.bip ? 'Installieren' : 'So geht’s'}</button>
    <button id="instX" class="x" aria-label="Hinweis ausblenden">✕</button></div>`;
}
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  S.bip = e;
  if ($('q') && !$('q').value) home(sheetState);
});
function home(state) {
  killCat();
  S.dest = null;
  S.pending = null;
  if (!route()) {
    setDestMarker(null);
    setFromMarker(null);
  }
  body(
    `<div class="search" id="sbox"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mut)" stroke-width="2.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="q" placeholder="Wohin?" enterkeyhint="search" autocomplete="off" spellcheck="false"><button class="clr" id="qx" aria-label="Löschen">✕</button></div>
  <div class="cats">${(isEV() ? CATS : [...CATS.slice(1), CATS[0]]).map(c => `<button class="cat" data-c="${c.id}">${catIcon(c)}${esc(c.label)}</button>`).join('')}</div>
  <div id="res"></div>
  <div class="sec">Favoriten</div><div class="favs">${sortedFavs()
    .map(
      ([f, i]) =>
        `<button class="fav" data-f="${i}"><i style="color:${favColor(f)}">${favIcon(f).replace('<svg', '<svg width="24" height="24"')}</i><span>${esc(f.name)}</span><small class="sub" style="font-size:11px" id="ft${i}">${f.kind && S.favTimes?.[i] ? fmtTime(S.favTimes[i]) : ''}</small></button>`
    )
    .join('')}
    ${favOf('home') ? '' : `<button class="fav" data-add="home"><i style="color:#007aff">${IC.house.replace('<svg', '<svg width="24" height="24"')}</i><span>Zuhause</span><small class="sub" style="font-size:11px">Hinzufügen</small></button>`}
    ${favOf('work') ? '' : `<button class="fav" data-add="work"><i style="color:#8e5a2b">${IC.work.replace('<svg', '<svg width="24" height="24"')}</i><span>Arbeit</span><small class="sub" style="font-size:11px">Hinzufügen</small></button>`}</div>
  ${installHint()}
  ${S.recent.length ? `<div class="sec">Zuletzt</div><div class="group"><ul class="list">${S.recent.map((r, i) => `<li data-r="${i}"><span class="ic" style="${r.cat ? `background:${CATS.find(c => c.id === r.cat)?.bg};color:${CATS.find(c => c.id === r.cat)?.fg}` : ''}">${r.cat ? glyphOf(CATS.find(c => c.id === r.cat)) : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'}</span><span class="tx"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span></li>`).join('')}</ul></div>` : ''}
  <div class="sub" style="margin-top:16px;font-size:13px">${isAM() ? 'Modus AM-Führerschein: alle Routen ohne Autobahn und Kraftfahrstraße, berechnet für höchstens 45 km/h.' : 'Modus normales Auto.'} Tippen Sie auf die Karte, um einen Ort zu wählen. Fahrzeug wechseln: Einstellungen.</div>`,
    state || 'peek'
  );
  const q = $('q');
  let t;
  q.addEventListener('focus', () => sheetTo('full'));
  q.addEventListener('input', () => {
    $('sbox').classList.toggle('has', !!q.value);
    clearTimeout(t);
    t = setTimeout(() => search(q.value.trim()), 280);
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      q.blur();
    }
  });
  $('qx').onclick = () => {
    q.value = '';
    $('sbox').classList.remove('has');
    $('res').innerHTML = '';
    q.focus();
  };
  $('body')
    .querySelectorAll('[data-c]')
    .forEach(b => (b.onclick = () => catSearch(CATS.find(c => c.id === b.dataset.c))));
  $('body')
    .querySelectorAll('[data-r]')
    .forEach(li => (li.onclick = () => place(S.recent[+li.dataset.r])));
  $('body')
    .querySelectorAll('[data-f]')
    .forEach(b => (b.onclick = () => place(S.favs[+b.dataset.f])));
  $('body')
    .querySelectorAll('[data-add]')
    .forEach(
      b =>
        (b.onclick = () => {
          S.pickKind = b.dataset.add;
          sheetTo('full');
          q.placeholder = S.pickKind === 'home' ? 'Ihre Adresse für „Zuhause“ …' : 'Adresse für „Arbeit“ …';
          q.focus();
        })
    );
  favTimes();
  if ($('inst'))
    $('inst').onclick = async () => {
      if (S.bip) {
        S.bip.prompt();
        try {
          await S.bip.userChoice;
        } catch (e) {}
        S.bip = null;
        home(sheetState);
      } else $('instTxt').innerHTML = 'Unten in Safari auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>.';
    };
  if ($('instX'))
    $('instX').onclick = () => {
      CFG.hint = false;
      LS.set('cfg', CFG);
      home(sheetState);
    };
}
async function search(q) {
  const res = $('res');
  if (!res) return;
  if (q.length < 2) {
    res.innerHTML = '';
    return;
  }
  const c = origin();
  try {
    const j = { features: await geo(q, c, 10) };
    if (!$('res') || $('q')?.value.trim() !== q) return;
    const items = j.features.map(f => {
      const l = label(f);
      const lat = f.geometry.coordinates[1],
        lon = f.geometry.coordinates[0];
      const pk = f.properties.osm_key;
      return { name: l.main, sub: l.sub, lat, lon, d: hav([c.lat, c.lon], [lat, lon]), shop: pk === 'shop' || pk === 'amenity' };
    });
    res.innerHTML = items.length
      ? `<div class="group" style="margin-top:14px"><ul class="list">${items.map((r, i) => `<li data-i="${i}"><span class="ic"${r.shop ? ' style="background:#ff9500;color:#fff"' : ''}>${r.shop ? IC.bag.replace('<svg', '<svg width="17" height="17"') : ''}<svg${r.shop ? ' hidden' : ''} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></span><span class="tx"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span><span class="rt">${fmtDist(r.d)}</span></li>`).join('')}</ul></div>`
      : '<div class="sub" style="margin-top:14px">Nichts gefunden.</div>';
    res.querySelectorAll('[data-i]').forEach(
      li =>
        (li.onclick = () => {
          document.activeElement?.blur();
          place(items[+li.dataset.i]);
        })
    );
  } catch (e) {
    if ($('res')) res.innerHTML = '<div class="note err">Suche gerade nicht erreichbar.</div>';
  }
}
