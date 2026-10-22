import { describe, expect, it } from 'vitest';
import { collapseSpaces, joinHyphenatedLines, normalizeText } from '../../src/core/text/normalize';

describe('normalizeText', () => {
  it('décompose les ligatures et unifie les espaces', () => {
    expect(normalizeText('ﬁn de l’ﬂux : ok')).toBe('fin de l’flux : ok');
  });
  it('retire les caractères invisibles et le trait d’union conditionnel', () => {
    expect(normalizeText('in­for​mation﻿')).toBe('information');
  });
  it('unifie les fins de ligne', () => {
    expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc');
  });
});

describe('joinHyphenatedLines', () => {
  it('recolle les mots coupés', () => {
    expect(joinHyphenatedLines('informa-\ntion utile')).toBe('information utile');
  });
  it('garde les vrais mots composés', () => {
    expect(joinHyphenatedLines('Jean-\nPierre et une demi-\nheure')).toBe(
      'Jean-Pierre et une demi-heure',
    );
  });
});

describe('collapseSpaces', () => {
  it('réduit les espaces et les retours', () => {
    expect(collapseSpaces('  a \n  b  ')).toBe('a b');
  });
});
