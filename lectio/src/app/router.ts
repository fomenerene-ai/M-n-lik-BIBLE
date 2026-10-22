// Routage par hash (#/lire/abc) : aucun serveur requis, le bouton Retour d'Android
// fonctionne, et l'URL reste valide dans la WebView Capacitor.

import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'reader'; docId: string | null }
  | { name: 'search' }
  | { name: 'annotations' }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'lire':
      return { name: 'reader', docId: parts[1] ?? null };
    case 'recherche':
      return { name: 'search' };
    case 'annotations':
      return { name: 'annotations' };
    case 'reglages':
      return { name: 'settings' };
    default:
      return { name: 'library' };
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'reader':
      return route.docId ? `#/lire/${encodeURIComponent(route.docId)}` : '#/lire';
    case 'search':
      return '#/recherche';
    case 'annotations':
      return '#/annotations';
    case 'settings':
      return '#/reglages';
    default:
      return '#/';
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeHref(route);
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}
