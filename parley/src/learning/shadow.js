/**
 * Shadowing rules: tier progression and score combination. Pure.
 */
import { SHADOW_TIERS, SHADOW_RULES } from '../config.js';

const ORDER = ['S', 'M', 'L'];

/**
 * Next tier after an attempt. Up when the last 5 attempts at the current tier (since the tier was
 * entered) average 80 or more; down when they average below 50.
 * @param {'S'|'M'|'L'} tier
 * @param {{tier: string, score: number, at: number}[]} attempts
 * @param {number} [since] time the current tier was entered
 * @returns {'S'|'M'|'L'}
 */
export function nextTier(tier, attempts, since = 0) {
  const recent = attempts.filter((a) => a.tier === tier && a.at >= since).sort((a, b) => a.at - b.at).slice(-SHADOW_RULES.window);
  if (recent.length < SHADOW_RULES.window) return tier;
  const avg = recent.reduce((s, a) => s + a.score, 0) / recent.length;
  const i = ORDER.indexOf(tier);
  if (avg >= SHADOW_RULES.up && i < ORDER.length - 1) return ORDER[i + 1];
  if (avg < SHADOW_RULES.down && i > 0) return ORDER[i - 1];
  return tier;
}

/**
 * Whether a sentence length fits a tier.
 * @param {number} words
 * @param {'S'|'M'|'L'} tier
 */
export function fitsTier(words, tier) {
  const t = SHADOW_TIERS[tier];
  return words >= t.min && words <= t.max;
}

/**
 * Overall score from the available parts (weights 50 words, 30 pitch, 20 rhythm, renormalised).
 * @param {{word: number|null, pitch: number|null, rhythm: number|null}} parts
 * @returns {number|null}
 */
export function combineScore(parts) {
  const w = { word: 0.5, pitch: 0.3, rhythm: 0.2 };
  let s = 0;
  let total = 0;
  for (const k of Object.keys(w)) {
    if (parts[k] !== null && parts[k] !== undefined && Number.isFinite(parts[k])) { s += w[k] * parts[k]; total += w[k]; }
  }
  return total ? Math.round(s / total) : null;
}

/**
 * Keeps the newest `keep` attempts per tier.
 * @param {{tier: string, at: number}[]} attempts
 * @param {number} keep
 * @returns {object[]} attempts to delete
 */
export function attemptsToPrune(attempts, keep = SHADOW_RULES.keep) {
  const out = [];
  for (const t of ORDER) {
    const list = attempts.filter((a) => a.tier === t).sort((a, b) => b.at - a.at);
    out.push(...list.slice(keep));
  }
  return out;
}
