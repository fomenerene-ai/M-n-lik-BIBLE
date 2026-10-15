import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, hrefFor } from '../src/router.js';

test('parseHash defaults to today', () => {
  assert.deepEqual(parseHash(''), { name: 'today', segments: [], params: {} });
  assert.deepEqual(parseHash('#/'), { name: 'today', segments: [], params: {} });
});

test('parseHash reads segments and params', () => {
  const r = parseHash('#/report/abc%20d?session=1&x=y');
  assert.equal(r.name, 'report');
  assert.deepEqual(r.segments, ['abc d']);
  assert.deepEqual(r.params, { session: '1', x: 'y' });
});

test('hrefFor round-trips', () => {
  const href = hrefFor('listen', { session: 1, skip: false, tier: 0 }, ['item 1']);
  assert.equal(href, '#/listen/item%201?session=1&tier=0');
  assert.deepEqual(parseHash(href), { name: 'listen', segments: ['item 1'], params: { session: '1', tier: '0' } });
});
