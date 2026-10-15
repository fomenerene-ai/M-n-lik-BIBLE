// Structure des textes installés : nombre de versets par chapitre, versets absents,
// et début de quelques versets témoins situés là où les numérotations divergent
// (numérotation « anglaise » ou « hébraïque »). Sert à vérifier les références des histoires.

// [livre, chapitre, verset] : versets dont le contenu révèle la numérotation suivie.
export const PROBES = [
  [1, 31, 55], [1, 32, 1], [1, 32, 28], [1, 32, 29],
  [2, 8, 1], [2, 21, 37], [2, 22, 1],
  [4, 16, 36], [4, 17, 1], [4, 17, 8], [4, 17, 23],
  [5, 23, 3], [5, 23, 4],
  [9, 20, 42], [9, 21, 1],
  [10, 18, 33], [10, 19, 1],
  [11, 4, 29], [11, 5, 1], [11, 5, 9],
  [13, 6, 4], [13, 5, 30],
  [16, 4, 1], [16, 3, 33],
  [19, 51, 1], [19, 51, 3],
  [23, 9, 1], [23, 9, 6], [23, 8, 23],
  [27, 4, 1], [27, 3, 31], [27, 6, 1], [27, 5, 31],
  [28, 1, 10], [28, 2, 1], [28, 2, 15], [28, 2, 17],
  [32, 1, 17], [32, 2, 1],
  [33, 5, 1], [33, 5, 2],
  [39, 4, 5], [39, 3, 23],
];

/**
 * @param records  enregistrements du magasin « chapters » : {v, b, c, verses:[{n, t}]}
 * @returns objet sérialisable
 */
export function buildStructure(records, meta = {}) {
  const versions = {};
  const index = new Map();
  for (const r of records) {
    const v = (versions[r.v] ||= { chapitres: {}, manquants: {} });
    const nums = r.verses.map((x) => x.n);
    const max = nums.length ? Math.max(...nums) : 0;
    v.chapitres[`${r.b}:${r.c}`] = max;
    const set = new Set(nums);
    const gaps = [];
    for (let n = 1; n <= max; n++) if (!set.has(n)) gaps.push(n);
    if (gaps.length) v.manquants[`${r.b}:${r.c}`] = gaps;
    index.set(`${r.v}:${r.b}:${r.c}`, r.verses);
  }
  for (const id of Object.keys(versions)) {
    const temoins = {};
    for (const [b, c, n] of PROBES) {
      const vs = index.get(`${id}:${b}:${c}`);
      const verse = vs && vs.find((x) => x.n === n);
      temoins[`${b}:${c}:${n}`] = verse ? verse.t.slice(0, 80) : null;
    }
    versions[id].temoins = temoins;
  }
  return { format: 'menelik-bible-structure', schema: 1, date: new Date().toISOString(), ...meta, versions };
}
