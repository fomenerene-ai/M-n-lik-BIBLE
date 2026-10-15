/* Service worker de Ménélik Bible.
 * Généré au build : la liste des fichiers et le numéro de version sont insérés par vite.config.js.
 *
 * Stratégie :
 *  - à l'installation, toute l'enveloppe (HTML, JS, CSS, polices, icônes, histoires) est mise
 *    en cache d'un seul bloc ; si un fichier manque, l'installation échoue et l'ancienne
 *    version reste active : l'accès hors ligne n'est jamais cassé ;
 *  - la nouvelle version attend l'accord de l'utilisateur (message SKIP_WAITING) ;
 *  - les requêtes vers notre origine sont servies depuis le cache ;
 *  - les requêtes externes (téléchargement initial des textes) ne sont pas interceptées.
 */

const VERSION = '__VERSION__';
const CACHE = `menelik-bible-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('menelik-bible-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Application monopage : toujours l'index en cache
    event.respondWith(
      caches.match('./index.html', { cacheName: CACHE }).then((r) => r || fetch(req)),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)),
  );
});
