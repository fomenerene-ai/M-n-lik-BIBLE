import { describe, it, expect } from 'vitest';
import { paginate, bestSize, slideIndexOfVerse } from '../../src/core/paginate.js';

// Modèle de mesure simple : l'écran contient CAP « unités » ;
// un verset coûte longueur × taille.
const CAP = 10000;
const fits = (vs, size) => vs.reduce((a, v) => a + v.t.length * size, 0) <= CAP;
const v = (n, len) => ({ n, t: 'x'.repeat(len) });

describe('découpage en diapositives', () => {
  it('regroupe les versets courts sur une diapositive', () => {
    const slides = paginate([v(1, 50), v(2, 50), v(3, 50)], fits, { base: 40, min: 10 });
    expect(slides).toHaveLength(1);
    expect(slides[0].size).toBe(40);
  });

  it('coupe toujours au passage d’un verset, sans en perdre', () => {
    const verses = Array.from({ length: 12 }, (_, i) => v(i + 1, 100));
    const slides = paginate(verses, fits, { base: 40, min: 10 });
    expect(slides.flatMap((s) => s.verses.map((x) => x.n))).toEqual(verses.map((x) => x.n));
    for (const s of slides) expect(fits(s.verses, s.size)).toBe(true);
    expect(slides.length).toBe(6); // 2 versets de 100 × 40 = 8000 par diapositive
  });

  it('un verset très long occupe seul une diapositive, taille réduite', () => {
    const slides = paginate([v(1, 50), v(2, 600), v(3, 50)], fits, { base: 40, min: 10 });
    expect(slides.map((s) => s.verses.map((x) => x.n))).toEqual([[1], [2], [3]]);
    expect(slides[1].size).toBe(16); // 600 × 16 = 9600 <= 10000 ; 600 × 17 > 10000
    expect(fits(slides[1].verses, slides[1].size)).toBe(true);
  });

  it('le texte tient toujours (sauf en dessous de la taille minimale)', () => {
    const slides = paginate([v(1, 5000)], fits, { base: 40, min: 10 });
    expect(slides[0].size).toBe(10);
  });

  it('plus grande taille qui tient', () => {
    expect(bestSize([v(1, 300)], fits, 40, 10)).toBe(33);
    expect(bestSize([v(1, 10)], fits, 40, 10)).toBe(40);
  });

  it('retrouve la diapositive d’un verset', () => {
    const slides = paginate(Array.from({ length: 6 }, (_, i) => v(i + 1, 100)), fits, { base: 40, min: 10 });
    expect(slideIndexOfVerse(slides, 5)).toBe(2);
    expect(slideIndexOfVerse(slides, 99)).toBe(0);
  });

  it('passage vide', () => {
    expect(paginate([], fits, { base: 40 })).toEqual([]);
  });
});
