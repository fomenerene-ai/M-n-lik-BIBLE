// Réglages : texte, thème, version, projection, sauvegarde, état des textes.

import { h, toast, confirmDialog } from '../ui.js';
import { go } from '../router.js';
import { VERSIONS } from '../core/versions.js';
import { settings, setSetting, exportBackup, importBackup } from '../core/userdata.js';
import { versionStatus, deleteVersion, needsRenumbering, renumberOutdated } from '../core/importer.js';
import { compareVersification } from '../core/parse-bolls.js';
import { buildStructure } from '../core/structure.js';
import * as db from '../core/db.js';
import { getBook } from '../core/books.js';
import { clearCache } from '../core/bible.js';
import { applyTheme } from '../theme.js';
import { FONT_MIN, FONT_MAX } from './reader.js';
import { speechSupported, frenchVoices, createSpeaker, RATE_MIN, RATE_MAX } from '../core/speech.js';

export async function renderSettings() {
  const s = settings();
  const refresh = () => go('/reglages');

  const seg = (label, key, options, after) =>
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
              after && after();
              refresh();
            },
          },
          text,
        ),
      ),
    );

  /* ---------- Taille du texte ---------- */
  const size = h('input', {
    type: 'range',
    min: String(FONT_MIN),
    max: String(FONT_MAX),
    step: '1',
    value: String(s.fontSize),
    'aria-label': 'Taille du texte',
  });
  const sample = h(
    'p',
    { class: 'sample' },
    h('sup', { class: 'vn' }, '16'),
    ' Car Dieu a tant aimé le monde qu’il a donné son Fils unique…',
  );
  size.addEventListener('input', async () => {
    await setSetting('fontSize', Number(size.value));
    applyTheme();
  });

  /* ---------- Lecture vocale ---------- */
  const voices = await frenchVoices();
  const voiceSel = h(
    'select',
    { class: 'select', 'aria-label': 'Voix' },
    h('option', { value: '' }, 'Automatique (meilleure voix française)'),
    voices.map((v) =>
      h('option', { value: v.voiceURI, selected: v.voiceURI === s.ttsVoice }, `${v.name} (${v.lang})${v.localService ? '' : ', en ligne'}`),
    ),
  );
  voiceSel.addEventListener('change', () => setSetting('ttsVoice', voiceSel.value));
  const rate = h('input', {
    type: 'range',
    min: String(RATE_MIN),
    max: String(RATE_MAX),
    step: '0.1',
    value: String(s.ttsRate),
    'aria-label': 'Vitesse de lecture',
  });
  const rateOut = h('span', { class: 'muted' }, `${s.ttsRate.toFixed(1).replace('.', ',')}×`);
  rate.addEventListener('input', async () => {
    await setSetting('ttsRate', Number(rate.value));
    rateOut.textContent = `${Number(rate.value).toFixed(1).replace('.', ',')}×`;
  });
  let trial = null;
  const tryVoice = () => {
    trial && trial.stop();
    trial = createSpeaker({ segments: [{ text: 'Au commencement, Dieu créa les cieux et la terre.' }] });
    trial.play();
  };
  const voiceHelp = h(
    'details',
    { class: 'help', open: !voices.length },
    h('summary', null, voices.length ? 'Voix absente ou muette hors connexion ?' : 'Aucune voix française trouvée sur cet appareil'),
    h(
      'ol',
      { class: 'steps' },
      h('li', null, 'Ouvrez les Paramètres d’Android.'),
      h('li', null, 'Cherchez « Synthèse vocale » (souvent dans Gestion générale ou Système, puis Langue).'),
      h('li', null, 'Choisissez le moteur Google (Services vocaux Google), puis ses paramètres.'),
      h('li', null, 'Touchez « Installer les données vocales », puis Français (France), et téléchargez la voix.'),
      h('li', null, 'Revenez ici et touchez « Essayer la voix ».'),
    ),
    h('p', { class: 'muted small' }, 'Une voix téléchargée fonctionne sans connexion. Les voix marquées « en ligne » demandent internet.'),
  );

  /* ---------- Sauvegarde ---------- */
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!(await confirmDialog('Remplacer toutes vos données actuelles par celles de cette sauvegarde ?', 'Restaurer'))) return;
      await importBackup(obj);
      applyTheme();
      toast('Sauvegarde restaurée');
      refresh();
    } catch (e) {
      toast(e.message || 'Fichier illisible', 4000);
    }
  });
  const doExport = async () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(await exportBackup(), `menelik-bible-sauvegarde-${day}.json`);
    toast('Sauvegarde exportée');
  };

  /* ---------- Stockage ---------- */
  let persisted = null;
  let usage = '';
  if (navigator.storage) {
    try {
      persisted = await navigator.storage.persisted();
      const est = await navigator.storage.estimate();
      usage = `${(est.usage / 1e6).toFixed(1)} Mo utilisés`;
    } catch {
      /* indisponible */
    }
  }

  /* ---------- Textes ---------- */
  const realign = async (btn) => {
    btn.disabled = true;
    btn.textContent = 'Téléchargement…';
    const done = await renumberOutdated();
    clearCache();
    toast(done.length ? 'Numérotation alignée sur la Louis Segond' : 'Échec : vérifiez la connexion puis réessayez', 4000);
    refresh();
  };
  const textRows = [];
  for (const id of Object.keys(VERSIONS)) {
    const st = await versionStatus(id);
    const outdated = await needsRenumbering(id);
    textRows.push(
      h(
        'div',
        { class: 'text-status' },
        h('strong', null, VERSIONS[id].label),
        h(
          'span',
          { class: 'muted small' },
          st.complete
            ? `${st.verses} versets, ${st.chapters} chapitres, importée le ${new Date(st.date).toLocaleDateString('fr-FR')}`
            : 'Non installée',
        ),
        st.problems && st.problems.length
          ? h('details', null, h('summary', null, `${st.problems.length} écart(s) avec la liste des livres`), h('ul', null, st.problems.map((p) => h('li', null, p))))
          : null,
        outdated
          ? h(
              'div',
              { class: 'row wrap' },
              h('span', { class: 'muted small' }, 'Numérotation à aligner sur la Louis Segond : retéléchargement automatique dès qu’une connexion est disponible.'),
              h('button', { class: 'btn small', onclick: (e) => realign(e.currentTarget) }, 'Aligner maintenant'),
            )
          : null,
      ),
    );
  }
  const versifOut = h('div', { class: 'versif' });
  const checkVersif = async () => {
    versifOut.textContent = 'Comparaison en cours…';
    const all = await db.getAll('chapters');
    const maps = { FRLSG: new Map(), BDS: new Map() };
    for (const r of all) maps[r.v] && maps[r.v].set(`${r.b}:${r.c}`, r.verses);
    const diffs = compareVersification(maps.FRLSG, maps.BDS);
    if (!diffs.length) return (versifOut.textContent = 'Aucun écart de numérotation entre les deux versions.');
    versifOut.replaceChildren(
      h('p', null, `${diffs.length} chapitre(s) avec une numérotation différente. Les versets absents sont signalés pendant la lecture.`),
      h(
        'ul',
        { class: 'small' },
        diffs.map((d) => {
          const [b, c] = d.key.split(':').map(Number);
          const parts = [];
          if (d.onlyA.length) parts.push(`seulement LSG : ${d.onlyA.join(', ')}`);
          if (d.onlyB.length) parts.push(`seulement BDS : ${d.onlyB.join(', ')}`);
          return h('li', null, `${getBook(b).name} ${c} (${parts.join(' ; ')})`);
        }),
      ),
    );
  };
  const exportStructure = async () => {
    const all = await db.getAll('chapters');
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(buildStructure(all, { app: __APP_VERSION__, build: __BUILD_ID__ }), `menelik-bible-structure-${day}.json`);
    toast('Structure exportée');
  };
  const reinstall = async () => {
    if (!(await confirmDialog('Supprimer les textes de la tablette et les télécharger à nouveau ? Une connexion sera nécessaire. Vos surlignages, notes et favoris sont conservés.', 'Retélécharger'))) return;
    for (const id of Object.keys(VERSIONS)) await deleteVersion(id);
    clearCache();
    location.reload();
  };

  const el = h(
    'div',
    { class: 'page settings' },
    section('Lecture', [
      field('Taille du texte', size),
      sample,
      field('Thème de lecture', seg('Thème', 'theme', [['parchemin', 'Parchemin'], ['sombre', 'Sombre']], applyTheme)),
      field('Version par défaut', seg('Version', 'version', Object.values(VERSIONS).map((v) => [v.id, v.label]))),
    ]),
    section(
      'Lecture vocale',
      speechSupported()
        ? [
            field('Voix', voiceSel),
            field('Vitesse', h('div', { class: 'row' }, rate, rateOut)),
            field('Annoncer les numéros de verset', seg('Annoncer les numéros', 'ttsAnnounce', [[false, 'Non'], [true, 'Oui']])),
            h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: tryVoice }, 'Essayer la voix')),
            voiceHelp,
          ]
        : [h('p', { class: 'muted' }, 'La lecture vocale n’est pas disponible sur ce navigateur. Utilisez Chrome.')],
    ),
    section('Projection', [
      field('Couleur du texte', seg('Couleur', 'projColor', [['jaune', 'Jaune'], ['blanc', 'Blanc']])),
      field(
        'Taille du texte projeté',
        h(
          'div',
          { class: 'row' },
          h('span', null, `${Math.round(s.projScale * 100)} %`),
          h('button', { class: 'btn small', onclick: async () => (await setSetting('projScale', 1), refresh()) }, 'Rétablir 100 %'),
        ),
      ),
    ]),
    section('Sauvegarde', [
      h(
        'p',
        { class: 'muted small' },
        'Vos surlignages, notes, favoris et réglages ne quittent jamais la tablette. Exportez-les régulièrement : vider les données du navigateur les effacerait.',
      ),
      h(
        'div',
        { class: 'row wrap' },
        h('button', { class: 'btn primary', onclick: doExport }, 'Exporter une sauvegarde'),
        h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Importer une sauvegarde…'),
      ),
      fileInput,
      h(
        'p',
        { class: 'muted small' },
        persisted === true
          ? `Stockage persistant accordé. ${usage}`
          : persisted === false
            ? `Stockage persistant non accordé par le navigateur : installez l’application et exportez vos données. ${usage}`
            : usage,
      ),
    ]),
    section('Textes bibliques', [
      ...textRows,
      h(
        'div',
        { class: 'row wrap' },
        h('button', { class: 'btn', onclick: checkVersif }, 'Comparer la versification'),
        h('button', { class: 'btn', onclick: exportStructure }, 'Exporter la structure des textes'),
        h('button', { class: 'btn danger', onclick: reinstall }, 'Retélécharger les textes'),
      ),
      versifOut,
    ]),
    section('À propos', [
      h('p', null, `Ménélik Bible, version ${__APP_VERSION__} (build du ${__BUILD_ID__} UTC). Usage strictement personnel.`),
      h('div', { class: 'row wrap' }, h('a', { class: 'btn', href: '#/mise-a-jour' }, 'Mises à jour et nouveautés')),
      h(
        'p',
        { class: 'muted small' },
        'Textes : Louis Segond 1910 (domaine public) et Bible du Semeur 2015 (© Biblica, texte sous droits, téléchargé pour un usage privé), fournis par bolls.life. Aucune donnée n’est envoyée hors de la tablette.',
      ),
    ]),
  );
  return { title: 'Réglages', el, cleanup: () => trial && trial.stop() };
}

/** Propose un objet JSON en téléchargement. */
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function section(title, children) {
  return h('section', { class: 'card' }, h('h2', { class: 'section-title' }, title), children);
}

function field(label, control) {
  return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), control);
}
