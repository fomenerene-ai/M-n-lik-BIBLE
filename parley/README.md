# Parley

A personal English speaking and listening trainer for an Android tablet, built for a French-speaking
B1-B2 learner who wants to understand natives at real speed and speak without freezing.

Every day: a guided 30 minute session in five steps (Listen 8 min, Talk 10, Shadow 5, Cards 4,
Dictation 3), with XP and levels. One user, no account, no server: everything is stored on the
tablet, with a JSON export and import.

- Installable PWA, landscape, Chrome on Android. Works from 1024 to 1920 px wide.
- Static files only: no build step, no framework, no dependency. Served from GitHub Pages.
- Conversations, reports and generated listening use the Anthropic Messages API with your own key.
- Voices and speech recognition come from the tablet (Chrome `speechSynthesis` and speech recognition).
- The app name is the `APP_NAME` constant in `src/config.js` (also repeated in `index.html`,
  `manifest.webmanifest` and this README).

Project notes for future work: [`CLAUDE.md`](CLAUDE.md). Decisions and their reasons:
[`docs/DECISIONS.md`](docs/DECISIONS.md). Tablet checklist: [`docs/MANUAL-TESTS.md`](docs/MANUAL-TESTS.md).

## Install on the tablet

This repository also hosts the Ménélik Bible app at its root. Parley lives in the `parley/` folder and is
published at `https://<user>.github.io/<repo>/parley/`.

1. **Repository.** The code is already in `fomenerene-ai/M-n-lik-BIBLE`. For a fresh copy elsewhere:
   create a GitHub repository, then `git push` this folder's repository to it.
2. **Merge to `main`.** The workflow `.github/workflows/deploy.yml` runs on every push to `main`: it runs
   the tests, builds the Bible app, copies `parley/` to `dist/parley/` and publishes `dist/`.
3. **Enable Pages (once).** On GitHub: Settings, Pages, Build and deployment, Source: **GitHub Actions**.
   (Parley alone would also work with "Deploy from a branch", folder `/`, because it needs no build,
   but this repository uses Actions for the Bible app.)
4. **Open the HTTPS address** in Chrome on the tablet: `https://<user>.github.io/<repo>/parley/`.
   Microphone and speech recognition need HTTPS: GitHub Pages provides it.
   If the Bible app is already installed on the tablet, open it once and accept its "new version" prompt
   first: older versions of its service worker answered every page of the site, including `/parley/`.
5. **Add to Home screen.** Chrome menu, **Install app** (or **Add to Home screen**). Open Parley from the
   home screen icon: it runs full screen in landscape.
6. **Allow the microphone** when Chrome asks (first launch, microphone step).
7. **Enter your API key** (first launch or Settings). Create a dedicated key in the Anthropic Console
   with a monthly spend limit. The key is stored only in this browser's storage on the tablet: it is never
   exported and only ever sent to `api.anthropic.com`.
8. **Install English voices** if the voice test is silent: Android Settings, Text-to-speech output,
   Speech Services by Google, Install voice data, English (United States) and English (United Kingdom).
   Other English voices (Australia, India, Ireland...) appear automatically once installed.
9. **Take the placement test** (about 5 minutes) from the first launch flow or from Today.

Updates: when a new version is deployed, the app shows "Update ready" with a Reload button.

### Run locally

```
python3 -m http.server 8080          # from the repository root
# open http://localhost:8080/parley/
node --test "parley/tests/*.test.js" # unit tests, no dependencies
node parley/tools/check-secrets.mjs  # fails if a key-like string is tracked
node parley/tools/validate-manifest.mjs
node parley/tools/build-sw.mjs       # after changing any app file: refreshes the service worker list
node parley/tools/make-icons.mjs     # regenerates the icons
```

Optional git hook against committing a key:
`printf '#!/bin/sh\nnode parley/tools/check-secrets.mjs\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`

## Costs and privacy

- API calls: one streamed call per conversation turn (effort `low`), one call for each report, one per
  generated dialogue, one per card definition, one per set of questions for real audio. Every request is
  capped at 8000 output tokens and a conversation at 80 learner turns. Set a spend limit on the key.
