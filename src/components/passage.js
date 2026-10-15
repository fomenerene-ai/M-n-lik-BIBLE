// Affichage d'un passage avec marques personnelles et menu d'action par verset.
// Utilisé par la lecture et la recherche.
//
// Un appui sur un verset le sélectionne et ouvre le menu. Un appui sur un autre verset
// étend la sélection jusqu'à lui (suite de versets). Le bouton retour ferme le menu.

import { h, icon, toast, sheet, confirmDialog, copyText } from '../ui.js';
import { ICONS } from '../icons.js';
import { pushOverlay, popOverlay } from '../router.js';
import { formatRef } from '../core/reference.js';
import { VERSIONS } from '../core/versions.js';
import { colorAt } from '../core/ranges.js';
import {
  COLORS,
  highlightsOf,
  notesOf,
  bookmarksOf,
  setHighlight,
  saveNote,
  deleteNote,
  toggleBookmark,
  addToQueue,
} from '../core/userdata.js';

/**
 * @param o.book, o.chapter, o.version
 * @param o.verses      [{n, t}] versets de la version affichée
 * @param o.otherNums   numéros présents dans l'autre version (pour signaler un verset absent)
 * @param o.range       {vs, ve} facultatif : limiter l'affichage
 */
export function createPassage(o) {
  const { book: b, chapter: c, version } = o;
  const el = h('div', { class: 'passage', lang: 'fr' });
  let marks = { highlights: [], notes: [], bookmarks: [] };
  let sel = null; // {anchor, vs, ve}
  let bar = null;

  // Numéros à afficher : ceux de la version, plus ceux qui n'existent que dans l'autre.
  const present = new Map(o.verses.map((v) => [v.n, v.t]));
  let nums = new Set(present.keys());
  for (const n of o.otherNums || []) nums.add(n);
  nums = [...nums].sort((a, b2) => a - b2);
  if (o.range) nums = nums.filter((n) => n >= o.range.vs && n <= o.range.ve);

  async function loadMarks() {
    const [hl, nt, bk] = await Promise.all([highlightsOf(b, c), notesOf(b, c), bookmarksOf(b, c)]);
    marks = { highlights: hl, notes: nt, bookmarks: bk };
  }

  function draw() {
    const frag = [];
    for (const n of nums) {
      const t = present.get(n);
      if (t === undefined) {
        frag.push(
          h(
            'div',
            { class: 'verse missing', 'data-n': n },
            h('sup', { class: 'vn' }, String(n)),
            h('span', { class: 'vt' }, `Verset absent dans la ${VERSIONS[version].label}.`),
          ),
        );
        continue;
      }
      const color = colorAt(marks.highlights, n);
      const notes = marks.notes.filter((x) => x.vs === n);
      const bookmarked = marks.bookmarks.some((x) => x.v === n);
      const selected = sel && n >= sel.vs && n <= sel.ve;
      frag.push(
        h(
          'div',
          {
            class:
              'verse' + (color ? ` hl-${color}` : '') + (selected ? ' selected' : '') + (o.focus && n >= o.focus.vs && n <= o.focus.ve ? ' focus' : ''),
            'data-n': n,
            role: 'button',
            tabindex: '0',
            'aria-pressed': selected ? 'true' : 'false',
          },
          h('sup', { class: 'vn' }, String(n)),
          h('span', { class: 'vt' }, t),
          bookmarked ? icon(ICONS.bookmark, 'mark-ico') : null,
          notes.map((nt) =>
            h(
              'button',
              {
                class: 'note-btn',
                'aria-label': 'Voir la note',
                onclick: (e) => {
                  e.stopPropagation();
                  openNote(nt.vs, nt.ve, nt);
                },
              },
              icon(ICONS.note),
            ),
          ),
        ),
      );
    }
    el.replaceChildren(...frag);
  }

  function onTap(n) {
    if (!present.has(n)) return;
    if (!sel) sel = { anchor: n, vs: n, ve: n };
    else if (sel.vs === sel.ve && sel.vs === n) return clearSel();
    else if (n === sel.anchor) sel = { anchor: n, vs: n, ve: n };
    else sel = { anchor: sel.anchor, vs: Math.min(sel.anchor, n), ve: Math.max(sel.anchor, n) };
    if (o.focus) o.focus = null;
    draw();
    showBar();
  }

  el.addEventListener('click', (e) => {
    const v = e.target.closest('.verse');
    if (v) onTap(Number(v.dataset.n));
  });
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('verse')) {
      e.preventDefault();
      onTap(Number(e.target.dataset.n));
    }
  });

  const refOfSel = () => ({ book: b, chapter: c, vStart: sel.vs, vEnd: sel.ve });

  function selText() {
    const parts = [];
    for (let n = sel.vs; n <= sel.ve; n++) if (present.has(n)) parts.push(sel.vs === sel.ve ? present.get(n) : `${n} ${present.get(n)}`);
    return parts.join(' ');
  }

  const closeFromBack = () => {
    clearSel();
    return true;
  };

  function clearSel() {
    sel = null;
    if (bar) {
      bar.remove();
      bar = null;
      popOverlay(closeFromBack);
    }
    draw();
  }

  function showBar() {
    const label = h('strong', null, formatRef(refOfSel()));
    const content = h(
      'div',
      { class: 'action-inner' },
      h(
        'div',
        { class: 'action-head' },
        label,
        h('span', { class: 'muted small' }, 'Touchez un autre verset pour étendre'),
        h('button', { class: 'btn-icon', 'aria-label': 'Fermer le menu', onclick: () => clearSel() }, '×'),
      ),
      h(
        'div',
        { class: 'action-row' },
        COLORS.map((col) =>
          h('button', {
            class: `swatch hl-${col.id}`,
            'aria-label': `Surligner en ${col.label.toLowerCase()}`,
            title: col.label,
            onclick: async () => {
              await setHighlight(b, c, sel.vs, sel.ve, col.id);
              await refresh();
              clearSel();
            },
          }),
        ),
        h(
          'button',
          {
            class: 'btn small',
            onclick: async () => {
              await setHighlight(b, c, sel.vs, sel.ve, null);
              await refresh();
              clearSel();
            },
          },
          'Retirer',
        ),
      ),
      h(
        'div',
        { class: 'action-row' },
        actionBtn(ICONS.note, 'Note', () => {
          const existing = marks.notes.find((x) => x.vs === sel.vs && x.ve === sel.ve);
          openNote(sel.vs, sel.ve, existing);
        }),
        actionBtn(ICONS.bookmark, 'Favori', async () => {
          const added = await toggleBookmark(b, c, sel.vs);
          toast(added ? 'Ajouté aux favoris' : 'Retiré des favoris');
          await refresh();
          clearSel();
        }),
        actionBtn(ICONS.copy, 'Copier', async () => {
          const txt = `${formatRef(refOfSel())} (${VERSIONS[version].short})\n${selText()}`;
          toast((await copyText(txt)) ? 'Copié' : 'Copie impossible');
          clearSel();
        }),
        actionBtn(ICONS.projection, 'Projection', async () => {
          await addToQueue(refOfSel());
          toast('Ajouté à la projection');
          clearSel();
        }),
      ),
    );
    if (!bar) {
      bar = h('div', { class: 'action-bar', role: 'toolbar', 'aria-label': 'Actions sur le verset' });
      document.body.append(bar);
      pushOverlay(closeFromBack);
    }
    bar.replaceChildren(content);
  }

  function openNote(vs, ve, existing) {
    const ta = h('textarea', { class: 'note-text', rows: '6', 'aria-label': 'Texte de la note' });
    ta.value = existing ? existing.text : '';
    const s = sheet(
      `Note · ${formatRef({ book: b, chapter: c, vStart: vs, vEnd: ve })}`,
      h(
        'div',
        { class: 'sheet-body' },
        ta,
        h(
          'div',
          { class: 'row end' },
          existing
            ? h(
                'button',
                {
                  class: 'btn danger',
                  onclick: async () => {
                    if (!(await confirmDialog('Supprimer cette note ?', 'Supprimer'))) return;
                    await deleteNote(existing.id);
                    s.close();
                    await refresh();
                    toast('Note supprimée');
                  },
                },
                'Supprimer',
              )
            : null,
          h(
            'button',
            {
              class: 'btn primary',
              onclick: async () => {
                if (!ta.value.trim()) {
                  if (existing) await deleteNote(existing.id);
                } else {
                  await saveNote({ id: existing && existing.id, b, c, vs, ve, text: ta.value });
                }
                s.close();
                await refresh();
                toast('Note enregistrée');
              },
            },
            'Enregistrer',
          ),
        ),
      ),
    );
    if (sel) clearSel();
  }

  async function refresh() {
    await loadMarks();
    draw();
  }

  function destroy() {
    if (bar) {
      bar.remove();
      bar = null;
      popOverlay(closeFromBack);
    }
  }

  return { el, refresh, destroy, select: (vs, ve) => ((sel = { anchor: vs, vs, ve }), draw(), showBar()) };
}

function actionBtn(svg, label, onclick) {
  return h('button', { class: 'btn action', onclick }, icon(svg), h('span', null, label));
}
