import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptySession, nextStepKey } from '../src/state/sessions.js';
import { SESSION_PLAN } from '../src/config.js';

test('plan is 30 minutes, listening first and heaviest after talk', () => {
  assert.equal(SESSION_PLAN.reduce((s, p) => s + p.minutes, 0), 30);
  assert.deepEqual(SESSION_PLAN.map((p) => [p.key, p.minutes]), [['listen', 8], ['talk', 10], ['shadow', 5], ['cards', 4], ['dictation', 3]]);
});

test('next step is the first unfinished one, in any completion order', () => {
  const s = emptySession('2026-10-15');
  assert.equal(nextStepKey(s), 'listen');
  s.steps.talk.status = 'done';
  assert.equal(nextStepKey(s), 'listen');
  s.steps.listen.status = 'done';
  assert.equal(nextStepKey(s), 'shadow');
  for (const p of SESSION_PLAN) s.steps[p.key].status = 'done';
  assert.equal(nextStepKey(s), null);
});
