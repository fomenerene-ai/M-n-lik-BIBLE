/**
 * Tier 0: generates short spoken-style dialogues with the API and caches them.
 */
import { put } from '../state/db.js';
import { chatJson } from '../ai/claude.js';
import { DIALOGUE_SCHEMA, dialogueSystem, dialogueUserMessage } from '../ai/prompts.js';
import { checkExercises } from '../learning/answers.js';
import { wordCount } from '../learning/text.js';
import { TOPICS, bandFor } from '../config.js';
import { dialogues, dialogueItem } from './pool.js';

/**
 * Generates and stores a new dialogue.
 * @param {string} topicKey work|daily|travel
 * @param {number} level listening level
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>} the normalised item
 */
export async function generateDialogue(topicKey, level, signal) {
  const topic = TOPICS.find((t) => t.key === topicKey) || TOPICS[0];
  const recent = (await dialogues()).slice(0, 8).map((d) => d.title).join('; ');
  const band = bandFor(level);
  const v = await chatJson({
    system: dialogueSystem(level),
    messages: [{ role: 'user', content: dialogueUserMessage(topic.label, recent) }],
    schema: DIALOGUE_SCHEMA, maxTokens: 3500, signal,
    check: (d) => {
      const errs = checkExercises(d, d.turns.map((t) => t.text).join(' '));
      const n = d.turns.reduce((s, t) => s + wordCount(t.text), 0);
      if (n < band.words[0] * 0.7 || n > band.words[1] * 1.4) errs.push(`the dialogue has ${n} words; write ${band.words[0]} to ${band.words[1]}`);
      if (new Set(d.turns.map((t) => t.speaker)).size < 2) errs.push('both speakers A and B must speak');
      return errs;
    },
  });
  const rec = { id: `dlg-${crypto.randomUUID()}`, kind: 'dialogue', tier: 0, title: v.title, topic: topic.key, level, turns: v.turns, questions: v.questions, gaps: v.gaps, createdAt: Date.now() };
  await put('contentCache', rec);
  return dialogueItem(rec);
}
