/**
 * Word alignment between a target sentence and what the learner typed or said. Pure.
 * Used by Dictation (typed text), Shadowing and "Say it" (speech recognition transcript).
 */
import { words, normWord } from './text.js';

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const EQUIV = { okay: 'ok', 'o.k': 'ok', percent: '%', gonna: 'going', wanna: 'want' };

/**
 * Canonical form used for comparison.
 * @param {string} w
 */
export function canon(w) {
  let n = normWord(w).replace(/\.$/, '');
  if (/^\d+$/.test(n) && Number(n) <= 20) n = NUMBERS[Number(n)];
  return EQUIV[n] || n;
}

/**
 * Aligns target and hypothesis words (Levenshtein with backtrace).
 * @param {string} target reference text
 * @param {string} said learner text
 * @returns {{type: 'correct'|'wrong'|'missing'|'extra', target?: string, said?: string}[]}
 */
export function alignWords(target, said) {
  const t = words(target);
  const s = words(said);
  const tc = t.map(canon);
  const sc = s.map(canon);
  const n = t.length;
  const m = s.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = d[i - 1][j - 1] + (tc[i - 1] === sc[j - 1] ? 0 : 1);
      d[i][j] = Math.min(sub, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (tc[i - 1] === sc[j - 1] ? 0 : 1)) {
      ops.push(tc[i - 1] === sc[j - 1] ? { type: 'correct', target: t[i - 1], said: s[j - 1] } : { type: 'wrong', target: t[i - 1], said: s[j - 1] });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ type: 'missing', target: t[i - 1] });
      i--;
    } else {
      ops.push({ type: 'extra', said: s[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

/**
 * Sentence score 0..100: correct words over (target words + extra words).
 * @param {ReturnType<typeof alignWords>} ops
 */
export function alignmentScore(ops) {
  const correct = ops.filter((o) => o.type === 'correct').length;
  const target = ops.filter((o) => o.type !== 'extra').length;
  const extra = ops.filter((o) => o.type === 'extra').length;
  if (target + extra === 0) return 0;
  return Math.round((correct / (target + extra)) * 100);
}

/**
 * Target words the learner missed or got wrong (normalised), for "missed twice" tracking.
 * @param {ReturnType<typeof alignWords>} ops
 * @returns {string[]}
 */
export function missedWords(ops) {
  return ops.filter((o) => o.type === 'missing' || o.type === 'wrong').map((o) => normWord(o.target)).filter((w) => w.length > 2);
}
