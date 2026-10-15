# Histoires bibliques : format et lots

Chaque personnage est un fichier `public/histoires/<id>.json`. L’index est généré au build :
ajouter un personnage revient à ajouter un fichier, sans toucher au code.

## Format

```json
{
  "id": "abraham",                 // = nom du fichier, minuscules sans accents
  "nom": "Abraham",                // nom affiché
  "cle": "abraham",                // clé de tri alphabétique
  "ordre": 30,                     // rang chronologique (ordre biblique)
  "groupe": "Patriarches et matriarches",
  "periode": "Époque des patriarches",
  "resume": "Deux phrases.",
  "recit": ["Paragraphe avec référence [[Genèse 12:1-3]]."],
  "contexte": ["Éléments extérieurs au texte biblique."],
  "chronologie": [{ "etape": "Appel de Dieu", "ref": "Genèse 12:1-5" }],
  "references": ["Genèse 12:1-9"]
}
```

- `[[Livre C:V-V]]` devient un lien ouvrant le passage ; `[[Livre C:V|libellé]]` affiche un libellé.
- Une plage sur plusieurs chapitres (`Genèse 12:1-25:11`, `Genèse 39-45`) ouvre son point de départ.
- Références en numérotation Louis Segond 1910.
- `npm run check:stories` vérifie les champs, les références et l’absence de tirets longs.

## Règles de rédaction

- S’en tenir au texte biblique ; ne rien inventer.
- Rattacher chaque affirmation importante à une référence.
- Citations littérales entre guillemets, sinon reformulation.
- Ce qui relève de l’histoire, de l’archéologie ou de la tradition va dans `contexte`, jamais dans `recit`.
- Style clair et sobre, en français.

## Rangs chronologiques

| Plage | Groupe |
|---|---|
| 10 à 29 | Les origines |
| 30 à 69 | Patriarches et matriarches |
| 70 à 119 | Exode et conquête |
| 120 à 169 | Juges |
| 170 à 249 | Rois d’Israël et de Juda |
| 250 à 329 | Prophètes |
| 330 à 399 | Exil et retour |
| 400 à 469 | Évangiles |
| 470 à 549 | Apôtres et compagnons de Paul |

## Lots

| Lot | Personnages | État |
|---|---|---|
| 1 | Adam, Ève, Noé, Abraham, Sara, Agar, Melchisédek, Lot, Isaac, Rebecca, Ésaü, Jacob, Léa, Rachel, Joseph | Validé |
| 2 | Moïse, Aaron, Miriam, Jéthro, Josué, Caleb, Koré, Balaam, Phinées, Rahab, Acan | Livré, à valider |
| 3 | Juges et début de la royauté : Débora, Gédéon, Samson, Ruth, Noémi, Anne, Samuel, Saül… | À venir |
| 4 | Rois : David, Jonathan, Bath-Schéba, Salomon, Roboam, Jéroboam, Achab, Jézabel, Ézéchias, Josias… | À venir |
| 5 | Prophètes : Élie, Élisée, Ésaïe, Jérémie, Ézéchiel, Jonas, Osée, Amos… | À venir |
| 6 | Exil et retour : Daniel, Esther, Mardochée, Esdras, Néhémie, Zorobabel… | À venir |
| 7 | Évangiles : Marie, Joseph de Nazareth, Jean-Baptiste, Pierre, Marthe, Marie de Magdala, Nicodème, Zachée… | À venir |
| 8 | Apôtres et compagnons de Paul : Paul, Barnabas, Timothée, Silas, Lydie, Priscille et Aquilas, Étienne… | À venir |
