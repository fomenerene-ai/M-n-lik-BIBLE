// Analyse des références bibliques saisies en toutes lettres.
// Formats : « Jean 3 », « Jean 3:16 », « Jean 3:16-21 », « 1 Jean 2:1-5 », « Psaumes 23 ».
// Séparateurs acceptés entre chapitre et verset : « : », « . », « , » ou espace.
// Insensible aux accents, à la casse et aux espaces superflus.

import { BOOKS, ALIASES, getBook } from './books.js';

export function normalize(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise aussi « 1jean », « 1 jean », « 1er jean », « 1re jean ». */
function normalizeBookPart(s) {
  return normalize(s).replace(/^([123])\s*(?:er|re|ere)?\s*(?=[a-z])/, '$1 ');
}

// Table des clés de livres, triée de la plus longue à la plus courte
// pour que « 1 jean » soit essayé avant « jean ».
const KEYS = (() => {
  const list = BOOKS.map((b) => [normalize(b.name), b.id]);
  for (const [alias, id] of Object.entries(ALIASES)) list.push([normalize(alias), id]);
  return list.sort((a, b) => b[0].length - a[0].length);
})();

export const EXAMPLE = 'Jean 3:16-21';

/**
 * @returns {{ok:true, book:number, chapter:number|null, vStart:number|null, vEnd:number|null}
 *          | {ok:false, error:string}}
 */
export function parseReference(input) {
  const s = normalizeBookPart(input || '');
  if (!s) return { ok: false, error: `Saisissez une référence, par exemple ${EXAMPLE}.` };

  let bookId = null;
  let rest = '';
  for (const [key, id] of KEYS) {
    if (s === key || (s.startsWith(key) && /[\s\d]/.test(s[key.length]))) {
      bookId = id;
      rest = s.slice(key.length).trim();
      break;
    }
  }
  if (!bookId) {
    return { ok: false, error: `Livre introuvable. Écrivez le nom complet, par exemple ${EXAMPLE}.` };
  }
  const book = getBook(bookId);
  if (rest === '') return { ok: true, book: bookId, chapter: null, vStart: null, vEnd: null };

  const m = rest.match(/^(\d+)(?:\s*[:.,\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/);
  if (!m) {
    return { ok: false, error: `Référence incomprise. Exemple : ${EXAMPLE}.` };
  }
  let chapter = Number(m[1]);
  let vStart = m[2] ? Number(m[2]) : null;
  let vEnd = m[3] ? Number(m[3]) : vStart;

  // Livres d'un seul chapitre : « Jude 3 » désigne le verset 3.
  if (book.chapters === 1 && vStart === null && chapter > 1) {
    vStart = vEnd = chapter;
    chapter = 1;
  }

  if (chapter < 1 || chapter > book.chapters) {
    return {
      ok: false,
      error: `${book.name} compte ${book.chapters} chapitre${book.chapters > 1 ? 's' : ''}. Exemple : ${EXAMPLE}.`,
    };
  }
  if (vStart !== null && (vStart < 1 || vEnd < vStart)) {
    return { ok: false, error: `Versets invalides. Exemple : ${EXAMPLE}.` };
  }
  return { ok: true, book: bookId, chapter, vStart, vEnd };
}

/** « Jean 3 », « Jean 3:16 », « Jean 3:16-21 ». */
export function formatRef({ book, chapter, vStart, vEnd }) {
  const b = getBook(book);
  if (!b) return '';
  if (!chapter) return b.name;
  let out = `${b.name} ${chapter}`;
  if (vStart) {
    out += `:${vStart}`;
    if (vEnd && vEnd !== vStart) out += `-${vEnd}`;
  }
  return out;
}

/** Suggestions de noms de livres pour l'autocomplétion. */
export function suggestBooks(input, max = 8) {
  const s = normalizeBookPart(input || '');
  if (!s) return [];
  // Si la saisie contient déjà un livre complet suivi d'un nombre, pas de suggestion.
  if (/\d/.test(s.replace(/^[123] /, ''))) return [];
  const seen = new Set();
  const out = [];
  for (const b of BOOKS) {
    const n = normalize(b.name);
    const bare = n.replace(/^[123] /, '');
    if (n.startsWith(s) || bare.startsWith(s)) {
      if (n === s) continue;
      seen.add(b.id);
      out.push(b);
    }
  }
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (!seen.has(id) && normalize(alias).startsWith(s) && normalize(alias) !== s) {
      seen.add(id);
      out.push(getBook(id));
    }
  }
  return out.slice(0, max);
}
