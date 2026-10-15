// Lecture d'un fichier de traduction Bolls.
//
// Le fichier statique (https://bolls.life/static/translations/<ID>.json) est la sortie
// de /get-translation/<ID>/ : un tableau d'objets {pk, translation, book, chapter, verse, text}.
// On ne suppose pas plus que nécessaire : on parcourt la structure et on retient tout objet
// portant book, chapter, verse et text, quel que soit l'emboîtement.

import { cleanText } from './clean.js';
import { BOOKS } from './books.js';

function collect(node, out, depth = 0) {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const x of node) collect(x, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  const b = Number(node.book ?? node.bookid);
  const c = Number(node.chapter);
  const v = Number(node.verse);
  if (Number.isInteger(b) && Number.isInteger(c) && Number.isInteger(v) && 'text' in node) {
    out.push({ b, c, n: v, raw: node.text, tr: node.translation });
    return;
  }
  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') collect(val, out, depth + 1);
  }
}

/**
 * @returns {{translation: string|null, chapters: Map<string, {b, c, verses:[{n,t}]}>, total: number, empty: number}}
 */
export function parseBolls(data) {
  const rows = [];
  collect(data, rows);
  const chapters = new Map();
  let translation = null;
  let empty = 0;
  for (const r of rows) {
    if (r.b < 1 || r.b > 66) continue; // hors canon protestant
    if (!translation && r.tr) translation = String(r.tr);
    const t = cleanText(r.raw);
    if (!t) {
      empty++;
      continue;
    }
    const key = `${r.b}:${r.c}`;
    let ch = chapters.get(key);
    if (!ch) chapters.set(key, (ch = { b: r.b, c: r.c, verses: [] }));
    // doublon éventuel : on garde le premier
    if (!ch.verses.some((x) => x.n === r.n)) ch.verses.push({ n: r.n, t });
  }
  let total = 0;
  for (const ch of chapters.values()) {
    ch.verses.sort((a, b) => a.n - b.n);
    total += ch.verses.length;
  }
  return { translation, chapters, total, empty };
}

/** Compare les chapitres importés à la liste canonique. */
export function validateAgainstCanon(chapters) {
  const problems = [];
  for (const book of BOOKS) {
    let found = 0;
    for (let c = 1; c <= book.chapters; c++) if (chapters.has(`${book.id}:${c}`)) found++;
    if (found !== book.chapters) {
      problems.push(`${book.name} : ${found} chapitre(s) sur ${book.chapters}`);
    }
  }
  for (const key of chapters.keys()) {
    const [b, c] = key.split(':').map(Number);
    if (c > BOOKS[b - 1].chapters) problems.push(`${BOOKS[b - 1].name} ${c} : chapitre en trop`);
  }
  return problems;
}

/** Liste les chapitres dont la numérotation des versets diffère entre deux versions. */
export function compareVersification(a, b) {
  const diffs = [];
  for (const [key, ca] of a) {
    const cb = b.get(key);
    if (!cb) continue;
    const na = new Set(ca.map((v) => v.n));
    const nb = new Set(cb.map((v) => v.n));
    const onlyA = [...na].filter((n) => !nb.has(n));
    const onlyB = [...nb].filter((n) => !na.has(n));
    if (onlyA.length || onlyB.length) diffs.push({ key, onlyA, onlyB });
  }
  return diffs;
}
