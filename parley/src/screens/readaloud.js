/**
 * Read aloud: paste any English text and play it with a chosen voice, highlighting word by word when
 * the voice reports word boundaries, otherwise sentence by sentence. Counts as Listen minutes.
 */
import { h, replace, add } from '../ui/dom.js';
import { button, iconButton, errorBanner, banner } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { getSettings } from '../state/settings.js';
import { addCard, enrichCard } from '../state/cards.js';
import { getVoices, englishVoiceGroups, pickVoice, speak, cancelSpeech } from '../speech/tts.js';
import { splitSentences, normWord, words } from '../learning/text.js';
import { startRun } from './run.js';

const TEXT_KEY = 'parley.readaloudText';
const SAMPLE = "Paste an English text here: an article, an email, your presentation notes. Then press play. You can jump between sentences, and tap any word to add it to your cards.";

/**
 * @param {HTMLElement} root
 * @param {{params: Record<string,string>}} route
 */
export async function render(root, route) {
  const run = startRun('listen', { params: {} });
  const [settings, voices] = await Promise.all([getSettings(), getVoices()]);
  const groups = englishVoiceGroups(voices);
  let saved = '';
  try { saved = localStorage.getItem(TEXT_KEY) || ''; } catch { /* storage blocked */ }

  const input = h('textarea.textarea', { 'aria-label': 'Text to read', placeholder: SAMPLE, value: saved, spellcheck: 'true' });
  const voiceSel = h('select.select', { 'aria-label': 'Voice' }, ...groups.flatMap((g) => g.voices.map((v) => h('option', { value: v.voiceURI }, `${g.label}: ${v.name}`))));
  const def = pickVoice(voices, settings.accentMix === 'mixed' ? 'en-GB' : settings.accentMix, settings.voices);
  if (def) voiceSel.value = def.voiceURI;
  const reader = h('div.card.reader', { lang: 'en', 'aria-live': 'off' });
  const status = h('p.muted.small', { 'aria-live': 'polite' });
  const selBox = h('div.row');

  let sentences = [];
  let index = 0;
  let playing = false;
  let token = 0;
  let boundarySeen = false;

  const build = () => {
    const text = input.value.trim() || SAMPLE;
    try { localStorage.setItem(TEXT_KEY, input.value); } catch { /* storage blocked */ }
    sentences = splitSentences(text).map((s) => {
      const el = h('span.rs');
      const wordEls = [];
      let pos = 0;
      for (const part of s.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { add(el, part); pos += part.length; continue; }
        const w = h('button.word-btn.rw', { type: 'button', onclick: () => offerWord(part, s) }, part);
        wordEls.push({ el: w, start: pos, end: pos + part.length });
        add(el, w);
        pos += part.length;
      }
      return { text: s, el, words: wordEls };
    });
    replace(reader, ...sentences.flatMap((s) => [s.el, ' ']));
    index = 0;
  };

  const clearMarks = () => reader.querySelectorAll('.current').forEach((e) => e.classList.remove('current'));
  const mark = (i, charIndex = null) => {
    clearMarks();
    const s = sentences[i];
    if (!s) return;
    s.el.classList.add('current');
    counter.textContent = `${i + 1} / ${sentences.length}`;
    if (charIndex !== null) {
      const w = s.words.find((x) => charIndex >= x.start && charIndex < x.end) || s.words.find((x) => x.start >= charIndex);
      if (w) w.el.classList.add('current');
    }
    s.el.scrollIntoView({ block: 'nearest' });
  };

  const voice = () => voices.find((v) => v.voiceURI === voiceSel.value) || null;
  const playFrom = async (i) => {
    const my = ++token;
    cancelSpeech();
    playing = true;
    drawControls();
    for (index = i; index < sentences.length; index++) {
      if (my !== token) return;
      mark(index);
      try {
        await speak(sentences[index].text, { voice: voice(), onBoundary: (ci) => { if (my === token) { boundarySeen = true; mark(index, ci); } } });
      } catch (e) { status.replaceChildren(errorBanner(e)); break; }
    }
    if (my !== token) return;
    playing = false;
    if (index >= sentences.length) index = 0;
    status.textContent = boundarySeen ? '' : 'This voice does not report word positions, so whole sentences are highlighted.';
    drawControls();
  };
  const stop = () => { token += 1; cancelSpeech(); playing = false; drawControls(); };

  const offerWord = (word, sentence) => {
    const clean = normWord(word);
    replace(selBox,
      button(`Add "${clean}" to cards`, { variant: 'sun', size: 'small', icon: 'plus', onClick: () => addToCards(clean, sentence) }),
      iconButton('close', 'Close', () => replace(selBox)));
  };
  const addToCards = async (front, context) => {
    replace(selBox);
    const { card, created } = await addCard({ front, context, source: 'manual', sourceRef: 'readaloud' });
    toast(created ? `"${front}" added to cards.` : `"${front}" is already in your cards.`);
    if (created) enrichCard(card).catch(() => {});
  };
  const onSelection = () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !reader.contains(sel.anchorNode)) return;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text || words(text).length > 8) return;
    const host = sentences.find((s) => s.el.contains(sel.anchorNode));
    replace(selBox, button(`Add "${text}" to cards`, { variant: 'sun', size: 'small', icon: 'plus', onClick: () => addToCards(text, host ? host.text : '') }), iconButton('close', 'Close', () => replace(selBox)));
  };
  document.addEventListener('selectionchange', onSelection);

  const controls = h('div.player');
  const counter = h('span.time');
  const drawControls = () => {
    counter.textContent = sentences.length ? `${Math.min(index + 1, sentences.length)} / ${sentences.length}` : '';
    replace(controls,
      iconButton('skipPrev', 'Previous sentence', () => playFrom(Math.max(0, index - 1))),
      button(playing ? 'Pause' : 'Play', { icon: playing ? 'pause' : 'play', onClick: () => (playing ? stop() : playFrom(index)) }),
      iconButton('skipNext', 'Next sentence', () => playFrom(Math.min(sentences.length - 1, index + 1))),
      iconButton('replay', 'Restart from the beginning', () => playFrom(0)),
      counter);
  };

  input.addEventListener('change', () => { stop(); build(); drawControls(); });
  build();
  drawControls();

  add(root, 
    h('div.screen-head', null, h('div', null, h('h1', null, 'Read aloud'), h('p.subtitle', null, 'Any English text, read by a natural voice with the words highlighted.'))),
    groups.length ? null : errorBanner({ kind: 'no-voice' }),
    h('div.activity', null,
      h('div.activity-main', null, h('div.card.stack', null, controls, status, selBox), reader),
      h('div.activity-rail', null,
        h('div.card.stack', null, h('h3', null, 'Your text'), input, button('Load text', { variant: 'outline', size: 'small', onClick: () => { stop(); build(); drawControls(); } })),
        h('div.card.stack', null, h('h3', null, 'Voice'), voiceSel),
        banner({ tone: 'sky', icon: 'info', text: 'Tap a word, or select a few words, to add them to your cards. Time here counts as listening.' }))));

  return () => {
    stop();
    document.removeEventListener('selectionchange', onSelection);
    run.dispose();
  };
}
