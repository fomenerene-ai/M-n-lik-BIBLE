/**
 * Spaced repetition, SM-2 style, with four answers: Again, Hard, Good, Easy. Pure.
 *
 * Card fields used: ease (>= 1.3, starts 2.5), interval (days), reps (successful reviews in a row),
 * lapses, due (ms timestamp), lastReviewedAt (ms or null: null means a new card).
 */

export const GRADES = ['again', 'hard', 'good', 'easy'];

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const MIN_EASE = 1.3;
const MAX_INTERVAL = 3650;
const RELEARN_MS = 10 * MIN;

/**
 * Scheduling fields for a new card.
 * @param {number} now ms
 */
export function newCardFields(now) {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, lastReviewedAt: null };
}

/**
 * Computes the next scheduling state.
 * @param {{ease: number, interval: number, reps: number, lapses: number}} card
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @param {number} now ms
 * @returns {{ease: number, interval: number, reps: number, lapses: number, due: number, lastReviewedAt: number}}
 */
export function schedule(card, grade, now) {
  let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card;
  if (!GRADES.includes(grade)) throw new Error(`Unknown grade ${grade}`);
  if (grade === 'again') {
    if (reps > 0) lapses += 1;
    return { ease: round2(Math.max(MIN_EASE, ease - 0.2)), interval: 0, reps: 0, lapses, due: now + RELEARN_MS, lastReviewedAt: now };
  }
  let next;
  if (grade === 'hard') {
    next = reps === 0 ? 1 : Math.max(interval, Math.round(interval * 1.2), 1);
    ease = Math.max(MIN_EASE, ease - 0.15);
  } else {
    const good = reps === 0 ? 1 : reps === 1 ? Math.max(6, interval + 1) : Math.max(interval + 1, Math.round(interval * ease));
    if (grade === 'good') next = good;
    else {
      next = reps === 0 ? 4 : Math.max(good + 1, Math.round(interval * ease * 1.3));
      ease += 0.15;
    }
  }
  next = Math.min(MAX_INTERVAL, next);
  return { ease: round2(ease), interval: next, reps: reps + 1, lapses, due: now + next * DAY, lastReviewedAt: now };
}

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Review order: due reviews first (oldest due first), then new cards (oldest first). New cards are unlimited.
 * Cards in relearning (Again, due within the next 10 minutes) count as due.
 * @param {object[]} cards
 * @param {number} now
 * @returns {{due: object[], fresh: object[]}}
 */
export function buildQueue(cards, now) {
  const due = cards.filter((c) => c.lastReviewedAt && c.due <= now + RELEARN_MS).sort((a, b) => a.due - b.due);
  const fresh = cards.filter((c) => !c.lastReviewedAt).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return { due, fresh };
}

/**
 * Human-readable interval for the rating buttons.
 * @param {number} ms
 */
export function formatInterval(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))} min`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))} h`;
  const d = Math.round(ms / DAY);
  if (d < 31) return `${d} d`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${(d / 365).toFixed(1)} y`;
}

/**
 * Interval previews for the four buttons.
 * @param {object} card
 * @param {number} now
 * @returns {Record<string, string>}
 */
export function previewIntervals(card, now) {
  return Object.fromEntries(GRADES.map((g) => [g, formatInterval(schedule(card, g, now).due - now)]));
}
