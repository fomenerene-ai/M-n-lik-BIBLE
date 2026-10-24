// Parcours complet dans Chromium, sur le build de production (npm run build d'abord).
// Les fichiers Bolls sont simulés (structure réelle : tableau d'objets
// {pk, translation, book, chapter, verse, text}) pour ne pas dépendre du réseau.
//
// Usage : npm run build && npm run test:e2e

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PKG_VERSION = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
import { BOOKS } from '../../src/core/books.js';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

/* ---------- Données simulées ---------- */
function fakeTranslation(id) {
  const out = [];
  let pk = 1;
  for (const b of BOOKS) {
    for (let c = 1; c <= b.chapters; c++) {
      const n = b.id === 43 && c === 3 ? 36 : b.id === 19 && c === 119 ? 176 : 12;
      for (let v = 1; v <= n; v++) {
        // Écart de versification simulé : Psaumes 3:9 absent de la BDS
        if (id === 'BDS' && b.id === 19 && c === 3 && v === 9) continue;
        let text = `${id} ${b.name} ${c}:${v} texte de démonstration<S>1234</S> avec <i>balises</i>.`;
        if (b.id === 43 && c === 3 && v === 16) {
          text =
            id === 'FRLSG'
              ? 'Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle.'
              : 'Oui, Dieu a tant aimé le monde qu’il a donné son Fils, son unique, pour que tous ceux qui placent leur confiance en lui échappent à la perdition et qu’ils aient la vie éternelle.';
        }
        if (b.id === 43 && c === 3 && v === 17) text = 'Long verset. '.repeat(60);
        out.push({ pk: pk++, translation: id, book: b.id, chapter: c, verse: v, text });
      }
    }
  }
  return JSON.stringify(out);
}
const DATA = { FRLSG: fakeTranslation('FRLSG'), BDS: fakeTranslation('BDS') };

/* ---------- Outils ---------- */
let failures = 0;
// Attend qu'un sélecteur atteigne un nombre d'éléments (rendu asynchrone)
const countIs = async (page, sel, n, ms = 3000) => {
  try {
    await page.waitForFunction(([q, k]) => document.querySelectorAll(q).length === k, [sel, n], { timeout: ms });
    return true;
  } catch {
    return false;
  }
};
const shot = (p, name) => (process.env.SHOTS ? p.screenshot({ path: `test-results/${name}.png` }) : null);
const check = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures++;
};

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'pipe',
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('serveur non démarré')), 15000);
  server.stdout.on('data', (d) => {
    if (String(d).includes('localhost')) {
      clearTimeout(t);
      resolve();
    }
  });
});

const browser = await chromium.launch();
const context = await browser.newContext({
  // VIEWPORT=390x844 pour tester le format téléphone
  viewport: process.env.VIEWPORT
    ? { width: +process.env.VIEWPORT.split('x')[0], height: +process.env.VIEWPORT.split('x')[1] }
    : { width: 1280, height: 800 },
  acceptDownloads: true,
  hasTouch: true,
  serviceWorkers: 'allow',
});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const errors = [];
const external = [];
let bollsAllowed = true;

await context.route('https://bolls.life/**', (route) => {
  if (!bollsAllowed) return route.abort();
  const m = route.request().url().match(/translations\/(\w+)\.json/);
  if (!m) return route.abort();
  route.fulfill({ status: 200, contentType: 'application/json', body: DATA[m[1]] });
});

const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => {
  if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url());
});

