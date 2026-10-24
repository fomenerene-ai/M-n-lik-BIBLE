// Lecture d'un chapitre : navigation continue, sélecteur de version, taille du texte.

import { h, icon, toast, onSwipe, prefersReducedMotion } from '../ui.js';
import { ICONS } from '../icons.js';
import { go } from '../router.js';
import { getBook } from '../core/books.js';
import { VERSIONS, otherVersion } from '../core/versions.js';
import { getChapter } from '../core/bible.js';
import { nextChapter, prevChapter, nextBook, prevBook } from '../core/navigation.js';
import { settings, setSetting, bookmarksOf, toggleBookmark } from '../core/userdata.js';
import { applyTheme } from '../theme.js';
import { createPassage } from '../components/passage.js';
import { createPlayer } from '../components/player.js';
import { chapterSegments, requestContinue, takeContinue } from '../core/speech.js';

export const FONT_MIN = 14;
export const FONT_MAX = 40;

const path = (v, t) => (t ? `/l/${v}/${t.book}/${t.chapter}` : null);

export async function renderReader(route) {
  const book = getBook(route.book);
  if (!book || route.chapter < 1 || route.chapter > book.chapters) throw new Error('Chapitre introuvable.');
  const version = VERSIONS[route.version] ? route.version : settings().version;
  const { chapter } = route;

  const [verses, other] = await Promise.all([
    getChapter(version, book.id, chapter),
    getChapter(otherVersion(version), book.id, chapter),
  ]);

  let focus = null;
  if (route.verse) {
    const [a, z] = String(route.verse).split('-').map(Number);
    if (a) focus = { vs: a, ve: z || a };
  }

  const passage = createPassage({
    book: book.id,
    chapter,
    version,
    verses,
    otherNums: other.map((v) => v.n),
    focus,
  });
  await passage.refresh();

  const targets = {
    prevBook: prevBook(book.id),
    prev: prevChapter(book.id, chapter),
    next: nextChapter(book.id, chapter),
    nextBook: nextBook(book.id),
  };

  const navBar = () =>
    h(
      'nav',
      { class: 'chapter-nav', 'aria-label': 'Navigation entre chapitres' },
      navBtn(ICONS.prevBook, 'Livre précédent', path(version, targets.prevBook)),
      navBtn(ICONS.prev, 'Chapitre précédent', path(version, targets.prev)),
      navBtn(ICONS.next, 'Chapitre suivant', path(version, targets.next), true),
      navBtn(ICONS.nextBook, 'Livre suivant', path(version, targets.nextBook), true),
    );

  // Sélecteur de version
  const versionSwitch = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Version' },
    Object.values(VERSIONS).map((v) =>
      h(
        'button',
        {
          class: v.id === version ? 'on' : '',
          'aria-pressed': v.id === version ? 'true' : 'false',
          title: v.label,
          onclick: async () => {
            if (v.id === version) return;
            await setSetting('version', v.id);
            go(`/l/${v.id}/${book.id}/${chapter}`);
          },
        },
        v.short,
      ),
    ),
  );

  // Taille du texte
  const setSize = async (d) => {
    const s = Math.min(FONT_MAX, Math.max(FONT_MIN, settings().fontSize + d));
    await setSetting('fontSize', s);
    applyTheme();
  };
  const sizeCtl = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Taille du texte' },
    h('button', { 'aria-label': 'A−, réduire le texte', title: 'Réduire le texte', onclick: () => setSize(-2) }, 'A−'),
    h('button', { 'aria-label': 'A+, agrandir le texte', title: 'Agrandir le texte', class: 'big-a', onclick: () => setSize(2) }, 'A+'),
  );

  // Marque-page du chapitre
  const chapMarked = async () => (await bookmarksOf(book.id, chapter)).some((x) => x.v == null);
  const bmBtn = h('button', { class: 'btn-icon bm', 'aria-label': 'Marque-page du chapitre' }, icon(ICONS.bookmark));
  const syncBm = async () => {
    const on = await chapMarked();
    bmBtn.classList.toggle('on', on);
    bmBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  bmBtn.addEventListener('click', async () => {
    const added = await toggleBookmark(book.id, chapter, null);
    toast(added ? 'Chapitre ajouté aux favoris' : 'Marque-page retiré');
    syncBm();
  });
  await syncBm();

  // Lecture vocale : suit le verset lu, puis enchaîne sur le chapitre suivant
  const player = createPlayer({
    title: `${book.name} ${chapter}`,
    segments: chapterSegments(book.name, chapter, verses),
    label: (i, seg) => (seg.n ? `${book.name} ${chapter}:${seg.n}` : `${book.name} ${chapter}`),
    onSegment: (i, seg) => {
      const v = passage.speaking(seg.n);
      if (v) v.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    onEnd: () => {
      passage.speaking(null);
      if (targets.next) {
        requestContinue();
        go(path(version, targets.next));
      } else toast('Fin de la Bible');
    },
    onStop: () => passage.speaking(null),
  });
  const listenBtn = h(
    'button',
    { class: 'btn-icon', 'aria-label': 'Écouter le chapitre', title: 'Écouter le chapitre', onclick: () => player.start() },
    icon(ICONS.listen),
  );
  const autoplay = takeContinue();

  const article = h(
    'article',
    { class: 'reader' },
    h('h2', { class: 'chapter-title' }, `${book.name} ${chapter}`),
    verses.length ? passage.el : h('p', { class: 'error' }, 'Ce chapitre est absent de cette version.'),
  );

  const el = h(
    'div',
    { class: 'page reading' },
    h('div', { class: 'reader-tools' }, versionSwitch, sizeCtl, listenBtn, bmBtn),
    navBar(),
    article,
    navBar(),
  );

  // Balayage horizontal : chapitre suivant / précédent
  onSwipe(article, (dir) => {
    if (dir === 'left' && targets.next) go(path(version, targets.next));
    if (dir === 'right' && targets.prev) go(path(version, targets.prev));
  });

  return {
    title: `${book.name} ${chapter}`,
    el,
    cleanup: () => {
      player.destroy();
      passage.destroy();
    },
    afterMount: () => {
      if (autoplay && verses.length) player.start();
      if (focus) {
        const target = article.querySelector(`.verse[data-n="${focus.vs}"]`);
        if (target) target.scrollIntoView({ block: 'center' });
      }
    },
  };
}

function navBtn(svg, label, href, iconAfter = false) {
  const content = iconAfter ? [h('span', null, label), icon(svg)] : [icon(svg), h('span', null, label)];
  if (!href) return h('span', { class: 'nav-btn disabled', 'aria-disabled': 'true' }, content);
  return h('a', { class: 'nav-btn', href: '#' + href }, content);
}
