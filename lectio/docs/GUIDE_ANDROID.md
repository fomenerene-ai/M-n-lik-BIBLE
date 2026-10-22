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
