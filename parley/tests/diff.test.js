import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignWords, alignmentScore, missedWords, canon } from '../src/learning/diff.js';

const types = (ops) => ops.map((o) => o.type).join(' ');

test('identical sentences ignore case and punctuation', () => {
  const ops = alignWords("I'm looking forward to it.", "i'm Looking forward to it");
  assert.equal(types(ops), 'correct correct correct correct correct');
  assert.equal(alignmentScore(ops), 100);
});

test('marks missing, wrong and extra words', () => {
  const ops = alignWords('We need to cut costs this quarter', 'we need cut cost this the quarter');
  assert.equal(types(ops), 'correct correct missing correct wrong correct extra correct');
  assert.equal(ops[4].target, 'costs');
  assert.equal(ops[4].said, 'cost');
  assert.equal(alignmentScore(ops), 63); // 5 correct / (7 target + 1 extra)
  assert.deepEqual(missedWords(ops), ['costs']);
});

test('numbers, okay and curly apostrophes are equivalent', () => {
  assert.equal(canon('3'), 'three');
  assert.equal(canon('Okay,'), 'ok');
  assert.equal(alignmentScore(alignWords('It’s 3 pm, okay?', "it's three pm ok")), 100);
});

test('empty inputs', () => {
  assert.equal(alignmentScore(alignWords('', '')), 0);
  assert.equal(types(alignWords('two words', '')), 'missing missing');
  assert.equal(types(alignWords('', 'hello')), 'extra');
});
