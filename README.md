# Ménélik Bible

Bible personnelle pour tablette Android, installable (PWA) et utilisable entièrement hors ligne.
Deux versions : Louis Segond 1910 et Bible du Semeur 2015. Recherche par référence, lecture continue,
surlignage, notes, favoris, projection en visioconférence, histoires des personnages bibliques.

Usage strictement personnel. Aucun compte, aucun serveur, aucune statistique : rien ne quitte la tablette.

## Autre application du dépôt : Parley

Le dossier `parley/` contient Parley, un entraîneur d'anglais oral (PWA statique, sans build), publié sous `/parley/` par le même workflow. Voir `parley/README.md`.

## Autre application du dépôt : Lectio

Le dossier `lectio/` contient Lectio, un lecteur vocal de documents et classeur personnel (React, TypeScript, Vite). Voir `lectio/CLAUDE.md`.

## Installer sur la tablette

1. Ouvrir l’adresse du site dans **Chrome** (connexion nécessaire la première fois).
2. Menu **⋮** puis **Installer l’application** (ou « Ajouter à l’écran d’accueil »).
3. Ouvrir Ménélik Bible depuis l’écran d’accueil et toucher **Télécharger les deux versions**.
   L’app enregistre environ 10 Mo de textes. Attendre le message « Tout est prêt ».
4. C’est fini : l’application fonctionne ensuite en mode avion.

En cas d’échec du téléchargement, le bouton **Réessayer** reprend là où l’opération s’est arrêtée
(une version déjà enregistrée n’est jamais retéléchargée). Repli : récupérer `FRLSG.json` et `BDS.json`
sur `https://bolls.life/static/translations/` depuis un ordinateur, les copier sur la tablette,
puis **Le téléchargement échoue toujours ? › Importer un fichier**.

## Mettre à jour

Quand une nouvelle version est publiée, l’app affiche « Nouvelle version disponible » à l’ouverture
(si la tablette est connectée). Toucher **Mettre à jour**. Tant que vous n’acceptez pas, l’ancienne version
reste active et fonctionne hors ligne. Vos textes et vos données sont conservés.

## Sauvegarder ses données

Surlignages, notes, marque-pages, file de projection et réglages sont stockés dans le navigateur.
Vider les données de Chrome pour ce site les effacerait.

- **Réglages › Exporter une sauvegarde** : télécharge un fichier `menelik-bible-sauvegarde-AAAA-MM-JJ.json`.
  Le ranger dans Drive, sur une clé, etc.
- **Réglages › Importer une sauvegarde** : remplace les données actuelles par celles du fichier, à l’identique.

L’app demande au navigateur un stockage persistant ; l’état est affiché dans les Réglages.

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` teste, construit et publie `dist/` à chaque push sur `main`.

1. Sur GitHub : **Settings › Pages › Build and deployment › Source : GitHub Actions**.
2. Fusionner la branche de travail dans `main`. L’adresse publiée apparaît dans l’onglet **Actions**.

Dépôt privé : GitHub Pages sur un dépôt privé exige un abonnement payant (Pro, Team ou Enterprise).
Sans abonnement, rendre le dépôt public (les textes bibliques n’y figurent pas) ou publier `dist/` sur
Netlify, qui accepte les dépôts privés gratuitement (build : `npm run build`, dossier : `dist`).

## Développement

```bash
npm install
npm run dev            # serveur de développement (sans service worker)
npm test               # tests unitaires (références, découpage, navigation, données)
npm run check:stories  # contrôle des fiches d'histoires
npm run build          # build de production dans dist/ (+ sw.js)
npm run preview        # sert dist/ sur http://localhost:4173
npm run test:e2e       # parcours complet dans Chromium (après build), textes simulés
npm run icons          # régénère les icônes PNG (Playwright requis)
```

Node 20 ou plus. Aucune dépendance d’exécution : seules Vite et Vitest servent au développement.

## Carte du code

```
index.html                 enveloppe HTML
vite.config.js             build ; index des histoires ; génération de sw.js (précache)
src/
  main.js                  démarrage, bandeau, rendu des écrans
  router.js                routes #/…, bouton retour (flèche et Android) qui remonte d’un niveau
  ui.js                    aides DOM, notifications, feuilles modales, balayages
  icons.js                 icônes SVG originales
  theme.js                 thème parchemin / sombre, taille du texte
  sw-register.js           service worker et bandeau de mise à jour
  sw-template.js           service worker (précache complet, mise à jour sur accord)
  core/
    books.js               66 livres, chapitres, testaments, formes alternatives
    reference.js           analyse et formatage des références, autocomplétion
    navigation.js          chapitre/livre suivant et précédent, sans coupure AT/NT
    paginate.js            découpage des passages en diapositives
    ranges.js              plages de surlignage (découpe, couleur), ordre biblique
    clean.js               nettoyage du texte importé (balises, Strong, espaces)
    parse-bolls.js         lecture du JSON Bolls, contrôles, comparaison de versification
    importer.js            téléchargement, reprise, enregistrement IndexedDB
    bible.js               accès aux chapitres (cache mémoire)
    db.js                  wrapper IndexedDB
    userdata.js            réglages, marques, file de projection, sauvegarde
    versions.js            LSG et BDS
  components/
    passage.js             versets, marques, menu d’action par verset
    refinput.js            champ de référence avec autocomplétion
  projection/
    projector.js           rendu et mesure des diapositives (aperçu = plein écran)
    live.js                plein écran, gestes, clavier, écran noir, Wake Lock
  screens/                 accueil, préparation, version, livres, chapitres, lecture,
                           recherche, favoris, projection, histoires, réglages
