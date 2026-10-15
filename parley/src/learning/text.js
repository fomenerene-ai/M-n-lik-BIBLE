/**
 * Text helpers: normalisation, tokenising, sentence splitting, card type inference. Pure.
 */

/**
 * Normalises a word for comparison: lowercase, curly quotes to straight, strip surrounding punctuation.
 * @param {string} w
 */
export function normWord(w) {
  return w.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '').replace(/^'+|'+$/g, '');
}

/**
 * Splits text into words (keeps the original spelling).
 * @param {string} text
 * @returns {string[]}
 */
export function words(text) {
  return String(text || '').split(/[\s—–]+/).filter((w) => normWord(w).length > 0);
}

/** Number of words. */
export function wordCount(text) {
  return words(text).length;
}

const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|Inc|Ltd|Co|U\.S|U\.K|a\.m|p\.m|No)\.$/i;
const CLOSERS = '.!?"\u201d\')';

/**
 * Indices (exclusive ends) of sentence boundaries that are confirmed by what follows:
 * an end mark, optional closing quotes, a space, then an uppercase letter, digit or opening quote.
 * @param {string} s normalised text (single spaces)
 * @returns {number[]}
 */
function boundaries(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (!'.!?'.includes(s[i])) continue;
    let j = i + 1;
    while (j < s.length && CLOSERS.includes(s[j])) j++;
    if (s[j] === ' ' && /[A-Z0-9"\u201c(]/.test(s[j + 1] || '') && !ABBREV.test(s.slice(0, i + 1))) out.push(j);
    i = j - 1;
  }
  return out;
}

/**
 * Splits text into sentences. Handles common abbreviations and decimals.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const out = [];
  let start = 0;
  for (const end of boundaries(s)) { out.push(s.slice(start, end).trim()); start = end; }
  if (s.slice(start).trim()) out.push(s.slice(start).trim());
  return out;
}

/**
 * Incremental sentence splitter for streamed text: returns sentences as soon as the next one starts.
 * @returns {{push: (chunk: string) => string[], flush: () => string[]}}
 */
export function sentenceStream() {
  let buf = '';
  return {
    push(chunk) {
      buf = (buf + chunk).replace(/\s+/g, ' ').replace(/^ /, '');
      const b = boundaries(buf);
      if (!b.length) return [];
      const last = b[b.length - 1];
      const done = splitSentences(buf.slice(0, last));
      buf = buf.slice(last).trimStart();
      return done;
    },
    flush() {
      const rest = splitSentences(buf);
      buf = '';
      return rest;
    },
  };
}

const PARTICLES = new Set(['up', 'down', 'out', 'off', 'in', 'on', 'over', 'away', 'back', 'through', 'about', 'around', 'along', 'across', 'by', 'into', 'after', 'ahead', 'forward', 'apart']);

/**
 * Guesses a card type from its front text.
 * @param {string} front
 * @returns {'word'|'expression'|'phrasal'|'sentence'}
 */
export function inferCardType(front) {
  const ws = words(front).map(normWord);
  if (ws.length <= 1) return 'word';
  if (ws.length >= 7 || /[.!?]$/.test(front.trim())) return 'sentence';
  if (ws.length <= 4 && PARTICLES.has(ws[1]) && (ws.length === 2 || PARTICLES.has(ws[2]) || ws.length <= 4)) return 'phrasal';
  return 'expression';
}

/**
 * Finds the sentence of a text that contains a word (for card context).
 * @param {string} text
 * @param {string} word
 */
export function sentenceContaining(text, word) {
  const w = normWord(word);
  return splitSentences(text).find((s) => words(s).some((x) => normWord(x) === w)) || '';
}
