/**
 * Conversation reports store.
 */
import { get, put, getAll } from './db.js';

/** All reports, newest first. */
export async function listReports() {
  const all = await getAll('reports');
  return all.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** One report by id. */
export function getReport(id) {
  return get('reports', id);
}

/** Saves a report. */
export function saveReport(r) {
  return put('reports', r);
}
