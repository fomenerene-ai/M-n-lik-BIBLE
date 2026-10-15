/**
 * Export and import of the JSON backup (IndexedDB side). Format and rules: backup-schema.js.
 */
import { getAll, get, putMany, put, clear, withTx } from './db.js';
import { getSettings, setSettings } from './settings.js';
import { buildBackup, validateBackup, mergeRecords, BACKUP_LISTS } from './backup-schema.js';
import { DEFAULT_PROFILE } from './profile.js';
import { localDate } from '../learning/dates.js';

/**
 * Builds the backup and returns it as a downloadable Blob with a file name.
 * @returns {Promise<{blob: Blob, filename: string, counts: Record<string, number>}>}
 */
export async function exportBackup() {
  const snap = { settings: await getSettings(), profile: await get('profile', 'main') };
  for (const k of BACKUP_LISTS) snap[k] = await getAll(k);
  // shadowAttempts ids are auto-increment keys local to this device.
  snap.shadowAttempts = snap.shadowAttempts.map(({ id, ...r }) => r);
  const data = buildBackup(snap);
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const counts = Object.fromEntries(BACKUP_LISTS.map((k) => [k, data[k].length]));
  return { blob, filename: `parley-backup-${localDate()}.json`, counts };
}

/**
 * Imports a backup file.
 * @param {File|Blob} file
 * @param {'merge'|'replace'} mode
 * @returns {Promise<{counts: Record<string, number>, dropped: number}>}
 */
export async function importBackup(file, mode) {
  if (file.size > 50 * 1024 * 1024) throw new Error('This file is too large to be a backup.');
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON.'); }
  const { backup, dropped } = validateBackup(raw);
  const counts = {};
  if (mode === 'replace') {
    await clear(['profile', 'sessions', 'minutes', ...BACKUP_LISTS]);
    for (const k of BACKUP_LISTS) { await putMany(k, backup[k]); counts[k] = backup[k].length; }
    if (backup.profile) await put('profile', { ...DEFAULT_PROFILE, ...stripUndefined(backup.profile) });
  } else {
    for (const k of BACKUP_LISTS) {
      const existing = await getAll(k);
      const recs = mergeRecords(k, existing, backup[k]);
      await putMany(k, recs);
      counts[k] = recs.length;
    }
    if (backup.profile) {
      const cur = await get('profile', 'main');
      if (!cur || (backup.profile.xp || 0) > (cur.xp || 0)) await put('profile', { ...DEFAULT_PROFILE, ...(cur || {}), ...stripUndefined(backup.profile) });
    }
  }
  await setSettings(backup.settings);
  return { counts, dropped };
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** Deletes every record of every store (the API key included). */
export async function resetAll() {
  const { ALL_STORES } = await import('./db.js');
  await withTx(ALL_STORES, 'readwrite', (tx) => { for (const s of ALL_STORES) tx.objectStore(s).clear(); });
}
