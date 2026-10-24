// Enregistrement du service worker et annonce des mises à jour.
// Une nouvelle version n'est activée qu'avec l'accord de l'utilisateur :
// l'ancienne reste en place (et fonctionne hors ligne) tant qu'il n'a pas accepté.
//
// L'état est partagé avec l'écran « Mise à jour » et le badge de l'accueil :
//   'unsupported' | 'idle' | 'checking' | 'available' | 'none' | 'offline' | 'error'

import { h } from './ui.js';

const CHECK_EVERY = 30 * 60 * 1000; // vérification périodique pendant l'utilisation
const LAST_CHECK_KEY = 'menelik-derniere-verification';

let registration = null;
let state = 'idle';
const listeners = new Set();

function setState(s) {
  state = s;
  if (s === 'none' || s === 'available') {
    try {
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }
  for (const fn of listeners) fn(state);
}

export function getUpdateState() {
  return state;
}

/** S'abonne aux changements d'état ; renvoie la fonction de désabonnement. */
export function onUpdateState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function lastCheck() {
  try {
    const v = Number(localStorage.getItem(LAST_CHECK_KEY));
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    state = 'unsupported';
    return;
  }

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
      if (reg.waiting && navigator.serviceWorker.controller) offer();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer();
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
    .catch((e) => {
      state = 'unsupported';
      console.warn('Service worker non enregistré :', e);
    });
}

function offer() {
  setState('available');
  showUpdateBanner();
}

/** Active la version en attente (rechargement automatique ensuite). */
export function applyUpdate() {
  const w = registration && registration.waiting;
  if (!w) return false;
  w.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/**
 * Recherche manuelle d'une mise à jour.
 * @returns {Promise<'available'|'none'|'offline'|'unsupported'|'error'>}
 */
export async function checkForUpdate() {
  if (!registration) return 'unsupported';
  if (!navigator.onLine) {
    setState('offline');
    return 'offline';
  }
  if (registration.waiting) {
    offer();
    return 'available';
  }
  setState('checking');
  try {
    await registration.update();
    // Laisse au nouveau service worker le temps de s'installer
    const worker = registration.installing || registration.waiting;
    if (worker && worker.state !== 'installed') {
      await new Promise((resolve) => {
        const done = () => ['installed', 'redundant', 'activated'].includes(worker.state) && resolve();
        worker.addEventListener('statechange', done);
        setTimeout(resolve, 30000);
      });
    }
  } catch {
    setState('error');
    return 'error';
  }
  if (registration.waiting) {
    offer();
    return 'available';
  }
  setState('none');
  return 'none';
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const bar = h(
    'div',
    { id: 'update-banner', role: 'status' },
    h('span', null, 'Nouvelle version disponible.'),
    h(
      'button',
      { type: 'button', class: 'btn primary', onclick: () => ((bar.textContent = 'Mise à jour…'), applyUpdate()) },
      'Mettre à jour',
    ),
    h('button', { type: 'button', class: 'btn', onclick: () => bar.remove() }, 'Plus tard'),
  );
  document.body.append(bar);
}
