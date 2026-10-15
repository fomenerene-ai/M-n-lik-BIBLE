# Manual tests on the tablet

Browser-only features cannot be verified in the build environment (no real microphone, no Google speech
recognition, no Android voices, no installed PWA). Run this checklist on the tablet in Chrome, landscape.
Tick each line, and note the device, Android and Chrome versions.

What was verified automatically (headless Chromium with mocked speech and API): every screen renders
without console errors at 1024 and 1280 px; the Talk loop (streamed reply spoken sentence by sentence,
report, cards, levels); Listen passes; Dictation diff; placement; onboarding; backup export, reset and
import; audio import and segmentation of WAV files; shadowing analysis with a WAV fed as the microphone;
service worker update toast and offline shell; accessibility audit (contrast, names, target sizes).

## 1. Install and first launch

- [ ] Open `https://<user>.github.io/<repo>/parley/` in Chrome: the welcome screen appears, no sidebar.
- [ ] If the Bible app was installed before: Parley still opens (not the Bible page).
- [ ] Chrome menu, Install app: the icon (coral speech bubble) is on the home screen; the app opens full
      screen, landscape. Rotating to portrait shows "Please turn your tablet to landscape."
- [ ] API key step: a wrong key shows "API key not accepted"; a good key shows "Key works and is saved".
- [ ] Microphone step: Chrome asks for permission; the level bar moves when speaking; then "Heard: ..."
      shows the recognised sentence.
- [ ] Deny the microphone once (site settings), retry: "Microphone blocked" with the fix explained.
- [ ] Voice step: both buttons speak, American then British voice. With no English voice installed,
      the "No English voice installed" message explains how to install one.
- [ ] "Later" goes to Today with the placement banner.

## 2. Speech (the risky parts)

- [ ] Talk, Job interview, 5 min: the opening line is spoken immediately.
- [ ] The mic opens after the voice ends ("Listening, tap to stop"), with a soft ring.
- [ ] Words appear live in the dashed bubble while speaking.
- [ ] About 1.2 s after you stop, the turn ends by itself and the reply starts being spoken before the
      whole reply text has arrived (sentence by sentence).
- [ ] A long answer with short pauses (2 s) is not cut into several turns. Note what happens.
- [ ] Tapping the mic while the partner speaks interrupts the voice and opens the mic.
- [ ] Pause stops voice and mic; Resume reopens the mic. The timer does not move while paused.
- [ ] "Type instead" sends a typed answer.
- [ ] The partner never corrects you and never switches to French (try a sentence in French).
- [ ] At 0:00 the partner wraps up in one or two sentences, then the report screen opens.
- [ ] The partner accent alternates between sessions (Settings, accent "Mixed").
- [ ] Report: scores, errors, rephrasings, vocabulary (also visible in Cards, source Report), numbers
      (words per minute, turns, words per turn, silences over 3 s). Listed in Progress.
- [ ] Airplane mode during a conversation: a "No connection" message with "Try again"; the transcript
      is kept. Ending the session offline saves the report and offers "Generate feedback" later.

## 3. Shadowing (record which mode works)

- [ ] Shadow with only synthetic sentences: the note says there is no reference curve; your own curve
      (coral) is drawn; word and rhythm (duration only) scores appear.
- [ ] Import a real recording with a transcript, then Shadow: "Real recording" chip, reference curve
      (teal) and your curve overlaid, three part scores.
- [ ] **Record which mode the tablet uses**: Recording mode card says "One take" or "Two takes".
      If one take fails, the app switches to two takes by itself with an explanation.
      Result on this tablet: ______________________
- [ ] After 5 attempts averaging 80 or more, a toast says "Moving up to medium sentences".
- [ ] Nothing is saved: Settings, Storage shows no growth after many attempts (only scores are kept).

## 4. Listening content

- [ ] Listen, Generate (Work and finance): a dialogue with two different voices; pass 1, 2, 3 work.
- [ ] Subtitles toggle shows text during pass 1 and 2; tapping a word offers "Add" and the card gets a
      definition a few seconds later.
- [ ] Sentence repeat, previous, next, A then B loop work on a dialogue and on imported audio.
- [ ] Imported audio plays from the tablet with per-sentence repeat when segmented.
- [ ] After adding real VOA items to the manifest: they play in tier 1 or 2 and get questions.
- [ ] Dictation: "Show transcript" appears after two replays; diff colours; a word missed twice appears
      under "Missed twice" and can be added to cards.

## 5. Cards, Read aloud

- [ ] Review order: due cards first, then new ones; Again brings the card back at the end.
- [ ] Speaker button reads the term then the context sentence. "Say it" shows a word match.
- [ ] Add card (manual): definition and example arrive in English.
- [ ] Read aloud: paste a paragraph, play; words are highlighted one by one (or whole sentences if the
      voice gives no word positions: a note says so). Previous, next, restart work.
- [ ] Selecting two or three words offers "Add ... to cards".

## 6. Session, minutes, XP

- [ ] Today: Start on each step opens the activity with the guided step bar and timer; "+2 min"
      extends; "Finish step" returns to Today with the step marked done (teal check).
- [ ] Completing the five steps shows "session complete" (+100 XP).
- [ ] Minutes per day: today's bar grows. Leaving the tablet idle for over a minute, or switching app,
      does not add minutes.
- [ ] Progress: 7 and 30 day toggle.

## 7. Data and updates

- [ ] Settings, Export backup: a JSON file is downloaded. Open it: no API key inside.
- [ ] Reset all data, then Import backup (Replace): cards, minutes and reports are back.
- [ ] Import the same backup again with Merge: no duplicate cards, minutes unchanged.
- [ ] After a new deployment: "Update ready" toast, Reload, the app keeps its data.
- [ ] Settings, Storage: "Persistent storage" once the app is installed.

## 8. Accessibility and layout

- [ ] At 1024, 1280 and 1920 px wide (tablet landscape, split screen if available): no overlapping text.
- [ ] With a Bluetooth keyboard: Tab reaches every control with a visible focus ring; Enter and Space work.
- [ ] Android "Remove animations" on: presses and progress bars change without animation.
- [ ] TalkBack: buttons with icons only are announced with a name (close, replay, next...).
