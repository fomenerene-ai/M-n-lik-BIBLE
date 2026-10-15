import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, newCardFields, buildQueue, previewIntervals, formatInterval } from '../src/learning/srs.js';

const DAY = 86400000;
const now = Date.UTC(2026, 9, 15, 9);

test('new card: again 10 min, hard 1 d, good 1 d, easy 4 d', () => {
  const c = newCardFields(now);
  assert.equal(schedule(c, 'again', now).due - now, 10 * 60000);
  assert.equal(schedule(c, 'hard', now).interval, 1);
  assert.equal(schedule(c, 'good', now).interval, 1);
  assert.equal(schedule(c, 'easy', now).interval, 4);
  assert.deepEqual(previewIntervals(c, now), { again: '10 min', hard: '1 d', good: '1 d', easy: '4 d' });
});

test('good progression follows SM-2: 1, 6, then x ease', () => {
  let c = { ...newCardFields(now), createdAt: now };
  c = { ...c, ...schedule(c, 'good', now) };
  assert.equal(c.interval, 1);
  c = { ...c, ...schedule(c, 'good', c.due) };
  assert.equal(c.interval, 6);
  c = { ...c, ...schedule(c, 'good', c.due) };
  assert.equal(c.interval, 15);
  assert.equal(c.reps, 3);
  assert.equal(c.ease, 2.5);
});

test('intervals are ordered hard <= good < easy, and easy raises ease', () => {
  const c = { ease: 2.5, interval: 10, reps: 3, lapses: 0 };
  const hard = schedule(c, 'hard', now), good = schedule(c, 'good', now), easy = schedule(c, 'easy', now);
  assert.ok(hard.interval <= good.interval && good.interval < easy.interval);
  assert.equal(hard.interval, 12);
  assert.equal(good.interval, 25);
  assert.equal(easy.ease, 2.65);
  assert.equal(hard.ease, 2.35);
});

test('again counts a lapse, resets reps, lowers ease to a floor of 1.3', () => {
  let c = { ease: 1.4, interval: 20, reps: 4, lapses: 1 };
  const a = schedule(c, 'again', now);
  assert.equal(a.lapses, 2);
  assert.equal(a.reps, 0);
  assert.equal(a.ease, 1.3);
  assert.equal(schedule({ ...c, reps: 0 }, 'again', now).lapses, 1, 'no lapse for a card that was not learned');
});

test('intervals are capped at 10 years', () => {
  assert.equal(schedule({ ease: 3, interval: 3000, reps: 9, lapses: 0 }, 'easy', now).interval, 3650);
});

test('queue: due reviews first, then all new cards', () => {
  const cards = [
    { id: 'n2', lastReviewedAt: null, createdAt: 2, due: 0 },
    { id: 'r-later', lastReviewedAt: 1, due: now + 2 * DAY },
    { id: 'r2', lastReviewedAt: 1, due: now - 1000 },
    { id: 'n1', lastReviewedAt: null, createdAt: 1, due: 0 },
    { id: 'r1', lastReviewedAt: 1, due: now - DAY },
    { id: 'relearn', lastReviewedAt: now, due: now + 5 * 60000 },
  ];
  const q = buildQueue(cards, now);
  assert.deepEqual(q.due.map((c) => c.id), ['r1', 'r2', 'relearn']);
  assert.deepEqual(q.fresh.map((c) => c.id), ['n1', 'n2']);
});

test('formatInterval', () => {
  assert.equal(formatInterval(10 * 60000), '10 min');
  assert.equal(formatInterval(3 * 3600000), '3 h');
  assert.equal(formatInterval(45 * DAY), '2 mo');
  assert.equal(formatInterval(400 * DAY), '1.1 y');
});
