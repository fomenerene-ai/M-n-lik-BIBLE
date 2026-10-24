import { describe, it, expect } from 'vitest';
import { splitSentences, chapterSegments } from '../../src/core/speech.js';
import { speakableText } from '../../src/screens/stories.js';

describe('lecture vocale', () => {
  it('découpe en phrases', () => {
    expect(splitSentences('Il vint. Il vit ! Il vainquit ?')).toEqual(['Il vint.', 'Il vit !', 'Il vainquit ?']);
  });

  it('coupe une phrase trop longue aux virgules', () => {
    const long = Array.from({ length: 12 }, (_, i) => `segment numéro ${i} assez long`).join(', ') + '.';
    const parts = splitSentences(long, 80);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 80)).toBe(true);
    expect(parts.join(' ')).toBe(long);
  });

  it('prépare un chapitre : titre puis versets, numéros annoncés au choix', () => {
    const verses = [{ n: 1, t: 'Au commencement.' }, { n: 2, t: 'La terre.' }];
    expect(chapterSegments('Genèse', 1, verses, false).map((s) => s.text)).toEqual([
      'Genèse, chapitre 1.',
      'Au commencement.',
      'La terre.',
    ]);
    const withNums = chapterSegments('Genèse', 1, verses, true);
    expect(withNums[2]).toEqual({ text: 'Verset 2. La terre.', n: 2 });
  });

  it('retire les références des histoires', () => {
    expect(speakableText('Il part [[Genèse 12:1-4]]. Puis il prie ([[Genèse 12:8]]).')).toBe('Il part. Puis il prie.');
    expect(speakableText('Voir [[Jean 3:16|ce verset]].')).toBe('Voir ce verset.');
  });
});
