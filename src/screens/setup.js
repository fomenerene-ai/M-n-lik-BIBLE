// Écran de premier lancement : téléchargement et enregistrement des deux versions.

import { h } from '../ui.js';
import { VERSIONS } from '../core/versions.js';
import { importVersion, versionStatus, importFromFile } from '../core/importer.js';

const PHASES = {
  download: 'Téléchargement',
  parse: 'Lecture du fichier',
  store: 'Enregistrement sur la tablette',
  done: 'Prête',
};

export async function renderSetup(onReady) {
  const rows = {};
  for (const id of Object.keys(VERSIONS)) {
    const bar = h('progress', { max: '100', value: '0', 'aria-label': VERSIONS[id].label });
    const state = h('span', { class: 'muted' }, 'En attente');
    rows[id] = { bar, state, el: h('div', { class: 'setup-row' }, h('strong', null, VERSIONS[id].label), bar, state) };
    if ((await versionStatus(id)).complete) {
      bar.value = 100;
      state.textContent = PHASES.done;
    }
  }
  const msg = h('p', { class: 'setup-msg', role: 'status', 'aria-live': 'polite' });
  const startBtn = h('button', { class: 'btn primary big' }, 'Télécharger les deux versions');
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const manual = h(
    'details',
    { class: 'setup-manual' },
    h('summary', null, 'Le téléchargement échoue toujours ?'),
    h(
      'p',
      null,
      'Récupérez sur un ordinateur les fichiers FRLSG.json et BDS.json depuis bolls.life, copiez-les sur la tablette, puis importez-les ici un par un.',
    ),
    h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Importer un fichier…'),
  );
  const readyBtn = h('button', { class: 'btn primary big', hidden: true, onclick: () => onReady() }, 'Commencer');

  const finishIfReady = async () => {
    for (const id of Object.keys(VERSIONS)) if (!(await versionStatus(id)).complete) return false;
    msg.textContent = 'Tout est prêt. L’application fonctionne désormais sans connexion.';
    startBtn.hidden = true;
    manual.hidden = true;
    readyBtn.hidden = false;
    readyBtn.focus();
    return true;
  };

  const progress = (id) => (p) => {
    const r = rows[id];
    const pct = p.phase === 'store' ? 50 + p.ratio * 50 : p.phase === 'done' ? 100 : p.phase === 'parse' ? 50 : p.ratio * 50;
    r.bar.value = Math.round(pct);
    r.state.textContent =
      PHASES[p.phase] + (p.phase === 'download' && p.bytes ? ` (${(p.bytes / 1e6).toFixed(1)} Mo)` : '');
  };

  let running = false;
  startBtn.addEventListener('click', async () => {
    if (running) return;
    running = true;
    startBtn.disabled = true;
    msg.textContent = 'Gardez l’application ouverte pendant la préparation.';
    let failed = false;
    for (const id of Object.keys(VERSIONS)) {
      try {
        await importVersion(id, progress(id));
      } catch (e) {
        failed = true;
        rows[id].state.textContent = 'Échec';
        msg.textContent = `${VERSIONS[id].label} : ${e.message} Les éléments déjà obtenus sont conservés.`;
      }
    }
    running = false;
    startBtn.disabled = false;
    if (failed) startBtn.textContent = 'Réessayer';
    else await finishIfReady();
  });

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    msg.textContent = 'Import du fichier…';
    try {
      const { id } = await importFromFile(f, (p) => p.phase && progress(guess)(p));
      progress(id)({ phase: 'done', ratio: 1 });
      msg.textContent = `${VERSIONS[id].label} importée.`;
      await finishIfReady();
    } catch (e) {
      msg.textContent = e.message;
    }
  });
  // l'id n'est connu qu'après lecture : la progression s'affiche sur la première version manquante
  let guess = 'FRLSG';
  for (const id of Object.keys(VERSIONS)) {
    if (!(await versionStatus(id)).complete) {
      guess = id;
      break;
    }
  }

  const el = h(
    'div',
    { class: 'page setup' },
    h('h2', null, 'Bienvenue dans Ménélik Bible'),
    h(
      'p',
      null,
      'Pour fonctionner sans connexion, l’application doit d’abord enregistrer sur cette tablette la Louis Segond 1910 et la Bible du Semeur 2015 (environ 10 Mo). Cette étape n’a lieu qu’une fois.',
    ),
    h('div', { class: 'setup-rows' }, Object.values(rows).map((r) => r.el)),
    msg,
    h('div', { class: 'row center' }, startBtn, readyBtn),
    manual,
    fileInput,
  );
  if (await finishIfReady()) readyBtn.hidden = false;
  return { el };
}
