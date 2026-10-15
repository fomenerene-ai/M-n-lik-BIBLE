// Parley rescue page script.
// An old version of the Ménélik Bible service worker answers every page of this site, including
// /parley/, with its own cached page. That page loads ./assets/index-<hash>.js, which resolves here,
// under /parley/assets/. Copies of this file carry the hashes of the Bible versions deployed before
// Parley existed. It activates the new Bible version (the same as tapping "Mettre à jour"), whose
// service worker leaves /parley/ alone, then reloads: Parley opens.
(async () => {
  const say = (t) => { document.body.textContent = t; document.body.style.cssText = 'font:20px system-ui,sans-serif;padding:40px;color:#1D2433'; };
  say('Opening Parley...');
  if (!('serviceWorker' in navigator)) { location.reload(); return; }
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) { location.reload(); return; }
  const skip = (w) => { if (w) w.postMessage({ type: 'SKIP_WAITING' }); };
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') skip(w); });
  });
  if (reg.waiting) skip(reg.waiting);
  else await reg.update().catch(() => {});
  if (reg.waiting) skip(reg.waiting);
  setTimeout(() => {
    if (!reloaded) say('Parley could not open yet. Open Ménélik Bible, tap "Mettre à jour", then come back to this address.');
  }, 20000);
})();