- Recordings are never stored: microphone audio is analysed in memory and discarded.
- No analytics, no tracking, no notifications. The only network hosts are the app itself, Google Fonts,
  `api.anthropic.com` and VOA audio hosts (see the Content Security Policy in `index.html`).

## Backup

Settings, Data: **Export backup** downloads `parley-backup-YYYY-MM-DD.json` (profile, minutes, sessions,
cards, reports, generated listening, shadowing attempts, settings). It never contains the API key or
imported audio files: keep your original audio files to re-import them.
**Import backup** validates the file, migrates older formats, then either **merges** (cards de-duplicated,
minutes never doubled) or **replaces** your data.

## Add VOA items

`content/voa-manifest.json` is a curated list. The shipped file only holds three items marked
`"placeholder": true`, which the app ignores: VOA sites could not be reached when this was built, and no
address was invented.

Rules:
- **VOA-produced content only.** Never add an item whose page or transcript credits AP (Associated
  Press), Reuters or AFP: that material is copyrighted. The validator rejects those credits.
- Tier 1 = VOA Learning English (read about one third slower, a stepping stone), tier 2 = VOA news at
  normal speed.

Steps for each item:
1. Open the story page on `learningenglish.voanews.com` (or `voanews.com` for tier 2). Check the byline
   is VOA.
2. Copy the MP3 link of the story's audio (the download link on the page) into `audioUrl`.
3. Copy the full transcript from the same page into `transcript`.
4. Fill `id` (lowercase slug), `tier`, `title`, `topic` (work, daily, travel, news, science, culture,
   health, education), `source` (the page URL), `licenseNote` (for example "Public domain, produced by
   VOA") and `durationSec`.
5. Optional `segments`: `[{ "start": 0.0, "end": 4.2, "text": "First sentence." }, ...]` in seconds.
   With segments you get per-sentence repeat, loops, Dictation and Shadowing on that item.
6. Remove `"placeholder": true` (or delete the placeholder items).
7. Run `node parley/tools/validate-manifest.mjs --check-urls`: it checks the schema, the credits, that
   the audio host is allowed by the Content Security Policy, and that each URL answers.
   If audio comes from a new host, add it to `media-src` (and `connect-src`) in `index.html`.

Remote audio plays in a plain `<audio>` element. It is analysed for a voice curve (Shadowing) only if the
host allows cross-origin reads (CORS); otherwise the app says so and compares words and duration only.

## Import audio and Common Voice

Settings, Audio library, **Import audio**. Select several files at once:
- Audio: `.mp3`, `.wav`, `.m4a` (and `.ogg`, `.webm`, `.flac` when the tablet can decode them), up to 80 MB.
- Optional transcript with the **same base name**: `talk.mp3` + `talk.srt` (timed cues, used as
  segments), `talk.vtt`, or `talk.txt` (plain text, aligned with the detected sentences in order).
- Common Voice: select the clips together with the dataset's `.tsv` file (columns `path` and `sentence`).
  Each clip becomes one item titled with its sentence.

The app decodes each file in the browser, cuts it into 1 to 12 second segments on silences, and aligns
the transcript. Imported items appear as tier 3 in Listen, and feed Dictation and Shadowing (Shadowing
uses them first: they are real native speech, so the voice curve can be compared).
Audio files stay in the browser storage of the tablet and are not part of backups.

**Licensing.** Common Voice data is CC0, but its terms forbid re-hosting or re-sharing the dataset.
Never commit Common Voice files to this repository and never serve them from GitHub Pages: download them
yourself (commonvoice.mozilla.org, datasets) and import them locally. The **Spontaneous Speech** subset is
the closest to natural conversation. The same applies to any audio you do not own: keep it on the tablet.

## Known limits

- Synthetic voices cannot be captured, so Shadowing has no reference voice curve for them: you see your
  own curve, the word match and a duration check, and the screen says so.
- Speech recognition tends to auto-correct mispronounced words: the word match is generous and is never
  a pronunciation diagnosis.
- Some Android devices cannot run speech recognition and recording at the same time. Shadowing detects it
  and switches to two takes (words, then voice curve).
- Word-by-word highlighting in Read aloud depends on the voice reporting word positions; otherwise whole
  sentences are highlighted.
