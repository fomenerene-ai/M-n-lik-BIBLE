/**
 * Today: guided 30-minute session.
 */
import { h } from '../ui/dom.js';

/**
 * @param {HTMLElement} root
 */
export async function render(root) {
  root.append(h('div.screen-head', null, h('div', null,
    h('h1', null, "Today's session"),
    h('p.subtitle', null, '30 minutes, five steps. Listening comes first.'))));
}
