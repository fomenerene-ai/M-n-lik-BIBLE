import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, validateBackup, migrateBackup, mergeRecords } from '../src/state/backup-schema.js';
import { BACKUP_SCHEMA_VERSION } from '../src/config.js';
import { lastNDates, localDate } from '../src/learning/dates.js';

const card = (id, front, extra = {}) => ({ id, front, type: 'word', due: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, ...extra });

test('buildBackup never includes the API key', () => {
  const b = buildBackup({ settings: { apiKey: 'secret', model: 'm' }, profile: { xp: 1 }, cards: [card('a', 'x')] }, new Date('2026-01-01'));
  assert.equal(b.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(b.settings.apiKey, undefined);
  assert.equal(JSON.stringify(b).includes('secret'), false);
  assert.deepEqual(b.minutes, []);
  assert.equal(b.cards.length, 1);
});

test('validateBackup round-trips and drops invalid records', () => {
  const b = buildBackup({ settings: { model: 'claude-sonnet-5-5', conversationMinutes: 15 }, profile: { listeningLevel: 5, xp: 300 }, cards: [card('a', 'x'), { id: 'bad' }], minutes: [{ date: '2026-01-01', total: 3, listen: 3 }, { date: 'nope', total: 1 }] });
  const { backup, dropped } = validateBackup(JSON.parse(JSON.stringify(b)));
  assert.equal(dropped, 2);
  assert.equal(backup.cards.length, 1);
  assert.equal(backup.minutes.length, 1);
  assert.equal(backup.profile.xp, 300);
  assert.equal(backup.settings.conversationMinutes, 15);
});

test('validateBackup rejects foreign files and secret settings', () => {
  assert.throws(() => validateBackup([]), /not a backup/);
  assert.throws(() => validateBackup({ app: 'other', schemaVersion: 1 }), /another app/);
  assert.throws(() => validateBackup({ hello: 1 }), /not a backup/);
  const { backup } = validateBackup({ app: 'parley', schemaVersion: 1, settings: { apiKey: 'x', model: 'bad model!', conversationMinutes: 7 }, profile: { xp: 1 } });
  assert.deepEqual(backup.settings, {});
});

test('migrates a version 0 backup', () => {
  const v0 = { profile: { xp: 50, levels: { listening: 3, speaking: 4, shadow: 5 } }, cards: [card('a', 'x')] };
  const m = migrateBackup(v0);
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.profile.listeningLevel, 3);
  assert.equal(m.profile.shadowLevel, 5);
  assert.deepEqual(m.reports, []);
  const { backup } = validateBackup(v0);
  assert.equal(backup.profile.speakingLevel, 4);
});

test('refuses backups from a newer version', () => {
  assert.throws(() => migrateBackup({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }), /newer version/);
});

test('merge: minutes take the max per activity', () => {
  const out = mergeRecords('minutes', [{ date: 'd', listen: 5, talk: 0, shadow: 0, cards: 0, dictation: 0, total: 5 }], [{ date: 'd', listen: 3, talk: 4, shadow: 0, cards: 0, dictation: 0, total: 7 }, { date: 'e', listen: 1, total: 1 }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].listen, 5);
  assert.equal(out[0].talk, 4);
  assert.equal(out[0].total, 9);
});

test('merge: cards dedupe by front and keep the latest review', () => {
  const existing = [card('a', 'Take off', { lastReviewedAt: 10 })];
  const out = mergeRecords('cards', existing, [card('a', 'Take off', { lastReviewedAt: 20 }), card('b', 'take off '), card('c', 'new one')]);
  assert.deepEqual(out.map((c) => c.id), ['a', 'c']);
  assert.equal(mergeRecords('cards', existing, [card('a', 'Take off', { lastReviewedAt: 5 })]).length, 0);
});

test('merge: other lists keep existing records', () => {
  const out = mergeRecords('reports', [{ id: 'r1', date: 'x' }], [{ id: 'r1', date: 'y' }, { id: 'r2', date: 'z' }]);
  assert.deepEqual(out.map((r) => r.id), ['r2']);
});

test('lastNDates gives n consecutive dates ending today', () => {
  const d = lastNDates(7, '2026-03-02');
  assert.deepEqual(d, ['2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.equal(lastNDates(30).length, 30);
  assert.equal(lastNDates(1)[0], localDate());
});
