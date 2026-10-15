/**
 * Settings: API key and model, conversation length, voices and accent mix, data (export, import,
 * reset), storage status.
 */
import { h, replace, mmss } from '../ui/dom.js';
import { button, choiceGroup, banner, errorBanner, confirmDialog, loading, chip } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { API, CONVERSATION_LENGTHS, DEFAULT_SETTINGS } from '../config.js';
import { getSettings, setSetting, getApiKey, setApiKey, maskKey } from '../state/settings.js';
import { exportBackup, importBackup, resetAll } from '../state/backup.js';
import { testKey } from '../ai/claude.js';
import { getVoices, englishVoiceGroups, pickVoice, speak, cancelSpeech } from '../speech/tts.js';
import { listLibrary, deleteLibraryItem } from '../audio/library.js';
import { importFiles } from '../audio/import.js';

const SAMPLE = 'Thanks for coming in today. Could you tell me a bit about yourself?';

/**
 * @param {HTMLElement} root
 * @param {object} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  const settings = await getSettings();
  root.append(h('div.screen-head', null, h('div', null, h('h1', null, 'Settings'), h('p.subtitle', null, 'Everything is stored on this tablet only.'))));
  const grid = h('div.settings-grid');
  root.append(grid);
  grid.append(await apiCard(settings), conversationCard(settings), await voicesCard(settings), await libraryCard(), dataCard(settings, ctx), await storageCard(ctx));
  return () => cancelSpeech();
}

async function apiCard(settings) {
  const card = h('div.card');
  const draw = async () => {
    const key = await getApiKey();
    const input = h('input.input', { id: 'api-key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: key ? 'Paste a new key to replace it' : 'Paste your Anthropic API key' });
    const model = h('input.input', { id: 'model', value: settings.model, autocomplete: 'off', spellcheck: 'false' });
    const out = h('div', { 'aria-live': 'polite' });
    const test = async () => {
      const k = input.value.trim() || key;
      const m = model.value.trim() || API.defaultModel;
      if (!k) { input.focus(); return; }
      replace(out, loading('Testing'));
      try {
        await testKey(k, m);
        if (input.value.trim()) await setApiKey(k);
        await setSetting('model', m);
        settings.model = m;
        replace(out, banner({ tone: 'teal', icon: 'check', text: `Key and model work. Saved on this tablet.` }));
        setTimeout(draw, 1200);
      } catch (e) { replace(out, errorBanner(e)); }
    };
    replace(card,
      h('h3', null, 'Anthropic API'),
      h('div.row', null, h('span.muted', null, 'Current key:'), key ? h('code', null, maskKey(key)) : chip('No key', 'coral', true)),
      h('div.field', null, h('label', { for: 'api-key' }, key ? 'Replace key' : 'API key'), input),
      h('div.field', null, h('label', { for: 'model' }, 'Model'), model, h('span.hint', null, `Default: ${API.defaultModel}. Check the current model IDs in the Anthropic documentation before changing it.`)),
      h('p.hint', null, 'Use a dedicated key with a monthly spend limit. It is never exported and is only sent to api.anthropic.com.'),
      out,
      h('div.row', null,
        button('Test and save', { size: 'small', onClick: test }),
        key ? button('Remove key', { variant: 'danger', size: 'small', onClick: async () => {
          if (await confirmDialog({ title: 'Remove the API key?', text: 'Talk, reports and generated listening will stop working until you add a key again.', confirm: 'Remove', danger: true })) { await setApiKey(''); toast('Key removed.'); draw(); }
        } }) : null,
        settings.model !== DEFAULT_SETTINGS.model ? button('Reset model', { variant: 'outline', size: 'small', onClick: async () => { await setSetting('model', DEFAULT_SETTINGS.model); settings.model = DEFAULT_SETTINGS.model; draw(); } }) : null));
  };
  await draw();
  return card;
}

function conversationCard(settings) {
  return h('div.card', null,
    h('h3', null, 'Conversation'),
    h('span.field-label', null, 'Default length'),
    choiceGroup(CONVERSATION_LENGTHS.map((m) => ({ value: m, label: `${m} min` })), settings.conversationMinutes, async (v) => { await setSetting('conversationMinutes', v); toast('Saved.'); }, 'Default conversation length'),
    h('p.hint', null, 'The guided session always uses 10 minutes for Talk.'));
}

async function voicesCard(settings) {
  const voices = await getVoices();
  const groups = englishVoiceGroups(voices);
  const card = h('div.card', null, h('h3', null, 'Voices'));
  if (!groups.length) { card.append(errorBanner({ kind: 'no-voice' })); return card; }
  const saved = { ...settings.voices };
  for (const g of groups) {
    const id = `voice-${g.lang}`;
    const current = pickVoice(voices, g.lang, saved);
    const sel = h('select.select', { id, onchange: async () => { saved[g.lang] = sel.value; await setSetting('voices', saved); toast('Voice saved.'); } },
      ...g.voices.map((v) => h('option', { value: v.voiceURI, selected: current && v.voiceURI === current.voiceURI }, `${v.name}${v.localService ? '' : ' (online)'}`)));
    card.append(h('div.field', null, h('label', { for: id }, g.label),
      h('div.row', null, h('div.grow', null, sel), button('Play', { variant: 'outline', size: 'small', icon: 'speaker', onClick: () => {
        cancelSpeech();
        const v = voices.find((x) => x.voiceURI === sel.value);
        speak(SAMPLE, { voice: v }).catch((e) => toast(e.message));
      } }))));
  }
  card.append(h('span.field-label', null, 'Accent for conversations'),
    choiceGroup([{ value: 'mixed', label: 'Mixed US and UK' }, ...groups.map((g) => ({ value: g.lang, label: g.label.replace('English ', '') }))], settings.accentMix,
      async (v) => { await setSetting('accentMix', v); toast('Saved.'); }, 'Accent mix'));
  if (!groups.some((g) => g.lang === 'en-GB') || !groups.some((g) => g.lang === 'en-US')) {
    card.append(banner({ tone: 'sun', icon: 'info', text: 'Install English (US) and English (UK) voices in Android text-to-speech settings for mixed accents.' }));
  }
  return card;
}

function dataCard(settings, ctx) {
  const lastExport = h('p.hint', null, settings.lastExportAt ? `Last export: ${new Date(settings.lastExportAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Never exported.');
  let mode = 'merge';
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'import-file' });
  const out = h('div', { 'aria-live': 'polite' });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    if (mode === 'replace' && !(await confirmDialog({ title: 'Replace all data?', text: 'Your current cards, minutes, reports and progress will be replaced by the backup. The API key and imported audio are kept.', confirm: 'Replace', danger: true }))) return;
    replace(out, loading('Importing'));
    try {
      const r = await importBackup(f, mode);
      const n = Object.values(r.counts).reduce((s, x) => s + x, 0);
      replace(out, banner({ tone: 'teal', icon: 'check', text: `Imported ${n} records${r.dropped ? `, skipped ${r.dropped} invalid ones` : ''}.` }));
    } catch (e) { replace(out, errorBanner({ kind: 'storage', message: e.message })); }
  });
  return h('div.card', null,
    h('h3', null, 'Data'),
    h('p.muted.small', null, 'The backup holds your profile, minutes, sessions, cards, reports and generated listening. It never holds the API key or imported audio files.'),
    h('div.row', null, button('Export backup', { variant: 'teal', size: 'small', icon: 'download', onClick: async () => {
      const { blob, filename } = await exportBackup();
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const now = new Date().toISOString();
      await setSetting('lastExportAt', now);
      lastExport.textContent = `Last export: ${new Date(now).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;
    } })),
    lastExport,
    h('span.field-label', null, 'Import mode'),
    choiceGroup([{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace' }], mode, (v) => { mode = v; }, 'Import mode'),
    h('div.row', null, h('label.btn.btn-outline.btn-small', { for: 'import-file', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, 'Import backup'), file),
    out,
    h('hr'),
    h('div.row', null, button('Reset all data', { variant: 'danger', size: 'small', icon: 'trash', onClick: async () => {
      if (!(await confirmDialog({ title: 'Delete everything?', text: 'All progress, cards, reports, imported audio and the API key will be deleted from this tablet. Export a backup first if you want to keep them.', confirm: 'Delete everything', danger: true }))) return;
      await resetAll();
      try { Object.keys(localStorage).filter((k) => k.startsWith('parley.')).forEach((k) => localStorage.removeItem(k)); } catch { /* storage blocked */ }
      toast('All data deleted.');
      ctx.go('welcome');
      location.reload();
    } })));
}

