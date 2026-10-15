import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCues, parseTsv, baseName, alignSentences, txtSentences } from '../src/learning/transcript.js';
import { segmentBySilence, speechRegions, speechBounds } from '../src/audio/segment.js';

test('parses SRT and VTT cues', () => {
  const srt = '1\n00:00:01,000 --> 00:00:03,500\nHello there.\n\n2\n00:00:04,000 --> 00:00:06,250\n<i>How are</i>\nyou?\n';
  assert.deepEqual(parseCues(srt), [{ start: 1, end: 3.5, text: 'Hello there.' }, { start: 4, end: 6.25, text: 'How are you?' }]);
  const vtt = 'WEBVTT\n\n00:01.200 --> 00:02.900 align:start\nShort one.\n\nnote\n\n01:00:00.000 --> 01:00:01.5\nLate.';
  assert.deepEqual(parseCues(vtt), [{ start: 1.2, end: 2.9, text: 'Short one.' }, { start: 3600, end: 3601.5, text: 'Late.' }]);
});

test('parses Common Voice TSV and matches base names', () => {
  const tsv = 'client_id\tpath\tsentence\tup_votes\nabc\tcommon_voice_en_1.mp3\tThe sky is clear.\t2\n';
  const m = parseTsv(tsv);
  assert.equal(m.get('common_voice_en_1.mp3'), 'The sky is clear.');
  assert.equal(baseName('folder/Common_Voice_EN_1.mp3'), 'common_voice_en_1');
  assert.equal(parseTsv('a\tb\n1\t2').size, 0);
});

test('aligns sentences to segments', () => {
  const segs = [{ start: 0, end: 2 }, { start: 2.5, end: 4.5 }];
  assert.deepEqual(alignSentences(['One.', 'Two.'], segs).map((s) => s.text), ['One.', 'Two.']);
  const three = alignSentences(['A short one.', 'Another short one.', 'And a third short one here.'], segs).map((s) => s.text);
  assert.equal(three.length, 2);
  assert.equal(three.join(' '), 'A short one. Another short one. And a third short one here.');
  assert.deepEqual(txtSentences('Line one.\nLine two!'), ['Line one.', 'Line two!']);
});

const RATE = 16000;
function synth(parts) {
  // parts: [[seconds, amplitude]] tone (220 Hz) or silence (amplitude 0, with faint noise)
  const total = parts.reduce((s, [d]) => s + d, 0);
  const out = new Float32Array(Math.round(total * RATE));
  let i = 0;
  let seed = 1;
  const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.002; };
  for (const [d, amp] of parts) {
    const n = Math.round(d * RATE);
    for (let k = 0; k < n; k++, i++) out[i] = amp * Math.sin((2 * Math.PI * 220 * k) / RATE) + noise();
  }
  return out;
}

test('speech regions and segments from tone bursts', () => {
  const s = synth([[0.5, 0], [2, 0.5], [0.7, 0], [3, 0.4], [0.2, 0], [1, 0.4], [0.8, 0], [0.3, 0.5], [0.6, 0]]);
  const regions = speechRegions(s, RATE);
  assert.equal(regions.length, 3, 'a 0.2 s gap is shorter than the minimum silence');
  const segs = segmentBySilence(s, RATE);
  // 2 s burst; 3 s + 0.2 s gap + 1 s (short pause, merged); 0.3 s blip merged or dropped.
  assert.equal(segs.length, 2);
  assert.ok(Math.abs(segs[0].start - 0.38) < 0.05, `start ${segs[0].start}`);
  assert.ok(Math.abs(segs[1].end - (0.5 + 2 + 0.7 + 3 + 0.2 + 1 + 0.8 + 0.3 + 0.12)) < 0.1, `end ${segs[1].end}`);
  for (const g of segs) assert.ok(g.end - g.start >= 1 && g.end - g.start <= 12.5);
});

test('long speech is split under 12 s', () => {
  const s = synth([[0.3, 0], [30, 0.4], [0.3, 0]]);
  const segs = segmentBySilence(s, RATE);
  assert.ok(segs.length >= 3);
  for (const g of segs) assert.ok(g.end - g.start <= 12.3, `${g.end - g.start}`);
});

test('speech bounds trim leading and trailing silence', () => {
  const b = speechBounds(synth([[1, 0], [2, 0.5], [1.5, 0]]), RATE);
  assert.ok(Math.abs(b.start - 0.9) < 0.05 && Math.abs(b.end - 3.1) < 0.05, JSON.stringify(b));
});
