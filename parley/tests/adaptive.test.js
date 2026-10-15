import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextLevel, dailyAnchor } from '../src/learning/adaptive.js';
import { bandFor } from '../src/config.js';

test('score of 70 keeps the level', () => {
  assert.equal(nextLevel(5, 70), 5);
});

test('high scores raise, low scores lower, by an EMA step', () => {
  assert.equal(nextLevel(5, 100), 5.3); // 5 + 0.15 * 2
  assert.equal(nextLevel(5, 40), 4.7);
  assert.ok(nextLevel(5, 85) > 5 && nextLevel(5, 85) < 5.3);
});

test('clamped to 1..10', () => {
  assert.equal(nextLevel(9.9, 100, 9.9), 10);
  assert.equal(nextLevel(1.1, 0, 1.1), 1);
});

test('never moves more than 0.5 from the daily anchor', () => {
  let lv = 5;
  for (let i = 0; i < 10; i++) lv = nextLevel(lv, 100, 5);
  assert.equal(lv, 5.5);
  lv = 5;
  for (let i = 0; i < 10; i++) lv = nextLevel(lv, 0, 5);
  assert.equal(lv, 4.5);
});

test('ignores non-finite scores', () => {
  assert.equal(nextLevel(5, NaN), 5);
});

test('daily anchor resets on a new day and is per skill', () => {
  let r = dailyAnchor(null, 'listeningLevel', 5, '2026-10-01');
  assert.equal(r.anchor, 5);
  r = dailyAnchor(r.anchors, 'listeningLevel', 5.3, '2026-10-01');
  assert.equal(r.anchor, 5, 'same day keeps the first value');
  r = dailyAnchor(r.anchors, 'speakingLevel', 3, '2026-10-01');
  assert.equal(r.anchor, 3);
  r = dailyAnchor(r.anchors, 'listeningLevel', 5.5, '2026-10-02');
  assert.equal(r.anchor, 5.5);
  assert.deepEqual(Object.keys(r.anchors.values), ['listeningLevel']);
});

test('level bands map to CEFR labels', () => {
  assert.equal(bandFor(3).cefr, 'B1');
  assert.equal(bandFor(6).cefr, 'B2-');
  assert.equal(bandFor(8).cefr, 'B2+');
  assert.equal(bandFor(10).cefr, 'C1');
});

test('placement listening level without the API', async () => {
  const { listeningFromResults, PLACEMENT_CLIPS } = await import('../src/learning/placement-bank.js');
  const r = (c) => PLACEMENT_CLIPS.map((clip, i) => ({ difficulty: clip.difficulty, correct: c[i] }));
  assert.equal(listeningFromResults(r([false, false, false, false])), 2.5);
  assert.equal(listeningFromResults(r([true, true, false, false])), 5);
  assert.equal(listeningFromResults(r([true, true, true, true])), 9);
  assert.equal(listeningFromResults(r([false, true, true, false])), 6, 'a miss on an easier clip lowers the result');
  for (const c of PLACEMENT_CLIPS) assert.ok(c.options.includes(c.answer));
});
