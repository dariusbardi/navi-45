// ---------- Einstellungen ----------
function settings() {
  killCat();
  const vs = voices().sort((a, b) => scoreVoice(b) - scoreVoice(a)),
    cur = bestVoice();
  body(
    `<div class="head"><div><h2>Einstellungen</h2></div><button class="x" id="x" aria-label="Schließen">✕</button></div>
  <div class="sec">Fahrzeug</div>
  <div class="group"><div class="set"><span>Ich fahre</span><select id="veh"><option value="rocks" ${CFG.vehicle === 'rocks' ? 'selected' : ''}>Opel Rocks-e (Elektro, 45 km/h)</option><option value="am" ${CFG.vehicle === 'am' ? 'selected' : ''}>Anderes 45-km/h-Fahrzeug (AM)</option><option value="car" ${!isAM() ? 'selected' : ''}>Normales Auto</option></select></div>
  <div class="set"><span>Symbol beim Fahren</span><select id="puck"><option value="" ${!CFG.puck ? 'selected' : ''}>Automatisch</option><option value="arrow" ${CFG.puck === 'arrow' ? 'selected' : ''}>3D-Pfeil</option><option value="rocks" ${CFG.puck === 'rocks' ? 'selected' : ''}>Opel Rocks</option><option value="car" ${CFG.puck === 'car' ? 'selected' : ''}>Auto</option></select></div>
  ${
    isEV()
      ? `<div class="set"><span>Reichweite voll geladen<br><small class="sub">Werk: 75 km (WLTP) – im Winter weniger</small></span><span style="display:flex;align-items:center;gap:8px"><input type="range" id="rng" min="35" max="80" step="5" value="${CFG.rangeFull}" style="width:110px"><b id="rngV" style="min-width:52px;text-align:right">${CFG.rangeFull} km</b></span></div>
  <div class="set"><span>Laden mit</span><select id="plug"><option value="adapter" ${CFG.plug !== 'type2' ? 'selected' : ''}>Haushaltskabel + Typ-2-Adapter</option><option value="type2" ${CFG.plug === 'type2' ? 'selected' : ''}>Typ-2-Anschluss am Auto</option></select></div>`
      : ''
  }
  ${
    isAM()
      ? `<div class="set"><span>Verbotene Straßen rot zeigen<br><small class="sub">Autobahn und Kraftfahrstraße</small></span><label class="sw"><input type="checkbox" id="fbShow" ${CFG.showForbidden ? 'checked' : ''}><span></span></label></div>
  <div class="set"><span>Warnung beim Auffahren<br><small class="sub">Roter Hinweis, Ansage und Vibration</small></span><label class="sw"><input type="checkbox" id="fbWarn" ${CFG.warnForbidden ? 'checked' : ''}><span></span></label></div>`
      : ''
  }</div>
  <div class="sec">Ansagen</div>
  <div class="group">
    <div class="set"><span>Stimme</span><select id="vSel">${vs.length ? vs.map(v => `<option ${cur && v.name === cur.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option>Standard</option>'}</select></div>
    <div class="set"><span>Tempo</span><input type="range" id="rate" min="0.8" max="1.3" step="0.05" value="${CFG.rate}"></div>
    <div class="set"><button id="vTest" style="color:var(--blue);font-weight:600">Stimme testen</button></div>
    <div class="set"><span>Ping bei zu schnell<br><small class="sub">Zwei kurze Töne über dem Tempolimit</small></span><label class="sw"><input type="checkbox" id="beep" ${CFG.beep ? 'checked' : ''}><span></span></label></div>
  </div>
  ${isIOS ? '<div class="sub" style="margin-top:8px;font-size:13px">Schönere Stimmen: iPhone-Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen › Deutsch – dort z. B. „Anna (Premium)“ laden.</div>' : ''}
  <div class="sec">Route</div>
  <div class="group">
    <div class="set"><span>Schotter- und Feldwege meiden<br><small class="sub">Nur befestigte Straßen, wenn möglich</small></span><label class="sw"><input type="checkbox" id="unp" ${CFG.noUnpaved ? 'checked' : ''}><span></span></label></div>
    <div class="set"><span>Ruhige Strecken bevorzugen<br><small class="sub">Weniger Hauptstraßen, etwas länger</small></span><label class="sw"><input type="checkbox" id="quiet" ${CFG.quiet ? 'checked' : ''}><span></span></label></div>
  </div>
  <div class="sec">Karte</div>
  <div class="group"><div class="set"><span>Kartentyp</span><select id="mtype"><option value="std" ${CFG.mapType !== 'sat' ? 'selected' : ''}>Standard</option><option value="sat" ${CFG.mapType === 'sat' ? 'selected' : ''}>Satellit</option></select></div><div class="set"><span>Darstellung</span><select id="theme">${[
    ['auto', 'Automatisch (Tag/Nacht)'],
    ['system', 'Wie das iPhone'],
    ['light', 'Immer hell'],
    ['dark', 'Immer dunkel']
  ]
    .map(([v, l]) => `<option value="${v}" ${CFG.theme === v ? 'selected' : ''}>${l}</option>`)
    .join('')}</select></div></div>
  ${CFG.theme === 'auto' ? `<div class="sub" style="margin-top:6px;font-size:13px">Die Karte dunkelt in der Dämmerung langsam ab und wechselt erst bei Dunkelheit auf die Nachtkarte. Sonne gerade: ${Math.round(sunNow())}° ${sunNow() >= 0 ? 'über' : 'unter'} dem Horizont.</div>` : ''}
  ${offlineSection()}
  <div class="sec">Farben</div>
  <div class="group">
    <div class="set"><span>Route</span><div class="swatches">${Object.entries(COLORS)
      .map(
        ([k, c]) =>
          `<button class="swatch${CFG.routeColor === k ? ' on' : ''}" data-rc="${k}" style="background:${c[1]}" aria-label="Route ${c[0]}"></button>`
      )
      .join('')}</div></div>
    <div class="set"><span>App</span><div class="swatches">${Object.entries(COLORS)
      .map(
        ([k, c]) =>
          `<button class="swatch${CFG.accent === k ? ' on' : ''}" data-ac="${k}" style="background:${c[3]}" aria-label="App-Farbe ${c[0]}"></button>`
      )
      .join('')}</div></div>
  </div>
  <div class="sub" style="margin:16px 0 4px;font-size:13px">${isAM() ? 'Im AM-Modus plant Navi 45 Routen für höchstens 45 km/h – ohne Autobahn und Kraftfahrstraße. Rot markierte Straßen sind für Sie verboten. ' : ''}Karten, Adressen, Läden und Tempolimits kommen aus OpenStreetMap: meist sehr genau, aber nicht fehlerfrei. Wo kein Tempolimit eingetragen ist, zeigt die App kein Schild. Verkehrsschilder gehen immer vor.</div>`,
    'full'
  );
  const save = () => LS.set('cfg', CFG);
  $('x').onclick = () => home();
  $('body')
    .querySelectorAll('[data-rc]')
    .forEach(
      b =>
        (b.onclick = () => {
          CFG.routeColor = b.dataset.rc;
          save();
          try {
            map.setPaintProperty('route-line', 'line-color', routeCol()[1]);
            map.setPaintProperty('route-case', 'line-color', routeCol()[2]);
          } catch (e) {}
          settings();
        })
    );
  $('body')
    .querySelectorAll('[data-ac]')
    .forEach(
      b =>
        (b.onclick = () => {
          CFG.accent = b.dataset.ac;
          save();
          applyAccent();
          settings();
        })
    );
  $('vSel').onchange = e => {
    CFG.voice = e.target.value;
    save();
    say('Jetzt bitte rechts abbiegen.', true);
  };
  $('rate').oninput = e => {
    CFG.rate = +e.target.value;
    save();
  };
  $('vTest').onclick = () => {
    unlockSpeech();
    say('In 300 Metern links auf die Hauptstraße abbiegen.', true);
  };
  $('quiet').onchange = e => {
    CFG.quiet = e.target.checked;
    save();
  };
  $('unp').onchange = e => {
    CFG.noUnpaved = e.target.checked;
    save();
  };
  $('puck').onchange = e => {
    CFG.puck = e.target.value;
    save();
  };
  $('beep').onchange = e => {
    CFG.beep = e.target.checked;
    save();
    unlockAudio();
    if (CFG.beep) setTimeout(ping, 100);
  };
  if ($('rng'))
    $('rng').oninput = e => {
      CFG.rangeFull = +e.target.value;
      $('rngV').textContent = CFG.rangeFull + ' km';
      save();
    };
  if ($('plug'))
    $('plug').onchange = e => {
      CFG.plug = e.target.value;
      save();
    };
  $('veh').onchange = e => {
    CFG.vehicle = e.target.value;
    save();
    document.body.classList.toggle('car', !isAM());
    clearRoute();
    showSign(0);
    forbiddenLayer();
    settings();
  };
  if ($('fbShow'))
    $('fbShow').onchange = e => {
      CFG.showForbidden = e.target.checked;
      save();
      forbiddenLayer();
    };
  if ($('fbWarn'))
    $('fbWarn').onchange = e => {
      CFG.warnForbidden = e.target.checked;
      save();
      forbiddenLayer();
    };
  $('theme').onchange = e => {
    CFG.theme = e.target.value;
    save();
    setTheme();
    settings();
  };
  $('mtype').onchange = e => {
    CFG.mapType = e.target.value;
    save();
    setTheme();
    $('btnType').style.color = CFG.mapType === 'sat' ? '#ff9f0a' : '';
  };
  offlineWire();
}
$('btnSet').onclick = settings;
