import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGap, checkShort, checkExercises } from '../src/learning/answers.js';

test('checkGap ignores case and punctuation', () => {
  assert.ok(checkGap('figure out', 'Figure out.'));
  assert.ok(checkGap('don’t', "don't"));
  assert.ok(!checkGap('figure out', 'figure'));
  assert.ok(!checkGap('', ''));
});

test('checkShort needs the content words', () => {
  assert.ok(checkShort('next Tuesday', 'I think it is next tuesday'));
  assert.ok(checkShort('the budget', 'budget'));
  assert.ok(checkShort('two tickets', 'two ticket'));
  assert.ok(!checkShort('next Tuesday', 'Tuesday'));
});

test('checkExercises validates gaps and options against the text', () => {
  const text = "We need to figure out the budget. Let's meet on Friday.";
  const good = { gaps: [{ sentence: 'We need to ____ the budget.', answer: 'figure out' }], questions: [{ kind: 'choice', options: ['Mon', 'Tue', 'Thu', 'Friday'], answer: 'Friday' }, { kind: 'short', options: [], answer: 'the budget' }] };
  assert.deepEqual(checkExercises(good, text), []);
  const bad = { gaps: [{ sentence: 'We need to ____ the money.', answer: 'figure out' }, { sentence: 'no gap', answer: 'x' }], questions: [{ kind: 'choice', options: ['a', 'b', 'c', 'd'], answer: 'e' }] };
  assert.equal(checkExercises(bad, text).length, 3);
});
