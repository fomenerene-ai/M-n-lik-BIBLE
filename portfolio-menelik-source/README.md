# Sources du portfolio

Le site publié (`../portfolio-menelik/`) est généré : on ne l'édite jamais à la main.

| Fichier | Contenu |
|---|---|
| `config.json` | Constantes uniques : e-mail, domaine (`SITE_URL`), LinkedIn, lien de rendez-vous (`BOOKING_URL`), CV, analytics |
| `site.json` | Brief du moteur premium-3d-glass (5 chapitres, en français) |
| `content.json` | Traduction anglaise du brief, projets, parcours, outils, textes d'interface FR/EN |
| `overlay/` | Gabarit HTML, CSS et JS ajoutés au moteur |
| `assets/` | `og.png` ; dépose ici `cv.pdf` et `photo.jpg` (portrait 4:5) quand tu les as |
| `build.py` | Construit le site : moteur du skill + extensions + pages légales + SEO |

```sh
python3 build.py                        # régénère ../portfolio-menelik
cd ../portfolio-menelik && python3 serve.py 5180   # http://127.0.0.1:5180
```

Prérequis : Python 3 et le skill installé dans `~/.claude/skills/premium-3d-glass/`
(ou la variable `PREMIUM_GLASS_TEMPLATE` pointant vers son dossier `template/`).

Règles du moteur vérifiées au build : titres sur deux lignes, 18 caractères maximum par
ligne, en français comme en anglais ; aucun tiret cadratin ni demi-cadratin.
