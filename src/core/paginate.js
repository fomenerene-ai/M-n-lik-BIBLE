// Découpage d'un passage en diapositives de projection.
// Indépendant du DOM : la mesure est fournie par la fonction `fits`.
//
//   fits(verses, size) -> true si ces versets tiennent à l'écran avec cette taille de police.
//
// Règles :
//  - on coupe toujours au passage d'un verset ;
//  - on remplit chaque diapositive au maximum à la taille de base ;
//  - un verset qui ne tient pas seul à la taille de base occupe une diapositive seul ;
//  - chaque diapositive reçoit la plus grande taille <= base qui tient (sinon la taille minimale).

export function paginate(verses, fits, { base, min = 12 }) {
  const groups = [];
  let cur = [];
  for (const v of verses) {
    if (cur.length === 0) {
      cur = [v];
    } else if (fits([...cur, v], base)) {
      cur.push(v);
    } else {
      groups.push(cur);
      cur = [v];
    }
  }
  if (cur.length) groups.push(cur);

  return groups.map((g) => ({ verses: g, size: bestSize(g, fits, base, min) }));
}

/** Plus grande taille entière dans [min, base] pour laquelle le groupe tient. */
export function bestSize(group, fits, base, min) {
  const hi0 = Math.floor(base);
  if (fits(group, hi0)) return hi0;
  let lo = Math.ceil(min);
  let hi = hi0 - 1;
  if (lo > hi || !fits(group, lo)) return lo;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(group, mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Index de la diapositive contenant le verset n (utile après un changement de taille). */
export function slideIndexOfVerse(slides, n) {
  const i = slides.findIndex((s) => s.verses.some((v) => v.n === n));
  return i < 0 ? 0 : i;
}
