/**
 * Guided session state per local date.
 */
import { get, put } from './db.js';
import { SESSION_PLAN, XP } from '../config.js';
import { localDate } from '../learning/dates.js';
import { addXp } from './profile.js';

/** Empty session for a date. */
export function emptySession(date) {
  const steps = {};
  for (const s of SESSION_PLAN) steps[s.key] = { status: 'todo', minutes: 0 };
  return { date, steps, completedAt: null, xpEarned: 0 };
}

/** Today's (or a date's) session. */
export async function getSession(date = localDate()) {
  const s = await get('sessions', date);
  if (!s) return emptySession(date);
  const base = emptySession(date);
  return { ...base, ...s, steps: { ...base.steps, ...s.steps } };
}

/**
 * Key of the first unfinished step, or null when all are done.
 * @param {{steps: Record<string, {status: string}>}} session
 */
export function nextStepKey(session) {
  const s = SESSION_PLAN.find((p) => session.steps[p.key].status !== 'done');
  return s ? s.key : null;
}

/**
 * Records minutes and XP for a step, and marks it done when asked.
 * Completing the fifth step adds the session bonus once.
 * @param {string} key step key
 * @param {{minutes?: number, xp?: number, done?: boolean}} o
 * @returns {Promise<{session: object, bonus: number}>}
 */
export async function recordStep(key, o) {
  const s = await getSession();
  const step = s.steps[key];
  if (!step) throw new Error(`Unknown step ${key}`);
  step.minutes = Math.round((step.minutes + (o.minutes || 0)) * 100) / 100;
  s.xpEarned += o.xp || 0;
  if (o.done) step.status = 'done';
  let bonus = 0;
  if (!s.completedAt && SESSION_PLAN.every((p) => s.steps[p.key].status === 'done')) {
    s.completedAt = new Date().toISOString();
    bonus = XP.sessionBonus;
    s.xpEarned += bonus;
  }
  await put('sessions', s);
  if (bonus) await addXp(bonus);
  return { session: s, bonus };
}
