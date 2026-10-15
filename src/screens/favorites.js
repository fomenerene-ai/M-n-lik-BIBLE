// Favoris : tout ce que l'utilisateur a marqué, filtrable et triable.

import { h, icon, confirmDialog, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import { formatRef } from '../core/reference.js';
import { getChapter } from '../core/bible.js';
import { biblicalOrder } from '../core/ranges.js';
import { allMarks, deleteMark, settings, COLORS } from '../core/userdata.js';

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'highlight', label: 'Surlignages' },
  ...COLORS.map((c) => ({ id: `color:${c.id}`, label: c.label, color: c.id })),
  { id: 'note', label: 'Notes' },
  { id: 'bookmark', label: 'Marque-pages' },
];

const KIND_LABEL = { highlight: 'Surlignage', note: 'Note', bookmark: 'Marque-page' };
const THIS = { highlight: 'ce surlignage', note: 'cette note', bookmark: 'ce marque-page' };

let state = { filter: 'all', sort: 'date' }; // conservé pendant la session

export async function renderFavorites() {
  const listEl = h('div', { class: 'fav-list' });
  const version = settings().version;

  const filterBar = h(
    'div',
    { class: 'chips', role: 'group', 'aria-label': 'Filtrer' },
    FILTERS.map((f) =>
      h(
        'button',
        {
          class: 'chip' + (state.filter === f.id ? ' on' : '') + (f.color ? ` hl-${f.color}` : ''),
          'aria-pressed': state.filter === f.id ? 'true' : 'false',
          onclick: () => {
            state.filter = f.id;
            go('/favoris');
          },
        },
        f.label,
      ),
    ),
  );
  const sortBar = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Trier' },
    [
      ['date', 'Par date'],
      ['bible', 'Ordre biblique'],
    ].map(([id, label]) =>
      h(
        'button',
        {
          class: state.sort === id ? 'on' : '',
          'aria-pressed': state.sort === id ? 'true' : 'false',
          onclick: () => {
            state.sort = id;
            go('/favoris');
          },
        },
        label,
      ),
    ),
  );

  let marks = await allMarks();
  const f = state.filter;
  if (f !== 'all') {
    marks = marks.filter((m) =>
      f.startsWith('color:') ? m.kind === 'highlight' && m.color === f.slice(6) : m.kind === f,
    );
  }
  marks.sort(state.sort === 'bible' ? biblicalOrder : (a, b) => (b.date || 0) - (a.date || 0));

  if (!marks.length) {
    listEl.append(
      h('p', { class: 'muted empty' }, 'Rien pour l’instant. Touchez un verset pendant la lecture pour le surligner, l’annoter ou le marquer.'),
    );
  }

  for (const m of marks) {
    const ref = { book: m.b, chapter: m.c, vStart: m.vs ?? null, vEnd: m.ve ?? null };
    const verses = await getChapter(version, m.b, m.c);
    const excerpt = m.vs
      ? verses
          .filter((v) => v.n >= m.vs && v.n <= m.ve)
          .map((v) => v.t)
          .join(' ')
      : '';
    const target = `/l/${version}/${m.b}/${m.c}${m.vs ? `/${m.vs}-${m.ve}` : ''}`;
    listEl.append(
      h(
        'div',
        { class: 'fav-item' },
        h(
          'button',
          { class: 'fav-open', onclick: () => go(target) },
          h(
            'div',
            { class: 'fav-head' },
            m.kind === 'highlight'
              ? h('span', { class: `dot hl-${m.color}`, 'aria-hidden': 'true' })
              : icon(m.kind === 'note' ? ICONS.note : ICONS.bookmark, 'ico small'),
            h('strong', null, formatRef(ref) + (m.vs ? '' : ' (chapitre)')),
            h('span', { class: 'muted small' }, `${KIND_LABEL[m.kind]} · ${new Date(m.date).toLocaleDateString('fr-FR')}`),
          ),
          m.kind === 'note' ? h('p', { class: 'fav-note' }, m.text) : null,
          excerpt ? h('p', { class: 'fav-excerpt' }, excerpt.length > 240 ? excerpt.slice(0, 240) + '…' : excerpt) : null,
        ),
        h(
          'button',
          {
            class: 'btn-icon',
            'aria-label': `Supprimer ${KIND_LABEL[m.kind].toLowerCase()} ${formatRef(ref)}`,
            onclick: async () => {
              if (!(await confirmDialog(`Supprimer ${THIS[m.kind]} (${formatRef(ref)}) ?`, 'Supprimer'))) return;
              await deleteMark(m.kind, m.id);
              toast('Supprimé');
              go('/favoris');
            },
          },
          icon(ICONS.trash),
        ),
      ),
    );
  }

  const el = h('div', { class: 'page' }, filterBar, h('div', { class: 'row' }, sortBar), listEl);
  return { title: 'Favoris', el };
}
