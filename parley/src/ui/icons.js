/**
 * Inline SVG icons: 24 px grid, stroke 2.2, round caps and joins. No emoji anywhere.
 */
import { svg } from './dom.js';

/** Path data per icon name. Each entry is a list of [tag, attrs]. */
const PATHS = {
  home: [['path', { d: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }]],
  headphones: [['path', { d: 'M4 15v-3a8 8 0 0 1 16 0v3' }], ['rect', { x: 3, y: 14, width: 4, height: 7, rx: 1.5 }], ['rect', { x: 17, y: 14, width: 4, height: 7, rx: 1.5 }]],
  mic: [['rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }], ['path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3' }]],
  wave: [['path', { d: 'M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4' }]],
  cards: [['rect', { x: 3, y: 6, width: 14, height: 14, rx: 2 }], ['path', { d: 'M7 3h13a1 1 0 0 1 1 1v13' }]],
  chart: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]],
  pen: [['path', { d: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
  close: [['path', { d: 'M5 5l14 14M19 5L5 19' }]],
  settings: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1' }]],
  book: [['path', { d: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z' }], ['path', { d: 'M4 21a2 2 0 0 1 2-2h13v2' }]],
  play: [['path', { d: 'M7 4.5v15l12-7.5z' }]],
  pause: [['path', { d: 'M8 5v14M16 5v14' }]],
  replay: [['path', { d: 'M4 12a8 8 0 1 0 2.3-5.7' }], ['path', { d: 'M4 4v4h4' }]],
  next: [['path', { d: 'M9 5l7 7-7 7' }]],
  prev: [['path', { d: 'M15 5l-7 7 7 7' }]],
  skipNext: [['path', { d: 'M6 5l9 7-9 7z' }], ['path', { d: 'M18 5v14' }]],
  skipPrev: [['path', { d: 'M18 5l-9 7 9 7z' }], ['path', { d: 'M6 5v14' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  trash: [['path', { d: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' }]],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-3.5-3.5' }]],
  edit: [['path', { d: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z' }], ['path', { d: 'M13.5 6.5l4 4' }]],
  speaker: [['path', { d: 'M4 10v4h4l5 4V6L8 10z' }], ['path', { d: 'M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12' }]],
  subtitles: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 3 }], ['path', { d: 'M7 13h4M13 13h4M7 16h10' }]],
  loop: [['path', { d: 'M17 2l3 3-3 3' }], ['path', { d: 'M4 11V9a4 4 0 0 1 4-4h12' }], ['path', { d: 'M7 22l-3-3 3-3' }], ['path', { d: 'M20 13v2a4 4 0 0 1-4 4H4' }]],
  upload: [['path', { d: 'M12 16V4M7 9l5-5 5 5' }], ['path', { d: 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3' }]],
  download: [['path', { d: 'M12 4v12M7 11l5 5 5-5' }], ['path', { d: 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3' }]],
  key: [['circle', { cx: 8, cy: 15, r: 4 }], ['path', { d: 'M11 12l9-9M16 7l3 3M14 9l2 2' }]],
  alert: [['path', { d: 'M12 3l10 18H2z' }], ['path', { d: 'M12 10v5M12 18v.01' }]],
  info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6M12 7.5v.01' }]],
  target: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 5 }], ['circle', { cx: 12, cy: 12, r: 1 }]],
  chat: [['path', { d: 'M4 5h16v11H9l-5 4z' }]],
  star: [['path', { d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  file: [['path', { d: 'M6 3h8l5 5v13H6z' }], ['path', { d: 'M14 3v5h5' }]],
  keyboard: [['rect', { x: 2, y: 6, width: 20, height: 12, rx: 2 }], ['path', { d: 'M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10' }]],
  bolt: [['path', { d: 'M13 2L4 14h7l-1 8 9-12h-7z' }]],
  eye: [['path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
  flag: [['path', { d: 'M5 21V4M5 4h11l-2 4 2 4H5' }]],
};

/**
 * Builds an icon element.
 * @param {keyof PATHS} name
 * @param {{size?: number, stroke?: number, label?: string}} [opts] label makes it role=img
 * @returns {SVGElement}
 */
export function icon(name, opts = {}) {
  const size = opts.size || 24;
  const el = svg('svg', {
    class: 'icon', width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': opts.stroke || 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  if (opts.label) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', opts.label); }
  else el.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of PATHS[name] || PATHS.info) el.appendChild(svg(tag, attrs));
  return el;
}
