// Liste canonique des 66 livres (ordre protestant, identifiants Bolls 1 à 66).
// Le nombre de chapitres sert de référence : il est contrôlé à l'import des textes.

const RAW = [
  // Ancien Testament
  ['Genèse', 50], ['Exode', 40], ['Lévitique', 27], ['Nombres', 36], ['Deutéronome', 34],
  ['Josué', 24], ['Juges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
  ['1 Rois', 22], ['2 Rois', 25], ['1 Chroniques', 29], ['2 Chroniques', 36], ['Esdras', 10],
  ['Néhémie', 13], ['Esther', 10], ['Job', 42], ['Psaumes', 150], ['Proverbes', 31],
  ['Ecclésiaste', 12], ['Cantique des cantiques', 8], ['Ésaïe', 66], ['Jérémie', 52], ['Lamentations', 5],
  ['Ézéchiel', 48], ['Daniel', 12], ['Osée', 14], ['Joël', 3], ['Amos', 9],
  ['Abdias', 1], ['Jonas', 4], ['Michée', 7], ['Nahum', 3], ['Habacuc', 3],
  ['Sophonie', 3], ['Aggée', 2], ['Zacharie', 14], ['Malachie', 4],
  // Nouveau Testament
  ['Matthieu', 28], ['Marc', 16], ['Luc', 24], ['Jean', 21], ['Actes', 28],
  ['Romains', 16], ['1 Corinthiens', 16], ['2 Corinthiens', 13], ['Galates', 6], ['Éphésiens', 6],
  ['Philippiens', 4], ['Colossiens', 4], ['1 Thessaloniciens', 5], ['2 Thessaloniciens', 3], ['1 Timothée', 6],
  ['2 Timothée', 4], ['Tite', 3], ['Philémon', 1], ['Hébreux', 13], ['Jacques', 5],
  ['1 Pierre', 5], ['2 Pierre', 3], ['1 Jean', 5], ['2 Jean', 1], ['3 Jean', 1],
  ['Jude', 1], ['Apocalypse', 22],
];

export const BOOKS = RAW.map(([name, chapters], i) => ({
  id: i + 1,
  name,
  chapters,
  testament: i < 39 ? 'AT' : 'NT',
}));

export const FIRST_NT = 40;

/** Autres formes acceptées à la saisie (pas d'abréviations, choix de l'utilisateur). */
export const ALIASES = {
  Psaume: 19,
  Isaïe: 23,
  Esaïe: 23,
  Cantique: 22,
  'Cantique des Cantiques': 22,
  Qohéleth: 21,
  'Actes des apôtres': 44,
  'Actes des Apôtres': 44,
};

export function getBook(id) {
  return BOOKS[id - 1] || null;
}

export function booksOf(testament) {
  return BOOKS.filter((b) => b.testament === testament);
}

export const TESTAMENTS = {
  AT: { id: 'AT', label: 'Ancien Testament' },
  NT: { id: 'NT', label: 'Nouveau Testament' },
};
