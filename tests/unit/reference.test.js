import { describe, it, expect } from 'vitest';
import { parseReference, formatRef, suggestBooks, normalize } from '../../src/core/reference.js';
import { BOOKS } from '../../src/core/books.js';

const ok = (s) => {
  const r = parseReference(s);
  expect(r.ok, `${s} -> ${r.error}`).toBe(true);
  return r;
};

describe('liste des livres', () => {
  it('66 livres, 1189 chapitres, ordre protestant', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.reduce((a, b) => a + b.chapters, 0)).toBe(1189);
    expect(BOOKS.filter((b) => b.testament === 'AT')).toHaveLength(39);
    expect(BOOKS[0].name).toBe('Genèse');
    expect(BOOKS[38].name).toBe('Malachie');
    expect(BOOKS[39].name).toBe('Matthieu');
    expect(BOOKS[65].name).toBe('Apocalypse');
  });
});

describe('analyse des références', () => {
  it('formats de base', () => {
    expect(ok('Jean 3')).toMatchObject({ book: 43, chapter: 3, vStart: null });
    expect(ok('Jean 3:16')).toMatchObject({ book: 43, chapter: 3, vStart: 16, vEnd: 16 });
    expect(ok('Jean 3:16-21')).toMatchObject({ book: 43, chapter: 3, vStart: 16, vEnd: 21 });
    expect(ok('1 Jean 2:1-5')).toMatchObject({ book: 62, chapter: 2, vStart: 1, vEnd: 5 });
    expect(ok('Psaumes 23')).toMatchObject({ book: 19, chapter: 23 });
  });

  it('séparateurs . et , et tirets typographiques', () => {
    expect(ok('Jean 3.16')).toMatchObject({ chapter: 3, vStart: 16 });
    expect(ok('Jean 3,16-18')).toMatchObject({ chapter: 3, vStart: 16, vEnd: 18 });
    expect(ok('Jean 3:16–18')).toMatchObject({ vEnd: 18 });
    expect(ok('Jean 3 16')).toMatchObject({ chapter: 3, vStart: 16 });
  });

  it('accents, casse, espaces superflus', () => {
    expect(ok('  genese   1 : 1 ')).toMatchObject({ book: 1, chapter: 1, vStart: 1 });
    expect(ok('ÉSAÏE 53')).toMatchObject({ book: 23, chapter: 53 });
    expect(ok('esaie 53:5')).toMatchObject({ book: 23 });
    expect(ok('Isaïe 53')).toMatchObject({ book: 23 });
    expect(ok('isaie 7:14')).toMatchObject({ book: 23 });
    expect(ok('Psaume 23')).toMatchObject({ book: 19 });
    expect(ok('psaume 119:105')).toMatchObject({ book: 19, chapter: 119, vStart: 105 });
    expect(ok('1jean 4:8')).toMatchObject({ book: 62 });
    expect(ok('2 rois 2')).toMatchObject({ book: 12 });
    expect(ok('cantique des cantiques 2')).toMatchObject({ book: 22 });
    expect(ok('Ecclesiaste 3:1')).toMatchObject({ book: 21 });
  });

  it('ne confond pas Jean et 1 Jean', () => {
    expect(ok('Jean 1').book).toBe(43);
    expect(ok('1 Jean 1').book).toBe(62);
    expect(ok('3 Jean 1').book).toBe(64);
  });

  it('livre seul', () => {
    expect(ok('Romains')).toMatchObject({ book: 45, chapter: null });
  });

  it('livres à un seul chapitre', () => {
    expect(ok('Jude 3')).toMatchObject({ book: 65, chapter: 1, vStart: 3 });
    expect(ok('Jude 1')).toMatchObject({ book: 65, chapter: 1, vStart: null });
    expect(ok('Abdias 1:4')).toMatchObject({ book: 31, chapter: 1, vStart: 4 });
  });

  it('erreurs claires avec exemple', () => {
    for (const s of ['', 'Jn 3:16', 'Toto 3', 'Jean 22', 'Jean 3:16-10', 'Jean trois', 'Genèse 0']) {
      const r = parseReference(s);
      expect(r.ok, s).toBe(false);
      expect(r.error).toMatch(/Jean 3:16-21|chapitre/);
    }
  });

  it('pas d’abréviations', () => {
    expect(parseReference('Gn 1').ok).toBe(false);
    expect(parseReference('Mt 5').ok).toBe(false);
  });

  it('formatage', () => {
    expect(formatRef({ book: 43, chapter: 3, vStart: 16, vEnd: 18 })).toBe('Jean 3:16-18');
    expect(formatRef({ book: 43, chapter: 3, vStart: 16, vEnd: 16 })).toBe('Jean 3:16');
    expect(formatRef({ book: 19, chapter: 23 })).toBe('Psaumes 23');
  });

  it('aller-retour sur tous les livres', () => {
    for (const b of BOOKS) {
      const r = ok(`${b.name} ${b.chapters}`);
      expect(r.book).toBe(b.id);
    }
  });
});

describe('autocomplétion', () => {
  it('propose les livres par préfixe, sans accents', () => {
    expect(suggestBooks('ge').map((b) => b.name)).toContain('Genèse');
    expect(suggestBooks('jean').map((b) => b.name)).toEqual(expect.arrayContaining(['1 Jean', '2 Jean', '3 Jean']));
    expect(suggestBooks('eph').map((b) => b.name)).toEqual(['Éphésiens']);
    expect(suggestBooks('isa').map((b) => b.name)).toEqual(['Ésaïe']);
    expect(suggestBooks('Jean 3')).toEqual([]);
  });
  it('normalise', () => {
    expect(normalize('  Ézéchiel  ')).toBe('ezechiel');
  });
});
