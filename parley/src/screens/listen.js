/**
 * Listen: real-speed comprehension in three passes the learner controls.
 * Pass 1 audio only ("What did you catch?"), pass 2 questions and gap-fill, pass 3 subtitles with
 * tap-to-card. Subtitles can be shown at any time with the toggle.
 */
import { h, replace, mmss } from '../ui/dom.js';
import { button, iconButton, chip, choiceGroup, banner, errorBanner, emptyState, loading, toggle, tile } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { TIERS, TOPICS } from '../config.js';
import { allItems, recommend, exercisesFor, markListened, listenedMap, allowedTiers } from '../content/pool.js';
import { generateDialogue } from '../content/dialogues.js';
import { createPlayer } from '../content/player.js';
import { dialogueVoices } from '../speech/voice-choice.js';
import { getProfile, updateSkill } from '../state/profile.js';
import { addCard, enrichCard } from '../state/cards.js';
import { checkGap, checkShort } from '../learning/answers.js';
import { normWord, words } from '../learning/text.js';
import { startRun } from './run.js';

const TIER_COLORS = { 0: 'violet', 1: 'teal', 2: 'sky', 3: 'coral' };

/**
 * @param {HTMLElement} root
 * @param {{params: Record<string,string>}} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  const scores = [];
  const run = startRun('listen', route, { quality: () => (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length / 100 : null) });
  let player = null;
  let genAbort = null;
  const body = h('div.stack.loose');
  root.append(
    h('div.screen-head', null, h('div', null, h('h1', null, 'Listen'), h('p.subtitle', null, 'Natural speed, three passes. You control the pace.'))),
    run.frameEl, body);

  const closePlayer = () => { if (player) { player.destroy(); player = null; } };

  /* ---------------- Library ---------------- */
  const showLibrary = async () => {
    closePlayer();
    replace(body, loading('Loading listening items'));
    const [profile, items, done] = await Promise.all([getProfile(), allItems(), listenedMap()]);
    const level = profile.listeningLevel;
    const rec = await recommend(level);
    let topic = 'work';
    const genOut = h('div', { 'aria-live': 'polite' });
    const generate = async () => {
      replace(genOut, loading('Writing a new dialogue'));
      genAbort = new AbortController();
      try { const item = await generateDialogue(topic, level, genAbort.signal); showItem(item); } catch (e) {
        if (e.kind !== 'aborted') replace(genOut, errorBanner(e, { onRetry: generate, onSettings: () => ctx.go('settings') }));
      } finally { genAbort = null; }
    };

    const recCard = rec
      ? h('div.card.coral.card-row', null, tile('headphones', 'coral', true),
        h('div.grow', null, h('div.step-title.lg', null, rec.title), h('div.row', null, chip(TIERS[rec.tier].label, TIER_COLORS[rec.tier], true))),
        button('Start', { onClick: () => showItem(rec) }))
      : null;

    const byTier = [0, 1, 2, 3].map((t) => {
      const list = items.filter((i) => i.tier === t);
      const fit = allowedTiers(level).includes(t);
      const rows = list.slice(0, 40).map((i) => h('button.list-row', { type: 'button', onclick: () => showItem(i) },
        h(`div.tile.${TIER_COLORS[t]}`, null, icon(done.has(i.id) ? 'check' : 'headphones')),
        h('div.grow', null, h('div.title', null, i.title), h('div.muted.small', null, done.has(i.id) ? `Done, score ${done.get(i.id).score ?? 'n/a'}` : 'Not heard yet')),
        i.transcript ? null : chip('No transcript', 'grey', true)));
      const empty = t === 1 || t === 2 ? 'No VOA items yet. They are added to content/voa-manifest.json (see the README, "Add VOA items").'
        : t === 3 ? 'Import your own audio or Common Voice clips in Settings, Audio library.' : 'Generate your first dialogue above.';
      return h('section.stack', null,
        h('div.row', null, h('h2', null, TIERS[t].label), fit ? chip('Fits your level', 'teal', true) : chip('Outside your level band', 'grey', true)),
        h('p.muted.small', null, TIERS[t].note),
        rows.length ? h('div.list', null, ...rows) : h('p.muted', null, empty));
    });

    replace(body,
      recCard ? h('div.stack', null, h('h2', null, 'Recommended'), recCard) : null,
      h('div.card.stack', null,
        h('h3', null, 'New dialogue'),
        h('p.muted.small', null, 'Written by AI for your level and read by two device voices with mixed accents. Synthetic speech: real recordings are in the other tiers.'),
        h('div.row.between', null, choiceGroup(TOPICS.map((t) => ({ value: t.key, label: t.label })), topic, (v) => { topic = v; }, 'Topic'),
          button('Generate', { variant: rec ? 'outline' : 'primary', icon: 'bolt', onClick: generate })),
        genOut),
      ...byTier);
  };

  /* ---------------- Item ---------------- */
  const showItem = async (item) => {
    closePlayer();
    replace(body, loading('Preparing audio'));
    try {
      player = await createPlayer(item, item.kind === 'dialogue' ? await dialogueVoices() : {});
    } catch (e) { replace(body, errorBanner(e, { onRetry: () => showItem(item) })); return; }
    let pass = 1;
    let subtitlesOn = false;
    let score = null;
    let state = { playing: false, index: 0 };

    const passContent = h('div.stack');
    const subsBox = h('div.card.stack');
    const tabs = h('div.pass-tabs', { role: 'list' });
    const drawTabs = () => replace(tabs, ...[[1, 'Listen, no text'], [2, 'Questions'], [3, 'Subtitles']].map(([n, label]) => h('button.pass-tab', {
      type: 'button', role: 'listitem', 'aria-current': n === pass ? 'step' : null, onclick: () => setPass(n),
    }, h('span.num', null, String(n)), label)));

    // Player controls
    const playBtn = h('button.btn.btn-primary', { type: 'button', 'aria-label': 'Play', onclick: () => player.toggle() }, icon('play'), 'Play');
    const timeEl = h('span.time');
    const seek = player.mode === 'audio' ? h('input.seek', { type: 'range', min: 0, max: 100, step: 0.1, value: 0, 'aria-label': 'Position', oninput: (e) => player.seek(Number(e.target.value)) }) : null;
    const loopChip = h('span');
    const controls = h('div.card.stack', null,
      h('div.player', null,
        iconButton('skipPrev', item.hasSegments ? 'Previous sentence' : 'Back 10 seconds', () => player.prev()),
        playBtn,
        iconButton('skipNext', item.hasSegments ? 'Next sentence' : 'Forward 10 seconds', () => player.next()),
        iconButton('replay', item.hasSegments ? 'Repeat this sentence' : 'Back 5 seconds', () => player.replay()),
        seek, timeEl),
      h('div.row', null,
        button('A', { variant: 'outline', size: 'small', ariaLabel: 'Set loop start', onClick: () => player.markA() }),
        button('B', { variant: 'outline', size: 'small', ariaLabel: 'Set loop end and start looping', onClick: () => player.markB() }),
        iconButton('close', 'Clear loop', () => player.clearLoop()),
        loopChip,
        h('span.grow'),
        toggle('Show subtitles', subtitlesOn, (v) => { subtitlesOn = v; drawSubs(); })));

    const subLines = [];
    const drawSubs = () => {
      subsBox.hidden = !(subtitlesOn || pass === 3);
      if (subsBox.hidden || subLines.length) { highlight(); return; }
      if (!item.units.length) { replace(subsBox, h('p.muted', null, item.transcript || 'No transcript for this audio.')); return; }
      const lines = h('div.subtitle-lines.words');
      item.units.forEach((u, i) => {
        const pop = h('span.word-pop');
        const line = h('div.subtitle-line', null,
          u.speaker ? h('span.who', null, u.speaker) : null,
          h('span', { lang: 'en' }, ...words(u.text).flatMap((w) => [h('button.word-btn', { type: 'button', 'aria-expanded': 'false', onclick: (e) => wordMenu(e.currentTarget, w, u.text, pop) }, w), ' '])),
          pop);
        line.addEventListener('dblclick', () => player.playUnit(i));
        subLines.push(line);
        lines.append(line);
      });
      replace(subsBox, h('div.row.between', null, h('h3', null, 'Subtitles'), h('span.muted.small', null, 'Tap a word to add it to your cards.')), lines);
      highlight();
    };
    const highlight = () => subLines.forEach((l, i) => l.classList.toggle('current', i === state.index && (state.playing || player.mode === 'tts')));

    const wordMenu = (btn, word, sentence, pop) => {
      root.querySelectorAll('.word-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      root.querySelectorAll('.word-pop').forEach((p) => p.replaceChildren());
      btn.setAttribute('aria-expanded', 'true');
      const clean = normWord(word);
      const add = async (front) => {
        replace(pop, h('span.muted.small', null, 'Adding...'));
        const { card, created } = await addCard({ front, context: sentence, source: 'listening', sourceRef: item.id });
        replace(pop);
        btn.setAttribute('aria-expanded', 'false');
        if (!created) { toast(`"${front}" is already in your cards.`); return; }
        toast(`"${front}" added to cards.`);
        enrichCard(card).catch((e) => { if (e.kind === 'no-key') toast('Add an API key in Settings to get definitions.'); });
      };
      replace(pop,
        button(`Add "${clean}"`, { variant: 'sun', size: 'small', icon: 'plus', onClick: () => add(clean) }),
        button('Add sentence', { variant: 'outline', size: 'small', onClick: () => add(sentence) }),
        iconButton('close', 'Close', () => { replace(pop); btn.setAttribute('aria-expanded', 'false'); }));
    };

    player.onChange((s) => {
      state = s;
      replace(playBtn, icon(s.playing ? 'pause' : 'play'), s.playing ? 'Pause' : 'Play');
      playBtn.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
      if (player.mode === 'audio') {
        timeEl.textContent = `${mmss(s.time || 0)} / ${s.duration ? mmss(s.duration) : '--:--'}`;
        if (seek && s.duration) { seek.max = String(s.duration); seek.value = String(s.time || 0); }
        if (s.error && !controls.querySelector('.banner')) controls.append(banner({ tone: 'danger', icon: 'alert', text: s.error }));
      } else {
        timeEl.textContent = `${Math.min(s.index + 1, item.units.length)} / ${item.units.length}`;
      }
      replace(loopChip, s.loop && s.loop.a !== null ? chip(s.loop.b !== null ? 'Loop on' : 'Loop start set', 'sun', true) : null);
      highlight();
    });

    const exercises = async () => {
      replace(passContent, loading('Preparing questions'));
      let ex;
      try { ex = await exercisesFor(item); } catch (e) { replace(passContent, errorBanner(e, { onRetry: exercises, onSettings: () => ctx.go('settings') })); return; }
      if (!ex) { replace(passContent, banner({ tone: 'sun', icon: 'info', text: 'This audio has no transcript, so there are no questions. Add a transcript when importing to unlock passes 2 and 3.' })); return; }
      const qBlocks = ex.questions.map((q) => {
        if (q.kind === 'choice') {
          let picked = null;
          const opts = h('div.choice-group', { role: 'group', 'aria-label': q.question });
          q.options.forEach((o) => opts.append(h('button.choice', { type: 'button', 'aria-pressed': 'false', onclick: (e) => {
            picked = o;
            opts.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          } }, o)));
          return { el: h('div.qa', null, h('p.q', null, q.question), opts), check: () => {
            opts.querySelectorAll('.choice').forEach((b) => { b.classList.toggle('correct', b.textContent === q.answer); b.classList.toggle('wrong', b.textContent === picked && picked !== q.answer); b.disabled = true; });
            return picked === q.answer;
          } };
        }
        const input = h('input.input', { type: 'text', 'aria-label': q.question, autocomplete: 'off' });
        const fb = h('p.small');
        return { el: h('div.qa', null, h('p.q', null, q.question), input, fb), check: () => {
          const ok = checkShort(q.answer, input.value);
          input.classList.add(ok ? 'correct' : 'wrong');
          fb.textContent = ok ? 'Correct.' : `Expected: ${q.answer}`;
          fb.className = ok ? 'small teal-text' : 'small';
          input.disabled = true;
          return ok;
        } };
      });
      const gBlocks = ex.gaps.map((g) => {
        const [before, after] = g.sentence.split('____');
        const input = h('input.gap-input', { type: 'text', 'aria-label': `Missing words: ${before}...`, autocomplete: 'off', autocapitalize: 'off' });
        const fb = h('span.small');
        return { el: h('p.words', null, before, input, after, ' ', fb), check: () => {
          const ok = checkGap(g.answer, input.value);
          input.classList.add(ok ? 'correct' : 'wrong');
          if (!ok) fb.textContent = `(${g.answer})`;
          input.disabled = true;
          return ok;
        } };
      });
      const result = h('div', { 'aria-live': 'polite' });
      const checkBtn = button('Check answers', { icon: 'check', onClick: async () => {
        const all = [...qBlocks, ...gBlocks].map((b) => b.check());
        const s = Math.round((all.filter(Boolean).length / all.length) * 100);
        checkBtn.disabled = true;
        if (score === null) {
          score = s;
          scores.push(s);
          const lv = await updateSkill('listeningLevel', s);
          replace(result, banner({ tone: s >= 70 ? 'teal' : 'sun', icon: 'star', title: `Score ${s} / 100`, text: `Listening level ${lv.before.toFixed(1)} to ${lv.after.toFixed(1)}. Replay the parts you missed, then open the subtitles.`, action: { label: 'Next: subtitles', onClick: () => setPass(3) } }));
        }
      } });
      replace(passContent,
        h('div.card.stack', null, h('h3', null, 'Questions'), ...qBlocks.map((b) => b.el)),
        h('div.card.stack', null, h('h3', null, 'Fill the gaps'), h('p.muted.small', null, 'Key sentences from the audio. Type the missing words.'), ...gBlocks.map((b) => b.el)),
        h('div.row', null, checkBtn), result);
    };

    const setPass = (n) => {
      pass = n;
      drawTabs();
      if (n === 1) {
        replace(passContent, h('div.card.stack', null,
          h('h3', null, 'What did you catch?'),
          h('p.muted.small', null, 'Listen without text. Note what you understood, in English. Optional.'),
          h('textarea.textarea', { 'aria-label': 'What did you catch?' }),
          h('div.row', null, button('Next: questions', { onClick: () => setPass(2) }))));
      } else if (n === 2) exercises();
      else {
        replace(passContent, h('div.row', null, button('Finish this item', { variant: 'teal', icon: 'check', onClick: async () => {
          await markListened(item.id, score);
          toast('Item done.');
          showLibrary();
        } })));
      }
      drawSubs();
    };

    replace(body,
      h('div.row', null,
        button('All items', { variant: 'outline', size: 'small', icon: 'prev', onClick: showLibrary }),
        h('h2.grow', null, item.title),
        chip(TIERS[item.tier].short, TIER_COLORS[item.tier], true)),
      h('p.muted.small', null, TIERS[item.tier].note, item.licenseNote ? ` ${item.licenseNote}` : ''),
      tabs, controls, subsBox, passContent);
    setPass(1);
  };

  await showLibrary();
  return () => {
    if (genAbort) genAbort.abort();
    closePlayer();
    run.dispose();
  };
}