try {
  /* 1. Premier lancement */
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Télécharger les deux versions' }).click();
  await page.getByRole('button', { name: 'Commencer' }).waitFor({ timeout: 60000 });
  check(true, 'Préparation : deux versions téléchargées et enregistrées');
  await page.getByRole('button', { name: 'Commencer' }).click();
  check((await page.locator('.tile').count()) === 6, 'Accueil : 6 tuiles');
  await shot(page, '01-accueil');
  await page.evaluate(() => navigator.serviceWorker.ready);
  bollsAllowed = false;
  external.length = 0;

  check(await page.locator('.home-verse').isVisible(), 'Accueil : verset du jour affiché');
  check((await page.locator('.tile-mini').count()) === 2, 'Accueil : accès Mise à jour et Réglages');

  /* 1 bis. Écran Mise à jour */
  await page.locator('.tile-mini', { hasText: 'Mise à jour' }).click();
  await page.locator('.status-title').waitFor();
  check((await page.locator('.version-meta').innerText()).includes(PKG_VERSION), 'Mise à jour : version installée affichée');
  check((await page.locator('.changelog > li').count()) >= 3, 'Mise à jour : historique des nouveautés');
  await shot(page, '11-mise-a-jour');
  await page.getByRole('button', { name: 'Rechercher une mise à jour' }).click();
  await page.locator('.status-title', { hasText: 'à jour' }).waitFor({ timeout: 20000 });
  check(true, 'Mise à jour : recherche sans nouveauté, « L’application est à jour »');
  await page.goto(BASE + '#/');

  /* 2. Recherche */
  await page.locator('.tile', { hasText: 'Recherche' }).click();
  const input = page.locator('.ref-input');
  await input.fill('jean 3:16-21');
  const t0 = Date.now();
  await input.press('Enter');
  await page.locator('.passage .verse').first().waitFor();
  const dt = Date.now() - t0;
  check(dt < 1000, `Recherche Jean 3:16-21 affichée en ${dt} ms`);
  check((await page.locator('.passage .verse').count()) === 6, 'Six versets affichés');
  check((await page.locator('.passage').innerText()).includes('Car Dieu a tant aimé'), 'Texte LSG affiché, balises retirées');
  check(!(await page.locator('.passage').innerText()).includes('<'), 'Aucune balise résiduelle');
  await page.getByRole('button', { name: 'BDS', exact: true }).click();
  await page.locator('.passage', { hasText: 'Oui, Dieu a tant aimé' }).waitFor();
  check(true, 'Bascule vers la Bible du Semeur en un geste');
  await shot(page, '02-recherche');
  await page.getByRole('button', { name: 'LSG', exact: true }).click();
  await page.locator('.passage', { hasText: 'Car Dieu' }).waitFor();
  await input.fill('Toto 3');
  await input.press('Enter');
  check((await page.locator('.error').innerText()).includes('Jean 3:16-21'), 'Référence introuvable : message avec exemple');
  await input.fill('ésa');
  check((await page.locator('.suggest-item', { hasText: 'Ésaïe' }).count()) === 1, 'Autocomplétion des noms de livres');

  /* 3. Parcours Testament → version → livres → chapitres → lecture */
  await page.goto(BASE + '#/');
  await page.locator('.tile', { hasText: 'Ancien Testament' }).click();
  check((await page.locator('.version-btn').count()) === 2, 'Choix de version présenté en premier');
  await shot(page, '03-version');
  await page.locator('.version-btn', { hasText: 'Louis Segond' }).click();
  await page.locator('.book-item', { hasText: 'Malachie' }).click();
  await page.locator('.chapter-cell', { hasText: /^4$/ }).click();
  check((await page.locator('.chapter-title').innerText()) === 'Malachie 4', 'Lecture de Malachie 4');
  await page.locator('.nav-btn', { hasText: 'Chapitre suivant' }).first().click();
  await page.locator('.chapter-title', { hasText: 'Matthieu 1' }).waitFor();
  check(true, 'Malachie 4 → Matthieu 1 sans repasser par la liste');
  await shot(page, '04-lecture');
  await page.locator('.nav-btn', { hasText: 'Livre suivant' }).first().click();
  await page.locator('.chapter-title', { hasText: 'Marc 1' }).waitFor();
  await page.locator('.nav-btn', { hasText: 'Chapitre précédent' }).first().click();
  await page.locator('.chapter-title', { hasText: 'Matthieu 28' }).waitFor();
  check(true, 'Livre suivant et chapitre précédent');

  // Retour Android (historique) : lecture → chapitres → livres → version → accueil
  await page.goBack();
  await page.locator('.chapter-grid').waitFor();
  check((await page.locator('.top-title').innerText()) === 'Matthieu', 'Retour : grille des chapitres');
  await page.goBack();
  await page.locator('.book-list').waitFor();
  check(true, 'Retour : liste des livres');
  await page.goBack();
  await page.locator('.version-choice').waitFor();
  check(true, 'Retour : choix de version');
  await page.goBack();
  await page.locator('.tiles').waitFor();
  check(true, 'Retour : accueil');

  /* 4. Versification : verset absent */
  await page.goto(BASE + '#/l/BDS/19/3');
  await page.locator('.verse.missing').waitFor();
  check((await page.locator('.verse.missing').innerText()).includes('absent'), 'Verset absent signalé (Psaumes 3:9 BDS)');

  /* 5. Surlignage, note, favori */
  await page.goto(BASE + '#/l/FRLSG/43/3');
  // Clavier : Entrée sur un verset ouvre le menu, Échap le ferme
  await page.locator('.verse[data-n="2"] .verse-hit').focus();
  await page.keyboard.press('Enter');
  await page.locator('.action-bar').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.action-bar').waitFor({ state: 'detached' });
  check(true, 'Clavier : verset sélectionné avec Entrée, menu fermé avec Échap');
  await page.locator('.verse[data-n="16"]').click();
  await page.locator('.verse[data-n="18"]').click();
  check((await page.locator('.action-head strong').innerText()) === 'Jean 3:16-18', 'Sélection d’une suite de versets');
  check((await page.locator('button button, [role=button] button').count()) === 0, 'Accessibilité : aucun bouton imbriqué dans un autre');
  await shot(page, '05-menu-verset');
  await page.getByRole('button', { name: 'Surligner en jaune' }).click();
  await page.locator('.verse[data-n="17"].hl-jaune').waitFor();
  await page.locator('.verse[data-n="17"]').click();
  await page.getByRole('button', { name: 'Surligner en bleu' }).click();
  await page.locator('.verse[data-n="17"].hl-bleu').waitFor();
  check((await page.locator('.verse.hl-jaune').count()) === 2, 'Changement de couleur au milieu d’une plage');
  await page.locator('.verse[data-n="5"]').click();
  await page.getByRole('button', { name: 'Note' }).click();
  await page.locator('.note-text').fill('Ma note sur la nouvelle naissance');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('.verse[data-n="5"] .note-btn').waitFor();
  await page.locator('.verse[data-n="1"]').click();
  await page.getByRole('button', { name: 'Favori' }).click();
  await page.getByRole('button', { name: 'Marque-page du chapitre' }).click();

  // Version indépendante : visibles en BDS après rechargement complet
  await page.goto(BASE + '#/l/BDS/43/3');
  await page.reload();
  await page.locator('.verse[data-n="16"].hl-jaune').waitFor();
  check((await page.locator('.verse[data-n="5"] .note-btn').count()) === 1, 'Marques conservées après redémarrage et visibles dans l’autre version');

  await page.goto(BASE + '#/favoris');
  await page.locator('.fav-item').first().waitFor();
  check((await page.locator('.fav-item').count()) === 6, 'Favoris : 3 surlignages, 1 note, 2 marque-pages');
  await shot(page, '06-favoris');
  await page.locator('.chip', { hasText: 'Notes' }).click();
  check(await countIs(page, '.fav-item', 1), 'Filtre Notes');
  await page.locator('.chip', { hasText: 'Jaune' }).click();
  check(await countIs(page, '.fav-item', 2), 'Filtre par couleur');
  await page.locator('.chip', { hasText: 'Tout' }).click();
  await countIs(page, '.fav-item', 6);
  await page.getByRole('button', { name: 'Ordre biblique' }).click();
  await page.locator('.fav-open').first().click();
  await page.locator('.chapter-title', { hasText: 'Jean 3' }).waitFor();
  check(true, 'Ouverture du passage depuis les favoris');

  // Audit d'accessibilité automatisé (axe-core), si AXE=chemin/vers/axe.min.js
  if (process.env.AXE) {
    const axeSrc = fs.readFileSync(process.env.AXE, 'utf8');
    const routes = ['#/', '#/recherche/Jean%203%3A16-21', '#/t/AT', '#/t/NT/FRLSG', '#/l/FRLSG/43', '#/l/FRLSG/43/3', '#/favoris', '#/projection', '#/histoires', '#/histoires/joseph', '#/reglages', '#/mise-a-jour'];
    for (const theme of ['Parchemin', 'Sombre']) {
      await page.goto(BASE + '#/reglages');
      await page.getByRole('button', { name: theme }).click();
      await page.locator('.segmented button.on', { hasText: theme }).waitFor();
      for (const r of routes) {
        await page.goto(BASE + r);
        await page.waitForTimeout(400);
        await page.evaluate(axeSrc);
        const res = await page.evaluate(() =>
          window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }).then((x) =>
            x.violations.map((v) => `${v.id} (${v.nodes.length}) : ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`),
          ),
        );
        check(res.length === 0, `axe ${theme} ${r}${res.length ? ' → ' + res.join(' ; ') : ''}`);
      }
    }
    await page.goto(BASE + '#/reglages');
    await page.getByRole('button', { name: 'Parchemin' }).click();
    await page.locator('.segmented button.on', { hasText: 'Parchemin' }).waitFor();
  }

  // Mode sombre en lecture (captures)
  if (process.env.SHOTS) {
    await page.goto(BASE + '#/reglages');
    await page.getByRole('button', { name: 'Sombre' }).click();
    await page.locator('.segmented button.on', { hasText: 'Sombre' }).waitFor();
    await page.goto(BASE + '#/l/FRLSG/43/3');
    await page.locator('.verse[data-n="16"].hl-jaune').waitFor();
    await shot(page, '12-lecture-sombre');
    await page.goto(BASE + '#/');
    await page.locator('.tile').first().waitFor();
    await shot(page, '13-accueil-sombre');
    await page.goto(BASE + '#/reglages');
    await page.getByRole('button', { name: 'Parchemin' }).click();
    await page.locator('.segmented button.on', { hasText: 'Parchemin' }).waitFor();
  }

  /* 6. Sauvegarde : export puis import */
  await page.goto(BASE + '#/reglages');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter une sauvegarde' }).click(),
  ]);
  const backupPath = await download.path();
  const before = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  await page.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open('menelik-bible');
      q.onsuccess = () => r(q.result);
    });
    const tx = db.transaction(['highlights', 'notes', 'bookmarks'], 'readwrite');
    for (const s of ['highlights', 'notes', 'bookmarks']) tx.objectStore(s).clear();
    await new Promise((r) => (tx.oncomplete = r));
  });
  await page.locator('.settings input[type=file]').setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await page.waitForTimeout(400);
  const [download2] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter une sauvegarde' }).click(),
  ]);
  const after = JSON.parse(fs.readFileSync(await download2.path(), 'utf8'));
  const norm = (d) => JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, [...v].sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)))])));
  check(norm(before.data) === norm(after.data), 'Export puis import : données restaurées à l’identique');

  // Export de la structure des textes
  const [dlStruct] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter la structure des textes' }).click(),
  ]);
  const struct = JSON.parse(fs.readFileSync(await dlStruct.path(), 'utf8'));
  check(
    Object.keys(struct.versions.FRLSG.chapitres).length === 1189 && struct.versions.BDS.manquants['19:3'][0] === 9,
    'Export de la structure : 1189 chapitres, verset absent repéré',
  );

  /* 7. Projection */
  await page.goto(BASE + '#/projection');
  await page.locator('.ref-input').fill('Jean 3:16-18');
  await page.locator('.ref-input').press('Enter');
  await page.locator('.queue-item').first().waitFor();
  await page.locator('.ref-input').fill('Psaumes 23');
  await page.locator('.ref-input').press('Enter');
  await page.locator('.queue-item').nth(1).waitFor();
  check((await page.locator('.queue-item').count()) === 2, 'File de projection : deux passages');
  const counter = await page.locator('.proj-right .muted').first().innerText();
  check(/Diapositive 1 \/ \d+/.test(counter), `Aperçu : ${counter}`);
  await shot(page, '07-projection-controle');
  await page.getByRole('button', { name: 'Projeter' }).click();
  await page.locator('.live .slide').waitFor();
  const slide = await page.evaluate(() => {
    const s = document.querySelector('.live .slide');
    const body = s.querySelector('.slide-body');
    const text = s.querySelector('.slide-text');
    const cs = getComputedStyle(s);
    return {
      bg: cs.backgroundColor,
      color: cs.color,
      weight: getComputedStyle(text).fontWeight,
      fits: text.scrollHeight <= body.clientHeight + 1,
      ref: s.querySelector('.slide-ref').innerText,
      version: s.querySelector('.slide-version').innerText,
      sup: !!text.querySelector('sup'),
    };
  });
  await shot(page, '08-projection-live');
  check(slide.bg === 'rgb(0, 0, 0)', 'Projection : fond noir');
  check(slide.color === 'rgb(255, 212, 0)', 'Projection : texte jaune #FFD400');
  check(Number(slide.weight) >= 700, 'Projection : texte en gras');
  check(slide.fits, 'Projection : le texte tient à l’écran');
  check(/^Jean 3:16/.test(slide.ref), `Référence en haut : ${slide.ref}`);
  check(slide.version === 'Louis Segond 1910', 'Version en bas');
  check(slide.sup, 'Numéros de versets en indice');
  const allFit = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowRight');
    allFit.push(await page.evaluate(() => {
      const s = document.querySelector('.live .slide');
      return s.querySelector('.slide-text').scrollHeight <= s.querySelector('.slide-body').clientHeight + 1;
    }));
  }
  check(allFit.every(Boolean), 'Toutes les diapositives tiennent (verset très long compris)');
  await page.keyboard.press('b');
  check(await page.locator('.live-black').isVisible(), 'Écran noir instantané (touche B)');
  await page.keyboard.press('.');
  check(!(await page.locator('.live-black').isVisible()), 'Retour de l’écran noir');
  await page.keyboard.press('Escape');
  await page.locator('.live').waitFor({ state: 'detached' });
  check(true, 'Échap quitte la projection');

  /* 8. Histoires */
  await page.goto(BASE + '#/histoires');
  await page.locator('.story-item').first().waitFor();
  check((await page.locator('.story-item').count()) >= 15, 'Histoires : liste chargée');
  // L'app trie par clé (« cle ») : on compare à l'index trié de la même façon
  const alpha = await page.locator('.story-item strong').allInnerTexts();
  const index = await page.evaluate(() => fetch('./histoires/index.json').then((r) => r.json()));
  const sorted = [...index].sort((a, b) => a.cle.localeCompare(b.cle, 'fr')).map((x) => x.nom);
  await page.getByRole('button', { name: 'Chronologique' }).click();
  await page.locator('.group-title', { hasText: 'Les origines' }).waitFor();
  const firstChrono = await page.locator('.story-item strong').first().innerText();
  check(alpha.join() === sorted.join() && firstChrono === 'Adam', `Classements alphabétique (${alpha[0]}…) et chronologique (${firstChrono}…)`);
  await shot(page, '09-histoires');
  await page.locator('a.story-item[href="#/histoires/joseph"]').click();
  await page.locator('.story-name').waitFor();
  await shot(page, '10-fiche');
  await page.locator('.ref-link', { hasText: 'Genèse 37:2-4' }).first().click();
  await page.locator('.chapter-title', { hasText: 'Genèse 37' }).waitFor();
  check((await page.locator('.verse.focus').count()) === 3, 'Référence d’histoire : ouvre le bon passage');

  /* 9. Hors ligne, application fermée puis rouverte */
  await context.setOffline(true);
  const page2 = await context.newPage();
  page2.on('pageerror', (e) => errors.push(String(e)));
  await page.close();
  await page2.goto(BASE + '#/recherche/Jean%203%3A16');
  await page2.locator('.passage', { hasText: 'Car Dieu' }).waitFor();
  check(true, 'Hors ligne : recherche fonctionnelle');
  await page2.goto(BASE + '#/histoires/abraham');
  await page2.locator('.story-name').waitFor();
  check(true, 'Hors ligne : histoires lisibles');
  await page2.goto(BASE + '#/projection');
  await page2.locator('.preview .slide').waitFor();
  check(true, 'Hors ligne : projection prête');
  await context.setOffline(false);

  check(external.length === 0, `Aucun appel réseau externe après le premier lancement (${external.length})`);
  check(errors.length === 0, `Aucune erreur console (${errors.join(' | ')})`);

  /* 10. Textes installés avec l'ancienne numérotation : réalignement automatique */
  bollsAllowed = true;
  await page2.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('menelik-bible');
        req.onsuccess = () => {
          const tx = req.result.transaction('meta', 'readwrite');
          const store = tx.objectStore('meta');
          store.get('version:BDS').onsuccess = (e) => store.put({ ...e.target.result, numerotation: 1 });
          tx.oncomplete = () => (req.result.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page2.goto(BASE + '#/');
  await page2.reload();
  await page2.locator('#toast', { hasText: 'numérotation alignée' }).waitFor({ timeout: 20000 });
  await page2.goto(BASE + '#/l/BDS/32/1');
  check(
    (await page2.locator('.verse[data-n="17"]').innerText()).includes('Jonas 2:1'),
    'Ancienne numérotation : BDS retéléchargée et alignée (Jonas 2:1 devient 1:17)',
  );
} catch (e) {
  failures++;
  console.error('✗ Échec :', e);
  await page.screenshot({ path: 'test-results/echec.png' }).catch(() => {});
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} échec(s)` : '\nTous les contrôles sont passés.');
process.exit(failures ? 1 : 0);
