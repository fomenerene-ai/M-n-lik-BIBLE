// Gestion des plages de versets (surlignages) au sein d'un même chapitre.
// Appliquer une couleur sur une plage remplace ce qui existait sur ces versets ;
// les surlignages voisins sont découpés pour ne garder que leurs parties hors plage.

/**
 * @param existing  surlignages du chapitre [{id, vs, ve, color, ...}]
 * @param range     {vs, ve}
 * @param color     couleur à appliquer, ou null pour retirer
 * @returns {{remove: string[], add: Array<{vs, ve, color, from?: object}>}}
 */
export function applyRange(existing, { vs, ve }, color) {
  const remove = [];
  const add = [];
  for (const h of existing) {
    if (h.ve < vs || h.vs > ve) continue; // pas de chevauchement
    remove.push(h.id);
    if (h.vs < vs) add.push({ ...h, id: undefined, vs: h.vs, ve: vs - 1 });
    if (h.ve > ve) add.push({ ...h, id: undefined, vs: ve + 1, ve: h.ve });
  }
  if (color) add.push({ vs, ve, color });
  return { remove, add };
}

/** Couleur du surlignage couvrant le verset n (le plus récent l'emporte). */
export function colorAt(highlights, n) {
  let best = null;
  for (const h of highlights) {
    if (n >= h.vs && n <= h.ve && (!best || (h.date || 0) >= (best.date || 0))) best = h;
  }
  return best ? best.color : null;
}

/** Comparaison en ordre biblique. */
export function biblicalOrder(a, b) {
  return a.b - b.b || a.c - b.c || (a.vs ?? a.v ?? 0) - (b.vs ?? b.v ?? 0);
}
