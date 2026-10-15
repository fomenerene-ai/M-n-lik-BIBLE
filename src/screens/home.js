// Accueil : grille de grosses tuiles.

import { h, icon } from '../ui.js';
import { ICONS } from '../icons.js';

const TILES = [
  { href: '#/recherche', label: 'Recherche', icon: ICONS.search },
  { href: '#/t/AT', label: 'Ancien Testament', icon: ICONS.ot },
  { href: '#/t/NT', label: 'Nouveau Testament', icon: ICONS.nt },
  { href: '#/histoires', label: 'Histoires', icon: ICONS.stories },
  { href: '#/favoris', label: 'Favoris', icon: ICONS.favorites },
  { href: '#/projection', label: 'Projection', icon: ICONS.projection },
];

export function renderHome() {
  const el = h(
    'div',
    { class: 'page home' },
    h(
      'nav',
      { class: 'tiles', 'aria-label': 'Menu principal' },
      TILES.map((t) => h('a', { class: 'tile', href: t.href }, icon(t.icon, 'tile-ico'), h('span', null, t.label))),
    ),
  );
  const settingsLink = h(
    'a',
    { class: 'top-action', href: '#/reglages', 'aria-label': 'Réglages', title: 'Réglages' },
    icon(ICONS.settings),
  );
  return { title: 'Ménélik Bible', el, actions: [settingsLink] };
}
