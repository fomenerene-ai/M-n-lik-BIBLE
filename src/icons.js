// Icônes originales en SVG (traits, couleur héritée du texte).

const svg = (body, vb = '0 0 48 48') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  // Loupe posée sur une page
  search: svg(
    '<path d="M10 6h18l8 8v10"/><path d="M28 6v8h8"/><path d="M10 6v34h14"/><circle cx="32" cy="32" r="7"/><path d="M37 37l6 6"/><path d="M15 16h8M15 22h12M15 28h6"/>',
  ),
  // Deux tables de pierre arrondies
  ot: svg(
    '<path d="M6 40V16a7 7 0 0 1 14 0v24z"/><path d="M28 40V16a7 7 0 0 1 14 0v24z"/><path d="M10 20h6M10 26h6M10 32h6M32 20h6M32 26h6M32 32h6"/><path d="M4 42h40"/>',
  ),
  // Livre ouvert surmonté d'une croix
  nt: svg(
    '<path d="M24 16c-5-3-11-4-18-3v26c7-1 13 0 18 3 5-3 11-4 18-3V13c-7-1-13 0-18 3z"/><path d="M24 16v26"/><path d="M24 2v10M20 6h8"/>',
  ),
  // Personnage avec bâton de berger
  stories: svg(
    '<circle cx="20" cy="10" r="5"/><path d="M12 44l3-16-4-6 5-6h8l5 6-3 6 2 16"/><path d="M36 44V14a5 5 0 0 0-10 0"/>',
  ),
  // Ruban marque-page et étoile
  favorites: svg(
    '<path d="M12 4h24v40l-12-9-12 9z"/><path d="M24 12l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8z"/>',
  ),
  // Écran avec rayon de projection
  projection: svg(
    '<rect x="4" y="6" width="40" height="26" rx="2"/><path d="M16 42h16M24 32v10"/><path d="M12 14h24M12 20h18M12 26h12"/>',
  ),
  // Engrenage simple
  settings: svg(
    '<circle cx="24" cy="24" r="6"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2"/><circle cx="24" cy="24" r="13"/>',
  ),
  back: svg('<path d="M30 10L16 24l14 14"/>'),
  prev: svg('<path d="M30 10L16 24l14 14"/>'),
  next: svg('<path d="M18 10l14 14-14 14"/>'),
  prevBook: svg('<path d="M26 10L12 24l14 14M38 10L24 24l14 14"/>'),
  nextBook: svg('<path d="M10 10l14 14-14 14M22 10l14 14-14 14"/>'),
  bookmark: svg('<path d="M14 6h20v36l-10-8-10 8z"/>'),
  note: svg('<path d="M10 6h20l8 8v28H10z"/><path d="M16 22h16M16 28h16M16 34h10"/>'),
  copy: svg('<rect x="16" y="16" width="24" height="26" rx="2"/><path d="M32 16V8H8v26h8"/>'),
  play: svg('<path d="M14 8l26 16-26 16z"/>'),
  trash: svg('<path d="M8 12h32M18 12V6h12v6M12 12l2 30h20l2-30"/>'),
  up: svg('<path d="M10 30l14-14 14 14"/>'),
  down: svg('<path d="M10 18l14 14 14-14"/>'),
  plus: svg('<path d="M24 8v32M8 24h32"/>'),
  marker: svg('<path d="M30 6l12 12-20 20H10V26z"/><path d="M6 42h36"/>'),
};
