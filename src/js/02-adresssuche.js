// ---------- Adresssuche: Photon, bei Ausfall Nominatim ----------
let nomLast = 0;
const nomWait = async () => {
  const w = nomLast + 1100 - Date.now();
  nomLast = Math.max(Date.now(), nomLast + 1100);
  if (w > 0) await new Promise(r => setTimeout(r, w));
};
const nomFeat = x => {
  const a = x.address || {};
  const street = a.road || a.pedestrian || a.footway || '';
  return {
    geometry: { coordinates: [+x.lon, +x.lat] },
    properties: {
      name: x.name && x.name !== street ? x.name : '',
      street,
      housenumber: a.house_number,
      postcode: a.postcode,
      city: a.city || a.town || a.village,
      district: a.suburb,
      osm_key: x.category,
      osm_value: x.type,
      osm_type: (x.osm_type || 'n')[0].toUpperCase(),
      osm_id: x.osm_id
    }
  };
};
async function geo(q, c, limit = 8) {
  try {
    const j = await (
      await fetch(
        `${PHOTON}/api/?q=${encodeURIComponent(q)}&lang=de&limit=${limit}&lat=${c.lat}&lon=${c.lon}&location_bias_scale=0.3`,
        { signal: withTimeout(6000) }
      )
    ).json();
    if (j.features) return j.features;
  } catch (e) {}
  await nomWait();
  const vb = [c.lon - 0.6, c.lat + 0.4, c.lon + 0.6, c.lat - 0.4].map(n => n.toFixed(3)).join(',');
  const j = await (
    await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=de&limit=${limit}&viewbox=${vb}&q=${encodeURIComponent(q)}`,
      { signal: withTimeout(10000) }
    )
  ).json();
  return j.map(nomFeat);
}
async function rgeo(lat, lon) {
  try {
    const j = await (await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}&lang=de`, { signal: withTimeout(5000) })).json();
    if (j.features?.length) return j.features[0];
  } catch (e) {}
  await nomWait();
  const x = await (
    await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=de&zoom=18&lat=${lat}&lon=${lon}`,
      { signal: withTimeout(10000) }
    )
  ).json();
  return x && x.lat ? nomFeat(x) : null;
}

// Fahrzeit zu den Favoriten (Zuhause/Arbeit zuerst), alle 5 Minuten neu
async function favTimes() {
  if (!S.me || !S.favs.length || (Date.now() - (S.favT || 0) < 300000 && S.favTimes)) return;
  S.favT = Date.now();
  try {
    const q = {
      sources: [{ lat: S.me.lat, lon: S.me.lon }],
      targets: S.favs.slice(0, 12).map(f => ({ lat: f.lat, lon: f.lon })),
      costing: COST(),
      costing_options: costOpts()
    };
    const j = await (
      await fetch(`${VALHALLA}/sources_to_targets?json=${encodeURIComponent(JSON.stringify(q))}`, { signal: withTimeout(12000) })
    ).json();
    S.favTimes = {};
    j.sources_to_targets[0].forEach(r => {
      if (r.time != null) {
        S.favTimes[r.to_index] = r.time;
        const el = $('ft' + r.to_index);
        if (el) el.textContent = fmtTime(r.time);
      }
    });
  } catch (e) {}
}
