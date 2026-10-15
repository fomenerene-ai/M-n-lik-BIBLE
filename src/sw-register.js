// Enregistrement du service worker et annonce des mises à jour.
// Une nouvelle version n'est activée qu'avec l'accord de l'utilisateur :
// l'ancienne reste en place (et fonctionne hors ligne) tant qu'il n'a pas accepté.

import { h } from './ui.js';

export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  // Au tout premier lancement, le service worker prend le contrôle sans recharger
  // (sinon le téléchargement initial serait interrompu) ; on ne recharge que lors d'une mise à jour.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offer = (worker) => showUpdateBanner(() => worker.postMessage({ type: 'SKIP_WAITING' }));
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // Vérifie les mises à jour à l'ouverture et au retour au premier plan (si réseau).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('Service worker non enregistré :', e));
}

function showUpdateBanner(apply) {
  if (document.getElementById('update-banner')) return;
  const bar = h(
    'div',
    { id: 'update-banner', role: 'status' },
    h('span', null, 'Nouvelle version disponible.'),
    h('button', { class: 'btn primary', onclick: () => ((bar.textContent = 'Mise à jour…'), apply()) }, 'Mettre à jour'),
    h('button', { class: 'btn', onclick: () => bar.remove() }, 'Plus tard'),
  );
  document.body.append(bar);
}
