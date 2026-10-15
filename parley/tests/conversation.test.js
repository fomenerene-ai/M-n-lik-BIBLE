import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnerMetrics, trimHistory } from '../src/learning/conversation.js';

test('learner metrics: wpm from speaking time, silences over 3 s', () => {
  const turns = [
    { text: 'I studied accounting at university in Lyon', startedAt: 0, firstResultAt: 4000, lastResultAt: 6500, longPauses: 0 },
    { text: 'yes', startedAt: 0, firstResultAt: 800, lastResultAt: 800, longPauses: 1 },
    { text: 'typed answer here', typed: true },
  ];
  const m = learnerMetrics(turns);
  assert.equal(m.turns, 3);
  assert.equal(m.longSilences, 2);
  assert.equal(m.avgTurnWords, 3.7);
  assert.equal(m.wpm, 137); // 8 spoken words over 3.5 s
  assert.equal(learnerMetrics([{ text: 'hi', startedAt: 0, firstResultAt: 10, lastResultAt: 10 }]).wpm, null, 'too short to measure');
});

test('trimHistory leaves short histories alone', () => {
  const m = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }];
  assert.equal(trimHistory(m), m);
});

test('trimHistory keeps the opening and recent turns, alternation intact', () => {
  const msgs = [{ role: 'user', content: 'start' }, { role: 'assistant', content: 'opening' }];
  for (let i = 0; i < 40; i++) msgs.push({ role: 'user', content: `learner turn ${i} ${'x'.repeat(300)}` }, { role: 'assistant', content: `reply ${i} ${'y'.repeat(300)}` });
  const t = trimHistory(msgs, 6000);
  assert.ok(t.reduce((s, m) => s + m.content.length, 0) < 6000);
  assert.equal(t[1].content, 'opening');
  assert.match(t[2].content, /The learner had said: .*learner turn \d+/);
  assert.equal(t[t.length - 1].content, msgs[msgs.length - 1].content);
  for (let i = 1; i < t.length; i++) assert.notEqual(t[i].role, t[i - 1].role);
});
