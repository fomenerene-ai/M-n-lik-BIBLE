# Mise en ligne (Netlify ou Vercel)

1. Déploiement : sur app.netlify.com, « Add new site » puis « Deploy manually », glisse le dossier `portfolio-menelik/` (ou relie le dépôt GitHub avec « Base directory » = `portfolio-menelik`). Vercel : « New Project », même dossier, preset « Other ».
2. Avant chaque mise en ligne : modifie `portfolio-menelik-source/config.json` (e-mail, domaine, LinkedIn, Cal.com), puis `python3 build.py` dans `portfolio-menelik-source/`.
3. Domaine : achète-le chez un registrar (OVHcloud, Gandi, Namecheap…), compte 10 à 20 € par an pour un .com ou un .fr.
4. Dans Netlify : Domain management, « Add a domain », saisis ton domaine.
5. DNS chez le registrar : enregistrement `A` de `@` vers l'IP indiquée par Netlify, `CNAME` de `www` vers `ton-site.netlify.app` (ou délègue les DNS à Netlify).
6. Vercel : mêmes étapes, enregistrements affichés dans Settings, Domains.
7. HTTPS : certificat Let's Encrypt automatique et gratuit, actif quelques minutes après la propagation DNS (jusqu'à 24 h).
8. Vérifie ensuite : https://ton-domaine, `/robots.txt`, `/sitemap.xml`, puis déclare le sitemap dans Google Search Console.
9. Les en-têtes de sécurité et de cache sont dans `netlify.toml` (régénéré par build.py ; Vercel les ignore, ajoute un `vercel.json` si besoin).
10. `version-monofichier.html` sert à l'envoi par e-mail ou à l'ouverture hors ligne, pas à l'hébergement.
