/**
 * Talk: voice conversation with the AI partner.
 * Setup (scenario or theme, duration) then an immersive conversation screen. Per turn: the learner
 * speaks (live transcript), the reply streams and is spoken sentence by sentence, then the mic reopens.
 * No correction during the conversation: the report comes at the end.
 */
import { h, replace, mmss, add } from '../ui/dom.js';
import { button, iconButton, chip, choiceGroup, banner, errorBanner, confirmDialog, loading } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { API, CONVERSATION_LENGTHS, TURN_SILENCE_MS } from '../config.js';
import { SCENARIOS, PERSONAS, conversationSystem, SESSION_START_NOTE, WRAP_UP_NOTE } from '../ai/prompts.js';
import { chat } from '../ai/claude.js';
import { getSettings, getApiKey } from '../state/settings.js';
import { getProfile } from '../state/profile.js';
import { sttSupported, listenTurn } from '../speech/stt.js';
import { createSpeechQueue, cancelSpeech, ttsSupported } from '../speech/tts.js';
import { sessionVoice } from '../speech/voice-choice.js';
import { sentenceStream } from '../learning/text.js';
import { trimHistory } from '../learning/conversation.js';
import { startRun } from './run.js';
import { createReport, generateReportAi } from './report-builder.js';

const LAST_SCENARIO = 'parley.lastScenario';

/**
 * @param {HTMLElement} root
 * @param {{params: Record<string,string>}} route
 * @param {{go: Function, setFocusMode: Function}} ctx
 */
export async function render(root, route, ctx) {
  const [settings, key] = await Promise.all([getSettings(), getApiKey()]);
  const isStep = route.params.session === '1';
  let scenarioKey = 'interview';
  try { scenarioKey = localStorage.getItem(LAST_SCENARIO) || scenarioKey; } catch { /* storage blocked */ }
  let minutes = isStep ? 10 : settings.conversationMinutes;
  let teardown = null;

  const scenarioPick = (list) => h('div.pick-grid', { role: 'group' }, ...list.map((s) => {
    const btn = h('button.pick', { type: 'button', 'aria-pressed': String(s.key === scenarioKey), onclick: () => {
      scenarioKey = s.key;
      root.querySelectorAll('.pick').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    } }, h(`div.tile.${s.kind === 'scenario' ? 'coral' : 'teal'}`, null, icon(s.icon)), h('span.pick-title', null, s.title), h('span.pick-sub', null, s.blurb));
    return btn;
  }));

  const warnings = h('div.stack');
  if (!key) add(warnings, banner({ tone: 'danger', icon: 'key', title: 'API key needed', text: 'Talk uses your Anthropic API key. Add it in Settings.', action: { label: 'Open Settings', onClick: () => ctx.go('settings') } }));
  if (!sttSupported()) add(warnings, errorBanner({ kind: 'no-stt' }));
  if (!ttsSupported()) add(warnings, errorBanner({ kind: 'no-voice' }));

  add(root, 
    h('div.screen-head', null, h('div', null, h('h1', null, 'Talk'), h('p.subtitle', null, 'A real conversation at natural speed. Corrections arrive in your end-of-session report.'))),
    warnings,
    h('div.stack', null, h('h2', null, 'Scenarios'), scenarioPick(SCENARIOS.filter((s) => s.kind === 'scenario'))),
    h('div.stack', null, h('h2', null, 'Free conversation'), scenarioPick(SCENARIOS.filter((s) => s.kind === 'theme'))),
    h('div.row.between', null,
      h('div.stack.tight', null, h('span.field-label', null, 'Duration'),
        choiceGroup(CONVERSATION_LENGTHS.map((m) => ({ value: m, label: `${m} min` })), minutes, (v) => { minutes = v; }, 'Duration')),
      button('Start conversation', { size: 'large', icon: 'mic', disabled: !key, onClick: () => {
        try { localStorage.setItem(LAST_SCENARIO, scenarioKey); } catch { /* storage blocked */ }
        teardown = startConversation(root, route, ctx, SCENARIOS.find((s) => s.key === scenarioKey), minutes);
      } })));

  return () => { if (teardown) teardown(); };
}

