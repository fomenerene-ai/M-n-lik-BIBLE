/**
 * Bootstrap: sidebar, router, screen lifecycle, service worker.
 */
import { APP_NAME } from './config.js';
import { h, replace } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { startRouter, go, hrefFor, parseHash } from './router.js';
import { registerServiceWorker } from './sw-register.js';
import { requestPersistence } from './state/db.js';
import { getSettings } from './state/settings.js';

/** Route name to lazy screen module. */
const SCREENS = {
  today: () => import('./screens/today.js'),
  progress: () => import('./screens/progress.js'),
  cards: () => import('./screens/cards.js'),
  talk: () => import('./screens/talk.js'),
  listen: () => import('./screens/listen.js'),
  dictation: () => import('./screens/dictation.js'),
  report: () => import('./screens/report.js'),
  welcome: () => import('./screens/welcome.js'),
  settings: () => import('./screens/settings.js'),
};

const NAV_TOP = [
  { name: 'today', label: 'Today', icon: 'home' },
  { name: 'listen', label: 'Listen', icon: 'headphones' },
  { name: 'talk', label: 'Talk', icon: 'mic' },
  { name: 'shadow', label: 'Shadow', icon: 'wave' },
  { name: 'cards', label: 'Cards', icon: 'cards' },
  { name: 'progress', label: 'Progress', icon: 'chart' },
];
const NAV_BOTTOM = [
  { name: 'readaloud', label: 'Read aloud', icon: 'book' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

const appEl = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');
let cleanup = null;
let renderToken = 0;

/** Context passed to every screen. */
const ctx = {
  go,
  /** Renders the current route again. */
  refresh() { onRoute(parseHash(location.hash)); },
  /** Hides the sidebar for immersive screens (conversation). */
  setFocusMode(on) { appEl.classList.toggle('focus-mode', !!on); },
};

function navLink(item, current) {
  return h('a.nav-item', { href: hrefFor(item.name), 'aria-current': item.name === current ? 'page' : null }, icon(item.icon), item.label);
}

function renderSidebar(current) {
  replace(sidebar,
    h('div.wordmark', null, APP_NAME),
    ...NAV_TOP.map((i) => navLink(i, current)),
    h('div.nav-spacer'),
    ...NAV_BOTTOM.map((i) => navLink(i, current)));
}

async function onRoute(route) {
  const token = ++renderToken;
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  ctx.setFocusMode(false);
  const loader = SCREENS[route.name];
  const navName = route.name === 'report' ? 'progress' : route.name === 'dictation' || route.name === 'placement' ? 'today' : route.name;
  renderSidebar(navName);
  if (!loader) { go('today'); return; }
  const mod = await loader();
  if (token !== renderToken) return;
  const root = h('div.screen');
  replace(main, root);
  main.scrollTop = 0;
  const result = await mod.render(root, route, ctx);
  if (token !== renderToken) { if (typeof result === 'function') result(); return; }
  cleanup = typeof result === 'function' ? result : null;
  const heading = root.querySelector('h1');
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
}

let onboarded = false;

async function boot() {
  document.title = APP_NAME;
  try { onboarded = !!(await getSettings()).onboardedAt; } catch (e) { console.error(e); onboarded = true; }
  startRouter((route) => {
    if (!onboarded && route.name !== 'welcome') {
      getSettings().then((s) => {
        onboarded = !!s.onboardedAt;
        if (onboarded) onRoute(route); else go('welcome');
      });
      return;
    }
    onRoute(route);
  });
}

boot();
registerServiceWorker();
requestPersistence();
