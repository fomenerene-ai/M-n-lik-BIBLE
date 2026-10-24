// Petites aides d'interface : construction DOM, notifications, feuilles modales.

import { pushOverlay, popOverlay } from './router.js';

/** h('div', {class: 'x', onclick: fn}, 'texte', enfant...) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // réservé aux icônes SVG internes
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function icon(svg, cls = 'ico') {
  return h('span', { class: cls, 'aria-hidden': 'true', html: svg });
}

/* ---------- Notification brève ---------- */

let toastTimer = null;
export function toast(msg, ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- Feuille modale (fermée par le bouton retour d'Android) ---------- */

export function sheet(title, content, { onClose } = {}) {
  const opener = document.activeElement; // pour rendre le focus à la fermeture
  const titleId = `sheet-title-${Date.now()}`;
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    popOverlay(closeFromBack);
    onClose && onClose();
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  };
  const closeFromBack = () => {
    close();
    return true;
  };
  const dialog = h(
    'div',
    { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'sheet-head' },
      h('h2', { id: titleId }, title),
      h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Fermer', onclick: () => close() }, '×'),
    ),
    content,
  );
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => e.target === wrap && close() }, dialog);

  // Échap ferme ; Tab reste à l'intérieur de la feuille
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
      (x) => !x.disabled && x.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  document.body.append(wrap);
  pushOverlay(closeFromBack);
  const focusable = wrap.querySelector('textarea, input, .sheet-body button');
  (focusable || dialog.querySelector('.btn-icon')).focus();
  return { close, el: wrap };
}

export function confirmDialog(message, okLabel = 'Confirmer') {
  return new Promise((resolve) => {
    let answered = false;
    const s = sheet(
      'Confirmation',
      h(
        'div',
        { class: 'sheet-body' },
        h('p', null, message),
        h(
          'div',
          { class: 'row end' },
          h('button', { class: 'btn', onclick: () => ((answered = true), s.close(), resolve(false)) }, 'Annuler'),
          h(
            'button',
            { class: 'btn primary', onclick: () => ((answered = true), s.close(), resolve(true)) },
            okLabel,
          ),
        ),
      ),
      { onClose: () => !answered && resolve(false) },
    );
  });
}

export function prefersReducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Copie dans le presse-papiers, avec repli. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Détection de balayage horizontal / vertical sur un élément. */
export function onSwipe(el, handler, { threshold = 60, ignore } = {}) {
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let active = false;
  el.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1 || (ignore && ignore(e))) return (active = false);
      active = true;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    },
    { passive: true },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Date.now() - t0 > 800) return;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) handler(dx < 0 ? 'left' : 'right');
      else if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx) * 1.5) handler(dy < 0 ? 'up' : 'down');
    },
    { passive: true },
  );
}
