// Écran « Mise à jour » : version installée, recherche de nouveautés, historique, aide.

import { h, icon } from '../ui.js';
import { ICONS } from '../icons.js';
import { CHANGELOG } from '../changelog.js';
import { checkForUpdate, applyUpdate, getUpdateState, onUpdateState, lastCheck } from '../sw-register.js';

const STATES = {
  idle: { dot: 'unknown', title: 'Version installée', text: 'Touchez « Rechercher » pour vérifier s’il existe une version plus récente.' },
  checking: { dot: 'unknown', title: 'Recherche en cours…', text: 'L’application interroge le site. Cela peut prendre quelques secondes.' },
  none: { dot: 'ok', title: 'L’application est à jour', text: 'Vous utilisez la dernière version publiée.' },
  available: { dot: 'available', title: 'Nouvelle version prête', text: 'Elle a été téléchargée. Installez-la : l’application redémarrera, vos données sont conservées.' },
  offline: { dot: 'offline', title: 'Pas de connexion', text: 'La recherche nécessite Internet. L’application continue de fonctionner hors ligne.' },
  error: { dot: 'offline', title: 'Recherche impossible', text: 'Le site n’a pas répondu. Réessayez plus tard.' },
  unsupported: { dot: 'unknown', title: 'Mises à jour automatiques indisponibles', text: 'Ce navigateur ne gère pas le mode hors ligne : la page est toujours chargée depuis le site.' },
};

const fmtDate = (d) =>
  d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function renderUpdates() {
  const dot = h('span', { class: 'status-dot', 'aria-hidden': 'true' });
  const title = h('h2', { class: 'status-title' });
  const text = h('p', { class: 'muted' });
  const last = h('p', { class: 'muted small' });
  const checkBtn = h('button', { type: 'button', class: 'btn primary big' }, icon(ICONS.refresh), 'Rechercher une mise à jour');
  const installBtn = h('button', { type: 'button', class: 'btn primary big', hidden: true }, icon(ICONS.download), 'Installer la mise à jour');

  const paint = (s) => {
    const st = STATES[s] || STATES.idle;
    dot.className = `status-dot ${st.dot}`;
    title.textContent = st.title;
    text.textContent = st.text;
    const lc = lastCheck();
    last.textContent = lc ? `Dernière vérification : ${fmtDate(lc)}.` : '';
    checkBtn.hidden = s === 'available' || s === 'unsupported';
    checkBtn.disabled = s === 'checking';
    installBtn.hidden = s !== 'available';
  };

  checkBtn.addEventListener('click', () => checkForUpdate());
  installBtn.addEventListener('click', () => {
    installBtn.disabled = true;
    installBtn.lastChild.textContent = 'Installation…';
    if (!applyUpdate()) paint('error');
  });

  const off = onUpdateState(paint);
  paint(getUpdateState());

  const statusCard = h(
    'section',
    { class: 'card', 'aria-labelledby': 'update-status-title' },
    h('div', { class: 'update-status', role: 'status', 'aria-live': 'polite' }, dot, h('div', null, title, text)),
    h(
      'dl',
      { class: 'version-meta' },
      h('dt', null, 'Version'),
      h('dd', null, __APP_VERSION__),
      h('dt', null, 'Publiée le'),
      h('dd', null, `${__BUILD_ID__} (UTC)`),
    ),
    h('div', { class: 'row wrap' }, checkBtn, installBtn),
    last,
  );
  title.id = 'update-status-title';

  const history = h(
    'section',
    { class: 'card', 'aria-labelledby': 'changelog-title' },
    h('h2', { class: 'section-title', id: 'changelog-title' }, 'Nouveautés'),
    h(
      'ol',
      { class: 'changelog' },
      CHANGELOG.map((v) =>
        h(
          'li',
          null,
          h('h3', null, `Version ${v.version}${v.version === __APP_VERSION__ ? ' (installée)' : ''}`),
          h('p', { class: 'muted small' }, fmtDay(v.date)),
          h('ul', null, v.items.map((it) => h('li', null, it))),
        ),
      ),
    ),
  );

  const help = h(
    'section',
    { class: 'card', 'aria-labelledby': 'help-title' },
    h('h2', { class: 'section-title', id: 'help-title' }, 'L’application ne se met pas à jour ?'),
    h('p', null, 'Les mises à jour sont proposées automatiquement quand l’appareil est connecté. Si la version reste ancienne :'),
    h(
      'ol',
      { class: 'steps' },
      h('li', null, 'Exportez une sauvegarde (Réglages › Exporter une sauvegarde) si vous avez des surlignages, notes ou favoris.'),
      h('li', null, 'Dans Chrome, ouvrez fomenerene-ai.github.io/M-n-lik-BIBLE, touchez l’icône à gauche de l’adresse, puis Paramètres du site › Effacer et réinitialiser.'),
      h('li', null, 'Rechargez la page, réinstallez l’application (menu ⋮ › Installer l’application) et retéléchargez les textes.'),
      h('li', null, 'Importez votre sauvegarde (Réglages › Importer une sauvegarde).'),
    ),
  );

  const el = h('div', { class: 'page settings' }, statusCard, history, help);
  return { title: 'Mise à jour', el, cleanup: off };
}
