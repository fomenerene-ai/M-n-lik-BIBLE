/**
 * Silence-based segmentation of decoded audio. Pure (works on Float32Array samples).
 */

/**
 * Frame energies in dB.
 * @param {Float32Array} samples mono
 * @param {number} rate sample rate
 * @param {number} [frameSec]
 * @returns {Float32Array}
 */
export function frameDb(samples, rate, frameSec = 0.02) {
  const n = Math.max(1, Math.round(rate * frameSec));
  const frames = Math.floor(samples.length / n);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * n; i < (f + 1) * n; i++) s += samples[i] * samples[i];
    out[f] = 10 * Math.log10(s / n + 1e-10);
  }
  return out;
}

function percentile(arr, p) {
  const a = Array.from(arr).sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

/**
 * Speech regions [start, end] in seconds, separated by silences of at least minSilence.
 * The threshold adapts to the recording: 35 % of the way from the noise floor to the speech level.
 * @param {Float32Array} samples
 * @param {number} rate
 * @param {{minSilence?: number, frameSec?: number}} [o]
 * @returns {{start: number, end: number}[]}
 */
export function speechRegions(samples, rate, o = {}) {
  const frameSec = o.frameSec || 0.02;
  const db = frameDb(samples, rate, frameSec);
  if (!db.length) return [];
  const floor = percentile(db, 0.1);
  const loud = percentile(db, 0.95);
  if (loud - floor < 6) return loud > -50 ? [{ start: 0, end: db.length * frameSec }] : [];
  const thr = floor + 0.35 * (loud - floor);
  const minSilFrames = Math.round((o.minSilence ?? 0.25) / frameSec);
  const regions = [];
  let start = -1;
  let silent = 0;
  for (let f = 0; f < db.length; f++) {
    if (db[f] > thr) {
      if (start < 0) start = f;
      silent = 0;
    } else if (start >= 0) {
      silent += 1;
      if (silent >= minSilFrames) { regions.push({ start: start * frameSec, end: (f - silent + 1) * frameSec }); start = -1; silent = 0; }
    }
  }
  if (start >= 0) regions.push({ start: start * frameSec, end: (db.length - silent) * frameSec });
  return regions.filter((r) => r.end - r.start >= 0.12);
}

/**
 * Cuts audio into sentence-like segments of 1 to 12 seconds.
 * Speech regions are grouped until a long pause (>= 0.45 s) follows a group of at least 1.5 s, or the
 * next region would exceed the maximum. Over-long regions are split at their quietest point.
 * @param {Float32Array} samples
 * @param {number} rate
 * @param {{min?: number, max?: number, pad?: number}} [o]
 * @returns {{start: number, end: number}[]}
 */
export function segmentBySilence(samples, rate, o = {}) {
  const min = o.min ?? 1;
  const max = o.max ?? 12;
  const pad = o.pad ?? 0.12;
  const duration = samples.length / rate;
  const regions = [];
  for (const r of speechRegions(samples, rate)) {
    if (r.end - r.start <= max) { regions.push(r); continue; }
    // Split long regions at the quietest 20 ms frame near each max-length boundary.
    let s = r.start;
    while (r.end - s > max) {
      const from = s + max * 0.5;
      const to = s + max;
      const a = Math.floor(from * rate);
      const b = Math.floor(to * rate);
      const db = frameDb(samples.subarray(a, b), rate);
      let q = 0;
      for (let i = 1; i < db.length; i++) if (db[i] < db[q]) q = i;
      const cut = from + q * 0.02;
      regions.push({ start: s, end: cut });
      s = cut;
    }
    regions.push({ start: s, end: r.end });
  }
  const groups = [];
  let cur = null;
  for (const r of regions) {
    if (!cur) { cur = { ...r }; continue; }
    const gap = r.start - cur.end;
    const len = cur.end - cur.start;
    if ((gap >= 0.45 && len >= 1.5) || r.end - cur.start > max) { groups.push(cur); cur = { ...r }; } else cur.end = r.end;
  }
  if (cur) groups.push(cur);
  // Merge too-short groups into a neighbour when it fits, otherwise drop them (clicks, breaths).
  const out = [];
  for (const g of groups) {
    const prev = out[out.length - 1];
    if (g.end - g.start < min) {
      if (prev && g.end - prev.start <= max) prev.end = g.end;
      continue;
    }
    if (prev && prev.end - prev.start < min && g.end - prev.start <= max) { prev.end = g.end; continue; }
    out.push({ ...g });
  }
  return out.filter((g) => g.end - g.start >= min).map((g) => ({
    start: Math.max(0, Math.round((g.start - pad) * 100) / 100),
    end: Math.min(duration, Math.round((g.end + pad) * 100) / 100),
  }));
}

/**
 * First and last speech instants (for single-sentence clips like Common Voice).
 * @param {Float32Array} samples
 * @param {number} rate
 * @returns {{start: number, end: number}}
 */
export function speechBounds(samples, rate) {
  const r = speechRegions(samples, rate);
  const duration = samples.length / rate;
  if (!r.length) return { start: 0, end: duration };
  const r2 = (x) => Math.round(x * 100) / 100;
  return { start: r2(Math.max(0, r[0].start - 0.1)), end: r2(Math.min(duration, r[r.length - 1].end + 0.1)) };
}
