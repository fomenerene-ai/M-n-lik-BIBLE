/**
 * XP and levels. Pure.
 * - 10 XP per active minute, plus a quality bonus up to 50 percent.
 * - 100 XP for a completed guided session.
 * - XP to go from level L to L+1: 150 + 25 * L.
 */
import { XP } from '../config.js';

/**
 * XP needed to go from level L to L+1.
 * @param {number} level >= 1
 */
export function xpToAdvance(level) {
  return XP.levelBase + XP.levelPerLevel * level;
}

/**
 * Level details for a total XP.
 * @param {number} totalXp
 * @returns {{level: number, xpInLevel: number, need: number, xpToNext: number}}
 */
export function levelInfo(totalXp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpToAdvance(level)) { rest -= xpToAdvance(level); level += 1; }
  const need = xpToAdvance(level);
  return { level, xpInLevel: rest, need, xpToNext: need - rest };
}

/**
 * XP earned for an activity.
 * @param {number} minutes active minutes
 * @param {number|null} [quality] activity score 0..1, null when there is no score
 * @returns {number}
 */
export function xpForActivity(minutes, quality = null) {
  if (!(minutes > 0)) return 0;
  const q = quality === null || quality === undefined || Number.isNaN(quality) ? 0 : Math.min(1, Math.max(0, quality));
  return Math.round(minutes * XP.perMinute * (1 + XP.maxQualityBonus * q));
}
