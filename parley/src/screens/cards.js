/**
 * Cards: review (due first, then unlimited new cards), browse (search, filter, edit, delete),
 * and manual add with AI enrichment.
 */
import { h, replace } from '../ui/dom.js';
import { button, iconButton, chip, segmented, choiceGroup, emptyState, errorBanner, confirmDialog, loading } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { listCards, addCard, saveCard, deleteCard, reviewCard, enrichCard } from '../state/cards.js';
import { buildQueue, previewIntervals, GRADES } from '../learning/srs.js';
import { alignWords, alignmentScore } from '../learning/diff.js';
import { speak, cancelSpeech } from '../speech/tts.js';
import { recognizeOnce, sttSupported } from '../speech/stt.js';
import { sessionVoice } from '../speech/voice-choice.js';
import { startRun } from './run.js';

const TYPE_LABELS = { word: 'Word', expression: 'Expression', phrasal: 'Phrasal verb', sentence: 'Sentence' };
const SOURCE_LABELS = { listening: 'Listening', report: 'Report', manual: 'Manual' };
const GRADE_STYLE = { again: 'outline', hard: 'sun', good: 'teal', easy: 'sky' };
const MODE_KEY = 'parley.cardsMode';

/**
 * @param {HTMLElement} root
 * @param {{params: Record<string,string>}} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  let ratings = 0;
  let goodRatings = 0;
  const run = startRun('cards', route, { quality: () => (ratings ? goodRatings / ratings : null) });
  let mode = 'review';
  try { if (!run.isStep && localStorage.getItem(MODE_KEY) === 'browse') mode = 'browse'; } catch { /* storage blocked */ }
  const { voice } = await sessionVoice({ lang: 'en-US' }).catch(() => ({ voice: null }));
  let activeTurn = null;

  const body = h('div.stack.loose');
  root.append(
    h('div.screen-head', null,
      h('div', null, h('h1', null, 'Cards'), h('p.subtitle', null, 'Due reviews first, then new cards. Definitions in simple English.')),
      h('div.head-chips', null,
        segmented([{ value: 'review', label: 'Review' }, { value: 'browse', label: 'Browse' }], mode, (v) => {
          mode = v;
          try { localStorage.setItem(MODE_KEY, v); } catch { /* storage blocked */ }
          draw();
        }, 'Cards mode'),
        button('Add card', { variant: 'outline', size: 'small', icon: 'plus', onClick: () => addFlow() }))),
    run.frameEl, body);

  const play = async (card) => {
    cancelSpeech();
    try {
      await speak(card.front, { voice });
      if (card.context && card.context !== card.front) await speak(card.context, { voice });
    } catch (e) { toast(e.kind === 'no-voice' ? 'No English voice installed. See Settings.' : 'Speech failed.'); }
  };

  /* ---------------- Review ---------------- */
  let queue = [];
  let counts = { due: 0, fresh: 0 };
  const loadQueue = async () => {
    const all = await listCards();
    const q = buildQueue(all, Date.now());
    queue = [...q.due, ...q.fresh];
    counts = { due: q.due.length, fresh: q.fresh.length, total: all.length };
  };

  const drawReview = async () => {
    await loadQueue();
    const main = h('div.activity-main');
    const rail = h('div.activity-rail');
    replace(body, h('div.activity', null, main, rail));
    const countsEl = h('div.card.stack.tight');
    const updateCounts = () => replace(countsEl,
      h('h3', null, 'Queue'),
      h('div.row', null, chip(`${counts.due} due`, 'coral'), chip(`${counts.fresh} new`, 'sky')),
      h('p.muted.small', null, `${counts.total} cards in total. New cards are unlimited.`));
    updateCounts();
    rail.append(countsEl, h('div.card.soft.stack.tight', null, h('h3', null, 'Say it'),
      h('p.muted.small', null, 'The match uses speech recognition, which tends to auto-correct pronunciation. It checks the words, it is not a pronunciation diagnosis.')));

    const next = () => {
      if (!queue.length) {
        replace(main, emptyState('check', 'teal', counts.total ? 'All caught up' : 'No cards yet',
          counts.total ? 'No card is due right now. Come back later or add new ones.' : 'Tap a word in Listen subtitles, finish a Talk session, or add a card yourself.',
          run.isStep ? button('Finish step', { variant: 'teal', icon: 'check', onClick: () => run.finish(ratings ? goodRatings / ratings : null, { done: true }) }) : null));
        return;
      }
      showCard(queue[0]);
    };

    const showCard = (card) => {
      const flash = h('div.card.flash');
      const reveal = h('div.stack.tight');
      const sayResult = h('div', { 'aria-live': 'polite' });
      const actions = h('div.row.center');
      replace(main, flash, actions);
      const isNew = !card.lastReviewedAt;
      flash.append(
        h('div.row.center', null, chip(TYPE_LABELS[card.type], 'violet', true), chip(isNew ? 'New' : 'Review', isNew ? 'sky' : 'coral', true), chip(SOURCE_LABELS[card.source] || card.source, 'grey', true)),
        h(`div.front${card.type === 'sentence' ? '.sentence' : ''}`, { lang: 'en' }, card.front),
        card.context && card.context !== card.front ? h('p.context', null, card.context) : null,
        h('div.row.center', null,
          iconButton('speaker', 'Listen to the card', () => play(card)),
          sttSupported() ? iconButton('mic', 'Say it', () => sayIt(card, sayResult)) : null),
        sayResult, reveal);

      const showAnswer = button('Show answer', { size: 'large', onClick: () => {
        replace(reveal,
          card.definitionEn ? h('p.definition', null, card.definitionEn) : h('div.stack.tight', null, h('p.muted', null, 'No definition yet.'),
            button('Fill with AI', { variant: 'outline', size: 'small', icon: 'bolt', onClick: async (e) => {
              e.currentTarget.disabled = true;
              try { const c = await enrichCard(card); Object.assign(card, c); showAnswer.click(); } catch (err) { reveal.append(errorBanner(err, { onSettings: () => ctx.go('settings') })); }
            } })),
          card.exampleEn ? h('p.example', null, card.exampleEn) : null);
        const pv = previewIntervals(card, Date.now());
        replace(actions, h('div.rate-row.grow', { role: 'group', 'aria-label': 'How well did you know it?' },
          ...GRADES.map((g) => h(`button.btn.btn-${GRADE_STYLE[g]}`, { type: 'button', onclick: () => rate(card, g) },
            g[0].toUpperCase() + g.slice(1), h('small', null, pv[g])))));
      } });
      actions.append(showAnswer);
      showAnswer.focus();
    };

    const rate = async (card, grade) => {
      const updated = await reviewCard(card, grade);
      ratings += 1;
      if (grade === 'good' || grade === 'easy') goodRatings += 1;
      queue.shift();
      if (!card.lastReviewedAt) counts.fresh -= 1; else counts.due -= 1;
      if (grade === 'again') { queue.push(updated); counts.due += 1; }
      updateCounts();
      next();
    };

    next();
  };

  const sayIt = async (card, out) => {
    if (activeTurn) { activeTurn.stop(); return; }
    replace(out, h('p.muted', null, 'Listening... say the card.'));
    activeTurn = recognizeOnce({ lang: 'en-US', onPartial: (t) => replace(out, h('p.muted', null, t)) });
    try {
      const { text } = await activeTurn.done;
      const score = alignmentScore(alignWords(card.front, text));
      const tone = score >= 90 ? 'teal' : score >= 60 ? 'sun' : 'coral';
      replace(out, h('div.row.center', null, chip(`${score}% word match`, tone), h('span.muted', null, text ? `Heard: "${text}"` : 'Nothing heard.')));
    } catch (e) {
      replace(out, errorBanner(e));
    } finally { activeTurn = null; }
  };

  /* ---------------- Browse ---------------- */
  let filterType = 'all';
  let filterSource = 'all';
  let query = '';
  const drawBrowse = async () => {
    const all = await listCards();
    const listEl = h('div.list.table-list');
    const search = h('input.input', { type: 'search', placeholder: 'Search cards', 'aria-label': 'Search cards', value: query, oninput: (e) => { query = e.target.value; drawList(); } });
    const drawList = () => {
      const q = query.toLowerCase().trim();
      const items = all.filter((c) => (filterType === 'all' || c.type === filterType) && (filterSource === 'all' || c.source === filterSource)
        && (!q || c.front.toLowerCase().includes(q) || (c.definitionEn || '').toLowerCase().includes(q)))
        .sort((a, b) => b.createdAt - a.createdAt);
      if (!items.length) { replace(listEl, emptyState('search', 'grey', 'No cards found', all.length ? 'Try another search or filter.' : 'Add your first card.')); return; }
      replace(listEl, ...items.slice(0, 300).map((c) => h('div.list-row', null,
        h('div.grow', null,
          h('div.title', { lang: 'en' }, c.front),
          h('div.muted.small', null, c.definitionEn || 'No definition yet')),
        chip(TYPE_LABELS[c.type], 'violet', true),
        chip(SOURCE_LABELS[c.source] || c.source, 'grey', true),
        h('span.muted.small', null, c.lastReviewedAt ? `due ${new Date(c.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'new'),
        iconButton('edit', `Edit ${c.front}`, () => editCard(c)),
        iconButton('trash', `Delete ${c.front}`, async () => {
          if (await confirmDialog({ title: 'Delete this card?', text: `"${c.front}" will be removed with its review history.`, confirm: 'Delete', danger: true })) {
            await deleteCard(c.id); toast('Card deleted.'); drawBrowse();
          }
        }))));
      if (items.length > 300) listEl.append(h('p.muted', null, `Showing 300 of ${items.length}. Refine the search.`));
    };
    replace(body,
      h('div.row', null, h('div.grow', null, search)),
      h('div.row', null,
        choiceGroup([{ value: 'all', label: 'All types' }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))], filterType, (v) => { filterType = v; drawList(); }, 'Filter by type')),
      h('div.row', null,
        choiceGroup([{ value: 'all', label: 'All sources' }, ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))], filterSource, (v) => { filterSource = v; drawList(); }, 'Filter by source')),
      listEl);
    drawList();
  };

  /* ---------------- Add and edit ---------------- */
  const cardDialog = (title, card, onSave) => {
    const dlg = h('dialog.modal', { 'aria-labelledby': 'card-dlg-title' });
    const f = {
      front: h('input.input', { id: 'cf-front', value: card.front || '', required: true, autocomplete: 'off' }),
      context: h('textarea.textarea', { id: 'cf-context', value: card.context || '' }),
      definitionEn: h('textarea.textarea', { id: 'cf-def', value: card.definitionEn || '' }),
      exampleEn: h('input.input', { id: 'cf-ex', value: card.exampleEn || '' }),
    };
    f.context.style.minHeight = '70px';
    f.definitionEn.style.minHeight = '70px';
    let type = card.type || 'word';
    const close = () => { dlg.close(); dlg.remove(); };
    const isNew = !card.id;
    dlg.append(h('form.stack', { onsubmit: async (e) => {
      e.preventDefault();
      if (!f.front.value.trim()) { f.front.focus(); return; }
      await onSave({ ...card, type, front: f.front.value, context: f.context.value.trim(), definitionEn: f.definitionEn.value.trim(), exampleEn: f.exampleEn.value.trim() });
      close();
    } },
    h('h2', { id: 'card-dlg-title' }, title),
    h('div.field', null, h('label', { for: 'cf-front' }, 'English word, expression or sentence'), f.front),
    isNew ? null : h('div.field', null, h('span.field-label', null, 'Type'), choiceGroup(Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })), type, (v) => { type = v; }, 'Card type')),
    h('div.field', null, h('label', { for: 'cf-context' }, 'Context sentence (optional)'), f.context),
    isNew ? h('p.hint', null, 'The definition and example are written for you in simple English.') : h('div.field', null, h('label', { for: 'cf-def' }, 'Definition (English)'), f.definitionEn),
    isNew ? null : h('div.field', null, h('label', { for: 'cf-ex' }, 'Example (English)'), f.exampleEn),
    h('div.row.end', null, button('Cancel', { variant: 'outline', onClick: close }), button(isNew ? 'Add card' : 'Save', { type: 'submit' }))));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    f.front.focus();
  };

  const addFlow = () => cardDialog('Add a card', { source: 'manual' }, async (draft) => {
    const { card, created } = await addCard({ front: draft.front, context: draft.context, source: 'manual' });
    if (!created) { toast('This card already exists.'); return; }
    const dismiss = toast('Card added. Writing the definition...', { duration: 0 });
    try { await enrichCard(card); dismiss(); toast('Card ready.'); } catch (e) {
      dismiss();
      toast(e.kind === 'no-key' ? 'Card added without definition: add an API key in Settings.' : 'Card added. The definition could not be written; use "Fill with AI" later.');
    }
    draw();
  });

  const editCard = (c) => cardDialog('Edit card', c, async (draft) => { await saveCard(draft); toast('Card saved.'); drawBrowse(); });

  const draw = () => {
    replace(body, loading());
    return mode === 'review' ? drawReview() : drawBrowse();
  };
  await draw();

  return () => {
    if (activeTurn) activeTurn.abort();
    cancelSpeech();
    run.dispose();
  };
}