public/
  manifest.webmanifest     manifeste PWA
  icons/                   icônes 192/512, maskable
  histoires/*.json         une fiche par personnage (voir docs/HISTOIRES.md)
tests/unit/                tests Vitest
tests/e2e/run.mjs          parcours complet Playwright
```

## Données

IndexedDB `menelik-bible` :

| Magasin | Contenu |
|---|---|
| `chapters` | `{v, b, c, verses:[{n, t}]}`, un enregistrement par chapitre et par version |
| `meta` | état de l’import de chaque version, écarts constatés |
| `highlights` | `{id, b, c, vs, ve, color, date}` |
| `notes` | `{id, b, c, vs, ve, text, date}` |
| `bookmarks` | `{id, b, c, v, date}` (`v` nul : chapitre entier) |
| `settings` | `{key, value}` : taille du texte, version, thème, projection |
| `queue` | file de projection `{id, pos, b, c, vs, ve}` |

Les marques sont rattachées au livre, au chapitre et au verset, jamais à une version : elles restent
visibles quand on change de version.

## Textes bibliques

- Source : `https://bolls.life/static/translations/FRLSG.json` et `BDS.json` (repli :
  `https://bolls.life/get-translation/<ID>/`). Fichiers complets, comme le demande l’auteur de Bolls.
- Structure attendue : tableau d’objets `{pk, translation, book, chapter, verse, text}`. Le code parcourt
  la structure sans la supposer figée et retient tout objet portant ces champs.
- Nettoyage : numéros Strong `<S>…</S>`, notes `<sup>…</sup>`, balises HTML, entités, espaces.
- Contrôle : nombre de chapitres comparé à la liste canonique (écarts affichés dans les Réglages).
- Versification : un verset présent dans une version et absent dans l’autre est signalé à sa place
  pendant la lecture. **Réglages › Comparer la versification** liste tous les écarts.
- Les textes ne sont pas dans le dépôt. La Bible du Semeur (© Biblica) est téléchargée sur l’appareil
  pour un usage privé, avec l’accord de l’utilisateur.

## Limites connues

- La structure réelle du JSON Bolls n’a pas pu être inspectée depuis l’environnement de développement
  (accès réseau bloqué). L’import est volontairement tolérant et a été testé sur des données simulées
  au format documenté. Premier lancement réel : vérifier l’absence d’écarts dans **Réglages › Textes bibliques**.
- Lighthouse a retiré sa catégorie « PWA » (version 12). L’installabilité se vérifie dans Chrome :
  DevTools › Application › Manifest. Les audits Accessibilité, Bonnes pratiques et Performances
  donnent 100, 100 et 95 sur l’écran de premier lancement.
- Les références des histoires suivent la numérotation de la Louis Segond 1910.
