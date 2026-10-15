# Decisions

One line per non-obvious decision, with the reason.

- App lives in `parley/` of the Ménélik Bible repo (user choice); deployed by the existing Pages workflow, which copies `parley/` into `dist/parley/` after the Vite build.
- The Bible service worker (`src/sw-template.js`) now skips `./parley/` requests: without it, a tablet that already runs the Bible app would get the Bible page when opening `/parley/`.
- Hash routing (`#/listen`) because GitHub Pages has no rewrite rules and paths must stay relative.
- `node --test "parley/tests/*.test.js"` (glob) because Node 22 does not accept a directory argument the way later versions do.
- `parley/package.json` declares `"type": "module"` so the folder does not depend on the Bible's package.json.
- `sw.js` keeps a hand-free precache list rewritten by `tools/build-sw.mjs`; a test fails when it is stale. This is a dev tool, not a build step: the repo is deployable as is.
- Navigations are served from the cached `index.html` (cache-first shell) so HTML and JS always come from the same version; new versions arrive through the "Update ready, reload" toast.
- `.json` requests and range requests bypass the service worker so the content manifest is always fresh and audio seeking works.
- Icons are rasterised by a dependency-free node script (`tools/make-icons.mjs`) from the same geometry as `icon.svg`.
- Contrast: the spec colors are kept for fills, but text on tints uses darker "ink" tokens (`--coral-ink`, `--teal-ink`, `--muted-strong`) to reach 4.5:1. Learner bubbles use `--sky-strong` (#1F78D1, 4.5:1 with white) instead of #4CA8FF (2.5:1).
- White labels on coral buttons are 3.07:1. They are 20 px semibold and above, which WCAG AA classes as large text (3:1). Kept for the "Pop" look; all body text is at least 4.5:1.
- VOA sites could not be reached from the build environment (DNS blocked), so the manifest ships 3 placeholder items flagged `"placeholder": true`, ignored by the app. No URL was invented.
- CSP allows `https://*.voanews.com` for media and connect (CORS decode attempt). The validator fails if a manifest audio host is not in the CSP.
- Separate `audioBlobs` store next to `audioLibrary`: listing the library never loads audio data.
- Cards carry a `frontKey` (lowercase front) index for de-duplication, and `lastReviewedAt` to tell new cards from reviewed ones.
- Adaptive rule: a score of 70 on content at the learner's level is "on level"; target = level + 2 * (score - 70) / 30, then EMA with alpha 0.15, clamped to 1..10 and to +/- 0.5 from the level held at the start of the day.
- Backups exclude the imported audio library entirely (metadata too), so an import never creates entries whose audio is missing. Device-local `shadowAttempts` ids are dropped on export.
- Merge import: minutes take the per-activity max per date (re-importing never doubles them), cards dedupe by id then by lowercase front keeping the most recently reviewed copy, profile kept unless the backup has more XP.
- Minutes are flushed every 15 s while an activity runs, so a crash loses at most 15 s; XP is awarded when the activity ends.
