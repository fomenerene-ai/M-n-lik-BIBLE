// Écran de contrôle de la projection : file d'attente, aperçu privé, lancement.

import { h, icon, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import { parseReference, formatRef } from '../core/reference.js';
import { VERSIONS } from '../core/versions.js';
import { settings, setSetting, getQueue, addToQueue, removeFromQueue, clearQueue } from '../core/userdata.js';
import { createRefInput } from '../components/refinput.js';
import { buildSlide, buildSlides, stageSize } from '../projection/projector.js';
import { startLive } from '../projection/live.js';

let current = 0; // diapositive affichée dans l'aperçu (conservée pendant la session)

export async function renderProjection() {
  const s = settings();
  const queue = await getQueue();
  const dims = stageSize();
  const opts = { color: s.projColor, scale: s.projScale };
  const slides = queue.length ? await buildSlides(queue, s.projVersion, dims, opts) : [];
  current = Math.max(0, Math.min(current, slides.length - 1));

  const refresh = () => go('/projection');

  /* ---------- Saisie ---------- */
  const msg = h('p', { class: 'error', role: 'alert' });
  const refInput = createRefInput({
    buttonLabel: 'Ajouter',
    onSubmit: async (val) => {
      const r = parseReference(val);
      if (!r.ok) return (msg.textContent = r.error);
      if (!r.chapter) return (msg.textContent = 'Précisez au moins un chapitre, par exemple Jean 3.');
      await addToQueue(r);
      toast(`${formatRef(r)} ajouté`);
      refresh();
    },
  });

  /* ---------- Réglages de projection ---------- */
  const seg = (label, key, options) =>
    h(
      'div',
      { class: 'segmented', role: 'group', 'aria-label': label },
      options.map(([id, text]) =>
        h(
          'button',
          {
            class: s[key] === id ? 'on' : '',
            'aria-pressed': s[key] === id ? 'true' : 'false',
            onclick: async () => {
              await setSetting(key, id);
              refresh();
            },
          },
          text,
        ),
      ),
    );
  const controls = h(
    'div',
    { class: 'row wrap' },
    seg('Version projetée', 'projVersion', Object.values(VERSIONS).map((v) => [v.id, v.label])),
    seg('Couleur du texte', 'projColor', [
      ['jaune', 'Texte jaune'],
      ['blanc', 'Texte blanc'],
    ]),
  );

  /* ---------- File d'attente ---------- */
  const firstSlideOf = (i) => slides.findIndex((sl) => sl.itemIndex === i);
  const curItem = slides[current] ? slides[current].itemIndex : -1;
  const queueEl = h(
    'ol',
    { class: 'queue' },
    queue.map((it, i) =>
      h(
        'li',
        { class: 'queue-item' + (i === curItem ? ' on' : '') },
        h(
          'button',
          {
            class: 'queue-open',
            'aria-current': i === curItem ? 'true' : null,
            onclick: () => {
              current = Math.max(0, firstSlideOf(i));
              refresh();
            },
          },
          formatRef({ book: it.b, chapter: it.c, vStart: it.vs, vEnd: it.ve }),
        ),
        h(
          'button',
          {
            class: 'btn-icon',
            'aria-label': 'Retirer de la file',
            onclick: async () => {
              await removeFromQueue(it.id);
              refresh();
            },
          },
          icon(ICONS.trash),
        ),
      ),
    ),
  );

  /* ---------- Aperçu ---------- */
  const preview = h('div', { class: 'preview', style: { aspectRatio: `${dims.W} / ${dims.H}` } });
  const fitPreview = () => {
    const slideEl = buildSlide(slides[current], dims, opts);
    const scale = preview.clientWidth / dims.W || 0.3;
    slideEl.style.transform = `scale(${scale})`;
    slideEl.style.transformOrigin = 'top left';
    preview.replaceChildren(slideEl);
  };
  const counter = h(
    'span',
    { class: 'muted' },
    slides.length ? `Diapositive ${current + 1} / ${slides.length}` : 'File vide',
  );
  const step = (d) => {
    const n = current + d;
    if (n < 0 || n >= slides.length) return;
    current = n;
    refresh();
  };

  const launch = h(
    'button',
    {
      class: 'btn primary big',
      disabled: slides.length ? null : true,
      onclick: () => {
        const sl = slides[current];
        startLive({
          queue,
          version: s.projVersion,
          color: s.projColor,
          scale: s.projScale,
          startAt: sl ? { itemIndex: sl.itemIndex, verse: sl.verses[0].n } : null,
          onScale: (v) => setSetting('projScale', v),
          onClose: (_i, sl2) => {
            if (sl2) current = Math.max(0, slides.findIndex((x) => x.itemIndex === sl2.itemIndex && x.verses.some((v) => v.n === sl2.verses[0].n)));
            refresh();
          },
        });
      },
    },
    icon(ICONS.play),
    'Projeter',
  );

  const el = h(
    'div',
    { class: 'page projection' },
    h(
      'div',
      { class: 'proj-grid' },
      h(
        'section',
        { class: 'proj-left' },
        h('h2', { class: 'section-title' }, 'File d’attente'),
        refInput.el,
        msg,
        queue.length ? queueEl : h('p', { class: 'muted' }, 'Ajoutez des passages ici, ou depuis la recherche, la lecture et les favoris.'),
        queue.length
          ? h(
              'button',
              {
                class: 'btn small',
                onclick: async () => {
                  await clearQueue();
                  current = 0;
                  refresh();
                },
              },
              'Vider la file',
            )
          : null,
      ),
      h(
        'section',
        { class: 'proj-right' },
        h('h2', { class: 'section-title' }, 'Aperçu privé'),
        controls,
        preview,
        h(
          'div',
          { class: 'row between' },
          h('button', { class: 'btn', 'aria-label': 'Diapositive précédente', onclick: () => step(-1) }, icon(ICONS.prev)),
          counter,
          h('button', { class: 'btn', 'aria-label': 'Diapositive suivante', onclick: () => step(1) }, icon(ICONS.next)),
        ),
        launch,
        h(
          'details',
          { class: 'help' },
          h('summary', null, 'Commandes pendant la projection'),
          h(
            'ul',
            null,
            h('li', null, 'Balayer à gauche ou à droite : diapositive suivante ou précédente.'),
            h('li', null, 'Balayer vers le haut ou le bas : texte plus grand ou plus petit.'),
            h('li', null, 'Double appui : écran noir, puis retour.'),
            h('li', null, 'Appui long : quitter la projection.'),
            h('li', null, 'Clavier : flèches, Page suivante/précédente, B ou « . » pour l’écran noir, Échap pour quitter.'),
          ),
        ),
      ),
    ),
  );

  const onResize = () => fitPreview();
  window.addEventListener('resize', onResize);
  return {
    title: 'Projection',
    el,
    afterMount: fitPreview,
    cleanup: () => window.removeEventListener('resize', onResize),
  };
}
