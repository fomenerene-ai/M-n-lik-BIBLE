/**
 * Adaptive level updates. Pure.
 *
 * A score of ADAPTIVE.onLevelScore (70) on content at the learner's level means "on level": no move.
 * Higher or lower scores pull the level up or down through an exponential moving average:
 *   target = current + gain * (score - 70) / 30
 *   next   = current + alpha * (target - current)
 * The result is clamped to [1, 10] and never moves more than 0.5 away from the level held at the
 * start of the day (the "anchor").
 */
import { ADAPTIVE } from '../config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Computes the next level after an activity.
 * @param {number} current current level 1..10
 * @param {number} score normalised activity score 0..100
 * @param {number} [anchor] level at the start of the day (defaults to current)
 * @returns {number} next level, rounded to 2 decimals
 */
export function nextLevel(current, score, anchor = current) {
  if (!Number.isFinite(score)) return current;
  const s = clamp(score, 0, 100);
  const target = current + (ADAPTIVE.gain * (s - ADAPTIVE.onLevelScore)) / 30;
  let next = current + ADAPTIVE.alpha * (target - current);
  next = clamp(next, anchor - ADAPTIVE.maxDailyMove, anchor + ADAPTIVE.maxDailyMove);
  next = clamp(next, ADAPTIVE.min, ADAPTIVE.max);
  return Math.round(next * 100) / 100;
}

/**
 * Returns the daily anchor for a skill, resetting it on a new day.
 * @param {{date?: string, values?: Record<string, number>}|undefined} anchors stored anchors
 * @param {string} skill e.g. "listeningLevel"
 * @param {number} current current level
 * @param {string} today YYYY-MM-DD
 * @returns {{anchor: number, anchors: {date: string, values: Record<string, number>}}}
 */
export function dailyAnchor(anchors, skill, current, today) {
  const fresh = !anchors || anchors.date !== today;
  const values = fresh ? {} : { ...anchors.values };
  if (values[skill] === undefined) values[skill] = current;
  return { anchor: values[skill], anchors: { date: today, values } };
}

