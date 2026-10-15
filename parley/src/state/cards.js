/**
 * Cards store: add with de-duplication, review, edit, delete, AI enrichment.
 */
import { get, put, del, getAll } from './db.js';
import { newCardFields, schedule } from '../learning/srs.js';
import { inferCardType } from '../learning/text.js';
import { chatJson } from '../ai/claude.js';
import { CARD_SCHEMA, CARD_SYSTEM, cardUserMessage } from '../ai/prompts.js';

const keyOf = (front) => String(front || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Adds a card unless one with the same front exists (case-insensitive).
 * @param {{front: string, type?: string, context?: string, definitionEn?: string, exampleEn?: string,
 *   source: 'listening'|'report'|'manual', sourceRef?: string}} o
 * @returns {Promise<{card: object, created: boolean}>}
 */
export async function addCard(o) {
  const front = String(o.front || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!front) throw new Error('The card needs a front.');
  const frontKey = keyOf(front);
  const existing = await getAll('cards', 'frontKey', IDBKeyRange.only(frontKey));
  if (existing.length) return { card: existing[0], created: false };
  const now = Date.now();
  const card = {
    id: crypto.randomUUID(), front, frontKey,
    type: o.type || inferCardType(front),
    context: (o.context || '').slice(0, 500), definitionEn: o.definitionEn || '', exampleEn: o.exampleEn || '',
    source: o.source, sourceRef: o.sourceRef || '', createdAt: now,
    ...newCardFields(now),
  };
  await put('cards', card);
  return { card, created: true };
}

/** All cards. */
export function listCards() {
  return getAll('cards');
}

/** Saves an edited card (front changes update the de-duplication key). */
export async function saveCard(card) {
  const c = { ...card, front: card.front.trim(), frontKey: keyOf(card.front) };
  await put('cards', c);
  return c;
}

/** Deletes a card. */
export function deleteCard(id) {
  return del('cards', id);
}

/**
 * Applies a review answer.
 * @param {object} card
 * @param {'again'|'hard'|'good'|'easy'} grade
 */
export async function reviewCard(card, grade) {
  const c = { ...card, ...schedule(card, grade, Date.now()) };
  await put('cards', c);
  return c;
}

/**
 * Fills definition and example with the API (in English).
 * @param {object} card
 * @returns {Promise<object>} the updated card
 */
export async function enrichCard(card) {
  const v = await chatJson({ system: CARD_SYSTEM, messages: [{ role: 'user', content: cardUserMessage(card.front, card.context) }], schema: CARD_SCHEMA, maxTokens: 1500 });
  const fresh = (await get('cards', card.id)) || card;
  const c = { ...fresh, definitionEn: v.definition.trim(), exampleEn: v.example.trim(), type: fresh.type === 'word' || fresh.type === 'expression' ? v.type : fresh.type };
  await put('cards', c);
  return c;
}

/**
 * Adds vocabulary items from a conversation report (definitions already in English).
 * @param {{term: string, type: string, definition: string, example: string}[]} items
 * @param {string} reportId
 * @returns {Promise<number>} number of new cards
 */
export async function addReportVocabulary(items, reportId) {
  let n = 0;
  for (const it of items) {
    const { created } = await addCard({ front: it.term, type: it.type, definitionEn: it.definition, exampleEn: it.example, source: 'report', sourceRef: reportId });
    if (created) n += 1;
  }
  return n;
}
