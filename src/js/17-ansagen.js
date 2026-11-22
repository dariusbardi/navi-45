// ---------- Pfeile ----------
function arrow(t, size, col = '#fff', w = 7) {
  const a =
    {
      8: 0,
      7: 0,
      17: 0,
      22: 0,
      25: 0,
      1: 0,
      2: 0,
      3: 0,
      9: 45,
      18: 45,
      20: 45,
      23: 25,
      10: 90,
      11: 135,
      12: 180,
      13: 180,
      14: -135,
      15: -90,
      16: -45,
      19: -45,
      21: -45,
      24: -25
    }[t] ?? 0;
  const inner = [4, 5, 6].includes(t)
    ? '<path d="M18 58V8M18 10h28l-6 9 6 9H18"/>'
    : [26, 27].includes(t)
      ? '<circle cx="32" cy="32" r="11"/><path d="M32 60V43M32 21V6M23 14l9-9 9 9"/>'
      : t === 12 || t === 13
        ? `<path d="M40 58V26a12 12 0 0 0-24 0v18M8 36l8 8 8-8" ${t === 12 ? 'transform="matrix(-1 0 0 1 64 0)"' : ''}/>`
        : `<g transform="rotate(${a} 32 40)"><path d="M32 60V14M18 28l14-14 14 14"/></g>`;
  return size
    ? `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
    : inner;
}

// ---------- Stimme ----------
let speechOk = false;
function voices() {
  return ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^de/i.test(v.lang));
}
function scoreVoice(v) {
  let s = 0;
  const n = v.name.toLowerCase();
  if (/premium|enhanced|erweitert|natural|neural|online/.test(n)) s += 10;
  if (/anna|helena|petra|google|katja|vicki|marlene|seraphina|amala/.test(n)) s += 3;
  if (/de-de/i.test(v.lang)) s += 2;
  if (
    /eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bubbles|whisper|zarvox|bad news|bells|boing|cellos|jester|organ|superstar|trinoids|wobble|good news/.test(
      n
    )
  )
    s -= 20;
  return s;
}
function bestVoice() {
  const vs = voices();
  if (CFG.voice) {
    const v = vs.find(v => v.name === CFG.voice);
    if (v) return v;
  }
  return vs.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}
function unlockSpeech() {
  unlockAudio();
  if (speechOk || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    speechOk = true;
  } catch (e) {}
}
function say(t, force) {
  if ((S.mute && !force) || !('speechSynthesis' in window) || !t) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      t
        .replace(/\bSt (\d)/g, 'Staatsstraße $1')
        .replace(/\bB (\d)/g, 'Bundesstraße $1')
        .replace(/\/\s*/g, ', ')
    );
    u.lang = 'de-DE';
    const v = bestVoice();
    if (v) u.voice = v;
    u.rate = CFG.rate;
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch (e) {}
}
if ('speechSynthesis' in window)
  speechSynthesis.onvoiceschanged = () => {
    if ($('vSel')) settings();
  };
const setMuteUI = () => {
  document.querySelectorAll('#navMute .wave').forEach(e => (e.style.display = S.mute ? 'none' : ''));
  document.querySelectorAll('#navMute .mx').forEach(e => (e.style.display = S.mute ? '' : 'none'));
};
$('navMute').onclick = () => {
  S.mute = !S.mute;
  setMuteUI();
  if (S.mute)
    try {
      speechSynthesis.cancel();
    } catch (e) {}
};

// ---------- Warnton bei zu schnell + Tacho ----------
let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
}
function ping() {
  if (!CFG.beep || !actx) return;
  try {
    const t = actx.currentTime;
    [0, 0.22].forEach(d => {
      const o = actx.createOscillator(),
        g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = 1320;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      o.connect(g).connect(actx.destination);
      o.start(t + d);
      o.stop(t + d + 0.18);
    });
  } catch (e) {}
}
let overSince = 0,
  lastPing = 0;
function speedCheck(kmh, limit) {
  const lim = Math.min(limit || 999, isAM() ? 45 : 999);
  const over = kmh != null && lim < 999 && kmh > lim + 3;
  const now = Date.now();
  if (over) {
    if (!overSince) overSince = now;
    if (now - overSince > 1500 && now - lastPing > 8000) {
      lastPing = now;
      ping();
    }
  } else overSince = 0;
  return over;
}
function tacho() {
  const t = $('tacho');
  if (S.navi || S.kmh == null || !S.watch || S.isSim) {
    t.hidden = true;
    return;
  }
  t.hidden = false;
  $('tachoV').textContent = Math.round(S.kmh);
  t.classList.toggle('over', speedCheck(S.kmh, S.freeLim));
}
