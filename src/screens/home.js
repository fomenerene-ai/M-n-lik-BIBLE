// Accueil : verset du jour, grille de grosses tuiles, accès secondaires (mise à jour, réglages).

import { h, icon } from '../ui.js';
import { ICONS } from '../icons.js';
import { getChapter } from '../core/bible.js';
import { formatRef } from '../core/reference.js';
import { settings } from '../core/userdata.js';
import { VERSIONS } from '../core/versions.js';
import { getUpdateState, onUpdateState } from '../sw-register.js';

const TILES = [
  { href: '#/recherche', label: 'Recherche', desc: 'Par référence', icon: ICONS.search },
  { href: '#/t/AT', label: 'Ancien Testament', desc: 'De la Genèse à Malachie', icon: ICONS.ot },
  { href: '#/t/NT', label: 'Nouveau Testament', desc: 'De Matthieu à l’Apocalypse', icon: ICONS.nt },
  { href: '#/histoires', label: 'Histoires', desc: 'Les personnages bibliques', icon: ICONS.stories },
  { href: '#/favoris', label: 'Favoris', desc: 'Surlignages, notes, marque-pages', icon: ICONS.favorites },
  { href: '#/projection', label: 'Projection', desc: 'Pour les études en visio', icon: ICONS.projection },
];

// Versets du jour : passages dont la numérotation est identique dans les éditions courantes.
const DAILY = [
  [43, 3, 16], [45, 8, 28], [50, 4, 13], [23, 40, 31], [6, 1, 9], [20, 3, 5], [40, 11, 28],
  [43, 14, 6], [25, 3, 22], [45, 12, 2], [55, 1, 7], [58, 11, 1], [59, 1, 5], [62, 4, 8],
  [33, 6, 8], [40, 5, 9], [43, 8, 12], [48, 5, 22], [49, 2, 8], [51, 3, 23], [20, 16, 3],
  [23, 41, 10], [24, 29, 11], [40, 6, 33], [42, 1, 37], [45, 15, 13], [60, 5, 7], [58, 13, 8],
  [66, 21, 4], [46, 13, 4], [43, 15, 12],
];

function dayIndex(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

async function dailyVerse(el) {
  const [b, c, n] = DAILY[dayIndex() % DAILY.length];
  const version = settings().version;
  try {
    const verses = await getChapter(version, b, c);
    const v = verses.find((x) => x.n === n);
    if (!v) return;
    const ref = formatRef({ book: b, chapter: c, vStart: n, vEnd: n });
    el.replaceChildren(
      h('span', { class: 'sr-only' }, 'Verset du jour : '),
      `« ${v.t} »`,
      h('cite', null, h('a', { href: `#/l/${version}/${b}/${c}/${n}-${n}` }, ref), ` · ${VERSIONS[version].short}`),
    );
    el.hidden = false;
  } catch {
    /* textes absents : pas de verset du jour */
  }
}

export function renderHome() {
  const verse = h('blockquote', { class: 'home-verse', hidden: true });
  dailyVerse(verse);

  const badge = h('span', { class: 'badge', hidden: true }, 'Nouvelle version');
  const paintBadge = (s) => {
    badge.hidden = s !== 'available';
  };
  paintBadge(getUpdateState());
  const off = onUpdateState(paintBadge);

  const el = h(
    'div',
    { class: 'page home' },
    h('div', { class: 'home-head' }, verse, h('div', { class: 'ornament', 'aria-hidden': 'true' }, h('span'))),
    h(
      'nav',
      { 'aria-label': 'Menu principal' },
      h(
        'ul',
        { class: 'tiles', role: 'list' },
        TILES.map((t) =>
          h(
            'li',
            null,
            h(
              'a',
              { class: 'tile', href: t.href },
              icon(t.icon, 'tile-ico'),
              h('span', { class: 'tile-label' }, t.label),
              h('span', { class: 'tile-desc' }, t.desc),
            ),
          ),
        ),
      ),
      h(
        'ul',
        { class: 'tiles-secondary', role: 'list' },
        h('li', null, h('a', { class: 'tile-mini', href: '#/mise-a-jour' }, icon(ICONS.update), 'Mise à jour', badge)),
        h('li', null, h('a', { class: 'tile-mini', href: '#/reglages' }, icon(ICONS.settings), 'Réglages')),
      ),
    ),
  );
  return { title: 'Ménélik Bible', el, cleanup: off };
}
