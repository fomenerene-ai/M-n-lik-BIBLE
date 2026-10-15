// Grille des chapitres d'un livre.

import { h } from '../ui.js';
import { getBook } from '../core/books.js';
import { VERSIONS } from '../core/versions.js';

export function renderChapters(route) {
  const b = getBook(route.book);
  if (!b) throw new Error('Livre introuvable.');
  const v = VERSIONS[route.version] ? route.version : 'FRLSG';
  const nums = Array.from({ length: b.chapters }, (_, i) => i + 1);
  const el = h(
    'div',
    { class: 'page' },
    h('p', { class: 'page-note' }, VERSIONS[v].label),
    h(
      'nav',
      { class: 'chapter-grid', 'aria-label': `Chapitres de ${b.name}` },
      nums.map((n) => h('a', { class: 'chapter-cell', href: `#/l/${v}/${b.id}/${n}` }, String(n))),
    ),
  );
  return { title: b.name, el };
}
