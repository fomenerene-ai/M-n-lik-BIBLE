/**
 * Minimal DOM helpers. The only element factory of the app.
 * Text is always set with textContent, never innerHTML.
 */

/**
 * Creates an element.
 * @param {string} tag tag name, optionally with classes: "div.card.soft"
 * @param {object|null} [attrs] attributes; `on*` functions become listeners, `class` merges,
 *   `dataset` and `style` objects are applied property by property, booleans toggle attributes.
 * @param {...(Node|string|number|null|false|Array)} children text or nodes
 * @returns {HTMLElement}
 */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style[sk] = sv;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'value') el.value = v;
      else if (k === 'ref' && typeof v === 'function') v(el);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

/**
 * Appends children (strings become text nodes).
 * @param {Node} el
 * @param {Array} children
 */
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * Replaces all children of an element.
 * @param {Element} el
 * @param {...any} children
 */
export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/**
 * Creates an SVG element tree from a compact description.
 * @param {string} tag
 * @param {object} attrs
 * @param {...SVGElement} children
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) if (c) el.appendChild(c);
  return el;
}

/**
 * Formats seconds as M:SS.
 * @param {number} sec
 */
export function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
