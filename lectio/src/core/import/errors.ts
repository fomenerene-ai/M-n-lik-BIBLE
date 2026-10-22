// Erreurs d'import avec un message clair qui dit quoi faire.

export type ImportErrorCode =
  'unsupported' | 'empty' | 'corrupt' | 'password' | 'storage-full' | 'too-large' | 'unknown';

const MESSAGES: Record<ImportErrorCode, string> = {
  unsupported:
    'Format non reconnu. Formats acceptés : PDF, DOCX, ePub, TXT, Markdown, HTML, JPG, PNG, WEBP.',
  empty:
    'Aucun texte lisible dans ce fichier. S’il s’agit d’un document scanné, l’OCR arrivera dans une prochaine version.',
  corrupt:
    'Le fichier semble abîmé ou incomplet. Ouvre-le dans son application d’origine, réenregistre-le, puis réessaie.',
  password:
    'Ce fichier est protégé par un mot de passe. Retire la protection dans son application d’origine, puis réessaie.',
  'storage-full':
    'Stockage plein. Libère de la place (corbeille, anciens documents) ou exporte une sauvegarde, puis réessaie.',
  'too-large': 'Fichier trop volumineux pour cet appareil (plus de 200 Mo).',
  unknown:
    'L’import a échoué pour une raison inattendue. Réessaie ; si cela persiste, note le nom du fichier.',
};

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code]);
    this.name = 'ImportError';
    this.code = code;
  }
}

export function userMessage(error: unknown): string {
  if (error instanceof ImportError) return error.message;
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return MESSAGES['storage-full'];
  }
  return MESSAGES.unknown;
}

export function isQuotaError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'QuotaExceededError') ||
    (error instanceof Error && /quota/i.test(error.message))
  );
}
