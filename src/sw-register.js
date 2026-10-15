// Enregistrement du service worker et annonce des mises à jour.
// Une nouvelle version n'est activée qu'avec l'accord de l'utilisateur :
// l'ancienne reste en place (et fonctionne hors ligne) tant qu'il n'a pas accepté.

import { h } from './ui.js';

const CHECK_EVERY = 30 * 60 * 1000; // vérification périodique pendant l'utilisation

let registration = null;

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
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // Vérifie à l'ouverture, au retour au premier plan et périodiquement (si réseau).
      const check = () => navigator.onLine && reg.update().catch(() => {});
      check();
      setInterval(check, CHECK_EVERY);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    })
    .catch((e) => console.warn('Service worker non enregistré :', e));
}

function offer(worker) {
  showUpdateBanner(() => worker.postMessage({ type: 'SKIP_WAITING' }));
}

/**
 * Recherche manuelle d'une mise à jour (bouton des réglages).
 * @returns {Promise<'available'|'none'|'offline'|'unsupported'>}
 */
export async function checkForUpdate() {
  if (!registration) return 'unsupported';
  if (!navigator.onLine) return 'offline';
  if (registration.waiting) {
    offer(registration.waiting);
    return 'available';
  }
  await registration.update();
  // Laisse au nouveau service worker le temps de s'installer
  const worker = registration.installing || registration.waiting;
  if (!worker) return 'none';
  if (worker.state !== 'installed') {
    await new Promise((resolve) => {
      const done = () => ['installed', 'redundant', 'activated'].includes(worker.state) && resolve();
      worker.addEventListener('statechange', done);
      setTimeout(resolve, 30000);
    });
  }
  if (registration.waiting) {
    offer(registration.waiting);
    return 'available';
  }
  return 'none';
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
