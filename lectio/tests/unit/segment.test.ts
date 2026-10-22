import { describe, expect, it } from 'vitest';
import { segmentSentences } from '../../src/core/text/segment';

const texts = (t: string, lang: 'fr' | 'en') => segmentSentences(t, lang, 'b0').map((s) => s.text);

describe('segmentSentences', () => {
  it('garde les abréviations françaises dans la phrase', () => {
    expect(texts('M. Dupont est arrivé. Il a vu le Dr. Martin, p. ex. hier. Fin.', 'fr')).toEqual([
      'M. Dupont est arrivé.',
      'Il a vu le Dr. Martin, p. ex. hier.',
      'Fin.',
    ]);
  });

  it('garde les abréviations anglaises et les décimaux', () => {
    expect(
      texts('Mr. Smith met Dr. Jones, e.g. at 3.14 p.m. today. It was fine! Really?', 'en'),
    ).toEqual(['Mr. Smith met Dr. Jones, e.g. at 3.14 p.m. today.', 'It was fine!', 'Really?']);
  });

  it('ne coupe pas les initiales ni « i.e. »', () => {
    expect(texts('J. R. R. Tolkien wrote it, i.e. the book. Then he rested.', 'en')).toEqual([
      'J. R. R. Tolkien wrote it, i.e. the book.',
      'Then he rested.',
    ]);
  });

  it('rattache le guillemet fermant à sa phrase', () => {
    expect(texts('« Bonjour. » Il partit. Voir l’art. 12 du code.', 'fr')).toEqual([
      '« Bonjour. »',
      'Il partit.',
      'Voir l’art. 12 du code.',
    ]);
  });

  it('coupe après « etc. » suivi d’une majuscule', () => {
    expect(texts('Des pommes, des poires, etc. La suite arrive.', 'fr')).toHaveLength(2);
  });

  it('fournit des bornes exactes et des identifiants stables', () => {
    const text = '  Première phrase.  Deuxième phrase. ';
    const s = segmentSentences(text, 'fr', 'b7');
    expect(s.map((x) => x.id)).toEqual(['b7.s0', 'b7.s1']);
    for (const x of s) expect(text.slice(x.start, x.end)).toBe(x.text);
  });

  it('découpe les phrases très longues sur une ponctuation faible', () => {
    const long = Array.from({ length: 40 }, (_, i) => `élément numéro ${i}`).join(', ') + '.';
    const s = segmentSentences(long, 'fr', 'b0');
    expect(s.length).toBeGreaterThan(1);
    expect(s.every((x) => x.text.length <= 320)).toBe(true);
    expect(s.map((x) => x.text).join(' ')).toBe(long);
  });
});
