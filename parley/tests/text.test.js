import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, sentenceStream, inferCardType, normWord, words, sentenceContaining } from '../src/learning/text.js';

test('splitSentences handles abbreviations, decimals and quotes', () => {
  assert.deepEqual(splitSentences('Hi Mr. Smith. It costs 3.5 dollars! "Really?" Yes.'), ['Hi Mr. Smith.', 'It costs 3.5 dollars!', '"Really?"', 'Yes.']);
  assert.deepEqual(splitSentences('No end mark'), ['No end mark']);
  assert.deepEqual(splitSentences(''), []);
});

test('sentenceStream emits a sentence once the next one starts', () => {
  const s = sentenceStream();
  assert.deepEqual(s.push('Thanks for com'), []);
  assert.deepEqual(s.push('ing in. Could you'), ['Thanks for coming in.']);
  assert.deepEqual(s.push(' tell me more?'), []);
  assert.deepEqual(s.push(' Sure'), ['Could you tell me more?']);
  assert.deepEqual(s.flush(), ['Sure']);
});

test('normWord and words', () => {
  assert.equal(normWord('Don\u2019t,'), "don't");
  assert.equal(normWord('"Hello!"'), 'hello');
  assert.deepEqual(words('Well \u2014 I mean, yes.'), ['Well', 'I', 'mean,', 'yes.']);
});

test('inferCardType', () => {
  assert.equal(inferCardType('leverage'), 'word');
  assert.equal(inferCardType('take off'), 'phrasal');
  assert.equal(inferCardType('look forward to'), 'phrasal');
  assert.equal(inferCardType('on the other hand'), 'expression');
  assert.equal(inferCardType('I was wondering if you could help me.'), 'sentence');
});

test('sentenceContaining', () => {
  assert.equal(sentenceContaining('We met. The budget was tight! Fine.', 'budget'), 'The budget was tight!');
});
