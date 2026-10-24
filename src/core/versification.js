// Alignement de la numérotation des versets sur celle de la Louis Segond 1910.
//
// La Bible du Semeur fournie par bolls.life suit la numérotation hébraïque dans une vingtaine
// de chapitres (Genèse 32, Nombres 17, 1 Rois 5, Daniel 4, Joël, Malachie…), alors que la LSG
// suit la numérotation traditionnelle. On renumérote donc la BDS à l'import : histoires,
// surlignages, projection et changement de version utilisent ainsi les mêmes numéros.
// Écarts relevés sur les textes installés (export de structure du 24/10/2026).

// Incrémenter quand les règles changent : les versions concernées sont retéléchargées.
export const NUMEROTATION = 2;

// [livre, chapitre source, premier verset, dernier verset, chapitre cible, premier verset cible]
// Quand deux versets source tombent sur le même verset cible, leurs textes sont réunis.
const BDS = [
  [1, 32, 1, 1, 31, 55], [1, 32, 2, 33, 32, 1], // Genèse 31-32
  [2, 21, 37, 37, 22, 1], [2, 22, 1, 30, 22, 2], // Exode 21-22
  [4, 17, 1, 15, 16, 36], [4, 17, 16, 28, 17, 1], // Nombres 16-17
  [4, 25, 19, 19, 26, 1], // Nombres 25-26
  [4, 30, 1, 1, 29, 40], [4, 30, 2, 17, 30, 1], // Nombres 29-30
  [5, 13, 1, 1, 12, 32], [5, 13, 2, 19, 13, 1], // Deutéronome 12-13
  [5, 23, 1, 1, 22, 30], [5, 23, 2, 26, 23, 1], // Deutéronome 22-23
  [5, 28, 69, 69, 29, 1], [5, 29, 1, 28, 29, 2], // Deutéronome 28-29
  [9, 21, 1, 1, 20, 43], [9, 21, 2, 16, 21, 1], // 1 Samuel 20-21
  [10, 19, 1, 1, 18, 33], [10, 19, 2, 44, 19, 1], // 2 Samuel 18-19
  [11, 5, 1, 14, 4, 21], [11, 5, 15, 32, 5, 1], // 1 Rois 4-5
  [12, 12, 1, 1, 11, 21], [12, 12, 2, 22, 12, 1], // 2 Rois 11-12
  [13, 5, 27, 41, 6, 1], [13, 6, 1, 66, 6, 16], // 1 Chroniques 5-6
  [13, 12, 5, 41, 12, 4], // 1 Chroniques 12
  [14, 1, 18, 18, 2, 1], [14, 2, 1, 17, 2, 2], // 2 Chroniques 1-2
  [16, 3, 33, 38, 4, 1], [16, 4, 1, 17, 4, 7], // Néhémie 3-4
  [16, 7, 68, 72, 7, 69], // Néhémie 7
  [16, 10, 1, 1, 9, 38], [16, 10, 2, 40, 10, 1], // Néhémie 9-10
  [24, 8, 23, 23, 9, 1], [24, 9, 1, 25, 9, 2], // Jérémie 8-9
  [27, 3, 31, 33, 4, 1], [27, 4, 1, 34, 4, 4], // Daniel 3-4
  [27, 6, 1, 1, 5, 31], [27, 6, 2, 29, 6, 1], // Daniel 5-6
  [28, 14, 1, 1, 13, 16], [28, 14, 2, 10, 14, 1], // Osée 13-14
  [29, 3, 1, 5, 2, 28], [29, 4, 1, 21, 3, 1], // Joël 2-4
  [32, 2, 1, 1, 1, 17], [32, 2, 2, 11, 2, 1], // Jonas 1-2
  [38, 2, 1, 4, 1, 18], [38, 2, 5, 17, 2, 1], // Zacharie 1-2
  [39, 3, 19, 24, 4, 1], // Malachie 3-4
];

export const RULES = { BDS };

function target(rules, b, c, n) {
  for (const [rb, sc, from, to, tc, tv] of rules) {
    if (rb === b && sc === c && n >= from && n <= to) return [tc, tv + n - from];
  }
  return [c, n];
}

/**
 * Renumérote les chapitres analysés d'une version (sortie de parseBolls).
 * Sans règle pour cette version, renvoie l'objet tel quel.
 */
export function renumber(id, parsed) {
  const rules = RULES[id];
  if (!rules) return parsed;
  const sources = [];
  for (const ch of parsed.chapters.values()) for (const v of ch.verses) sources.push({ b: ch.b, c: ch.c, n: v.n, t: v.t });
  sources.sort((x, y) => x.b - y.b || x.c - y.c || x.n - y.n);
  const chapters = new Map();
  for (const s of sources) {
    const [c, n] = target(rules, s.b, s.c, s.n);
    const key = `${s.b}:${c}`;
    let ch = chapters.get(key);
    if (!ch) chapters.set(key, (ch = { b: s.b, c, verses: [] }));
    const same = ch.verses.find((x) => x.n === n);
    if (same) same.t += ' ' + s.t;
    else ch.verses.push({ n, t: s.t });
  }
  let total = 0;
  for (const ch of chapters.values()) {
    ch.verses.sort((x, y) => x.n - y.n);
    total += ch.verses.length;
  }
  return { ...parsed, chapters, total };
}
