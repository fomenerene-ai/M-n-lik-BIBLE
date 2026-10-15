import { describe, it, expect } from 'vitest';
import { nextChapter, prevChapter, nextBook, prevBook } from '../../src/core/navigation.js';

describe('navigation entre chapitres et livres', () => {
  it('chapitre suivant / précédent dans un livre', () => {
    expect(nextChapter(43, 3)).toEqual({ book: 43, chapter: 4 });
    expect(prevChapter(43, 3)).toEqual({ book: 43, chapter: 2 });
  });
  it('fin de livre : premier chapitre du livre suivant', () => {
    expect(nextChapter(1, 50)).toEqual({ book: 2, chapter: 1 });
  });
  it('début de livre : dernier chapitre du livre précédent', () => {
    expect(prevChapter(2, 1)).toEqual({ book: 1, chapter: 50 });
  });
  it('aucune coupure entre Malachie et Matthieu', () => {
    expect(nextChapter(39, 4)).toEqual({ book: 40, chapter: 1 });
    expect(prevChapter(40, 1)).toEqual({ book: 39, chapter: 4 });
    expect(nextBook(39)).toEqual({ book: 40, chapter: 1 });
    expect(prevBook(40)).toEqual({ book: 39, chapter: 1 });
  });
  it('livres à un chapitre', () => {
    expect(nextChapter(31, 1)).toEqual({ book: 32, chapter: 1 });
    expect(prevChapter(32, 1)).toEqual({ book: 31, chapter: 1 });
  });
  it('bornes de la Bible', () => {
    expect(prevChapter(1, 1)).toBeNull();
    expect(prevBook(1)).toBeNull();
    expect(nextChapter(66, 22)).toBeNull();
    expect(nextBook(66)).toBeNull();
  });
  it('parcours complet : 1189 chapitres dans les deux sens', () => {
    let pos = { book: 1, chapter: 1 };
    let n = 1;
    while ((pos = nextChapter(pos.book, pos.chapter))) n++;
    expect(n).toBe(1189);
    pos = { book: 66, chapter: 22 };
    n = 1;
    while ((pos = prevChapter(pos.book, pos.chapter))) n++;
    expect(n).toBe(1189);
  });
});
