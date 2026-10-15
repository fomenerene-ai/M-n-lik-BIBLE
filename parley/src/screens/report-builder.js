/**
 * Builds conversation reports: local metrics first (saved immediately so nothing is lost), then the
 * AI part (one JSON call), vocabulary cards and the speaking level update.
 */
import { chatJson } from '../ai/claude.js';
import { REPORT_SCHEMA, REPORT_SYSTEM, reportUserMessage } from '../ai/prompts.js';
import { learnerMetrics } from '../learning/conversation.js';
import { saveReport, getReport } from '../state/reports.js';
import { addReportVocabulary } from '../state/cards.js';
import { updateSkill } from '../state/profile.js';

/**
 * Saves a report draft with the transcript and local metrics.
 * @param {{scenario: object, turns: object[], durationSec: number, lang: string}} o
 */
export async function createReport(o) {
  const learner = o.turns.filter((t) => t.role === 'me');
  const report = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    scenarioKey: o.scenario.key,
    scenarioTitle: o.scenario.title,
    durationSec: Math.round(o.durationSec),
    lang: o.lang,
    turns: o.turns.map((t) => ({ role: t.role, text: t.text })),
    metrics: learnerMetrics(learner),
    ai: null,
    overall: 0,
    cardsAdded: 0,
    level: null,
  };
  await saveReport(report);
  return report;
}

/**
 * Generates the AI part of a report, adds vocabulary cards and updates the speaking level.
 * Safe to call again on a report whose AI part failed.
 * @param {object} report
 * @returns {Promise<{report: object}>}
 */
export async function generateReportAi(report) {
  const ai = await chatJson({
    system: REPORT_SYSTEM,
    messages: [{ role: 'user', content: reportUserMessage(report.scenarioTitle, report.turns) }],
    schema: REPORT_SCHEMA,
    maxTokens: 6000,
    effort: 'medium',
  });
  const s = ai.scores;
  const overall = Math.round((s.fluency + s.grammar + s.vocabulary + s.relevance) / 4);
  const fresh = (await getReport(report.id)) || report;
  const first = !fresh.ai;
  const updated = { ...fresh, ai, overall };
  if (first) {
    updated.cardsAdded = await addReportVocabulary(ai.vocabulary, report.id);
    updated.level = await updateSkill('speakingLevel', overall);
  }
  await saveReport(updated);
  return { report: updated };
}
