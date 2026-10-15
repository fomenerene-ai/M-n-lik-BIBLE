// Application du thème de lecture et de la taille du texte.

import { settings } from './core/userdata.js';

export function applyTheme() {
  const s = settings();
  document.documentElement.dataset.theme = s.theme === 'sombre' ? 'sombre' : 'parchemin';
  document.documentElement.style.setProperty('--reading-size', `${s.fontSize}px`);
}
