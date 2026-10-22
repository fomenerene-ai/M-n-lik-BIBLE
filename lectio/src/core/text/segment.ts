// Découpage d'un paragraphe en phrases : Intl.Segmenter, corrigé par des règles maison
// pour les abréviations françaises et anglaises que l'ICU coupe à tort.

import type { Lang, Sentence } from '../model';

// Comparaison en minuscules, sans le point final. « etc » est volontairement absent :
// il termine très souvent une phrase.
const ABBREVIATIONS = new Set([
  // français
  'm',
  'mm',
  'mme',
  'mmes',
  'mlle',
  'mlles',
  'dr',
  'pr',
  'me',
  'mgr',
  'st',
  'ste',
  'p',
  'pp',
  'ex',
  'p. ex',
  'cf',
  'art',
  'al',
  'chap',
  'vol',
  'fig',
  'éd',
  'n°',
  'no',
  'env',
  'av',
  'apr',
  'hab',
  'tél',
  'min',
  'max',
  'sq',
  'suiv',
  'op',
  'cit',
  'ibid',
  // anglais
  'mr',
  'mrs',
  'ms',
  'prof',
  'jr',
  'sr',
  'vs',
  'e.g',
  'i.e',
  'approx',
  'dept',
  'est',
  'gen',
  'gov',
  'lt',
  'col',
  'sgt',
  'capt',
  'rev',
  'hon',
  'mt',
  'ft',
  'pp',
  'cca',
]);

const CLOSERS = /^[»”’")\]]+/u;
const MAX_SENTENCE = 320;

const segmenters = new Map<Lang, Intl.Segmenter>();
function getSegmenter(lang: Lang): Intl.Segmenter {
  let s = segmenters.get(lang);
  if (!s) {
    s = new Intl.Segmenter(lang, { granularity: 'sentence' });
    segmenters.set(lang, s);
  }
  return s;
}

/** Dernier « mot » avant le point final d'un segment, en minuscules, sans le point. */
function lastToken(segment: string): string | null {
  const m = /(?:^|[\s(«“"'’])((?:p\. )?[\p{L}\d°.]+)\.\s*$/u.exec(segment);
  return m?.[1] ? m[1].toLowerCase() : null;
}

function endsWithAbbreviation(segment: string): boolean {
  const token = lastToken(segment);
  if (!token) return false;
  if (ABBREVIATIONS.has(token)) return true;
  // « p. ex. » : le dernier jeton capturé peut être « ex » précédé de « p. »
  if (/\bp\. ex$/.test(token)) return true;
  // Initiale isolée : « J. », « R. »
  if (/^\p{Lu}$/u.test(token.toUpperCase()) && token.length === 1) {
    return /(?:^|\s)\p{Lu}\.\s*$/u.test(segment);
  }
  // Sigles à points : U.S., p.m., a.m.
  if (/^(?:\p{L}\.)+\p{L}$/u.test(token)) return true;
  return false;
}

type Piece = { text: string; start: number };

/** Découpe brute ICU puis fusion des faux découpages. */
function rawPieces(text: string, lang: Lang): Piece[] {
  const pieces: Piece[] = [];
  for (const seg of getSegmenter(lang).segment(text)) {
    pieces.push({ text: seg.segment, start: seg.index });
  }
  const merged: Piece[] = [];
  for (const piece of pieces) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...piece });
      continue;
    }
    // Guillemet ou parenthèse fermante rejetée au début du segment suivant.
    const closer = CLOSERS.exec(piece.text);
    if (closer && closer[0].length > 0) {
      const moved = closer[0];
      prev.text += moved;
      piece.text = piece.text.slice(moved.length);
      piece.start += moved.length;
      if (!piece.text.trim()) continue;
    }
    const startsLower = /^\s*[\p{Ll}\d]/u.test(piece.text);
    if (endsWithAbbreviation(prev.text) || startsLower) {
      prev.text += piece.text;
    } else {
      merged.push({ ...piece });
    }
  }
  return merged;
}

/** Coupe une phrase trop longue sur une ponctuation faible, pour la voix et le surlignage. */
function splitLong(piece: Piece): Piece[] {
  if (piece.text.length <= MAX_SENTENCE) return [piece];
  const out: Piece[] = [];
  let rest = piece;
  while (rest.text.length > MAX_SENTENCE) {
    const window = rest.text.slice(0, MAX_SENTENCE);
    let cut = -1;
    for (const re of [/[;:](?=\s)/g, /,(?=\s)/g, /\s/g]) {
      let m: RegExpExecArray | null;
      let last = -1;
      while ((m = re.exec(window))) if (m.index > MAX_SENTENCE / 3) last = m.index + 1;
      if (last > 0) {
        cut = last;
        break;
      }
    }
    if (cut < 0) cut = MAX_SENTENCE;
    out.push({ text: rest.text.slice(0, cut), start: rest.start });
    rest = { text: rest.text.slice(cut), start: rest.start + cut };
  }
  out.push(rest);
  return out;
}

/**
 * Découpe `text` en phrases. Les bornes `start`/`end` indexent `text` et excluent
 * les espaces de bord ; `id` vaut `${blockId}.s${n}`.
 */
export function segmentSentences(text: string, lang: Lang, blockId: string): Sentence[] {
  const sentences: Sentence[] = [];
  for (const piece of rawPieces(text, lang).flatMap(splitLong)) {
    const leading = piece.text.length - piece.text.trimStart().length;
    const trimmed = piece.text.trim();
    if (!trimmed) continue;
    const start = piece.start + leading;
    sentences.push({
      id: `${blockId}.s${sentences.length}`,
      text: trimmed,
      start,
      end: start + trimmed.length,
    });
  }
  return sentences;
}
