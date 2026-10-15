// Histoires bibliques : liste (alphabétique ou chronologique) et fiche détaillée.
// Les fiches sont des fichiers JSON statiques dans public/histoires/ ; l'index est
// généré au build (voir vite.config.js). Ajouter un personnage = ajouter un fichier.

import { h } from '../ui.js';
import { parseReference } from '../core/reference.js';
import { settings } from '../core/userdata.js';
import { go } from '../router.js';

let indexCache = null;
let order = 'alpha'; // conservé pendant la session

async function loadIndex() {
  if (indexCache) return indexCache;
  const res = await fetch('./histoires/index.json');
  if (!res.ok) throw new Error('Histoires indisponibles.');
  indexCache = await res.json();
  return indexCache;
}

async function loadStory(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Fiche introuvable.');
  const res = await fetch(`./histoires/${id}.json`);
  if (!res.ok) throw new Error('Fiche introuvable.');
  return res.json();
}

/**
 * Lien de lecture pour une référence d'histoire. Les plages sur plusieurs chapitres
 * (« Genèse 12:1-25:11 », « Genèse 12-25 ») ouvrent leur point de départ.
 */
export function storyRefTarget(text) {
  let r = parseReference(text);
  if (!r.ok || !r.chapter) {
    const start = text.split(/[-–]/)[0];
    r = parseReference(start);
    if (r.ok && r.chapter) r = { ...r, vEnd: r.vStart };
  }
  if (!r.ok || !r.chapter) return null;
  const v = settings().version;
  return `/l/${v}/${r.book}/${r.chapter}${r.vStart ? `/${r.vStart}-${r.vEnd}` : ''}`;
}

function refLink(text, label) {
  const target = storyRefTarget(text);
  if (!target) return h('span', { class: 'ref-bad' }, label || text);
  return h('a', { class: 'ref-link', href: '#' + target }, label || text);
}

/** Texte avec références [[Livre C:V-V]] ou [[Livre C:V|libellé]] cliquables. */
export function richText(str) {
  const out = [];
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    // Référence sans libellé : affichée entre parenthèses, comme dans un texte imprimé
    if (m[2]) out.push(refLink(m[1].trim(), m[2].trim()));
    else out.push('(', refLink(m[1].trim()), ')');
    last = re.lastIndex;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

export async function renderStories() {
  const list = await loadIndex();
  const sorted = [...list].sort((a, b) =>
    order === 'alpha' ? a.cle.localeCompare(b.cle, 'fr') : a.ordre - b.ordre || a.cle.localeCompare(b.cle, 'fr'),
  );

  const toggle = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Classement' },
    [
      ['alpha', 'Alphabétique'],
      ['chrono', 'Chronologique'],
    ].map(([id, label]) =>
      h(
        'button',
        {
          class: order === id ? 'on' : '',
          'aria-pressed': order === id ? 'true' : 'false',
          onclick: () => {
            order = id;
            go('/histoires');
          },
        },
        label,
      ),
    ),
  );

  const items = [];
  let group = null;
  for (const s of sorted) {
    if (order === 'chrono' && s.groupe !== group) {
      group = s.groupe;
      items.push(h('h3', { class: 'group-title' }, group));
    } else if (order === 'alpha') {
      const letter = s.cle[0].toUpperCase();
      if (letter !== group) {
        group = letter;
        items.push(h('h3', { class: 'group-title' }, letter));
      }
    }
    items.push(
      h(
        'a',
        { class: 'story-item', href: `#/histoires/${s.id}` },
        h('strong', null, s.nom),
        h('span', { class: 'muted small' }, s.periode),
        h('span', { class: 'story-sum' }, s.resume),
      ),
    );
  }

  const el = h(
    'div',
    { class: 'page' },
    h('div', { class: 'row between wrap' }, toggle, h('span', { class: 'muted small' }, `${list.length} personnages`)),
    h('div', { class: 'story-list' }, items),
  );
  return { title: 'Histoires', el };
}

export async function renderStory(route) {
  const s = await loadStory(route.id);
  const el = h(
    'article',
    { class: 'page story' },
    h('h2', { class: 'story-name' }, s.nom),
    h('p', { class: 'muted' }, s.periode),
    h('p', { class: 'story-lead' }, richText(s.resume)),

    h('h3', { class: 'section-title' }, 'Le récit biblique'),
    s.recit.map((p) => h('p', { class: 'story-p' }, richText(p))),

    s.contexte && s.contexte.length
      ? h(
          'aside',
          { class: 'context-box' },
          h('h3', null, 'Contexte historique'),
          h('p', { class: 'muted small' }, 'Éléments extérieurs au texte biblique, donnés à titre d’éclairage.'),
          s.contexte.map((p) => h('p', null, richText(p))),
        )
      : null,

    h('h3', { class: 'section-title' }, 'Chronologie'),
    h(
      'ol',
      { class: 'timeline' },
      s.chronologie.map((c) => h('li', null, h('span', null, richText(c.etape)), ' ', c.ref ? refLink(c.ref) : null)),
    ),

    s.references && s.references.length
      ? [
          h('h3', { class: 'section-title' }, 'Références principales'),
          h('ul', { class: 'ref-list' }, s.references.map((r) => h('li', null, refLink(r)))),
        ]
      : null,
  );
  return { title: s.nom, el };
}

