# Décisions techniques

Chaque choix, sa raison, et les hypothèses prises quand une information manquait.

## Hypothèses

- **H1. Prototype absent.** `reference/lecteur-classeur.html` n'existe pas dans le dépôt. Le design suit la section 5 du cahier des charges (fond sombre, rail, lecteur flottant, ambre). Quand le fichier sera ajouté, le rendu sera recalé dessus.
- **H2. Emplacement.** Le dépôt contient déjà Ménélik Bible et Parley. Lectio vit dans `lectio/`, projet npm autonome, sans toucher aux autres applications.
- **H3. Tutoiement** dans l'interface, comme dans les consignes.

## Versions (vérifiées sur le registre npm le 22/10/2026)

| Paquet            | Version                    | Remarque                                                                                                                                                                             |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| vite              | 8.3.5                      |                                                                                                                                                                                      |
| react / react-dom | 19.3.1                     |                                                                                                                                                                                      |
| typescript        | **6.0.3** au lieu de 7.0.2 | `typescript-eslint` 8.72 exige `typescript < 6.1`. TS 7 (réécrit en Go) n'a pas encore l'API dont l'analyseur ESLint a besoin. Passage à TS 7 dès que typescript-eslint le supporte. |
| zustand           | 5.0.16                     |                                                                                                                                                                                      |
| dexie             | 4.4.6                      |                                                                                                                                                                                      |
| mammoth           | 1.13.0                     |                                                                                                                                                                                      |
| jszip             | 3.10.2                     |                                                                                                                                                                                      |
| vite-plugin-pwa   | 2.0.0                      | compatible Vite 8                                                                                                                                                                    |
| vitest            | 5.0.5                      |                                                                                                                                                                                      |
| @playwright/test  | 1.64.1                     |                                                                                                                                                                                      |
| eslint            | 10.13.0                    |                                                                                                                                                                                      |
| prettier          | 3.9.10                     |                                                                                                                                                                                      |

Installés aux phases concernées : pdfjs-dist (3), tesseract.js (4), minisearch (6), Capacitor (11), SDK Azure (9).

## Choix

1. **Projet séparé dans `lectio/`.** Évite de mélanger les dépendances des deux autres applications ; CI dédiée (job `lectio` dans `.github/workflows/tests.yml`).
2. **Routage par hash** (`#/lire/<id>`) sans bibliothèque. Aucun serveur requis, bouton Retour d'Android fonctionnel, compatible WebView Capacitor. Cinq écrans seulement : une dépendance de routage serait superflue.
3. **Extraction dans un Web Worker module.** L'interface ne fige pas. Conséquence : le code d'extraction n'utilise pas `DOMParser` (absent des Workers). D'où un convertisseur HTML maison tolérant (`core/import/html.ts`), réutilisé par DOCX, puis par ePub et HTML.
4. **DOCX via mammoth → HTML → blocs.** mammoth convertit les styles Word (Titre 1, Citation, Légende, en français et en anglais) en balises sémantiques. Titre et auteur lus dans `docProps/core.xml` avec JSZip. Images ignorées (illisibles à voix haute, et lourdes).
5. **Markdown : analyseur maison.** Besoins limités (titres, listes, citations, front matter). Une bibliothèque complète (marked, markdown-it) produirait du HTML qu'il faudrait reconvertir. Blocs de code ignorés.
6. **Segmentation : `Intl.Segmenter` + règles.** L'ICU coupe après `M.`, `Dr.`, `p. ex.`, `e.g.`, les initiales. Les segments sont refusionnés si le précédent finit par une abréviation connue ou si le suivant commence par une minuscule ou un chiffre. `etc.` n'est pas une abréviation bloquante (il termine souvent une phrase). Phrases de plus de 320 caractères recoupées sur `;`, `:` ou `,` pour la voix et le surlignage.
7. **Langue par bloc, par mots outils.** Sans dépendance, fiable dès 4 mots. Les blocs courts (titres) héritent du bloc suivant. Langue principale = majorité en caractères.
8. **Originaux : OPFS, repli IndexedDB.** L'OPFS est rapide et hors quota par entrée. Si `createWritable` manque (Safari) ou échoue, l'original est stocké en `ArrayBuffer` dans Dexie (`files`). Un `ArrayBuffer` plutôt qu'un `Blob` : clonable partout, y compris dans les tests.
9. **Doublons par SHA-256** (`crypto.subtle`), seulement parmi les documents hors corbeille.
10. **Corbeille = `deletedAt`.** Suppression réversible dès la phase 1 ; écran Corbeille et purge à 30 jours en phase 5.
11. **CSS Modules + jetons CSS.** Zéro framework CSS. Thèmes clair et sépia déjà définis par `data-theme`.
12. **Polices auto-hébergées via Fontsource**, sous-ensemble latin uniquement (accents français couverts) : ~150 Ko au total, en cache hors ligne.
13. **Service worker en `autoUpdate`.** Utilisateur unique : une mise à jour silencieuse au prochain lancement suffit. Désactivé en développement.
14. **Encodage des TXT** : UTF-8 strict, sinon Windows-1252.
15. **Icônes PWA** générées depuis un SVG par Chromium (`scripts/make-icons.mjs`), dont une version « maskable » pour Android.
16. **Pas de repli « extraction sans Worker ».** Les Workers modules sont pris en charge par tous les navigateurs visés ; le repli doublait 300 Ko dans le cache.
17. **Avertissement `npm audit`** (sprintf-js via argparse via mammoth) : ce code sert à l'outil en ligne de commande de mammoth, jamais importé dans l'application. Accepté.
