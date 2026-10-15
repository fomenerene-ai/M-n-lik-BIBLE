/**
 * Settings store (key/value). The API key is a separate record that never leaves the device.
 */
import { DEFAULT_SETTINGS } from '../config.js';
import { get, put, getAll } from './db.js';

const API_KEY = 'apiKey';

/**
 * All settings merged with defaults (without the API key).
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  const rows = await getAll('settings');
  const out = { ...DEFAULT_SETTINGS, voices: { ...DEFAULT_SETTINGS.voices } };
  for (const r of rows) if (r.key !== API_KEY && r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out;
}

/**
 * Saves one setting.
 * @param {keyof typeof DEFAULT_SETTINGS} key
 * @param {any} value
 */
export async function setSetting(key, value) {
  if (key === API_KEY || !(key in DEFAULT_SETTINGS)) throw new Error(`Unknown setting ${key}`);
  await put('settings', { key, value });
}

/** Saves several settings. */
export async function setSettings(obj) {
  for (const [k, v] of Object.entries(obj)) if (k in DEFAULT_SETTINGS) await setSetting(k, v);
}

/** @returns {Promise<string>} the API key or "" */
export async function getApiKey() {
  const r = await get('settings', API_KEY);
  return (r && r.value) || '';
}

/** Stores the API key on this device only. Empty string removes it. */
export async function setApiKey(key) {
  await put('settings', { key: API_KEY, value: String(key || '').trim() });
}

/**
 * Masks a key for display: first 7 and last 4 characters.
 * @param {string} key
 */
export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 14) return '•'.repeat(key.length);
  return `${key.slice(0, 7)}${'•'.repeat(8)}${key.slice(-4)}`;
}
