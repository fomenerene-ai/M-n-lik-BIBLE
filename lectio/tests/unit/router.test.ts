import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from '../../src/app/router';

describe('router', () => {
  it('lit et écrit les routes', () => {
    expect(parseRoute('#/lire/abc')).toEqual({ name: 'reader', docId: 'abc' });
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#/reglages')).toEqual({ name: 'settings' });
    expect(routeHref({ name: 'reader', docId: 'a b' })).toBe('#/lire/a%20b');
  });
});
