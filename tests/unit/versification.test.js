import { describe, it, expect } from 'vitest';
import { renumber } from '../../src/core/versification.js';
import { validateAgainstCanon } from '../../src/core/parse-bolls.js';

// Nombre de versets des chapitres concernés, relevés sur les textes installés (export du 24/10/2026).
// [livre, chapitre, BDS, LSG] ; 0 = chapitre absent.
const COUNTS = [
  [1, 31, 54, 55], [1, 32, 33, 32],
  [2, 21, 37, 36], [2, 22, 30, 31],
  [4, 16, 35, 50], [4, 17, 28, 13], [4, 25, 19, 18], [4, 26, 65, 65], [4, 29, 39, 40], [4, 30, 17, 16],
  [5, 12, 31, 32], [5, 13, 19, 18], [5, 22, 29, 30], [5, 23, 26, 25], [5, 28, 69, 68], [5, 29, 28, 29],
  [9, 20, 42, 43], [9, 21, 16, 15],
  [10, 18, 32, 33], [10, 19, 44, 43],
  [11, 4, 20, 34], [11, 5, 32, 18],
  [12, 11, 20, 21], [12, 12, 22, 21],
  [13, 5, 41, 26], [13, 6, 66, 81], [13, 12, 41, 40],
  [14, 1, 18, 17], [14, 2, 17, 18],
  [16, 3, 38, 32], [16, 4, 17, 23], [16, 7, 72, 73], [16, 9, 37, 38], [16, 10, 40, 39],
  [24, 8, 23, 22], [24, 9, 25, 26],
  [27, 3, 33, 30], [27, 4, 34, 37], [27, 5, 30, 31], [27, 6, 29, 28],
  [28, 13, 15, 16], [28, 14, 10, 9],
  [29, 2, 27, 32], [29, 3, 5, 21], [29, 4, 21, 0],
  [32, 1, 16, 17], [32, 2, 11, 10],
  [38, 1, 17, 21], [38, 2, 17, 13],
  [39, 3, 24, 18], [39, 4, 0, 6],
];

function bdsParsed() {
  const chapters = new Map();
  for (const [b, c, n] of COUNTS) {
    if (!n) continue;
    const verses = Array.from({ length: n }, (_, i) => ({ n: i + 1, t: `${b}:${c}:${i + 1}` }));
    chapters.set(`${b}:${c}`, { b, c, verses });
  }
  return { translation: 'BDS', chapters, total: 0, empty: 0 };
}

describe('renumérotation BDS vers LSG', () => {
  const out = renumber('BDS', bdsParsed());
  const text = (b, c, n) => out.chapters.get(`${b}:${c}`)?.verses.find((v) => v.n === n)?.t;

  it('donne le même nombre de versets que la LSG', () => {
    for (const [b, c, , lsg] of COUNTS) {
      const ch = out.chapters.get(`${b}:${c}`);
      const max = ch ? Math.max(...ch.verses.map((v) => v.n)) : 0;
      expect(max, `${b}:${c}`).toBe(lsg);
    }
  });

  it('place les versets témoins comme la LSG', () => {
    expect(text(1, 32, 28)).toBe('1:32:29'); // Israël
    expect(text(1, 31, 55)).toBe('1:32:1');
    expect(text(4, 16, 36)).toBe('4:17:1');
    expect(text(4, 17, 8)).toBe('4:17:23');
    expect(text(5, 23, 3)).toBe('5:23:4');
    expect(text(11, 4, 29)).toBe('11:5:9');
    expect(text(13, 6, 4)).toBe('13:5:30');
    expect(text(27, 5, 31)).toBe('27:6:1');
    expect(text(29, 3, 1)).toBe('29:4:1');
    expect(text(39, 4, 5)).toBe('39:3:23');
  });

  it('réunit deux versets qui tombent sur le même numéro, dans l’ordre', () => {
    expect(text(4, 26, 1)).toBe('4:25:19 4:26:1');
    expect(text(13, 12, 4)).toBe('13:12:4 13:12:5');
    expect(out.chapters.get('13:12').verses).toHaveLength(40);
  });

  it('ne touche ni la LSG ni les chapitres sans règle', () => {
    const p = bdsParsed();
    expect(renumber('FRLSG', p)).toBe(p);
    expect(text(1, 31, 1)).toBe('1:31:1');
  });

  it('supprime les écarts Joël 4 et Malachie 4', () => {
    const problems = validateAgainstCanon(out.chapters);
    expect(problems.some((p) => /en trop/.test(p))).toBe(false);
    expect(out.chapters.has('29:4')).toBe(false);
    expect(out.chapters.get('39:4').verses).toHaveLength(6);
  });
});
