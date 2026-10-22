// Détection du format à partir de l'extension, du type MIME et des premiers octets.

import type { DocFormat } from '../model';

const BY_EXT: Record<string, DocFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  epub: 'epub',
  txt: 'txt',
  text: 'txt',
  md: 'md',
  markdown: 'md',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
};

const BY_MIME: Record<string, DocFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/epub+zip': 'epub',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
};

export function detectFormat(name: string, mime: string, head: Uint8Array): DocFormat | null {
  // Signature binaire d'abord : elle ne ment pas.
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image';
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext && BY_EXT[ext]) return BY_EXT[ext];
  return BY_MIME[mime] ?? null;
}

export const ACCEPT =
  '.pdf,.docx,.epub,.txt,.md,.markdown,.html,.htm,.xhtml,.jpg,.jpeg,.png,.webp,' +
  Object.keys(BY_MIME).join(',');

/** Formats pris en charge par la version actuelle (les autres arrivent aux phases 3 et 4). */
export const SUPPORTED_NOW: ReadonlySet<DocFormat> = new Set(['docx', 'txt', 'md', 'html']);
