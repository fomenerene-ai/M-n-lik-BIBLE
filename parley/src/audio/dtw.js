/**
 * Dynamic time warping between two contours, and a 0-100 similarity score. Pure.
 */

/**
 * DTW with a Sakoe-Chiba band.
 * @param {number[]} a
 * @param {number[]} b
 * @param {{band?: number}} [o] band as a fraction of the longer length (default 0.25)
 * @returns {{distance: number, steps: number, mean: number}} mean = average absolute difference along the path
 */
export function dtw(a, b, o = {}) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return { distance: Infinity, steps: 0, mean: Infinity };
  const band = Math.max(Math.abs(n - m), Math.ceil((o.band ?? 0.25) * Math.max(n, m)));
  const INF = Infinity;
  let prev = new Float64Array(m + 1).fill(INF);
  let prevSteps = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    const cur = new Float64Array(m + 1).fill(INF);
    const curSteps = new Float64Array(m + 1);
    const center = Math.round((i * m) / n);
    const lo = Math.max(1, center - band);
    const hi = Math.min(m, center + band);
    for (let j = lo; j <= hi; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      let best = prev[j - 1];
      let steps = prevSteps[j - 1];
      if (prev[j] < best) { best = prev[j]; steps = prevSteps[j]; }
      if (cur[j - 1] < best) { best = cur[j - 1]; steps = curSteps[j - 1]; }
      cur[j] = cost + best;
      curSteps[j] = steps + 1;
    }
    prev = cur;
    prevSteps = curSteps;
  }
  const distance = prev[m];
  const steps = prevSteps[m] || 1;
  return { distance, steps, mean: distance / steps };
}

/**
 * Similarity of two semitone contours: 100 when identical, 0 at a mean gap of 4 semitones.
 * @param {number[]} ref
 * @param {number[]} learner
 */
export function contourSimilarity(ref, learner) {
  const { mean } = dtw(ref, learner);
  if (!Number.isFinite(mean)) return null;
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - mean / 4))));
}
