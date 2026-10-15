/**
 * Fundamental frequency (F0) extraction with the YIN algorithm, and contour helpers. Pure.
 * de Cheveigne and Kawahara (2002): difference function, cumulative mean normalised difference,
 * absolute threshold, parabolic interpolation.
 */

/**
 * Estimates F0 of one frame.
 * @param {Float32Array} frame
 * @param {number} rate
 * @param {{fmin?: number, fmax?: number, threshold?: number}} [o]
 * @returns {number|null} Hz, or null when unvoiced
 */
export function yin(frame, rate, o = {}) {
  const fmin = o.fmin ?? 65;
  const fmax = o.fmax ?? 450;
  const threshold = o.threshold ?? 0.15;
  const maxTau = Math.min(Math.floor(rate / fmin), Math.floor(frame.length / 2));
  const minTau = Math.max(2, Math.floor(rate / fmax));
  if (maxTau <= minTau) return null;
  const W = frame.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const x = frame[i] - frame[i + tau]; s += x * x; }
    d[tau] = s;
  }
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) { running += d[tau]; cmnd[tau] = running ? (d[tau] * tau) / running : 1; }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the minimum.
  const a = cmnd[tau - 1] ?? cmnd[tau];
  const b = cmnd[tau];
  const c = cmnd[tau + 1] ?? cmnd[tau];
  const denom = a - 2 * b + c;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  return rate / (tau + shift);
}

/**
 * Pitch track over a whole signal.
 * @param {Float32Array} samples
 * @param {number} rate
 * @param {{hop?: number, frame?: number, minRms?: number}} [o] seconds
 * @returns {{t: number, f0: number|null}[]}
 */
export function pitchTrack(samples, rate, o = {}) {
  const hop = Math.round((o.hop ?? 0.01) * rate);
  const size = Math.round((o.frame ?? 0.04) * rate);
  const minRms = o.minRms ?? 0.01;
  const out = [];
  for (let start = 0; start + size <= samples.length; start += hop) {
    const frame = samples.subarray(start, start + size);
    let e = 0;
    for (let i = 0; i < frame.length; i++) e += frame[i] * frame[i];
    const rms = Math.sqrt(e / frame.length);
    out.push({ t: (start + size / 2) / rate, f0: rms < minRms ? null : yin(frame, rate) });
  }
  return out;
}

/**
 * Voiced contour in semitones relative to the speaker's median F0, with octave-jump cleanup and a
 * median smoothing filter. Unvoiced frames are dropped.
 * @param {{t: number, f0: number|null}[]} track
 * @returns {{t: number, st: number}[]}
 */
export function semitoneContour(track) {
  const voiced = track.filter((p) => p.f0);
  if (voiced.length < 3) return [];
  const sorted = voiced.map((p) => p.f0).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let pts = voiced.map((p) => {
    let st = 12 * Math.log2(p.f0 / median);
    if (st > 9) st -= 12; else if (st < -9) st += 12; // octave errors
    return { t: p.t, st };
  });
  pts = pts.filter((p) => Math.abs(p.st) <= 12);
  const k = 2;
  return pts.map((p, i) => {
    const win = pts.slice(Math.max(0, i - k), i + k + 1).map((q) => q.st).sort((a, b) => a - b);
    return { t: p.t, st: win[Math.floor(win.length / 2)] };
  });
}

/**
 * Resamples a contour to n evenly spaced points over its time span (linear interpolation).
 * @param {{t: number, st: number}[]} c
 * @param {number} n
 * @returns {number[]}
 */
export function resample(c, n) {
  if (!c.length) return [];
  if (c.length === 1) return new Array(n).fill(c[0].st);
  const t0 = c[0].t;
  const t1 = c[c.length - 1].t;
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    while (j < c.length - 2 && c[j + 1].t < t) j++;
    const a = c[j];
    const b = c[j + 1];
    const w = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push(a.st + Math.min(1, Math.max(0, w)) * (b.st - a.st));
  }
  return out;
}

/**
 * Downsamples by an integer factor with a box low-pass (enough for speech F0 analysis).
 * @param {Float32Array} samples
 * @param {number} from source rate
 * @param {number} to target rate (from / to is rounded)
 * @returns {{samples: Float32Array, rate: number}}
 */
export function downsample(samples, from, to) {
  const k = Math.max(1, Math.round(from / to));
  if (k === 1) return { samples, rate: from };
  const out = new Float32Array(Math.floor(samples.length / k));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += samples[i * k + j];
    out[i] = s / k;
  }
  return { samples: out, rate: from / k };
}
