// Modèle de document commun. Tous les extracteurs produisent ces structures ;
// le lecteur, la voix et la recherche ne connaissent que ce modèle.

export type Lang = 'fr' | 'en';
export type LangMode = 'auto' | Lang;
export type DocFormat = 'pdf' | 'docx' | 'epub' | 'txt' | 'md' | 'html' | 'image';
export type BlockKind = 'heading' | 'paragraph' | 'list-item' | 'quote' | 'caption';

export type Sentence = { id: string; text: string; start: number; end: number };

export type SourceRect = { page: number; x: number; y: number; w: number; h: number };

export type Block = {
  id: string;
  kind: BlockKind;
  level?: number;
  text: string;
  page?: number;
  lang: Lang;
  sentences: Sentence[];
  sourceRects?: SourceRect[];
};

export type TocEntry = { title: string; blockId: string; level: number };

export type DocPosition = { blockId: string; sentenceId: string };

export type DocMeta = {
  id: string;
  title: string;
  author?: string;
  format: DocFormat;
  hash: string;
  folderId: string | null;
  tags: string[];
  favorite: boolean;
  color?: string;
  pages: number;
  chars: number;
  langMain: Lang;
  langMode: LangMode;
  ocr: boolean;
  toc: TocEntry[];
  position: DocPosition;
  progress: number;
  listenedSeconds: number;
  addedAt: number;
  openedAt: number;
  deletedAt?: number;
  /** Nom du fichier importé, utile pour l'export et les messages. */
  fileName: string;
  fileSize: number;
  mimeType: string;
};

/** Bloc brut produit par un extracteur, avant segmentation et détection de langue. */
export type RawBlock = {
  kind: BlockKind;
  level?: number;
  text: string;
  page?: number;
  sourceRects?: SourceRect[];
};

/** Résultat brut d'un extracteur. */
export type Extraction = {
  title?: string;
  author?: string;
  pages?: number;
  ocr?: boolean;
  blocks: RawBlock[];
};

/** Résultat complet après construction du modèle commun. */
export type BuiltDocument = {
  title: string;
  author?: string;
  pages: number;
  chars: number;
  langMain: Lang;
  ocr: boolean;
  toc: TocEntry[];
  blocks: Block[];
};
