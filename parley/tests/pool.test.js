import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentenceUnits, allowedTiers, dialogueItem, libraryItem } from '../src/content/pool.js';

const dlg = dialogueItem({ id: 'd1', title: 't', topic: 'work', level: 4, createdAt: 1, turns: [{ speaker: 'A', text: 'Hi. Have you booked the room for Thursday yet?' }, { speaker: 'B', text: "Not yet, I'll sort it out this afternoon." }], questions: [], gaps: [] });
const lib = libraryItem({ id: 'x', title: 'clip', durationSec: 9, transcript: 'a b', segments: [{ start: 0, end: 2, text: 'This is a real native sentence here.' }, { start: 2, end: 3, text: '' }] });
const noSeg = libraryItem({ id: 'y', title: 'clip2', durationSec: 9, transcript: 'Some text without timing at all here.' });

test('sentence units come from dialogue sentences and timed segments only', () => {
  const u = sentenceUnits([dlg, lib, noSeg], 4, 25);
  assert.deepEqual(u.map((s) => s.text), ['Have you booked the room for Thursday yet?', "Not yet, I'll sort it out this afternoon.", 'This is a real native sentence here.']);
  assert.equal(u[0].unit, 0);
  assert.equal(u[0].speaker, 'A');
  assert.equal(u[2].item.tier, 3);
});

test('tiers by level: VOA Learning English is a stepping stone', () => {
  assert.deepEqual(allowedTiers(3), [0, 1, 3]);
  assert.deepEqual(allowedTiers(5), [0, 1, 2, 3]);
  assert.deepEqual(allowedTiers(8), [0, 2, 3]);
});
