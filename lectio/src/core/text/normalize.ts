// Normalisation du texte extrait, avant segmentation.

const SPACES = /[\u00a0\u2007\u202f\u2000-\u200a\u3000]/g;
const ZERO_WIDTH = /[\u200b-\u200d\u2060\ufeff\u00ad]/g;

/**
 * NFKC (ligatures ﬁ → fi, chiffres pleine chasse…), espaces insécables → espace simple,
 * suppression des caractères invisibles et du trait d'union conditionnel.
 * Les guillemets typographiques sont conservés : la synthèse vocale les ignore
 * et ils restent plus beaux à l'écran.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(SPACES, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ');
}

/** Réduit les espaces multiples et retire les espaces de bord sur une ligne. */
export function collapseSpaces(input: string): string {
  return input.replace(/[ \n]+/g, ' ').trim();
}

// Mots composés dont le trait d'union doit rester même en fin de ligne.
const KEEP_HYPHEN_PREFIX =
  /^(?:anti|après|arrière|avant|auto|contre|demi|ex|extra|grand|haut|inter|mi|micro|multi|non|post|pré|semi|sous|sur|vice|well|self|co|e|x)$/i;

/**
 * Recolle les mots coupés en fin de ligne : `informa-\ntion` → `information`.
 * Garde le trait d'union si la suite commence par une majuscule (`Jean-\nPierre`)
 * ou si le début est un préfixe de mot composé connu (`demi-\nheure`).
 */
export function joinHyphenatedLines(input: string): string {
  return input.replace(/([\p{L}]+)-\n[ ]*([\p{L}]+)/gu, (_match, before: string, after: string) => {
    const lastWord = before;
    if (/^\p{Lu}/u.test(after) || KEEP_HYPHEN_PREFIX.test(lastWord)) {
      return `${before}-${after}`;
    }
    return `${before}${after}`;
  });
}
