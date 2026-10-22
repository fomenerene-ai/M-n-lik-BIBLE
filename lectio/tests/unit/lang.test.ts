import { describe, expect, it } from 'vitest';
import { detectLang } from '../../src/core/text/lang';

describe('detectLang', () => {
  it('reconnaît le français', () => {
    expect(detectLang('La comptabilité enregistre les opérations de l’entreprise.')).toBe('fr');
    expect(detectLang("L'homme qu'il a vu est dans la maison")).toBe('fr');
  });
  it('reconnaît l’anglais', () => {
    expect(detectLang('The framework is used by the companies that are listed.')).toBe('en');
  });
  it('renvoie null quand rien ne permet de trancher', () => {
    expect(detectLang('IFRS 2024')).toBeNull();
    expect(detectLang('')).toBeNull();
  });
});
