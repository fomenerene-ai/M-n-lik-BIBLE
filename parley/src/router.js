/**
 * Hash router: "#/listen?session=1". Hash routing works on GitHub Pages without rewrites.
 */

/**
 * Parses a location hash into a route name, path segments and query params.
 * Pure, testable.
 * @param {string} hash e.g. "#/report/abc?x=1"
 * @returns {{name: string, segments: string[], params: Record<string,string>}}
 */
export function parseHash(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = {};
  for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { name: segments[0] || 'today', segments: segments.slice(1), params };
}

/**
 * Builds a hash for a route.
 * @param {string} name
 * @param {Record<string, string|number|boolean>} [params]
 * @param {string[]} [segments]
 */
export function hrefFor(name, params = {}, segments = []) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => [k, String(v)])).toString();
  return `#/${[name, ...segments].map(encodeURIComponent).join('/')}${qs ? `?${qs}` : ''}`;
}

/**
 * Navigates to a route.
 * @param {string} name
 * @param {object} [params]
 * @param {string[]} [segments]
 */
export function go(name, params, segments) {
  location.hash = hrefFor(name, params, segments);
}

/**
 * Starts the router.
 * @param {(route: ReturnType<typeof parseHash>) => void} onRoute
 */
export function startRouter(onRoute) {
  const handle = () => onRoute(parseHash(location.hash));
  window.addEventListener('hashchange', handle);
  handle();
}
