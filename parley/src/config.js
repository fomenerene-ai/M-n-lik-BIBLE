/**
 * Global configuration: app name, defaults, guided plan, level tables.
 * Pure data, safe to import from node tests.
 */

/** Single place to rename the app. */
export const APP_NAME = 'Parley';

/** IndexedDB name. Independent of APP_NAME so a rename keeps the learner's data. */
export const DB_NAME = 'parley';

/** Version of the JSON backup format. Bump and add a migration in state/backup-schema.js. */
export const BACKUP_SCHEMA_VERSION = 1;

export const API = {
  url: 'https://api.anthropic.com/v1/messages',
  version: '2023-06-01',
  defaultModel: 'claude-sonnet-5-5',
  /** Hard cap on max_tokens for any single request (spend guard). Thinking counts toward it. */
  maxTokensCap: 8000,
  /** Hard cap on learner turns in one conversation (spend guard). */
  maxConversationTurns: 80,
  /** Request timeout without any byte received. */
  timeoutMs: 45000,
  retries: 3,
  /** Models that accept the server-side refusal fallback ("default" form). */
  fallbackModels: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'],
  fallbackBeta: 'server-side-fallback-2026-07-01',
};

export const DEFAULT_SETTINGS = {
  model: API.defaultModel,
  conversationMinutes: 10,
  /** voiceURI per lang tag, e.g. {"en-US": "...", "en-GB": "..."} */
  voices: {},
  /** "mixed" alternates US and UK, or a single lang tag like "en-GB". */
  accentMix: 'mixed',
  lastExportAt: null,
  onboardedAt: null,
};

export const CONVERSATION_LENGTHS = [5, 10, 15, 20];

/** Guided session plan, listening-weighted, 30 minutes. */
export const SESSION_PLAN = [
  { key: 'listen', label: 'Listen', minutes: 8, route: 'listen', color: 'teal', icon: 'headphones', blurb: 'Three passes: no text, questions, subtitles' },
  { key: 'talk', label: 'Talk', minutes: 10, route: 'talk', color: 'coral', icon: 'mic', blurb: 'A 10 minute conversation with your AI partner' },
  { key: 'shadow', label: 'Shadow', minutes: 5, route: 'shadow', color: 'sky', icon: 'wave', blurb: 'Repeat after native voices, difficulty adapts' },
  { key: 'cards', label: 'Cards', minutes: 4, route: 'cards', color: 'sun', icon: 'cards', blurb: 'Review due cards, then new ones' },
  { key: 'dictation', label: 'Dictation', minutes: 3, route: 'dictation', color: 'violet', icon: 'pen', blurb: 'Type what you hear' },
];

export const ACTIVITIES = ['listen', 'talk', 'shadow', 'cards', 'dictation'];

export const XP = {
  perMinute: 10,
  /** Quality bonus up to this fraction of the minute XP. */
  maxQualityBonus: 0.5,
  sessionBonus: 100,
  /** XP to go from level L to L+1 is base + perLevel * L. */
  levelBase: 150,
  levelPerLevel: 25,
};

export const ADAPTIVE = {
  alpha: 0.15,
  min: 1.0,
  max: 10.0,
  maxDailyMove: 0.5,
  /** Score (0-100) at which the content is "at level": no move. */
  onLevelScore: 70,
  /** Target offset in levels for a score 30 points away from onLevelScore. */
  gain: 2,
};

/** Idle time after which the minutes timer pauses. */
export const IDLE_MS = 60000;

/**
 * Level bands. Levels are floats from 1.0 to 10.0. Roughly 3 = B1 low, 6 = B1+/B2-, 8 = B2+.
 * Each band drives content difficulty, persona complexity and vocabulary sophistication.
 */
export const LEVEL_TABLE = [
  { max: 2.5, cefr: 'A2+', words: [60, 80], vocabulary: 'very common everyday words, short sentences, no idioms', topics: 'concrete, personal, everyday', persona: 'friendly, uses simple sentence structures but natural contractions', shadowTier: 'S' },
  { max: 4.0, cefr: 'B1', words: [70, 95], vocabulary: 'common words plus a few frequent phrasal verbs', topics: 'familiar situations at work and in daily life', persona: 'natural and warm, common idioms only', shadowTier: 'S' },
  { max: 5.5, cefr: 'B1+', words: [80, 105], vocabulary: 'everyday and workplace vocabulary, common phrasal verbs and collocations', topics: 'work, plans, opinions, simple explanations', persona: 'natural pace, some idioms and phrasal verbs, occasional humour', shadowTier: 'M' },
  { max: 7.0, cefr: 'B2-', words: [90, 115], vocabulary: 'broader workplace and finance vocabulary, idiomatic phrasal verbs', topics: 'opinions, trade-offs, hypotheticals', persona: 'fully natural, idioms, hedging, follow-ups that ask for detail', shadowTier: 'M' },
  { max: 8.5, cefr: 'B2+', words: [100, 120], vocabulary: 'precise, nuanced vocabulary, idioms and colloquial expressions', topics: 'abstract issues, persuasion, nuance', persona: 'fast-moving, colloquial, challenges vague answers politely', shadowTier: 'L' },
  { max: 10.0, cefr: 'C1', words: [110, 120], vocabulary: 'sophisticated and idiomatic, including understatement and irony', topics: 'abstract and specialised', persona: 'native professional register, subtle humour, pushes back', shadowTier: 'L' },
];

/**
 * Returns the level band for a float level.
 * @param {number} level 1.0 to 10.0
 * @returns {typeof LEVEL_TABLE[number]}
 */
export function bandFor(level) {
  return LEVEL_TABLE.find((b) => level <= b.max) || LEVEL_TABLE[LEVEL_TABLE.length - 1];
}

/** Shadowing tiers by sentence length (words). */
export const SHADOW_TIERS = {
  S: { min: 5, max: 8, label: 'Short' },
  M: { min: 9, max: 14, label: 'Medium' },
  L: { min: 15, max: 22, label: 'Long' },
};
export const SHADOW_RULES = { window: 5, up: 80, down: 50, keep: 50 };

/** Listening content tiers. */
export const TIERS = {
  0: { label: 'Tier 0, generated dialogue', short: 'Generated', note: 'Written by AI and read by your device voices (synthetic speech).' },
  1: { label: 'Tier 1, VOA Learning English', short: 'VOA Learning', note: 'Public domain, read about one third slower than normal speech.' },
  2: { label: 'Tier 2, VOA news', short: 'VOA News', note: 'Public domain VOA reporting at normal speed.' },
  3: { label: 'Tier 3, your imported audio', short: 'Imported', note: 'Real native speech at natural speed, stored on this tablet.' },
};

export const TOPICS = [
  { key: 'work', label: 'Work and finance' },
  { key: 'daily', label: 'Daily life' },
  { key: 'travel', label: 'Travel' },
];

/** Talk: silence that ends the learner's turn. */
export const TURN_SILENCE_MS = 1200;
export const LONG_SILENCE_MS = 3000;
