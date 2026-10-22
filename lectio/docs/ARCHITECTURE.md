# Architecture

Carte fichiers → fonctions → dépendances. À lire avant de modifier le code.

## Flux principal (import)

```
Importer / glisser-déposer
  → features/library/store.ts  importFiles()
  → core/storage/documents.ts  importFile(file, extractInWorker)
       ├ detect.ts         detectFormat()   signature, extension, MIME
       ├ hash.ts           sha256Hex()      → findByHash() : doublon ?
       ├ import/client.ts  extractInWorker() ─► workers/extract.worker.ts
       │                                          └ import/extract.ts extractDocument()
       │                                               ├ txt.ts / markdown.ts / html.ts / docx.ts → Extraction
       │                                               └ build.ts buildDocument()
       │                                                    ├ text/normalize.ts  NFKC, espaces
       │                                                    ├ text/lang.ts       detectLang()
       │                                                    └ text/segment.ts    segmentSentences()
       ├ files.ts          saveOriginal()   OPFS ou repli Dexie
       └ db.ts             docs + contents (transaction)
```

## Fichiers

### `src/core/` (logique pure, sans React)

| Fichier                | Exporte                                                                                                                            | Dépend de                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `model.ts`             | types `Block`, `DocMeta`, `RawBlock`, `Extraction`, `BuiltDocument`…                                                               | rien                        |
| `text/normalize.ts`    | `normalizeText`, `collapseSpaces`, `joinHyphenatedLines`                                                                           | rien                        |
| `text/segment.ts`      | `segmentSentences(text, lang, blockId)`                                                                                            | `Intl.Segmenter`            |
| `text/lang.ts`         | `detectLang(text)` → `'fr' \| 'en' \| null`                                                                                        | rien                        |
| `text/estimate.ts`     | `listeningMinutes`, `formatDuration`                                                                                               | rien                        |
| `import/detect.ts`     | `detectFormat`, `ACCEPT`, `SUPPORTED_NOW`                                                                                          | model                       |
| `import/decode.ts`     | `decodeText` (UTF-8/1252), `decodeEntities`                                                                                        | rien                        |
| `import/errors.ts`     | `ImportError`, `userMessage`, `isQuotaError`                                                                                       | rien                        |
| `import/txt.ts`        | `textToBlocks`, `extractTxt`                                                                                                       | decode, normalize           |
| `import/markdown.ts`   | `markdownToBlocks`, `stripInlineMarkdown`, `extractMarkdown`                                                                       | decode, normalize           |
| `import/html.ts`       | `htmlToBlocks` (sans DOM), `extractHtml`                                                                                           | decode                      |
| `import/docx.ts`       | `extractDocx`                                                                                                                      | mammoth, jszip, html        |
| `import/build.ts`      | `buildDocument(extraction, fallbackTitle)`                                                                                         | text/*                      |
| `import/extract.ts`    | `extractDocument(buffer, format, name)`                                                                                            | tous les extracteurs, build |
| `import/protocol.ts`   | types des messages Worker                                                                                                          | model                       |
| `import/client.ts`     | `extractInWorker`                                                                                                                  | worker                      |
| `storage/db.ts`        | `db` (Dexie), types `DocContent`, `Folder`, `StoredFile`, `Setting`                                                                | dexie                       |
| `storage/files.ts`     | `saveOriginal`, `readOriginal`, `deleteOriginal`                                                                                   | OPFS, db                    |
| `storage/hash.ts`      | `sha256Hex`                                                                                                                        | WebCrypto                   |
| `storage/documents.ts` | `importFile`, `listDocs`, `getDoc`, `getContent`, `markOpened`, `savePosition`, `trashDoc`, `restoreDoc`, `purgeDoc`, `createMeta` | db, files, hash, detect     |

### `src/workers/`

| Fichier             | Rôle                                               |
| ------------------- | -------------------------------------------------- |
| `extract.worker.ts` | reçoit `ExtractRequest`, renvoie `ExtractResponse` |

### `src/app/` (coquille)

| Fichier           | Rôle                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `App.tsx`         | grille rail + contenu, choix de l'écran selon la route, dialogues globaux |
| `router.ts`       | `useRoute`, `navigate`, `parseRoute`, `routeHref` (hash)                  |
| `Rail.tsx`        | rail vertical (≥ 720 px) ou barre du bas (téléphone)                      |
| `DropOverlay.tsx` | glisser-déposer global                                                    |
| `Placeholder.tsx` | écrans pas encore construits                                              |

### `src/features/`

| Fichier                       | Rôle                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `library/store.ts`            | Zustand : `docs`, `importing`, `duplicates`, `load`, `importFiles`, `resolveDuplicate`, `trash`                              |
| `library/LibraryView.tsx`     | grille de cartes, état vide, import                                                                                          |
| `library/DuplicateDialog.tsx` | « Ouvrir l'existant » / « Importer quand même »                                                                              |
| `library/useFilePicker.ts`    | sélecteur de fichiers multiple                                                                                               |
| `reader/ReaderView.tsx`       | vue texte : titres, paragraphes numérotés, phrases `data-sid`, barre d'outils, lecteur flottant (inactif jusqu'à la phase 2) |

### `src/ui/`

`tokens.css` (jetons + thèmes), `global.css`, `icons.tsx`, `Button.tsx` (`Button`, `IconButton`), `Dialog.tsx`, `Menu.tsx`, `toast.ts` + `Toasts.tsx`.

## Stockage (Dexie, base `lectio`, version 1)

| Table      | Clé     | Index                                               | Contenu                        |
| ---------- | ------- | --------------------------------------------------- | ------------------------------ |
| `docs`     | `id`    | hash, folderId, addedAt, openedAt, deletedAt, *tags | `DocMeta`                      |
| `contents` | `docId` |                                                     | `{ docId, blocks }`            |
| `folders`  | `id`    | parentId                                            | dossiers (phase 5)             |
| `files`    | `id`    |                                                     | originaux si OPFS indisponible |
| `settings` | `key`   |                                                     | réglages (phase 2+)            |

OPFS : `originals/<docId>`.

## Tests

- `tests/unit/` : Vitest, Node, IndexedDB simulée (`fake-indexeddb`). Un fichier par domaine.
- `tests/e2e/` : Playwright sur le build de production, profil tablette paysage.
- `tests/fixtures/` : générés par `scripts/make-fixtures.mjs`.
