# Guide Android

Ce guide sera complété à la phase 11 (application Android via Capacitor).
En attendant, tu peux déjà essayer Lectio sur ta tablette comme application web.

## Essayer Lectio sur ta tablette dès maintenant (réseau local)

1. Sur ton ordinateur, ouvre un terminal dans le dossier `lectio`.
2. Tape `npm install` (une seule fois).
3. Tape `npm run build` puis `npx vite preview --host --port 4174`.
4. Le terminal affiche une adresse « Network », par exemple `http://192.168.1.20:4174`.
5. Sur la tablette, connectée au même Wi-Fi, ouvre cette adresse dans Chrome.

Limite : sans HTTPS, Chrome n'active ni le mode hors ligne ni l'installation. Ce sera réglé par l'APK (phase 11) ou par une publication HTTPS.

## Dépannage : page blanche à l'ouverture de Lectio

Cause : l'ancienne version de Ménélik Bible, encore active sur la tablette, répond à la place de Lectio.
Elle se met à jour dès que toutes les pages du site sont fermées.

1. Dans Chrome, ferme l'onglet blanc et tous les onglets `fomenerene-ai.github.io`.
2. Si Ménélik Bible est installée : touche le bouton des applications récentes (carré ou trois traits), puis glisse Ménélik Bible vers le haut pour la fermer.
3. Rouvre Chrome et va sur `https://fomenerene-ai.github.io/M-n-lik-BIBLE/lectio/`.
4. Toujours blanc ? Ouvre Ménélik Bible, va dans Réglages, cherche une mise à jour, touche « Mettre à jour », puis recommence l'étape 3.

Ne vide pas les données du site dans Chrome : cela effacerait aussi tes surlignages et notes de la Bible.
