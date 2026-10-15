import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yin, pitchTrack, semitoneContour, resample, downsample } from '../src/audio/pitch.js';
import { dtw, contourSimilarity } from '../src/audio/dtw.js';
import { rhythmScore, rhythmProfile } from '../src/audio/rhythm.js';
import { nextTier, combineScore, fitsTier, attemptsToPrune } from '../src/learning/shadow.js';

const RATE = 16000;
const sine = (f, sec, amp = 0.5) => Float32Array.from({ length: Math.round(sec * RATE) }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / RATE));
function sweep(f0, f1, sec) {
  const n = Math.round(sec * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) { const f = f0 + ((f1 - f0) * i) / n; phase += (2 * Math.PI * f) / RATE; out[i] = 0.5 * Math.sin(phase); }
  return out;
}
// A voice-like signal: fundamental plus harmonics.
function voice(f, sec) {
  return Float32Array.from({ length: Math.round(sec * RATE) }, (_, i) => { const t = (2 * Math.PI * f * i) / RATE; return 0.4 * Math.sin(t) + 0.25 * Math.sin(2 * t) + 0.15 * Math.sin(3 * t); });
}

test('YIN finds pure and harmonic tones within 1 %', () => {
  for (const f of [90, 150, 220, 330]) {
    const est = yin(sine(f, 0.04), RATE);
    assert.ok(Math.abs(est - f) / f < 0.01, `${f} -> ${est}`);
    const v = yin(voice(f, 0.04), RATE);
    assert.ok(Math.abs(v - f) / f < 0.01, `voice ${f} -> ${v}`);
  }
  assert.equal(yin(new Float32Array(640), RATE), null);
});

test('pitch track follows a rising sweep and skips silence', () => {
  const sig = new Float32Array(Math.round(1.4 * RATE));
  sig.set(sweep(150, 300, 1), Math.round(0.2 * RATE));
  const track = pitchTrack(sig, RATE);
  const voiced = track.filter((p) => p.f0);
  assert.ok(voiced.length > 80);
  assert.equal(track.filter((p) => p.t < 0.15 && p.f0).length, 0, 'silence is unvoiced');
  let rising = 0;
  for (let i = 5; i < voiced.length; i += 5) if (voiced[i].f0 > voiced[i - 5].f0) rising += 1;
  assert.ok(rising / Math.floor(voiced.length / 5) > 0.9);
  const mid = voiced[Math.floor(voiced.length / 2)];
  const expected = 150 + 150 * (mid.t - 0.2);
  assert.ok(Math.abs(mid.f0 - expected) / expected < 0.03, `${mid.f0} vs ${expected}`);
});

test('semitone contour is speaker independent', () => {
  const low = semitoneContour(pitchTrack(sweep(100, 160, 0.8), RATE));
  const high = semitoneContour(pitchTrack(sweep(200, 320, 0.8), RATE));
  const a = resample(low, 50);
  const b = resample(high, 50);
  assert.equal(a.length, 50);
  assert.ok(contourSimilarity(a, b) >= 90, `similarity ${contourSimilarity(a, b)}`);
});

test('DTW: identical 100, time-stretched high, inverted low', () => {
  const up = Array.from({ length: 40 }, (_, i) => (i / 39) * 6 - 3);
  const stretched = Array.from({ length: 60 }, (_, i) => (i / 59) * 6 - 3);
  const down = up.slice().reverse();
  assert.equal(contourSimilarity(up, up), 100);
  assert.ok(contourSimilarity(up, stretched) >= 95);
  assert.ok(contourSimilarity(up, down) <= 50, `${contourSimilarity(up, down)}`);
  assert.equal(dtw([], [1]).distance, Infinity);
  assert.equal(contourSimilarity([], [1]), null);
});

test('rhythm: duration ratio and pause placement', () => {
  assert.equal(rhythmScore({ duration: 2, pauses: [0.5] }, { duration: 2, pauses: [0.52] }).score, 100);
  assert.equal(rhythmScore({ duration: 2, pauses: null }, { duration: 4, pauses: [] }).score, 0);
  const r = rhythmScore({ duration: 2, pauses: [0.3, 0.7] }, { duration: 2.4, pauses: [0.3] });
  assert.equal(r.pauseScore, 67);
  assert.ok(r.durationScore > 70 && r.durationScore < 80);
  const sig = new Float32Array(Math.round(2 * RATE));
  sig.set(voice(150, 0.6), Math.round(0.1 * RATE));
  sig.set(voice(150, 0.6), Math.round(1.0 * RATE));
  const p = rhythmProfile(sig, RATE);
  assert.ok(Math.abs(p.duration - 1.5) < 0.06, `${p.duration}`);
  assert.equal(p.pauses.length, 1);
  assert.ok(Math.abs(p.pauses[0] - 0.5) < 0.05);
});

test('tier progression over the last 5 attempts at the tier', () => {
  const at = (tier, scores, start = 0) => scores.map((score, i) => ({ tier, score, at: start + i }));
  assert.equal(nextTier('S', at('S', [90, 90, 90, 90])), 'S', 'needs 5 attempts');
  assert.equal(nextTier('S', at('S', [70, 75, 80, 85, 85])), 'S', 'average 79 stays');
  assert.equal(nextTier('S', at('S', [80, 80, 85, 85, 90])), 'M');
  assert.equal(nextTier('M', at('M', [40, 50, 45, 55, 40])), 'S');
  assert.equal(nextTier('L', at('L', [95, 95, 95, 95, 95])), 'L', 'L is the top');
  assert.equal(nextTier('S', at('S', [10, 10, 10, 10, 10])), 'S', 'S is the bottom');
  assert.equal(nextTier('M', [...at('M', [90, 90, 90, 90, 90]), ...at('M', [60], 100)], 50), 'M', 'only attempts since entering the tier');
});

test('combined score renormalises missing parts', () => {
  assert.equal(combineScore({ word: 80, pitch: 60, rhythm: 50 }), 68);
  assert.equal(combineScore({ word: 80, pitch: null, rhythm: 50 }), 71);
  assert.equal(combineScore({ word: null, pitch: null, rhythm: null }), null);
  assert.ok(fitsTier(6, 'S') && !fitsTier(9, 'S') && fitsTier(9, 'M') && fitsTier(22, 'L'));
  const many = Array.from({ length: 55 }, (_, i) => ({ tier: 'S', at: i }));
  assert.equal(attemptsToPrune(many).length, 5);
  assert.equal(attemptsToPrune(many)[0].at, 4);
});

test('downsampled 48 kHz voice keeps its pitch', () => {
  const hi = Float32Array.from({ length: 48000 * 0.2 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 180 * i) / 48000));
  const d = downsample(hi, 48000, 16000);
  assert.equal(d.rate, 16000);
  const f = yin(d.samples.subarray(0, 640), d.rate);
  assert.ok(Math.abs(f - 180) < 2, `${f}`);
});

test('built-in shadowing sentences fit their tier', async () => {
  const { SHADOW_BANK } = await import('../src/learning/shadow-bank.js');
  const { wordCount } = await import('../src/learning/text.js');
  for (const t of ['S', 'M', 'L']) for (const s of SHADOW_BANK[t]) assert.ok(fitsTier(wordCount(s), t), `${t}: ${s}`);
});
