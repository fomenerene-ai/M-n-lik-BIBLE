import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpToAdvance, levelInfo, xpForActivity } from '../src/learning/xp.js';

test('xp to advance follows 150 + 25 * L', () => {
  assert.equal(xpToAdvance(1), 175);
  assert.equal(xpToAdvance(7), 325);
});

test('levelInfo walks the thresholds', () => {
  assert.deepEqual(levelInfo(0), { level: 1, xpInLevel: 0, need: 175, xpToNext: 175 });
  assert.deepEqual(levelInfo(174), { level: 1, xpInLevel: 174, need: 175, xpToNext: 1 });
  assert.deepEqual(levelInfo(175), { level: 2, xpInLevel: 0, need: 200, xpToNext: 200 });
  assert.equal(levelInfo(175 + 200 + 225).level, 4);
  assert.equal(levelInfo(-50).level, 1);
});

test('xpForActivity: 10 per minute plus up to 50 percent quality bonus', () => {
  assert.equal(xpForActivity(8), 80);
  assert.equal(xpForActivity(8, 1), 120);
  assert.equal(xpForActivity(8, 0.5), 100);
  assert.equal(xpForActivity(8, 3), 120, 'quality is clamped');
  assert.equal(xpForActivity(0, 1), 0);
  assert.equal(xpForActivity(2.5, null), 25);
});
