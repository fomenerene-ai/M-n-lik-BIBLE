// Point d'entrée : réglages, écran de préparation, routage, service worker.

import './styles/fonts.css';
import './styles/base.css';

import { h, icon } from './ui.js';
import { ICONS } from './icons.js';
import { startRouter, parse, back } from './router.js';
import { loadSettings } from './core/userdata.js';
import { allReady } from './core/importer.js';
import { registerSW } from './sw-register.js';
import { applyTheme } from './theme.js';

import { renderHome } from './screens/home.js';
import { renderSetup } from './screens/setup.js';
import { renderVersion } from './screens/version.js';
import { renderBooks } from './screens/books.js';
import { renderChapters } from './screens/chapters.js';
import { renderReader } from './screens/reader.js';
import { renderSearch } from './screens/search.js';
import { renderFavorites } from './screens/favorites.js';
import { renderStories, renderStory } from './screens/stories.js';
import { renderProjection } from './screens/projection.js';
import { renderSettings } from './screens/settings.js';

const SCREENS = {
  home: renderHome,
  version: renderVersion,
  books: renderBooks,
  chapters: renderChapters,
  reader: renderReader,
  search: renderSearch,
  favorites: renderFavorites,
  stories: renderStories,
  story: renderStory,
  projection: renderProjection,
  settings: renderSettings,
};

/* ---------- Enveloppe : bandeau + zone principale ---------- */

const titleEl = h('h1', { class: 'top-title' });
const subEl = h('p', { class: 'top-sub' }, 'Bible en français');
const backBtn = h(
  'button',
  { class: 'top-back', 'aria-label': 'Retour', onclick: () => back() },
  icon(ICONS.back),
);
const actionsEl = h('div', { class: 'top-actions' });
const topbar = h(
  'header',
  { class: 'topbar' },
  backBtn,
  h('div', { class: 'top-titles' }, titleEl, subEl),
  actionsEl,
);
const view = h('main', { id: 'view', tabindex: '-1' });

let cleanup = null;
let token = 0;

async function render(path) {
  const my = ++token;
  const route = parse(path);
  const screen = SCREENS[route.name] || renderHome;
  let res;
  try {
    res = await screen(route);
  } catch (err) {
    console.warn(err);
    res = {
      title: 'Erreur',
      el: h('div', { class: 'page' }, h('p', { class: 'error' }, String(err.message || err))),
    };
  }
  if (my !== token) {
    res.cleanup && res.cleanup();
    return;
  }
  if (cleanup) cleanup();
  cleanup = res.cleanup || null;
  titleEl.textContent = res.title || 'Ménélik Bible';
  document.title = res.title && route.name !== 'home' ? `${res.title} · Ménélik Bible` : 'Ménélik Bible';
  backBtn.hidden = route.name === 'home';
  actionsEl.replaceChildren(...(res.actions || []));
  view.replaceChildren(res.el);
  view.dataset.screen = route.name;
  window.scrollTo(0, 0);
  if (res.afterMount) res.afterMount();
}

async function boot() {
  await loadSettings();
  applyTheme();
  document.body.append(topbar, view);

  // Stockage persistant : évite que le navigateur efface les données sans prévenir.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
  }

  registerSW();

  if (!(await allReady())) {
    backBtn.hidden = true;
    titleEl.textContent = 'Préparation';
    const res = await renderSetup(() => startRouter(render));
    view.replaceChildren(res.el);
    return;
  }
  startRouter(render);
}

boot();
