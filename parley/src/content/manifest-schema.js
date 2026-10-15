/**
 * Validation of content/voa-manifest.json items. Pure, used by the app (the manifest is treated as
 * untrusted data) and by tools/validate-manifest.mjs.
 */

/** Credits that make an item unusable (copyrighted wire content). */
export const FORBIDDEN_CREDITS = /\b(AP|Associated Press|Reuters|AFP|Agence France[- ]Presse)\b/;

export const MANIFEST_TOPICS = ['work', 'daily', 'travel', 'news', 'science', 'culture', 'health', 'education'];

/**
 * Validates one manifest item.
 * @param {any} item
 * @param {{allowedHosts?: string[]}} [o] hosts allowed by the CSP media-src (wildcards "*.x.com")
 * @returns {string[]} list of problems, empty if valid
 */
export function validateItem(item, o = {}) {
  const errs = [];
  if (!item || typeof item !== 'object') return ['item is not an object'];
  const str = (k) => typeof item[k] === 'string' && item[k].trim().length > 0;
  if (!str('id') || !/^[a-z0-9-]+$/.test(item.id)) errs.push('id must be a non-empty slug (a-z, 0-9, -)');
  if (![1, 2].includes(item.tier)) errs.push('tier must be 1 (VOA Learning English) or 2 (VOA news)');
  if (!str('title')) errs.push('title is required');
  if (!MANIFEST_TOPICS.includes(item.topic)) errs.push(`topic must be one of ${MANIFEST_TOPICS.join(', ')}`);
  if (!str('source')) errs.push('source (page URL or program name) is required');
  if (!str('licenseNote')) errs.push('licenseNote is required');
  if (item.placeholder === true) return errs;
  if (!str('audioUrl')) errs.push('audioUrl is required');
  else {
    let url = null;
    try { url = new URL(item.audioUrl); } catch { errs.push('audioUrl is not a valid URL'); }
    if (url && url.protocol !== 'https:') errs.push('audioUrl must use https');
    if (url && o.allowedHosts && !hostAllowed(url.hostname, o.allowedHosts)) errs.push(`audio host ${url.hostname} is not in the CSP media-src of index.html`);
  }
  if (!str('transcript')) errs.push('transcript is required');
  if (!(typeof item.durationSec === 'number' && item.durationSec > 0)) errs.push('durationSec must be a positive number');
  for (const k of ['title', 'source', 'licenseNote', 'transcript']) {
    if (typeof item[k] === 'string' && FORBIDDEN_CREDITS.test(item[k])) errs.push(`${k} mentions AP, Reuters or AFP: only VOA-produced items are allowed`);
  }
  if (item.segments !== undefined) {
    if (!Array.isArray(item.segments)) errs.push('segments must be an array');
    else {
      let prevEnd = 0;
      item.segments.forEach((s, i) => {
        if (!s || typeof s.start !== 'number' || typeof s.end !== 'number' || typeof s.text !== 'string') errs.push(`segments[${i}] needs numeric start, end and text`);
        else if (s.end <= s.start || s.start < prevEnd - 0.01) errs.push(`segments[${i}] times are not increasing`);
        else prevEnd = s.end;
      });
    }
  }
  return errs;
}

/**
 * Checks a hostname against CSP-style host patterns.
 * @param {string} host
 * @param {string[]} patterns e.g. ["*.voanews.com", "example.org"]
 */
export function hostAllowed(host, patterns) {
  return patterns.some((p) => (p.startsWith('*.') ? host.endsWith(p.slice(1)) : host === p));
}

/**
 * Validates a whole manifest.
 * @param {any} manifest {items: [...]}
 * @param {{allowedHosts?: string[]}} [o]
 * @returns {{valid: object[], errors: {id: string, errors: string[]}[], placeholders: number}}
 */
export function validateManifest(manifest, o = {}) {
  const out = { valid: [], errors: [], placeholders: 0 };
  const items = manifest && Array.isArray(manifest.items) ? manifest.items : null;
  if (!items) { out.errors.push({ id: '(root)', errors: ['manifest must be {"items": [...]}'] }); return out; }
  const seen = new Set();
  for (const item of items) {
    const errs = validateItem(item, o);
    if (item && seen.has(item.id)) errs.push('duplicate id');
    if (item && item.id) seen.add(item.id);
    if (errs.length) out.errors.push({ id: (item && item.id) || '(no id)', errors: errs });
    else if (item.placeholder === true) out.placeholders += 1;
    else out.valid.push(item);
  }
  return out;
}

/**
 * Extracts host patterns of a CSP directive from index.html source.
 * @param {string} html
 * @param {string} directive e.g. "media-src"
 * @returns {string[]}
 */
export function cspHosts(html, directive) {
  const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!m) return [];
  const d = m[1].split(';').map((s) => s.trim()).find((s) => s.startsWith(`${directive} `));
  if (!d) return [];
  return d.split(/\s+/).slice(1).filter((s) => s.startsWith('https://')).map((s) => s.replace('https://', ''));
}
