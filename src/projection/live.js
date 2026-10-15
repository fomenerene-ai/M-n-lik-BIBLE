// Mode projection plein écran : aucune interface, aucune animation.
//
// Gestes : balayage gauche/droite = diapositive suivante/précédente,
//          balayage haut/bas = texte plus grand/plus petit,
//          double appui = écran noir (puis retour), appui long = quitter.
// Clavier / télécommande : flèches, Page suivante/précédente, Espace,
//          B ou « . » = écran noir, + / - = taille, Échap = quitter.

import { h } from '../ui.js';
import { pushOverlay, popOverlay } from '../router.js';
import { buildSlide, buildSlides } from './projector.js';
import { slideIndexOfVerse } from '../core/paginate.js';

const SCALE_STEP = 0.1;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;

/**
 * @param o.queue, o.version, o.color, o.scale
 * @param o.startAt        {itemIndex, verse} : diapositive de départ
 * @param o.onScale(scale)  appelé quand la taille change en direct
 * @param o.onClose(index)  index de la diapositive affichée à la sortie
 */
export async function startLive(o) {
  let scale = o.scale;
  let slides = [];
  let index = 0;
  let black = false;
  let wakeLock = null;
  let closed = false;

  const stage = h('div', { class: 'live-stage' });
  const blackout = h('div', { class: 'live-black', hidden: true });
  const root = h('div', { class: 'live', role: 'presentation' }, stage, blackout);
  document.body.append(root);
  document.documentElement.classList.add('live-on');

  // Plein écran : demandé immédiatement (geste de l'utilisateur encore actif)
  try {
    await root.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* le mode standalone de la PWA suffit si le plein écran est refusé */
  }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock(screen.orientation.type).catch(() => {});
  } catch {
    /* sans effet */
  }

  const dims = () => ({ W: window.innerWidth, H: window.innerHeight });

  /** Recalcule les diapositives en restant sur le même verset (anchor = {itemIndex, verse}). */
  async function layout(anchor) {
    const cur = slides[index];
    const a = anchor || (cur && { itemIndex: cur.itemIndex, verse: cur.verses[0].n });
    slides = await buildSlides(o.queue, o.version, dims(), { color: o.color, scale });
    if (a) {
      const same = slides.map((sl, i) => [sl, i]).filter(([sl]) => sl.itemIndex === a.itemIndex);
      if (same.length) index = same[slideIndexOfVerse(same.map(([sl]) => sl), a.verse)][1];
    }
    index = Math.max(0, Math.min(index, slides.length - 1));
    show();
  }

  function show() {
    stage.replaceChildren(buildSlide(slides[index], dims(), { color: o.color, scale }));
  }

  const next = () => {
    if (index < slides.length - 1) {
      index++;
      show();
    }
  };
  const prev = () => {
    if (index > 0) {
      index--;
      show();
    }
  };
  const toggleBlack = () => {
    black = !black;
    blackout.hidden = !black;
  };
  const resize = async (d) => {
    const s = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale + d)) * 10) / 10;
    if (s === scale) return;
    scale = s;
    o.onScale && o.onScale(scale);
    await layout();
  };

  /* ---------- Écran allumé ---------- */
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }
  const onVisible = () => document.visibilityState === 'visible' && !closed && lockScreen();
  document.addEventListener('visibilitychange', onVisible);
  lockScreen();

  /* ---------- Gestes ---------- */
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let moved = false;
  let longTimer = null;
  let lastTap = 0;

  const onStart = (e) => {
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = Date.now();
    moved = false;
    clearTimeout(longTimer);
    longTimer = setTimeout(() => {
      if (!moved) close();
    }, 800);
  };
  const onMove = (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - x0) > 12 || Math.abs(t.clientY - y0) > 12) {
      moved = true;
      clearTimeout(longTimer);
    }
    e.preventDefault();
  };
  const onEnd = (e) => {
    clearTimeout(longTimer);
    if (closed) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    const dt = Date.now() - t0;
    if (moved) {
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (black) toggleBlack();
        dx < 0 ? next() : prev();
      } else if (Math.abs(dy) > 50) {
        resize(dy < 0 ? SCALE_STEP : -SCALE_STEP);
      }
      return;
    }
    if (dt > 600) return;
    const now = Date.now();
    if (now - lastTap < 350) {
      lastTap = 0;
      toggleBlack();
    } else {
      lastTap = now;
    }
    e.preventDefault();
  };
  root.addEventListener('touchstart', onStart, { passive: true });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onEnd, { passive: false });
  // Souris : double clic = écran noir
  root.addEventListener('dblclick', toggleBlack);

  const onKey = (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'Enter':
        if (black) toggleBlack();
        next();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        if (black) toggleBlack();
        prev();
        break;
      case 'b':
      case 'B':
      case '.':
        toggleBlack();
        break;
      case '+':
      case '=':
        resize(SCALE_STEP);
        break;
      case '-':
        resize(-SCALE_STEP);
        break;
      case 'Escape':
        close();
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);

  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => !closed && layout(), 150);
  };
  window.addEventListener('resize', onResize);

  const onFs = () => {
    if (!document.fullscreenElement && !closed) close();
  };
  document.addEventListener('fullscreenchange', onFs);

  const closeFromBack = () => {
    close();
    return true;
  };
  pushOverlay(closeFromBack);

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(longTimer);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('fullscreenchange', onFs);
    window.removeEventListener('resize', onResize);
    popOverlay(closeFromBack);
    if (wakeLock) wakeLock.release().catch(() => {});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (screen.orientation && screen.orientation.unlock) {
      try {
        screen.orientation.unlock();
      } catch {
        /* sans effet */
      }
    }
    root.remove();
    document.documentElement.classList.remove('live-on');
    o.onClose && o.onClose(index, slides[index]);
  }

  // attendre la mise en plein écran avant de mesurer
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await layout(o.startAt);
  return { close };
}
