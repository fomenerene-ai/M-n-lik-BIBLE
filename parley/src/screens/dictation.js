/**
 * Dictation: full transcription of real-speed sentences from the listening pool.
 * Unlimited replays; the transcript is offered after two replays. The diff marks correct, missing,
 * wrong and extra words. Words missed twice can be added to cards in one tap.
 */
import { h, replace } from '../ui/dom.js';
import { button, chip, errorBanner, emptyState, loading } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { allItems, sentenceUnits } from '../content/pool.js';
import { generateDialogue } from '../content/dialogues.js';
import { createPlayer } from '../content/player.js';
import { dialogueVoices } from '../speech/voice-choice.js';
import { speak, cancelSpeech } from '../speech/tts.js';
import { alignWords, alignmentScore, missedWords } from '../learning/diff.js';
import { sentenceContaining } from '../learning/text.js';
import { getProfile, updateSkill } from '../state/profile.js';
import { addCard, enrichCard } from '../state/cards.js';
import { startRun } from './run.js';

/**
 * @param {HTMLElement} root
 * @param {{params: Record<string,string>}} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  const results = [];
  const missCount = new Map();
  const run = startRun('dictation', route, { quality: () => avg() / 100 });
  const avg = () => (results.length ? results.reduce((a, b) => a + b, 0) / results.length : 0);
  const players = new Map();
  let voices = null;

  const main = h('div.activity-main');
  const stats = h('div.card.stack.tight');
  const missedBox = h('div.card.stack.tight');
  root.append(
    h('div.screen-head', null, h('div', null, h('h1', null, 'Dictation'), h('p.subtitle', null, 'Type exactly what you hear. Natural speed, replay as often as you need.'))),
    run.frameEl,
    h('div.activity', null, main, h('div.activity-rail', null, stats, missedBox, h('div.card.soft.stack.tight', null,
      h('h3', null, 'Legend'),
      h('div.legend', null, h('span.tok.correct', null, 'correct'), h('span.tok.missing', null, 'missing'), h('span.tok.wrong', null, 'wrong'), h('span.tok.extra', null, 'extra'))))));

  const drawStats = () => replace(stats, h('h3', null, 'This session'),
    h('div.row', null, chip(`${results.length} sentence${results.length === 1 ? '' : 's'}`, 'violet', true), chip(`${Math.round(avg())}% average`, 'teal', true)));
  const drawMissed = () => {
    const twice = [...missCount.entries()].filter(([, v]) => v.count >= 2);
    replace(missedBox, h('h3', null, 'Missed twice'),
      twice.length ? h('div.row', null, ...twice.map(([w, v]) => button(w, { variant: 'outline', size: 'small', icon: 'plus', ariaLabel: `Add ${w} to cards`, onClick: async (e) => {
        e.currentTarget.disabled = true;
        const { card, created } = await addCard({ front: w, context: v.context, source: 'listening', sourceRef: 'dictation' });
        toast(created ? `"${w}" added to cards.` : `"${w}" is already in your cards.`);
        if (created) enrichCard(card).catch(() => {});
      } }))) : h('p.muted.small', null, 'Words you miss twice appear here, ready to add to your cards.'));
  };
  drawStats();
  drawMissed();

  const load = async () => {
    replace(main, loading('Loading sentences'));
    const items = await allItems();
    let pool = sentenceUnits(items, 4, 25);
    if (!pool.length) {
      const out = h('div');
      replace(main, emptyState('pen', 'violet', 'No sentences yet', 'Dictation uses the listening items. Generate a dialogue to start.',
        button('Generate a dialogue', { icon: 'bolt', onClick: async () => {
          replace(out, loading('Writing a dialogue'));
          try { await generateDialogue('work', (await getProfile()).listeningLevel); load(); } catch (e) { replace(out, errorBanner(e, { onSettings: () => ctx.go('settings') })); }
        } })), out);
      return;
    }
    // Shuffle, real audio first.
    pool = pool.map((s) => ({ s, k: (s.item.tier > 0 ? 0 : 1) + Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.s);
    voices = await dialogueVoices();
    let i = 0;
    const next = () => { show(pool[i % pool.length]); i += 1; };
    next();

    function show(sentence) {
      let replays = 0;
      let checked = false;
      const play = async () => {
        if (sentence.item.kind === 'dialogue') {
          cancelSpeech();
          await speak(sentence.text, { voice: (sentence.speaker === 'B' ? voices.B : voices.A).voice }).catch((e) => main.append(errorBanner(e)));
        } else {
          let p = players.get(sentence.item.id);
          if (!p) { p = await createPlayer(sentence.item); players.set(sentence.item.id, p); }
          await p.playUnit(sentence.unit);
        }
      };
      const replayInfo = h('span.muted.small', { 'aria-live': 'polite' }, 'Not played yet');
      const transcriptBox = h('div');
      const offerTranscript = () => {
        if (replays >= 2 && !transcriptBox.firstChild && !checked) {
          transcriptBox.append(button('Show transcript', { variant: 'outline', size: 'small', icon: 'eye', onClick: () => replace(transcriptBox, h('p.words', { lang: 'en' }, sentence.text)) }));
        }
      };
      const input = h('textarea.textarea', { 'aria-label': 'Type what you hear', autocapitalize: 'sentences', spellcheck: 'false' });
      const result = h('div.stack', { 'aria-live': 'polite' });
      const playBtn = button('Play sentence', { icon: 'play', size: 'large', onClick: async () => {
        const first = replayInfo.textContent === 'Not played yet';
        if (!first) replays += 1;
        replayInfo.textContent = replays ? `${replays} replay${replays > 1 ? 's' : ''}` : 'Played once';
        offerTranscript();
        await play();
        input.focus();
      } });
      const checkBtn = button('Check', { variant: 'teal', icon: 'check', onClick: async () => {
        if (checked || !input.value.trim()) { input.focus(); return; }
        checked = true;
        const ops = alignWords(sentence.text, input.value);
        const score = alignmentScore(ops);
        results.push(score);
        for (const w of missedWords(ops)) {
          const prev = missCount.get(w) || { count: 0, context: sentence.text };
          missCount.set(w, { count: prev.count + 1, context: sentenceContaining(sentence.text, w) || sentence.text });
        }
        drawStats();
        drawMissed();
        replace(result,
          h('div.row', null, chip(`${score}%`, score >= 90 ? 'teal' : score >= 60 ? 'sun' : 'coral'), h('span.muted', null, score === 100 ? 'Perfect.' : 'Compare with the sentence below.')),
          h('p.words', { 'aria-label': 'Word by word comparison' }, ...ops.map((o) => h(`span.tok.${o.type}`, { title: o.type }, o.type === 'extra' ? o.said : o.type === 'wrong' ? `${o.said} \u2192 ${o.target}` : o.target), ' ')),
          h('p.muted', null, h('strong', null, 'Sentence: '), sentence.text),
          h('div.row', null, button('Next sentence', { icon: 'next', onClick: next }), button('Play again', { variant: 'outline', size: 'small', icon: 'replay', onClick: play })));
        checkBtn.disabled = true;
        input.disabled = true;
      } });
      replace(main, h('div.card.stack', null,
        h('div.row.between', null, h('h3', null, `Sentence ${results.length + 1}`), h('div.row', null, chip(sentence.item.kind === 'dialogue' ? 'Synthetic voice' : 'Real recording', sentence.item.kind === 'dialogue' ? 'violet' : 'coral', true), replayInfo)),
        h('div.row', null, playBtn, transcriptBox),
        input,
        h('div.row', null, checkBtn),
        result));
      playBtn.focus();
    }
  };

  await load();

  return () => {
    cancelSpeech();
    for (const p of players.values()) p.destroy();
    if (results.length >= 3) updateSkill('listeningLevel', avg()).catch(() => {});
    run.dispose();
  };
}

