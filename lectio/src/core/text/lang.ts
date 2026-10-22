// Détection de langue FR/EN par mots outils : rapide, sans dépendance, fiable
// dès une dizaine de mots. Retourne null si le texte ne permet pas de trancher.

import type { Lang } from '../model';

const FR = new Set(
  'le la les un une des du de et est sont dans pour pas que qui ne sur au aux avec ce cette ces il elle ils elles nous vous je tu on se sa son ses leur leurs mais ou où donc car par plus être avoir fait comme tout tous très aussi été sans entre sous même cela dont si y en lui'.split(
    ' ',
  ),
);
const EN = new Set(
  'the a an and is are was were in of to for not that which who on at with this these those it he she they we you i his her their but or so by more be have has had as all very also been without between under same if do does did from will would can could there what when'.split(
    ' ',
  ),
);

export function detectLang(text: string): Lang | null {
  const words =
    text
      .toLowerCase()
      .replace(/’/g, "'")
      .match(/[\p{L}']+/gu) ?? [];
  let fr = 0;
  let en = 0;
  for (const raw of words) {
    // Élision (l', d', qu'…) : signe fort du français.
    const elided = /^(?:qu|[ldjmnstc])'/u.exec(raw);
    if (elided) fr += 1;
    const w = elided ? raw.slice(elided[0].length) : raw;
    if (FR.has(w)) fr += 1;
    if (EN.has(w)) en += 1;
  }
  if (/[éèêàùçœ]/u.test(text)) fr += 1;
  if (fr === 0 && en === 0) return null;
  if (fr === en) return null;
  return fr > en ? 'fr' : 'en';
}