async function storageCard(ctx) {
  let persisted = false;
  let usage = '';
  try {
    persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    if (est && est.usage !== undefined) usage = `${(est.usage / 1048576).toFixed(1)} MB used`;
  } catch { /* not supported */ }
  return h('div.card', null,
    h('h3', null, 'Storage and levels'),
    h('div.row', null, chip(persisted ? 'Persistent storage' : 'Storage may be cleared by Chrome', persisted ? 'teal' : 'sun', true), usage ? h('span.muted.small', null, usage) : null),
    persisted ? null : h('p.hint', null, 'Install the app to the home screen so Chrome keeps the data, and export a backup regularly.'),
    h('div.row', null, button('Retake placement test', { variant: 'outline', size: 'small', icon: 'target', onClick: () => ctx.go('placement') })));
}

async function libraryCard() {
  const card = h('div.card');
  const file = h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.wav,.m4a,.txt,.srt,.vtt,.tsv', class: 'visually-hidden', id: 'audio-files' });
  const progress = h('div.list', { 'aria-live': 'polite' });
  const list = h('div.list');
  const drawList = async () => {
    const items = (await listLibrary()).sort((a, b) => b.createdAt - a.createdAt);
    if (!items.length) { replace(list, h('p.muted.small', null, 'No imported audio yet.')); return; }
    replace(list, ...items.slice(0, 200).map((m) => h('div.list-row', null,
      h('div.grow', null, h('div.title', null, m.title), h('div.muted.small', null, `${mmss(m.durationSec)}, ${m.segments.length} segment${m.segments.length === 1 ? '' : 's'}`)),
      chip(m.transcript ? 'Transcript' : 'No transcript', m.transcript ? 'teal' : 'grey', true),
      h('button.icon-btn', { type: 'button', 'aria-label': `Delete ${m.title}`, onclick: async () => {
        if (await confirmDialog({ title: 'Delete this audio?', text: `"${m.title}" will be removed from this tablet.`, confirm: 'Delete', danger: true })) { await deleteLibraryItem(m.id); drawList(); }
      } }, icon('trash')))));
    if (items.length > 200) list.append(h('p.muted.small', null, `${items.length} items in total.`));
  };
  file.addEventListener('change', async () => {
    const files = Array.from(file.files || []);
    file.value = '';
    if (!files.length) return;
    const rows = new Map();
    replace(progress);
    const res = await importFiles(files, (name, status) => {
      if (!rows.has(name)) { const r = h('div.muted.small'); rows.set(name, r); progress.append(r); }
      rows.get(name).textContent = `${name}: ${status}`;
    });
    toast(`${res.imported} file${res.imported === 1 ? '' : 's'} imported${res.skipped.length ? `, ${res.skipped.length} skipped` : ''}.`);
    drawList();
  });
  card.append(
    h('h3', null, 'Audio library'),
    h('p.muted.small', null, 'Import real native speech: your own recordings or Common Voice clips. Add a transcript with the same name (.txt, .srt, .vtt) or the Common Voice .tsv to unlock questions, dictation and word scores. Files stay on this tablet and are not included in backups.'),
    h('div.row', null, h('label.btn.btn-outline.btn-small', { for: 'audio-files', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, icon('upload'), 'Import audio'), file),
    progress, list);
  await drawList();
  return card;
}
