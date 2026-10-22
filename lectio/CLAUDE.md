# Lectio : mémoire projet

Lecteur vocal de documents (FR/EN) et classeur personnel. PWA + Android (Capacitor), 100 % local.
Cahier des charges complet : demandé par l'utilisateur en session ; résumé dans `docs/DECISIONS.md`.

## Commandes (depuis `lectio/`)

| But                   | Commande                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Installer             | `npm install`                                                                                                       |
| Développement         | `npm run dev` puis http://localhost:5175                                                                            |
| Tests unitaires       | `npm test`                                                                                                          |
| Bout en bout          | `npm run test:e2e` (build + preview sur :4174). En cloud : `PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e` |
| Lint / format / types | `npm run lint`, `npm run format`, `npm run typecheck`                                                               |
| Build                 | `npm run build` (sortie `dist/`)                                                                                    |
| Jeux d'essai          | `npm run fixtures` (régénère `tests/fixtures/`)                                                                     |
| Icônes PWA            | `node scripts/make-icons.mjs`                                                                                       |

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess`. Aucun `any`.
- Interface en français, tutoiement. Jamais de tiret cadratin ou demi-cadratin dans les textes visibles.
- Styles : CSS Modules par composant, jetons dans `src/ui/tokens.css`. Cibles tactiles ≥ 44 px.
- Un extracteur par format dans `src/core/import/`, tous vers `Extraction` puis `buildDocument` (modèle commun `src/core/model.ts`).
- Le code d'extraction ne doit pas utiliser le DOM (il tourne dans un Worker).
- Les erreurs visibles passent par `ImportError` / `userMessage` : message qui dit quoi faire.
- Schéma Dexie : ne jamais modifier `version(1)`, ajouter `version(n+1)` avec migration.
- Pas de dépendance nouvelle sans entrée dans `docs/DECISIONS.md`.
- Caractères invisibles (espace insécable…) : toujours écrits en échappement ` ` dans le code.

## État des phases

| Phase                                              | État        |
| -------------------------------------------------- | ----------- |
| 0 Initialisation                                   | ✅ terminée |
| 1 Stockage, import TXT/MD/DOCX, classeur de base   | ✅ terminée |
| 2 Lecteur + Web Speech + file de phrases + reprise | à faire     |
| 3 à 12                                             | à faire     |

## Problèmes connus

- Prototype `reference/lecteur-classeur.html` absent du dépôt : design reconstruit d'après la section 5 du cahier des charges.
- `npm audit` : 3 alertes modérées via `mammoth → argparse → sprintf-js`, code de ligne de commande jamais chargé dans le navigateur.
- PDF, ePub, images : détectés mais refusés avec message clair jusqu'aux phases 3 et 4.
