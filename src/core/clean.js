// Nettoyage du texte importé depuis Bolls : balises HTML, numéros Strong, notes, espaces.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  hellip: '…', mdash: '—', ndash: '–', oelig: 'œ', OElig: 'Œ',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function cleanText(raw) {
  if (raw == null) return '';
  let s = String(raw);
  // Numéros Strong : <S>1234</S>, <s>...</s>
  s = s.replace(/<S>[^<]*<\/S>/gi, '');
  // Notes et appels de note : <sup>...</sup>, <f>...</f>, <n>...</n>
  s = s.replace(/<(sup|f|n)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Sauts de ligne et paragraphes : espace
  s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?(p|pb|t)\b[^>]*\/?>/gi, ' ');
  // Toute autre balise : retirée, contenu conservé
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  // Espaces : les insécables (typographie française) restent insécables,
  // les fines deviennent des insécables simples, les suites d'espaces sont réduites.
  s = s
    .replace(/[  ]/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/[  ]{2,}/g, (m) => (m.includes(' ') ? ' ' : ' '))
    .trim();
  return s;
}
