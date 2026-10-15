/* Service worker. Precaches the app shell only; API and audio are network-only.
 * VERSION and PRECACHE are rewritten by tools/build-sw.mjs. Do not edit them by hand. */

const VERSION = '76bce15d4dd8';
const CACHE = `parley-shell-${VERSION}`;
const PRECACHE = [
  "./",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon.svg",
  "./assets/icons/maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./src/ai/claude.js",
  "./src/ai/prompts.js",
  "./src/ai/schema.js",
  "./src/ai/sse.js",
  "./src/audio/capture.js",
  "./src/audio/library.js",
  "./src/config.js",
  "./src/content/dialogues.js",
  "./src/content/manifest-schema.js",
  "./src/content/player.js",
  "./src/content/pool.js",
  "./src/learning/adaptive.js",
  "./src/learning/answers.js",
  "./src/learning/conversation.js",
  "./src/learning/dates.js",
  "./src/learning/diff.js",
  "./src/learning/srs.js",
  "./src/learning/text.js",
  "./src/learning/xp.js",
  "./src/main.js",
  "./src/router.js",
  "./src/screens/cards.js",
  "./src/screens/dictation.js",
  "./src/screens/listen.js",
  "./src/screens/progress.js",
  "./src/screens/report-builder.js",
  "./src/screens/report.js",
  "./src/screens/run.js",
  "./src/screens/settings.js",
  "./src/screens/talk.js",
  "./src/screens/today.js",
  "./src/screens/welcome.js",
  "./src/speech/stt-merge.js",
  "./src/speech/stt.js",
  "./src/speech/tts.js",
  "./src/speech/voice-choice.js",
  "./src/state/activity.js",
  "./src/state/backup-schema.js",
  "./src/state/backup.js",
  "./src/state/cards.js",
  "./src/state/db.js",
  "./src/state/minutes.js",
  "./src/state/profile.js",
  "./src/state/reports.js",
  "./src/state/sessions.js",
  "./src/state/settings.js",
  "./src/sw-register.js",
  "./src/ui/components.js",
  "./src/ui/dom.js",
  "./src/ui/icons.js",
  "./src/ui/toast.js",
  "./styles/base.css",
  "./styles/components.css",
  "./styles/screens.css",
  "./styles/tokens.css"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('parley-shell-') && k !== CACHE).map((k) => caches.delete(k))))
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
  // Cross-origin (API, fonts, remote audio): network only, not intercepted.
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  // Range requests (audio seeking) and the content manifest go to the network.
  if (req.headers.has('range') || url.pathname.endsWith('.json')) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)));
});
