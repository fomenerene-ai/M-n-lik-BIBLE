/**
 * Placement test, about 5 minutes: 4 listening clips of increasing difficulty with one question each,
 * then 3 spoken questions assessed by the API with a rubric. Sets the starting levels.
 */
import { h, replace, add } from '../ui/dom.js';
import { button, chip, banner, errorBanner, loading } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { bandFor } from '../config.js';
import { PLACEMENT_CLIPS, listeningFromResults } from '../learning/placement-bank.js';
import { PLACEMENT_QUESTIONS, PLACEMENT_SCHEMA, PLACEMENT_SYSTEM, placementUserMessage } from '../ai/prompts.js';
import { chatJson } from '../ai/claude.js';
import { getApiKey } from '../state/settings.js';
import { setLevels, getProfile, saveProfile } from '../state/profile.js';
import { dialogueVoices, sessionVoice } from '../speech/voice-choice.js';
import { speak, cancelSpeech } from '../speech/tts.js';
import { listenTurn, sttSupported } from '../speech/stt.js';
import { TURN_SILENCE_MS } from '../config.js';

/**
 * @param {HTMLElement} root
 * @param {object} route
 * @param {{go: Function, setFocusMode: Function}} ctx
 */
export async function render(root, route, ctx) {
  ctx.setFocusMode(true);
  const [voices, partner, key] = await Promise.all([dialogueVoices(), sessionVoice(), getApiKey()]);
  const listening = [];
  const speaking = [];
  let turn = null;
  let closed = false;
  const wrap = h('div.welcome.stack.loose');
  add(root, wrap);
  const totalSteps = PLACEMENT_CLIPS.length + PLACEMENT_QUESTIONS.length;
  const head = (n, title, sub) => [
    h('div.row.between', null, h('div.dots', { 'aria-label': `Step ${n} of ${totalSteps}` }, ...Array.from({ length: totalSteps }, (_, i) => h(`span${i < n ? '.on' : ''}`))),
      button('Leave test', { variant: 'outline', size: 'small', onClick: leave })),
    h('h1', null, title), sub ? h('p.subtitle', null, sub) : null,
  ];
  const focusTitle = () => { const t = wrap.querySelector('h1'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); } };

  function leave() {
    closed = true;
    if (turn) turn.abort();
    cancelSpeech();
    ctx.setFocusMode(false);
    ctx.go('today');
  }

  const intro = () => {
    replace(wrap,
      h('h1', null, 'Placement test'),
      h('p.subtitle', null, 'About 5 minutes. First 4 short listening clips at natural speed, then 3 questions to answer out loud.'),
      h('div.card.soft.stack.tight', null,
        h('p', null, 'Each clip can be played twice. Answer the question, then move on.'),
        h('p', null, 'For the spoken part, answer in a few sentences, as you would in a conversation.')),
      key ? null : banner({ tone: 'sun', icon: 'info', text: 'Without an API key the spoken part cannot be assessed: your levels will come from the listening part only.' }),
      h('div.row.end', null, button('Start', { size: 'large', onClick: () => clip(0) })));
    focusTitle();
  };

  const clip = (i) => {
    const c = PLACEMENT_CLIPS[i];
    let plays = 0;
    let picked = null;
    const playBtn = button('Play clip', { variant: 'sky', icon: 'speaker', size: 'large', onClick: async () => {
      if (plays >= 2) return;
      plays += 1;
      playBtn.disabled = true;
      for (const u of c.units) { if (closed) return; await speak(u.text, { voice: (u.speaker === 'B' ? voices.B : voices.A).voice }).catch(() => {}); }
      playBtn.disabled = plays >= 2;
      replace(playBtn, icon('speaker'), plays >= 2 ? 'No more plays' : 'Play again');
    } });
    const nextBtn = button(i < PLACEMENT_CLIPS.length - 1 ? 'Next clip' : 'Go to speaking', { disabled: true, onClick: () => {
      listening.push({ difficulty: c.difficulty, correct: picked === c.answer });
      cancelSpeech();
      if (i < PLACEMENT_CLIPS.length - 1) clip(i + 1); else ask(0);
    } });
    const opts = h('div.choice-group', { role: 'group', 'aria-label': c.question }, ...c.options.map((o) => h('button.choice', { type: 'button', 'aria-pressed': 'false', onclick: (e) => {
      picked = o;
      opts.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      nextBtn.disabled = false;
    } }, o)));
    replace(wrap, ...head(i + 1, `Listening ${i + 1} of ${PLACEMENT_CLIPS.length}`, 'Play the clip, then answer.'),
      h('div.card.stack', null, h('div.row', null, playBtn), h('p.q', null, c.question), opts),
      h('div.row.end', null, nextBtn));
    focusTitle();
  };

  const ask = (i) => {
    const q = PLACEMENT_QUESTIONS[i];
    let answer = '';
    const live = h('p.bubble.live', null, '...');
    live.hidden = true;
    const typed = h('textarea.textarea', { 'aria-label': 'Type your answer instead', placeholder: 'Or type your answer here' });
    const out = h('div', { 'aria-live': 'polite' });
    const nextBtn = button(i < PLACEMENT_QUESTIONS.length - 1 ? 'Next question' : 'See my levels', { disabled: true, onClick: () => {
      if (turn) { turn.stop(); return; }
      speaking.push({ question: q, answer: (answer || typed.value).trim() });
      if (i < PLACEMENT_QUESTIONS.length - 1) ask(i + 1); else assess();
    } });
    typed.addEventListener('input', () => { nextBtn.disabled = !typed.value.trim() && !answer; });
    const mic = h('button.mic', { type: 'button', 'aria-label': 'Answer out loud', onclick: () => {
      if (turn) { turn.stop(); return; }
      if (!sttSupported()) { replace(out, errorBanner({ kind: 'no-stt' })); return; }
      cancelSpeech();
      live.hidden = false;
      mic.classList.add('listening');
      turn = listenTurn({ lang: 'en-US', silenceMs: TURN_SILENCE_MS * 2, maxMs: 60000, onPartial: (t) => { live.textContent = t; } });
      turn.done.then((r) => {
        answer = [answer, r.text].filter(Boolean).join(' ');
        live.textContent = answer || 'Nothing heard. Tap the mic to try again.';
        nextBtn.disabled = !answer && !typed.value.trim();
      }, (e) => replace(out, errorBanner(e))).finally(() => { turn = null; mic.classList.remove('listening'); });
    } }, icon('mic'));
    replace(wrap, ...head(PLACEMENT_CLIPS.length + i + 1, `Question ${i + 1} of ${PLACEMENT_QUESTIONS.length}`, null),
      h('div.card.stack', null,
        h('div.row', null, h('p.q.grow', null, q), button('Hear it', { variant: 'outline', size: 'small', icon: 'speaker', onClick: () => speak(q, { voice: partner.voice }).catch(() => {}) })),
        h('div.row.center', null, h('div.stack.tight', null, mic, h('div.mic-caption', null, 'Tap to answer, tap again to stop'))),
        live, typed, out),
      h('div.row.end', null, nextBtn));
    focusTitle();
    speak(q, { voice: partner.voice }).catch(() => {});
  };

  const assess = async () => {
    replace(wrap, h('h1', null, 'Your levels'), loading('Assessing your answers'));
    let listeningLevel = listeningFromResults(listening);
    let speakingLevel = Math.max(1, listeningLevel - 0.5);
    let comment = 'Levels set from the listening part. They adapt as you practise.';
    let problem = null;
    if (key && speaking.some((s) => s.answer)) {
      try {
        const v = await chatJson({ system: PLACEMENT_SYSTEM, messages: [{ role: 'user', content: placementUserMessage(listening, speaking) }], schema: PLACEMENT_SCHEMA, maxTokens: 2000, effort: 'medium' });
        listeningLevel = v.listeningLevel;
        speakingLevel = v.speakingLevel;
        comment = v.comment;
      } catch (e) { problem = e; }
    }
    if (closed) return;
    const p = await setLevels({ listeningLevel, speakingLevel, shadowLevel: speakingLevel });
    const prof = await getProfile();
    prof.shadowTier = bandFor(speakingLevel).shadowTier;
    prof.shadowTierSince = Date.now();
    await saveProfile(prof);
    const row = (label, lv) => h('div.card.score-ring', null, h('span.score-value', null, lv.toFixed(1)), h('span.score-label', null, label), chip(bandFor(lv).cefr, 'sun', true));
    replace(wrap,
      h('h1', null, 'Your levels'),
      h('p.subtitle', null, comment),
      problem ? errorBanner(problem) : null,
      problem ? h('p.muted.small', null, 'The spoken part could not be assessed, so levels come from the listening part. You can retake the test from Settings.') : null,
      h('div.metrics', null, row('Listening', p.listeningLevel), row('Speaking', p.speakingLevel), row('Shadowing', p.shadowLevel)),
      h('p.muted.small', null, 'Levels go from 1 to 10. About 3 is B1, 6 is B2 low, 8 is B2+. They move a little after each activity, at most half a level per day.'),
      h('div.row.end', null, button('Go to Today', { size: 'large', onClick: () => { ctx.setFocusMode(false); ctx.go('today'); } })));
    focusTitle();
  };

  intro();
  return () => { closed = true; if (turn) turn.abort(); cancelSpeech(); ctx.setFocusMode(false); };
}
