// Moteur de projection : dimensions, rendu d'une diapositive, mesure et découpage.
// L'aperçu et le plein écran utilisent exactement le même rendu (buildSlide),
// à la même taille logique ; l'aperçu est seulement réduit par une transformation CSS.

import { h } from '../ui.js';
import { paginate } from '../core/paginate.js';
import { formatRef } from '../core/reference.js';
import { VERSIONS } from '../core/versions.js';
import { getPassage } from '../core/bible.js';

export const COLORS = { jaune: '#FFD400', blanc: '#FFFFFF' };

/** Dimensions logiques de l'écran projeté (celles du plein écran). */
export function stageSize() {
  const landscape = window.innerWidth >= window.innerHeight;
  const a = screen.width || window.innerWidth;
  const b = screen.height || window.innerHeight;
  const W = landscape ? Math.max(a, b) : Math.min(a, b);
  const H = landscape ? Math.min(a, b) : Math.max(a, b);
  return { W, H };
}

export function metrics({ W, H }, scale = 1) {
  const pad = Math.round(Math.min(W, H) * 0.05);
  const label = Math.max(12, Math.round(Math.min(W, H) * 0.03));
  const base = Math.max(16, Math.round(Math.min(H * 0.085, W * 0.06) * scale));
  return { pad, label, base, min: 12 };
}

function textNodes(verses) {
  const out = [];
  verses.forEach((v, i) => {
    if (i) out.push(' ');
    out.push(h('sup', { class: 'pv' }, String(v.n)), ' ', v.t);
  });
  return out;
}

/** Diapositive complète, aux dimensions exactes W × H. */
export function buildSlide(slide, { W, H }, opts) {
  const m = metrics({ W, H }, opts.scale);
  return h(
    'div',
    {
      class: 'slide',
      style: {
        width: `${W}px`,
        height: `${H}px`,
        padding: `${m.pad}px`,
        color: COLORS[opts.color] || COLORS.jaune,
        '--label': `${m.label}px`,
      },
    },
    h('div', { class: 'slide-ref' }, slide ? slide.ref : ''),
    h('div', { class: 'slide-body' }, h('p', { class: 'slide-text', style: { fontSize: `${slide ? slide.size : m.base}px` } }, slide ? textNodes(slide.verses) : [])),
    h('div', { class: 'slide-version' }, slide ? VERSIONS[slide.version].label : ''),
  );
}

/** Crée une fonction fits(verses, size) mesurant dans un élément invisible de même gabarit. */
function createMeasurer(dims, opts) {
  const probe = buildSlide({ ref: 'X', verses: [], size: 10, version: 'FRLSG' }, dims, opts);
  const wrap = h('div', { class: 'measure', 'aria-hidden': 'true' }, probe);
  document.body.append(wrap);
  const body = probe.querySelector('.slide-body');
  const text = probe.querySelector('.slide-text');
  const fits = (verses, size) => {
    text.style.fontSize = `${size}px`;
    text.replaceChildren(...textNodes(verses));
    return text.scrollHeight <= body.clientHeight + 1 && text.scrollWidth <= body.clientWidth + 1;
  };
  return { fits, destroy: () => wrap.remove() };
}

/**
 * Charge les passages de la file et les découpe en diapositives.
 * @returns [{itemIndex, itemId, ref, verses, size, version}]
 */
export async function buildSlides(queue, version, dims, opts) {
  const m = metrics(dims, opts.scale);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const meas = createMeasurer(dims, opts);
  const slides = [];
  try {
    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      const ref = { book: it.b, chapter: it.c, vStart: it.vs, vEnd: it.ve };
      const { verses } = await getPassage(version, ref);
      if (!verses.length) {
        slides.push({ itemIndex: i, itemId: it.id, ref: formatRef(ref), verses: [{ n: it.vs || 1, t: 'Passage absent de cette version.' }], size: m.base, version });
        continue;
      }
      const pages = paginate(verses, meas.fits, { base: m.base, min: m.min });
      for (const p of pages) {
        const first = p.verses[0].n;
        const last = p.verses[p.verses.length - 1].n;
        slides.push({
          itemIndex: i,
          itemId: it.id,
          ref: formatRef({ book: it.b, chapter: it.c, vStart: first, vEnd: last }),
          verses: p.verses,
          size: p.size,
          version,
        });
      }
    }
  } finally {
    meas.destroy();
  }
  return slides;
}
