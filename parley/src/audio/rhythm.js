/**
 * Rhythm: duration ratio and pause placement versus the reference. Pure.
 */
import { speechRegions } from './segment.js';

/**
 * Speech span and pause positions (relative 0..1 within the span) of a recording.
 * @param {Float32Array} samples
 * @param {number} rate
 * @returns {{duration: number, pauses: number[]}|null}
 */
export function rhythmProfile(samples, rate) {
  const r = speechRegions(samples, rate, { minSilence: 0.15 });
  if (!r.length) return null;
  const start = r[0].start;
  const end = r[r.length - 1].end;
  const span = end - start;
  if (span <= 0) return null;
  const pauses = [];
  for (let i = 1; i < r.length; i++) pauses.push(((r[i - 1].end + r[i].start) / 2 - start) / span);
  return { duration: span, pauses };
}

/**
 * Rhythm score 0..100.
 * Duration: 100 for the same length, 0 at half or double. Pauses: share of matched pauses (within 8 %
 * of the span) over all pauses; skipped when the reference pauses are unknown (TTS reference).
 * @param {{duration: number, pauses: number[]|null}} ref
 * @param {{duration: number, pauses: number[]}} learner
 * @returns {{score: number, durationScore: number, pauseScore: number|null, ratio: number}}
 */
export function rhythmScore(ref, learner) {
  const ratio = learner.duration / ref.duration;
  const durationScore = Math.round(100 * Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(2)));
  if (!ref.pauses) return { score: durationScore, durationScore, pauseScore: null, ratio };
  let pauseScore;
  const total = ref.pauses.length + learner.pauses.length;
  if (!total) pauseScore = 100;
  else {
    const used = new Set();
    let matched = 0;
    for (const p of ref.pauses) {
      const k = learner.pauses.findIndex((q, i) => !used.has(i) && Math.abs(q - p) <= 0.08);
      if (k >= 0) { used.add(k); matched += 1; }
    }
    pauseScore = Math.round((200 * matched) / total);
  }
  return { score: Math.round(0.6 * durationScore + 0.4 * pauseScore), durationScore, pauseScore, ratio };
}
