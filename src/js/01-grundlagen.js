const VALHALLA = 'https://valhalla1.openstreetmap.de',
  PHOTON = 'https://photon.komoot.io',
  OVERPASS = 'https://overpass-api.de/api/interpreter';
const $ = id => document.getElementById(id);
const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem('navi45.' + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('navi45.' + k, JSON.stringify(v));
    } catch (e) {}
  }
};
const CFG = Object.assign(
  {
    voice: '',
    rate: 1,
    quiet: false,
    noUnpaved: true,
    theme: 'auto',
    routeColor: 'blue',
    accent: 'blue',
    mapType: 'std',
    hint: true,
    vehicle: 'am',
    showForbidden: true,
    warnForbidden: true,
    rangeFull: 70,
    battery: 100,
    plug: 'adapter',
    puck: '',
    beep: true
  },
  LS.get('cfg', {})
);
const isEV = () => CFG.vehicle === 'rocks';
const isAM = () => CFG.vehicle !== 'car';
const COST = () => (isAM() ? 'motor_scooter' : 'auto');
const vehTxt = () => (isAM() ? 'mit 45 km/h' : 'mit dem Auto');
document.body.classList.toggle('car', !isAM());
const S = {
  me: null,
  acc: 0,
  heading: null,
  kmh: null,
  watch: null,
  follow: 0,
  from: null,
  dest: null,
  routes: [],
  sel: 0,
  navi: false,
  sim: null,
  lastIdx: 0,
  off: 0,
  rerouting: false,
  said: {},
  mute: false,
  wake: null,
  via: null,
  recent: LS.get('recent', []),
  favs: LS.get('favs', []),
  favMarkers: [],
  trail: [],
  pending: null,
  markers: [],
  bip: null,
  clickGuard: 0,
  camBusy: false
};
const route = () => S.routes[S.sel];

// ---------- Hilfen ----------
const R = 6371000,
  rad = x => (x * Math.PI) / 180,
  deg = x => (x * 180) / Math.PI;
function hav(a, b) {
  const dLa = rad(b[0] - a[0]),
    dLo = rad(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function brg(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])),
    x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
function decode6(s) {
  let i = 0,
    la = 0,
    lo = 0,
    o = [];
  while (i < s.length) {
    for (const k of [0, 1]) {
      let b,
        sh = 0,
        r = 0;
      do {
        b = s.charCodeAt(i++) - 63;
        r |= (b & 31) << sh;
        sh += 5;
      } while (b >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (k === 0) la += d;
      else lo += d;
    }
    o.push([la / 1e6, lo / 1e6]);
  }
  return o;
}
const comma = n => String(n).replace('.', ',');
const fmtDist = m =>
  m >= 1000
    ? comma((m / 1000).toFixed(m >= 10000 ? 0 : 1)) + ' km'
    : (m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10)) + ' m';
const spokenDist = m =>
  m >= 1000
    ? m < 1500
      ? 'einem Kilometer'
      : comma((Math.round(m / 500) / 2).toString()) + ' Kilometern'
    : Math.round(m / 50) * 50 + ' Metern';
const mins = s => Math.max(1, Math.round(s / 60));
const fmtTime = s => {
  const m = mins(s);
  return m < 60 ? m + ' Min.' : Math.floor(m / 60) + ' Std. ' + (m % 60) + ' Min.';
};
const clock = s => new Date(Date.now() + s * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lowFirst = t => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
function withTimeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
function label(f) {
  const p = f.properties || {};
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const main = p.name || street || p.city || 'Markierter Ort';
  const sub = [p.name && street ? street : '', p.postcode, p.city || p.town || p.village || p.district]
    .filter(Boolean)
    .join(', ');
  return { main, sub };
}
const center = () => {
  const c = map.getCenter();
  return { lat: c.lat, lon: c.lng };
};
const origin = () => S.me || center();
