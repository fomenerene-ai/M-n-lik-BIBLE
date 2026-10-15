import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeResults } from '../src/speech/stt-merge.js';
import { normLang, englishVoiceGroups, pickVoice } from '../src/speech/tts.js';

test('mergeResults appends normal finals and keeps the interim', () => {
  const r = mergeResults([{ transcript: 'I studied accounting', isFinal: true }, { transcript: ' and I did', isFinal: false }]);
  assert.deepEqual(r, { finalText: 'I studied accounting', interim: 'and I did' });
});

test('mergeResults collapses cumulative Android finals', () => {
  const r = mergeResults([{ transcript: 'I was', isFinal: true }, { transcript: 'I was in charge', isFinal: true }, { transcript: 'I was in charge of the audit', isFinal: true }]);
  assert.equal(r.finalText, 'I was in charge of the audit');
  const dup = mergeResults([{ transcript: 'hello there', isFinal: true }, { transcript: 'there', isFinal: true }]);
  assert.equal(dup.finalText, 'hello there');
});

test('voice helpers', () => {
  assert.equal(normLang('en_gb'), 'en-GB');
  const voices = [
    { name: 'fr', lang: 'fr-FR', voiceURI: 'fr', localService: true },
    { name: 'au', lang: 'en_AU', voiceURI: 'au', localService: true },
    { name: 'gb1', lang: 'en-GB', voiceURI: 'gb1', localService: false },
    { name: 'gb2', lang: 'en-GB', voiceURI: 'gb2', localService: true },
    { name: 'us', lang: 'en-US', voiceURI: 'us', localService: true, default: true },
  ];
  assert.deepEqual(englishVoiceGroups(voices).map((g) => g.lang), ['en-US', 'en-GB', 'en-AU']);
  assert.equal(pickVoice(voices, 'en-GB').voiceURI, 'gb2');
  assert.equal(pickVoice(voices, 'en-GB', { 'en-GB': 'gb1' }).voiceURI, 'gb1');
  assert.equal(pickVoice(voices, 'en-IE').lang, 'en_AU', 'falls back to any English voice');
});
