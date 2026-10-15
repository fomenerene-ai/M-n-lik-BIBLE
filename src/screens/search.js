// Recherche par référence (pas de recherche par mot-clé, choix de l'utilisateur).

import { h, icon, toast, sheet } from '../ui.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import { parseReference, formatRef, EXAMPLE } from '../core/reference.js';
import { VERSIONS, otherVersion } from '../core/versions.js';
import { getChapter } from '../core/bible.js';
import { settings, setSetting, addToQueue, toggleBookmark, setHighlight, COLORS } from '../core/userdata.js';
import { createPassage } from '../components/passage.js';
import { createRefInput } from '../components/refinput.js';

export async function renderSearch(route) {
  const q = route.q || '';
  const result = h('section', { class: 'search-result', 'aria-live': 'polite' });
  let passage = null;

  const refInput = createRefInput({
    value: q,
    onSubmit: (val) => {
      const s = val.trim();
      if (!s) return;
      go('/recherche/' + encodeURIComponent(s));
    },
  });

  if (q) {
    const r = parseReference(q);
    if (!r.ok) {
      result.append(h('p', { class: 'error' }, r.error));
    } else if (!r.chapter) {
      // Livre seul : on ouvre sa grille de chapitres
      queueMicrotask(() => go(`/l/${settings().version}/${r.book}`));
    } else {
      passage = await showPassage(result, r);
      refInput.input.value = formatRef(r);
    }
  }

  const el = h(
    'div',
    { class: 'page search' },
    refInput.el,
    h('p', { class: 'muted small' }, `Noms complets des livres. Exemples : ${EXAMPLE}, 1 Jean 2:1-5, Psaumes 23.`),
    result,
  );
  return {
    title: 'Recherche',
    el,
    cleanup: () => passage && passage.destroy(),
    afterMount: () => {
      if (!q) refInput.input.focus();
    },
  };
}

async function showPassage(container, ref) {
  const version = settings().version;
  const [all, other] = await Promise.all([
    getChapter(version, ref.book, ref.chapter),
    getChapter(otherVersion(version), ref.book, ref.chapter),
  ]);
  const vs = ref.vStart || 1;
  const last = Math.max(all.length ? all[all.length - 1].n : 0, other.length ? other[other.length - 1].n : 0);
  const ve = ref.vStart ? Math.min(ref.vEnd, last) : last;
  const inRange = all.filter((v) => v.n >= vs && v.n <= ve);
  if (ref.vStart && ref.vStart > last) {
    container.append(h('p', { class: 'error' }, `${formatRef(ref)} n’existe pas. Exemple : ${EXAMPLE}.`));
    return null;
  }

  const passage = createPassage({
    book: ref.book,
    chapter: ref.chapter,
    version,
    verses: all,
    otherNums: other.map((v) => v.n),
    range: { vs, ve },
  });
  await passage.refresh();

  const fullRef = { ...ref, vStart: ref.vStart ? vs : null, vEnd: ref.vStart ? ve : null };
  const versionSwitch = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Version' },
    Object.values(VERSIONS).map((v) =>
      h(
        'button',
        {
          class: v.id === version ? 'on' : '',
          'aria-pressed': v.id === version ? 'true' : 'false',
          onclick: async () => {
            if (v.id === version) return;
            await setSetting('version', v.id);
            go('/recherche/' + encodeURIComponent(formatRef(ref)));
          },
        },
        v.short,
      ),
    ),
  );

  const actions = h(
    'div',
    { class: 'row wrap' },
    h(
      'button',
      {
        class: 'btn',
        onclick: async () => {
          await addToQueue(fullRef);
          toast('Ajouté à la projection');
        },
      },
      icon(ICONS.projection),
      'Projeter',
    ),
    h(
      'button',
      {
        class: 'btn',
        onclick: () => {
          const s = sheet(
            'Surligner le passage',
            h(
              'div',
              { class: 'sheet-body row wrap' },
              COLORS.map((c) =>
                h('button', {
                  class: `swatch big hl-${c.id}`,
                  'aria-label': c.label,
                  onclick: async () => {
                    await setHighlight(ref.book, ref.chapter, vs, ve, c.id);
                    s.close();
                    await passage.refresh();
                    toast('Passage surligné');
                  },
                }),
              ),
              h(
                'button',
                {
                  class: 'btn',
                  onclick: async () => {
                    await setHighlight(ref.book, ref.chapter, vs, ve, null);
                    s.close();
                    await passage.refresh();
                  },
                },
                'Retirer',
              ),
            ),
          );
        },
      },
      icon(ICONS.marker),
      'Surligner',
    ),
    h(
      'button',
      {
        class: 'btn',
        onclick: async () => {
          const added = await toggleBookmark(ref.book, ref.chapter, ref.vStart ? vs : null);
          toast(added ? 'Ajouté aux favoris' : 'Retiré des favoris');
          await passage.refresh();
        },
      },
      icon(ICONS.bookmark),
      'Favori',
    ),
    h(
      'a',
      { class: 'btn', href: `#/l/${version}/${ref.book}/${ref.chapter}${ref.vStart ? `/${vs}-${ve}` : ''}` },
      'Ouvrir dans la lecture',
    ),
  );

  container.replaceChildren(
    h(
      'div',
      { class: 'result-head' },
      h('h2', { class: 'chapter-title' }, formatRef(fullRef)),
      h('span', { class: 'muted' }, VERSIONS[version].label),
      versionSwitch,
    ),
    inRange.length ? passage.el : h('p', { class: 'error' }, 'Passage absent de cette version.'),
    actions,
  );
  return passage;
}
