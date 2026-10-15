/**
 * Report: end-of-conversation feedback (scores, recurring errors, natural rephrasings, vocabulary,
 * strengths, next focus) plus local metrics and the transcript.
 */
import { h, replace, add } from '../ui/dom.js';
import { button, chip, errorBanner, emptyState, loading } from '../ui/components.js';
import { getReport } from '../state/reports.js';
import { generateReportAi } from './report-builder.js';

const SCORE_BARS = { fluency: 'teal', grammar: 'coral', vocabulary: 'sun', relevance: 'teal' };

/**
 * @param {HTMLElement} root
 * @param {{segments: string[]}} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  const report = await getReport(route.segments[0] || '');
  if (!report) {
    add(root, h('h1', null, 'Report'), emptyState('chat', 'coral', 'Report not found', 'It may have been deleted.', button('Back to Progress', { onClick: () => ctx.go('progress') })));
    return;
  }
  const when = new Date(report.date).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
  add(root, h('div.screen-head', null,
    h('div', null, h('h1', null, report.scenarioTitle), h('p.subtitle', null, `${when}, ${Math.max(1, Math.round(report.durationSec / 60))} min`)),
    h('div.head-chips', null, button('Back to Today', { onClick: () => ctx.go('today') }))));
  const body = h('div.stack.loose');
  add(root, body);
  draw(body, report, ctx);
}

function section(title, ...children) {
  return h('section.stack', null, h('h2', null, title), ...children);
}

function metricCard(value, label) {
  return h('div.card.soft.score-ring', null, h('span.score-value', null, value), h('span.score-label', null, label));
}

function draw(body, report, ctx) {
  const m = report.metrics;
  const metrics = h('div.metrics', null,
    metricCard(m.wpm === null ? 'n/a' : String(m.wpm), 'Words per minute'),
    metricCard(String(m.turns), 'Your turns'),
    metricCard(String(m.avgTurnWords), 'Words per turn'),
    metricCard(String(m.longSilences), 'Silences over 3 s'));

  if (!report.ai) {
    const retryBox = h('div.stack');
    const retry = async () => {
      replace(retryBox, loading('Writing your report'));
      try {
        const { report: r } = await generateReportAi(report);
        replace(body);
        draw(body, r, ctx);
      } catch (e) {
        replace(retryBox, errorBanner(e, { onRetry: retry, onSettings: () => ctx.go('settings') }));
      }
    };
    replace(body, section('Your numbers', metrics),
      h('div.card.sun.stack', null, h('h3', null, 'Feedback not written yet'), h('p', null, 'The transcript is saved. Generate the feedback when the connection is back.'), retryBox,
        button('Generate feedback', { onClick: retry })),
      transcript(report));
    return;
  }

  const a = report.ai;
  const scores = h('div.scores', null, ...Object.entries(a.scores).map(([k, v]) => h('div.card.score-ring', null,
    h('span.score-value', null, String(v)), h('span.score-label', null, k[0].toUpperCase() + k.slice(1)),
    h(`div.bar.${SCORE_BARS[k]}`, { role: 'progressbar', 'aria-label': `${k} score`, 'aria-valuenow': v, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div.fill', { style: { width: `${v}%` } })))));

  const levelLine = report.level ? `Speaking level ${report.level.before.toFixed(1)} to ${report.level.after.toFixed(1)}.` : '';
  replace(body,
    h('div.card.teal.stack.tight', null, h('h3', null, 'Summary'), h('p', null, a.summary), levelLine ? h('p.muted.small', null, levelLine) : null),
    section('Scores', scores),
    section('Your numbers', metrics),
    a.recurringErrors.length ? section('Recurring errors', h('div.list', null, ...a.recurringErrors.map((e) => h('div.card.stack.tight', null,
      h('div.fix', null, h('span.muted.small', null, 'You said'), h('span.muted.small', null, 'Better'), h('span.orig', null, e.original), h('span.corr', null, e.corrected)),
      h('p', null, e.explanation),
      e.count > 1 ? h('span.muted.small', null, `${e.count} times`) : null)))) : null,
    a.naturalRephrasings.length ? section('Sound more natural', h('div.list', null, ...a.naturalRephrasings.map((r) => h('div.card.stack.tight', null,
      h('div.fix', null, h('span.muted.small', null, 'You said'), h('span.muted.small', null, 'A native speaker might say'), h('span', null, r.original), h('span.corr', null, r.better)))))) : null,
    a.vocabulary.length ? section('New vocabulary',
      h('p.muted', null, report.cardsAdded ? `${report.cardsAdded} new cards added to your deck.` : 'Already in your cards.'),
      h('div.list', null, ...a.vocabulary.map((v) => h('div.list-row', null,
        h('div.grow', null, h('div.title', null, v.term), h('div.muted.small', null, v.definition), h('div.small', null, v.example)),
        chip(v.type === 'phrasal' ? 'Phrasal verb' : v.type[0].toUpperCase() + v.type.slice(1), 'violet', true))))) : null,
    h('div.activity', null,
      h('div.activity-main', null, section('Strengths', h('ul', null, ...a.strengths.map((s) => h('li', null, s))))),
      h('div.activity-main', null, section('Next focus', h('div.card.sun', null, h('p', null, a.nextFocus))))),
    transcript(report));
}

function transcript(report) {
  return h('details.card', null, h('summary', null, h('strong', null, 'Transcript')),
    h('div.chat', { style: { marginTop: '14px' } }, ...report.turns.map((t) => (t.role === 'ai'
      ? h('div.msg', null, h('div.bubble.ai', null, t.text))
      : h('div.msg.me', null, h('div.bubble.me', null, t.text))))));
}
