// Routage par fragment (#/...) et gestion du bouton retour.
//
// Hiérarchie : accueil > version > livres > chapitres > lecture (et accueil > histoires > fiche…).
// Le bouton retour (flèche en haut ou bouton Android) remonte toujours d'un niveau.
//
// Technique : l'historique du navigateur ne contient que deux entrées :
//   s:0  l'accueil (sentinelle)      s:1  l'écran courant
// Les navigations internes remplacent l'entrée s:1. Quand le bouton retour d'Android
// ramène sur s:0, on affiche le parent de l'écran courant et on recrée s:1.
// Sur l'accueil, l'entrée s:1 n'existe pas : un retour quitte l'application.

import { getBook } from './core/books.js';

let renderFn = () => {};
let current = '/';
let pendingHome = null;
const overlays = []; // fonctions de fermeture des surcouches (feuilles, projection)

export function parse(hash) {
  const path = decodeURIComponent((hash || '').replace(/^#/, '')) || '/';
  const parts = path.split('/').filter(Boolean);
  const [a, b, c, d, e] = parts;
  switch (a) {
    case undefined:
      return { name: 'home' };
    case 'recherche':
      return { name: 'search', q: parts.slice(1).join('/') };
    case 't':
      if (b && c) return { name: 'books', testament: b, version: c };
      return { name: 'version', testament: b };
    case 'l':
      if (e !== undefined || d !== undefined) {
        return { name: 'reader', version: b, book: +c, chapter: +d, verse: e || null };
      }
      return { name: 'chapters', version: b, book: +c };
    case 'favoris':
      return { name: 'favorites' };
    case 'projection':
      return { name: 'projection' };
    case 'histoires':
      return b ? { name: 'story', id: b } : { name: 'stories' };
    case 'reglages':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

/** Écran parent (null pour l'accueil). */
export function parentOf(path) {
  const r = parse(path);
  switch (r.name) {
    case 'home':
      return null;
    case 'books':
      return `/t/${r.testament}`;
    case 'chapters': {
      const b = getBook(r.book);
      return `/t/${b ? b.testament : 'AT'}/${r.version}`;
    }
    case 'reader':
      return `/l/${r.version}/${r.book}`;
    case 'story':
      return '/histoires';
    default:
      return '/';
  }
}

const isHome = (p) => parse(p).name === 'home';

export function currentPath() {
  return current;
}

export function go(path) {
  const onTop = history.state && history.state.s === 1;
  if (isHome(path) && onTop) {
    pendingHome = path;
    history.back();
    return;
  }
  const url = '#' + path;
  if (!isHome(path) && !onTop) history.pushState({ s: 1 }, '', url);
  else history.replaceState(history.state || { s: 0 }, '', url);
  current = path;
  renderFn(path);
}

/** Flèche de retour de l'en-tête. */
export function back() {
  const p = parentOf(current);
  go(p || '/');
}

export function pushOverlay(closeFn) {
  overlays.push(closeFn);
  // Sur l'accueil, créer une entrée pour que le retour Android ferme la surcouche
  if (!(history.state && history.state.s === 1)) history.pushState({ s: 1 }, '', '#' + current);
}

export function popOverlay(closeFn) {
  const i = overlays.lastIndexOf(closeFn);
  if (i >= 0) overlays.splice(i, 1);
}

export function startRouter(render) {
  renderFn = render;
  const start = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  history.replaceState({ s: 0 }, '', '#/');
  if (!isHome(start)) history.pushState({ s: 1 }, '', '#' + start);
  current = start;

  window.addEventListener('popstate', () => {
    // Saisie directe d'une adresse #/... (entrée d'historique sans état) : simple navigation
    if (history.state === null) {
      const p = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
      history.replaceState({ s: isHome(p) ? 0 : 1 }, '', '#' + p);
      current = p;
      renderFn(p);
      return;
    }
    if (pendingHome !== null) {
      const p = pendingHome;
      pendingHome = null;
      history.replaceState({ s: 0 }, '', '#' + p);
      current = p;
      renderFn(p);
      return;
    }
    // Retour système : fermer d'abord une surcouche éventuelle
    if (overlays.length) {
      const close = overlays[overlays.length - 1];
      if (close()) {
        if (!isHome(current)) history.pushState({ s: 1 }, '', '#' + current);
        return;
      }
    }
    const p = parentOf(current);
    if (!p || isHome(p)) {
      history.replaceState({ s: 0 }, '', '#/');
      current = '/';
      renderFn('/');
    } else {
      history.pushState({ s: 1 }, '', '#' + p);
      current = p;
      renderFn(p);
    }
  });

  // Liens internes <a href="#/...">
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    go(a.getAttribute('href').slice(1));
  });

  renderFn(start);
}