/**
 * Runs the conversation screen. Returns a teardown function.
 */
function startConversation(root, route, ctx, scenario, minutes) {
  ctx.setFocusMode(true);
  const run = startRun('talk', route, { frame: false });
  const totalSec = minutes * 60;
  const state = { phase: 'starting', paused: false, elapsed: 0, wrapUp: false, ended: false, timeUp: false };
  const turns = []; // transcript for the report: {role: 'ai'|'me', text, ...metrics}
  const history = [{ role: 'user', content: SESSION_START_NOTE }, { role: 'assistant', content: scenario.opening }];
  let voice = null;
  let lang = 'en-US';
  let listener = null;
  let queue = null;
  let abort = null;
  let profileLevel = 4;

  // ----- Layout -----
  const fill = h('div.fill');
  const bar = h('div.bar.track.grow', { role: 'progressbar', 'aria-label': 'Time elapsed', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
  const left = h('div.timer', null, `${mmss(totalSec)} left`);
  const chatEl = h('div.chat', { 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const scroller = h('div.chat-scroll', null, h('div.chat-col', null, chatEl));
  const mic = h('button.mic', { type: 'button', 'aria-label': 'Start speaking' }, icon('mic'));
  const caption = h('div.mic-caption', { role: 'status' }, 'Getting ready');
  const pauseBtn = button('Pause', { variant: 'outline', onClick: () => togglePause() });
  const endBtn = button('End session', { variant: 'outline', onClick: () => endSession(true) });
  const typedInput = h('input.input', { type: 'text', placeholder: 'Type your answer instead', 'aria-label': 'Typed answer', autocomplete: 'off' });
  const typedRow = h('form.typed-row', { onsubmit: (e) => { e.preventDefault(); submitTyped(); } }, typedInput, button('Send', { variant: 'sky', size: 'small', type: 'submit' }));
  typedRow.hidden = true;
  const typeToggle = h('button.link-btn', { type: 'button', onclick: () => { typedRow.hidden = !typedRow.hidden; if (!typedRow.hidden) typedInput.focus(); } }, 'Type instead');
  const personaChip = h('span');

  root.className = 'screen full';
  replace(root,
    h('div.topbar', null,
      iconButton('close', 'Close session', () => leave()),
      bar, left),
    h('div.row.center', null, h('div.title-center', null, scenario.title), personaChip),
    scroller,
    typedRow,
    h('div.talk-controls', null, pauseBtn, h('div.stack.tight', null, mic, caption), endBtn),
    h('div.row.center', null, h('p.talk-hint', null, 'Corrections arrive in your end-of-session report.'), typeToggle));
  mic.addEventListener('click', () => onMic());

  const scrollDown = () => { scroller.scrollTop = scroller.scrollHeight; };
  const addBubble = (role, text, cls = '') => {
    const bubble = h(`div.bubble.${role === 'ai' ? 'ai' : 'me'}${cls}`, null, text);
    const row = role === 'ai' ? h('div.msg', null, h('div.avatar', { 'aria-hidden': 'true' }, icon('chat')), bubble) : h('div.msg.me', null, bubble);
    add(chatEl, row);
    scrollDown();
    return { row, bubble };
  };
  const setPhase = (phase) => {
    state.phase = phase;
    mic.classList.toggle('listening', phase === 'listening');
    mic.classList.toggle('busy', phase === 'thinking' || phase === 'speaking');
    mic.disabled = phase === 'thinking' || phase === 'starting' || phase === 'ended';
    const labels = {
      starting: ['Getting ready', 'Please wait'],
      speaking: ['Partner speaking, tap to answer now', 'Interrupt and answer'],
      thinking: ['Thinking', 'Please wait'],
      listening: ['Listening, tap to stop', 'Stop speaking'],
      idle: ['Tap to speak', 'Start speaking'],
      paused: ['Paused', 'Paused'],
      ended: ['Session ended', 'Session ended'],
    }[phase];
    caption.textContent = labels[0];
    mic.setAttribute('aria-label', labels[1]);
  };

  // ----- Clock -----
  const clock = setInterval(() => {
    if (state.paused || state.ended || state.phase === 'starting') return;
    state.elapsed += 1;
    const pct = Math.min(100, (state.elapsed / totalSec) * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    left.textContent = `${mmss(Math.max(0, totalSec - state.elapsed))} left`;
    if (state.elapsed >= totalSec && !state.timeUp) {
      state.timeUp = true;
      // Never cut the learner off: the wrap-up follows their current turn or the current reply.
      if (state.phase === 'idle') wrapUp();
    }
  }, 1000);

  // ----- Speaking and listening -----
  const speakReply = async (userContent) => {
    setPhase('thinking');
    history.push({ role: 'user', content: userContent });
    const { row, bubble } = addBubble('ai', '...', '.pending');
    queue = createSpeechQueue(voice, { onSentence: () => setPhase('speaking') });
    const splitter = sentenceStream();
    abort = new AbortController();
    try {
      const res = await chat({
        system: conversationSystem({ scenario, level: profileLevel, lang, minutes }),
        messages: trimHistory(history), maxTokens: 1500, stream: true, effort: 'low', cache: true, signal: abort.signal,
        onText: (delta, full) => {
          bubble.classList.remove('pending');
          bubble.textContent = full;
          scrollDown();
          for (const s of splitter.push(delta)) queue.push(s);
        },
      });
      for (const s of splitter.flush()) queue.push(s);
      const text = res.text.trim() || 'Sorry, could you say that again?';
      bubble.classList.remove('pending');
      bubble.textContent = text;
      history.push({ role: 'assistant', content: text });
      turns.push({ role: 'ai', text });
      queue.end();
      await queue.wait();
      return true;
    } catch (e) {
      queue.cancel();
      history.pop();
      if (e.kind === 'aborted' || state.ended) { row.remove(); return false; }
      row.replaceWith(errorBanner(e, {
        onRetry: () => { chatEl.lastElementChild.remove(); speakAndContinue(userContent); },
        onSettings: () => ctx.go('settings'),
      }));
      scrollDown();
      setPhase('idle');
      return false;
    } finally { abort = null; }
  };

  const speakAndContinue = async (userContent) => {
    const ok = await speakReply(userContent);
    if (!ok || state.ended) return;
    if (state.wrapUp) { endSession(false); return; }
    if (state.timeUp) { wrapUp(); return; }
    if (!state.paused) listen();
  };

  const learnerTurns = () => turns.filter((t) => t.role === 'me').length;

  const listen = () => {
    if (state.ended || state.paused) return;
    if (!sttSupported()) { setPhase('idle'); typedRow.hidden = false; typedInput.focus(); return; }
    setPhase('listening');
    const live = addBubble('me', '...', '.live');
    live.bubble.classList.replace('me', 'live');
    listener = listenTurn({
      lang: 'en-US', silenceMs: TURN_SILENCE_MS,
      onPartial: (t) => { live.bubble.textContent = t; scrollDown(); },
    });
    const current = listener;
    current.done.then((r) => {
      if (listener !== current) return;
      listener = null;
      live.row.remove();
      if (state.ended) return;
      if (!r.text) {
        if (state.timeUp) { state.wrapUp = false; wrapUp(); } else setPhase('idle');
        return;
      }
      submitLearner(r.text, { startedAt: r.startedAt, firstResultAt: r.firstResultAt, lastResultAt: r.lastResultAt, longPauses: r.longPauses });
    }, (e) => {
      if (listener !== current) return;
      listener = null;
      live.row.remove();
      add(chatEl, errorBanner(e, { onRetry: () => { chatEl.lastElementChild.remove(); listen(); } }));
      typedRow.hidden = false;
      setPhase('idle');
      scrollDown();
    });
  };

  const submitLearner = (text, meta) => {
    addBubble('me', text);
    turns.push({ role: 'me', text, ...meta });
    if (learnerTurns() >= API.maxConversationTurns) {
      add(chatEl, banner({ tone: 'sun', icon: 'info', text: 'Turn limit reached for one session. Wrapping up.' }));
      state.timeUp = true;
    }
    if (state.timeUp) state.wrapUp = true;
    speakAndContinue(state.timeUp ? `${text}\n\n${WRAP_UP_NOTE}` : text);
  };

  const submitTyped = () => {
    const text = typedInput.value.trim();
    if (!text || state.phase === 'thinking' || state.phase === 'starting' || state.ended) return;
    typedInput.value = '';
    if (listener) { const l = listener; listener = null; l.abort(); chatEl.querySelector('.bubble.live')?.closest('.msg')?.remove(); }
    if (queue) queue.cancel();
    submitLearner(text, { typed: true });
  };

  const wrapUp = () => {
    if (state.wrapUp || state.ended) return;
    state.wrapUp = true;
    if (listener) { listener.stop(); return; }
    speakAndContinue(WRAP_UP_NOTE);
  };

  const onMic = () => {
    if (state.phase === 'listening' && listener) listener.stop();
    else if (state.phase === 'speaking') { if (queue) queue.cancel(); }
    else if (state.phase === 'idle') { if (state.timeUp) wrapUp(); else listen(); }
  };

  const togglePause = () => {
    if (state.ended) return;
    state.paused = !state.paused;
    pauseBtn.lastChild.textContent = state.paused ? 'Resume' : 'Pause';
    if (state.paused) {
      run.tracker.pause();
      if (listener) { const l = listener; listener = null; l.abort(); chatEl.querySelector('.bubble.live')?.closest('.msg')?.remove(); }
      if (queue) queue.cancel();
      cancelSpeech();
      setPhase('paused');
    } else {
      run.tracker.resume();
      if (abort) setPhase('thinking'); else listen();
    }
  };

  const stopAll = () => {
    state.ended = true;
    clearInterval(clock);
    if (listener) { const l = listener; listener = null; l.abort(); }
    if (abort) abort.abort();
    if (queue) queue.cancel();
    cancelSpeech();
  };

  const leave = async () => {
    if (learnerTurns() > 0 && !state.ended) {
      const ok = await confirmDialog({ title: 'Leave without a report?', text: 'Your minutes count, but no report will be written. Use End session to get your report.', confirm: 'Leave' });
      if (!ok) return;
    }
    stopAll();
    ctx.setFocusMode(false);
    await run.finish(null, { done: false, stay: true });
    if (run.isStep) ctx.go('today'); else ctx.refresh();
  };

  const endSession = async (manual) => {
    if (state.ended) return;
    if (manual && learnerTurns() === 0) { leave(); return; }
    stopAll();
    setPhase('ended');
    const status = h('div.stack', { role: 'status' }, loading('Writing your report. This takes a few seconds.'));
    replace(scroller, h('div.chat-col', null, status));
    const report = await createReport({ scenario, turns, durationSec: state.elapsed, lang });
    let quality = null;
    try {
      const res = await generateReportAi(report);
      quality = res.report.overall / 100;
    } catch (e) {
      console.warn('Report generation failed', e.kind || e.message);
    }
    await run.finish(quality, { stay: true });
    ctx.setFocusMode(false);
    ctx.go('report', {}, [report.id]);
  };

  // ----- Start -----
  (async () => {
    const [{ voice: v, lang: l }, profile] = await Promise.all([sessionVoice(), getProfile()]);
    voice = v;
    lang = l;
    profileLevel = profile.speakingLevel;
    const persona = PERSONAS[lang] || PERSONAS.other;
    replace(personaChip, chip(`${persona.name}, ${persona.accent} voice`, 'teal', true));
    if (!voice) add(chatEl, errorBanner({ kind: 'no-voice' }));
    addBubble('ai', scenario.opening);
    turns.push({ role: 'ai', text: scenario.opening });
    setPhase('speaking');
    queue = createSpeechQueue(voice);
    queue.push(scenario.opening);
    queue.end();
    await queue.wait();
    if (!state.ended && !state.paused) listen();
  })().catch((e) => { add(chatEl, errorBanner(e)); setPhase('idle'); });

  return () => {
    if (!state.ended) stopAll();
    ctx.setFocusMode(false);
    run.dispose();
  };
}

