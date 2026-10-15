// Choix de la version, affiché juste après la tuile Ancien ou Nouveau Testament.

import { h } from '../ui.js';
import { go } from '../router.js';
import { TESTAMENTS } from '../core/books.js';
import { VERSIONS } from '../core/versions.js';
import { settings, setSetting } from '../core/userdata.js';

export function renderVersion(route) {
  const t = TESTAMENTS[route.testament] || TESTAMENTS.AT;
  const current = settings().version;
  const el = h(
    'div',
    { class: 'page' },
    h('h2', { class: 'page-title' }, 'Choisissez la version'),
    h(
      'div',
      { class: 'version-choice' },
      Object.values(VERSIONS).map((v) =>
        h(
          'button',
          {
            class: 'version-btn' + (v.id === current ? ' current' : ''),
            onclick: async () => {
              await setSetting('version', v.id);
              go(`/t/${t.id}/${v.id}`);
            },
          },
          h('span', { class: 'version-name' }, v.label),
          h('span', { class: 'version-short' }, v.short),
        ),
      ),
    ),
  );
  return { title: t.label, el };
}
