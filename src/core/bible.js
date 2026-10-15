// Accès aux textes bibliques stockés hors ligne.

import * as db from './db.js';

const cache = new Map(); // petit cache mémoire des derniers chapitres lus
const MAX = 40;

export async function getChapter(version, b, c) {
  const key = `${version}:${b}:${c}`;
  if (cache.has(key)) return cache.get(key);
  const rec = await db.get('chapters', [version, b, c]);
  const verses = rec ? rec.verses : [];
  cache.set(key, verses);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return verses;
}

/**
 * Versets d'une référence {book, chapter, vStart, vEnd}.
 * @returns {{verses:[{n,t}], missing:number[], outOfRange:boolean}}
 */
export async function getPassage(version, ref) {
  const all = await getChapter(version, ref.book, ref.chapter);
  if (!ref.vStart) return { verses: all, missing: [], outOfRange: all.length === 0 };
  const verses = all.filter((v) => v.n >= ref.vStart && v.n <= ref.vEnd);
  const present = new Set(verses.map((v) => v.n));
  const last = all.length ? all[all.length - 1].n : 0;
  const missing = [];
  for (let n = ref.vStart; n <= Math.min(ref.vEnd, last); n++) if (!present.has(n)) missing.push(n);
  return { verses, missing, outOfRange: verses.length === 0 };
}

export function clearCache() {
  cache.clear();
}
