/**
 * Toast messages at the bottom of the screen.
 */
import { h } from './dom.js';
import { button } from './components.js';

let host = null;

function ensureHost() {
  if (!host) {
    host = h('div.toast-host', { 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  return host;
}

/**
 * Shows a toast.
 * @param {string} text
 * @param {{action?: {label: string, onClick: Function}, duration?: number}} [o] duration 0 = sticky
 * @returns {() => void} dismiss
 */
export function toast(text, o = {}) {
  const el = h('div.toast', { role: 'status' }, h('span', null, text));
  const dismiss = () => el.remove();
  if (o.action) el.appendChild(button(o.action.label, { variant: 'sun', onClick: () => { dismiss(); o.action.onClick(); } }));
  ensureHost().appendChild(el);
  const duration = o.duration ?? (o.action ? 0 : 3500);
  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}
