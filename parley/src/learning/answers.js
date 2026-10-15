/**
 * Checking comprehension answers locally (no API call). Pure.
 */
import { words } from './text.js';
import { canon } from './diff.js';

const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'it', 'is', 'was', 'and', 'for']);

/**
 * Gap answers: equal after normalisation (case, punctuation, contractions spelled with curly quotes).
 * @param {string} expected
 * @param {string} given
 */
export function checkGap(expected, given) {
  const e = words(expected).map(canon).join(' ');
  const g = words(given).map(canon).join(' ');
  return e.length > 0 && e === g;
}

/**
 * Short answers: every content word of the expected answer appears in the learner's answer.
 * @param {string} expected
 * @param {string} given
 */
export function checkShort(expected, given) {
  const need = words(expected).map(canon).filter((w) => !STOP.has(w));
  const have = new Set(words(given).map(canon));
  if (!need.length) return checkGap(expected, given);
  return need.every((w) => have.has(w) || have.has(w.replace(/s$/, '')) || have.has(`${w}s`));
}

/**
 * Validates generated exercises against their source text: each gap sentence has one "____" and,
 * once filled, appears in the text; each choice question's answer is one of its options.
 * @param {{questions: object[], gaps: object[]}} ex
 * @param {string} sourceText
 * @returns {string[]} problems
 */
export function checkExercises(ex, sourceText) {
  const errs = [];
  const flat = ` ${words(sourceText).map(canon).join(' ')} `;
  ex.gaps.forEach((g, i) => {
    if ((g.sentence.match(/____/g) || []).length !== 1) errs.push(`gaps[${i}].sentence must contain "____" exactly once`);
    else {
      const filled = ` ${words(g.sentence.replace('____', g.answer)).map(canon).join(' ')} `;
      if (!flat.includes(filled)) errs.push(`gaps[${i}] filled sentence is not copied word for word from the text`);
    }
  });
  ex.questions.forEach((q, i) => {
    if (q.kind === 'choice' && (q.options.length !== 4 || !q.options.includes(q.answer))) errs.push(`questions[${i}] needs 4 options including the exact answer`);
  });
  return errs;
}
