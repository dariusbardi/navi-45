// ---------- Start ----------
sheetTo('peek');
home();
map.on('load', () => {
  drawFavs();
  const lp = LS.get('lastPlace', null);
  if (lp && Date.now() - lp.t < 7200000 && !S.dest) place(lp.p, false);
});
window.navi45 = { S, CFG, forbiddenLayer, map };
if ('speechSynthesis' in window) speechSynthesis.getVoices();
try {
  navigator.permissions?.query({ name: 'geolocation' }).then(p => {
    if (p.state === 'granted') startWatch();
  });
} catch (e) {}
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
