import { describe, it, expect } from 'vitest';
import { cleanText } from '../../src/core/clean.js';
import { parseBolls, validateAgainstCanon, compareVersification } from '../../src/core/parse-bolls.js';
import { applyRange, colorAt, biblicalOrder } from '../../src/core/ranges.js';

describe('nettoyage du texte', () => {
  it('retire balises, Strong et notes', () => {
    expect(cleanText('Au commencement<S>7225</S>, Dieu<S>430</S> créa')).toBe('Au commencement, Dieu créa');
    expect(cleanText('<i>Car</i> Dieu<sup>a</sup> a tant aimé<br/>le monde')).toBe('Car Dieu a tant aimé le monde');
    expect(cleanText('  trop   d’espaces\n ici ')).toBe('trop d’espaces ici');
    expect(cleanText('l&#39;Éternel &amp; moi')).toBe("l'Éternel & moi");
    expect(cleanText('Pourquoi ?')).toBe('Pourquoi ?');
    expect(cleanText(null)).toBe('');
  });
});

describe('lecture du format Bolls', () => {
  const sample = [
    { pk: 1, translation: 'FRLSG', book: 1, chapter: 1, verse: 2, text: 'deux' },
    { pk: 2, translation: 'FRLSG', book: 1, chapter: 1, verse: 1, text: 'un<S>1</S>' },
    { pk: 3, translation: 'FRLSG', book: 70, chapter: 1, verse: 1, text: 'deutérocanonique' },
    { pk: 4, translation: 'FRLSG', book: 1, chapter: 2, verse: 1, text: '' },
  ];
  it('tableau plat', () => {
    const r = parseBolls(sample);
    expect(r.translation).toBe('FRLSG');
    expect(r.chapters.get('1:1').verses).toEqual([
      { n: 1, t: 'un' },
      { n: 2, t: 'deux' },
    ]);
    expect(r.chapters.has('70:1')).toBe(false);
    expect(r.empty).toBe(1);
    expect(r.total).toBe(2);
  });
  it('structure emboîtée', () => {
    const r = parseBolls({ FRLSG: [[sample[0], sample[1]]] });
    expect(r.total).toBe(2);
  });
  it('contrôle contre la liste canonique', () => {
    const r = parseBolls(sample);
    const problems = validateAgainstCanon(r.chapters);
    expect(problems[0]).toMatch(/Genèse : 1 chapitre/);
  });
  it('compare la versification', () => {
    const a = new Map([['19:3', [{ n: 1 }, { n: 2 }, { n: 9 }]]]);
    const b = new Map([['19:3', [{ n: 1 }, { n: 2 }]]]);
    expect(compareVersification(a, b)).toEqual([{ key: '19:3', onlyA: [9], onlyB: [] }]);
  });
});

describe('plages de surlignage', () => {
  const ex = [{ id: 'a', vs: 3, ve: 8, color: 'jaune', date: 1 }];
  it('applique sans chevauchement', () => {
    expect(applyRange(ex, { vs: 10, ve: 12 }, 'vert')).toEqual({ remove: [], add: [{ vs: 10, ve: 12, color: 'vert' }] });
  });
  it('découpe un surlignage existant', () => {
    const r = applyRange(ex, { vs: 5, ve: 6 }, 'bleu');
    expect(r.remove).toEqual(['a']);
    expect(r.add.map((x) => [x.vs, x.ve, x.color])).toEqual([
      [3, 4, 'jaune'],
      [7, 8, 'jaune'],
      [5, 6, 'bleu'],
    ]);
  });
  it('retire une partie', () => {
    const r = applyRange(ex, { vs: 1, ve: 4 }, null);
    expect(r.add.map((x) => [x.vs, x.ve])).toEqual([[5, 8]]);
  });
  it('couleur d’un verset', () => {
    expect(colorAt(ex, 4)).toBe('jaune');
    expect(colorAt(ex, 9)).toBeNull();
  });
  it('ordre biblique', () => {
    const l = [{ b: 43, c: 3, vs: 16 }, { b: 1, c: 1, vs: 1 }, { b: 43, c: 1, v: 1 }];
    expect(l.sort(biblicalOrder).map((x) => x.b + ':' + x.c)).toEqual(['1:1', '43:1', '43:3']);
  });
});
