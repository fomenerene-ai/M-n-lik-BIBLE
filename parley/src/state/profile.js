/**
 * Learner profile: skill levels, XP and level.
 */
import { get, put } from './db.js';
import { levelInfo } from '../learning/xp.js';
import { nextLevel, dailyAnchor } from '../learning/adaptive.js';
import { localDate } from '../learning/dates.js';

export const DEFAULT_PROFILE = {
  id: 'main',
  listeningLevel: 4.0,
  speakingLevel: 4.0,
  shadowLevel: 4.0,
  shadowTier: 'S',
  xp: 0,
  level: 1,
  placementDoneAt: null,
  levelAnchors: null,
};

/** @returns {Promise<typeof DEFAULT_PROFILE>} */
export async function getProfile() {
  const p = await get('profile', 'main');
  return { ...DEFAULT_PROFILE, ...(p || {}) };
}

/** Saves the whole profile. */
export async function saveProfile(p) {
  await put('profile', { ...p, id: 'main', level: levelInfo(p.xp).level });
}

/**
 * Adds XP.
 * @param {number} amount
 * @returns {Promise<{xp: number, before: number, after: number, leveledUp: boolean}>}
 */
export async function addXp(amount) {
  const p = await getProfile();
  const before = levelInfo(p.xp).level;
  p.xp = Math.max(0, Math.round(p.xp + (amount || 0)));
  const after = levelInfo(p.xp).level;
  await saveProfile(p);
  return { xp: p.xp, before, after, leveledUp: after > before };
}

/**
 * Updates one skill level with the adaptive rule.
 * @param {'listeningLevel'|'speakingLevel'|'shadowLevel'} skill
 * @param {number} score 0..100
 * @returns {Promise<{before: number, after: number}>}
 */
export async function updateSkill(skill, score) {
  const p = await getProfile();
  const { anchor, anchors } = dailyAnchor(p.levelAnchors, skill, p[skill], localDate());
  const before = p[skill];
  p[skill] = nextLevel(before, score, anchor);
  p.levelAnchors = anchors;
  await saveProfile(p);
  return { before, after: p[skill] };
}

/**
 * Sets levels directly (placement test).
 * @param {{listeningLevel?: number, speakingLevel?: number, shadowLevel?: number}} levels
 */
export async function setLevels(levels) {
  const p = await getProfile();
  for (const k of ['listeningLevel', 'speakingLevel', 'shadowLevel']) {
    if (Number.isFinite(levels[k])) p[k] = Math.round(Math.min(10, Math.max(1, levels[k])) * 100) / 100;
  }
  p.placementDoneAt = new Date().toISOString();
  p.levelAnchors = null;
  await saveProfile(p);
  return p;
}
