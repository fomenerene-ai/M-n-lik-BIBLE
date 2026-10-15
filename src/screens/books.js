// Liste des livres d'un Testament.

import { h } from '../ui.js';
import { booksOf, TESTAMENTS } from '../core/books.js';
import { VERSIONS } from '../core/versions.js';

export function renderBooks(route) {
  const t = TESTAMENTS[route.testament] || TESTAMENTS.AT;
  const v = VERSIONS[route.version] ? route.version : 'FRLSG';
  const el = h(
    'div',
    { class: 'page' },
    h('p', { class: 'page-note' }, VERSIONS[v].label),
    h(
      'nav',
      { class: 'book-list', 'aria-label': 'Livres' },
      booksOf(t.id).map((b) => h('a', { class: 'book-item', href: `#/l/${v}/${b.id}` }, b.name)),
    ),
  );
  return { title: t.label, el };
}
