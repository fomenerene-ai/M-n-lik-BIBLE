/**
 * Shared UI components built on h(). Every component returns a DOM node.
 */
import { h, replace, mmss, add } from './dom.js';
import { icon } from './icons.js';

/**
 * Chunky button.
 * @param {string} label
 * @param {{variant?: string, size?: string, icon?: string, onClick?: Function, disabled?: boolean, block?: boolean, ariaLabel?: string, type?: string}} [o]
 */
export function button(label, o = {}) {
  const cls = ['btn', `btn-${o.variant || 'primary'}`];
  if (o.size) cls.push(`btn-${o.size}`);
  if (o.block) cls.push('btn-block');
  return h('button', { type: o.type || 'button', class: cls.join(' '), onclick: o.onClick, disabled: o.disabled, 'aria-label': o.ariaLabel },
    o.icon ? icon(o.icon) : null, label);
}

/**
 * Icon-only button (48 px, chunky), always with an aria-label.
 * @param {string} name icon name
 * @param {string} label accessible label
 * @param {Function} onClick
 * @param {object} [attrs]
 */
export function iconButton(name, label, onClick, attrs = {}) {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onclick: onClick, ...attrs }, icon(name));
}

/** Colored icon tile. */
export function tile(name, color, large = false) {
  return h(`div.tile.${color}${large ? '.lg' : ''}`, null, icon(name));
}

/** Pill chip. */
export function chip(text, color = 'grey', small = false) {
  return h(`span.chip.${color}${small ? '.sm' : ''}`, null, text);
}

/**
 * Inline banner with optional action.
 * @param {{tone?: string, title?: string, text: string, action?: {label: string, onClick: Function, variant?: string}, icon?: string}} o
 */
export function banner(o) {
  return h(`div.banner.${o.tone || 'sky'}`, { role: o.tone === 'danger' ? 'alert' : 'status' },
    o.icon ? icon(o.icon) : null,
    h('div.banner-text', null, o.title ? h('div.banner-title', null, o.title) : null, h('div', null, o.text)),
    o.action ? button(o.action.label, { variant: o.action.variant || 'outline', size: 'small', onClick: o.action.onClick }) : null);
}

/**
 * Friendly error message for a caught error (ApiError, speech errors, others).
 * @param {any} err
 * @param {{onRetry?: Function, onSettings?: Function}} [actions]
 */
export function errorBanner(err, actions = {}) {
  const msg = friendlyError(err);
  const action = msg.action === 'settings' && actions.onSettings ? { label: 'Open Settings', onClick: actions.onSettings }
    : actions.onRetry ? { label: 'Try again', onClick: actions.onRetry } : undefined;
  return banner({ tone: 'danger', icon: 'alert', title: msg.title, text: msg.text, action });
}

/**
 * Maps an error to a title, text and suggested action. Never includes secrets.
 * @param {any} err
 * @returns {{title: string, text: string, action?: string}}
 */
export function friendlyError(err) {
  const kind = err && err.kind;
  switch (kind) {
    case 'no-key': return { title: 'API key needed', text: 'Add your Anthropic API key in Settings to use this feature.', action: 'settings' };
    case 'auth': return { title: 'API key not accepted', text: 'The key was rejected (401). Check it in Settings, or create a new one in the Anthropic Console.', action: 'settings' };
    case 'permission': return { title: 'Access denied', text: 'The API refused this request (403). Check that the key has access to the selected model.', action: 'settings' };
    case 'rate': return { title: 'Too many requests', text: 'The API rate limit was reached (429). Wait a few seconds and try again.' };
    case 'overloaded': return { title: 'Service busy', text: 'The API is overloaded right now. Try again in a moment.' };
    case 'network': return { title: 'No connection', text: 'Could not reach the API. Check the Wi-Fi connection and try again.' };
    case 'timeout': return { title: 'Request timed out', text: 'The API took too long to answer. Try again.' };
    case 'bad-request': return { title: 'Request rejected', text: `The API rejected the request. If you changed the model in Settings, check its ID. ${err.detail || ''}`.trim(), action: 'settings' };
    case 'refusal': return { title: 'Request declined', text: 'The model declined this request. Try a different topic.' };
    case 'invalid-output': return { title: 'Unexpected answer', text: 'The model answered in an unexpected format twice. Try again.' };
    case 'spend-guard': return { title: 'Limit reached', text: err.message };
    case 'no-mic': return { title: 'Microphone blocked', text: 'Allow microphone access for this site: tap the lock icon next to the address, then Permissions, then Microphone.' };
    case 'no-mic-device': return { title: 'No microphone available', text: 'No working microphone was found, or another app is using it. Close other apps that use the microphone and try again.' };
    case 'no-stt': return { title: 'Speech recognition unavailable', text: 'This browser has no speech recognition. Open the app in Google Chrome on Android.' };
    case 'stt-network': return { title: 'Speech recognition offline', text: 'Chrome speech recognition needs an internet connection. Check the Wi-Fi and try again.' };
    case 'no-voice': return { title: 'No English voice installed', text: 'Install an English voice: Android Settings, then Accessibility or General management, Text-to-speech output, Speech Services by Google, then Install voice data and pick English (US) and English (UK).' };
    case 'storage': return { title: 'Storage error', text: err.message || 'The tablet storage could not be used.' };
    default: return { title: 'Something went wrong', text: (err && err.message) ? String(err.message).slice(0, 300) : 'Unexpected error.' };
  }
}

/**
 * Step card used on Today.
 * @param {{step: object, state: 'done'|'next'|'upcoming', minutesDone?: number, onStart: Function, subtitle?: string}} o
 */
export function stepCard(o) {
  const { step, state } = o;
  const sub = o.subtitle || step.blurb;
  if (state === 'done') {
    return h('div.step.done', null,
      h('div.tile.teal', null, icon('check', { stroke: 3 })),
      h('div.grow', null, h('div.step-title', null, step.label), h('div.step-sub', null, sub)),
      h('span.step-meta.teal-text', null, `${step.minutes} min, done`),
      h('button.btn.btn-outline.btn-small', { type: 'button', onclick: o.onStart, 'aria-label': `Do ${step.label} again` }, 'Again'));
  }
  if (state === 'next') {
    return h('div.step.next', null,
      tile(step.icon, 'coral', true),
      h('div.grow', null, h('div.step-title.lg', null, step.label), h('div.step-sub', null, sub)),
      button('Start', { onClick: o.onStart, ariaLabel: `Start ${step.label}` }));
  }
  return h('div.step', null,
    tile(step.icon, step.color),
    h('div.grow', null, h('div.step-title', null, step.label), h('div.step-sub', null, sub)),
    h('span.step-meta', null, `${step.minutes} min`),
    h('button.btn.btn-outline.btn-small', { type: 'button', onclick: o.onStart, 'aria-label': `Start ${step.label}` }, 'Start'));
}

/**
 * Level card: level, XP to next, progress bar.
 * @param {{level: number, xpInLevel: number, need: number, xpToNext: number}} lv
 */
export function levelCard(lv) {
  const pct = Math.round((lv.xpInLevel / lv.need) * 100);
  return h('div.card.sun', null,
    h('h3', null, `Level ${lv.level}`),
    h('div.muted.small', null, `${lv.xpToNext} XP to level ${lv.level + 1}`),
    h('div.bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Progress to next level', style: { marginTop: '14px' } },
      h('div.fill', { style: { width: `${pct}%` } })));
}

/**
 * Minutes per day bar chart.
 * @param {{date: string, total: number}[]} days oldest first
 * @param {string} today YYYY-MM-DD
 * @param {{dense?: boolean}} [o]
 */
export function minutesChart(days, today, o = {}) {
  const max = Math.max(10, ...days.map((d) => d.total));
  const total = days.reduce((s, d) => s + d.total, 0);
  const label = `Minutes per day. Total ${Math.round(total)} minutes over ${days.length} days.`;
  const chart = h(`div.chart${o.dense ? '.dense' : ''}`, { role: 'img', 'aria-label': label });
  for (const d of days) {
    const isToday = d.date === today;
    const dt = new Date(`${d.date}T12:00:00`);
    const dayLabel = o.dense ? (dt.getDate() % 5 === 0 || isToday ? String(dt.getDate()) : '') : 'SMTWTFS'[dt.getDay()];
    const bar = d.total > 0.05
      ? h(`div.barv${isToday ? '.today' : ''}`, { title: `${d.date}: ${Math.round(d.total)} min` })
      : h('div.barv.none', { title: `${d.date}: 0 min` });
    if (d.total > 0.05) bar.style.height = `${Math.max(8, (d.total / max) * 100)}%`;
    chart.appendChild(h('div.col', null, bar, h(`span.day${isToday ? '.today' : ''}`, { 'aria-hidden': 'true' }, dayLabel)));
  }
  return chart;
}

/**
 * Group of toggle choices (single select).
 * @param {{value: any, label: string}[]} options
 * @param {any} value
 * @param {(v: any) => void} onChange
 * @param {string} groupLabel
 */
export function choiceGroup(options, value, onChange, groupLabel) {
  const wrap = h('div.choice-group', { role: 'group', 'aria-label': groupLabel });
  const render = (current) => {
    replace(wrap, ...options.map((opt) => h('button.choice', {
      type: 'button', 'aria-pressed': String(opt.value === current),
      onclick: () => { render(opt.value); onChange(opt.value); },
    }, opt.label)));
  };
  render(value);
  return wrap;
}

/**
 * Segmented control.
 * @param {{value: any, label: string}[]} options
 * @param {any} value
 * @param {(v: any) => void} onChange
 * @param {string} groupLabel
 */
export function segmented(options, value, onChange, groupLabel) {
  const wrap = h('div.segmented', { role: 'group', 'aria-label': groupLabel });
  const render = (current) => replace(wrap, ...options.map((opt) => h('button', {
    type: 'button', 'aria-pressed': String(opt.value === current), onclick: () => { render(opt.value); onChange(opt.value); },
  }, opt.label)));
  render(value);
  return wrap;
}

/**
 * Switch (role=switch).
 * @param {string} label
 * @param {boolean} on
 * @param {(v: boolean) => void} onChange
 */
export function toggle(label, on, onChange) {
  const btn = h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(on) }, h('span.track-sw', { 'aria-hidden': 'true' }), label);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return btn;
}

/**
 * Confirmation dialog. Resolves true when confirmed.
 * @param {{title: string, text: string, confirm?: string, danger?: boolean}} o
 * @returns {Promise<boolean>}
 */
export function confirmDialog(o) {
  return new Promise((resolve) => {
    const dlg = h('dialog.modal', { 'aria-labelledby': 'dlg-title' });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    add(dlg, h('div.stack', null,
      h('h2', { id: 'dlg-title' }, o.title),
      h('p', null, o.text),
      h('div.row.end', null,
        button('Cancel', { variant: 'outline', onClick: () => done(false) }),
        button(o.confirm || 'Confirm', { variant: o.danger ? 'danger' : 'primary', onClick: () => done(true) }))));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

/**
 * Prompt dialog with a text field. Resolves the string or null.
 * @param {{title: string, label: string, value?: string, confirm?: string, multiline?: boolean}} o
 * @returns {Promise<string|null>}
 */
export function promptDialog(o) {
  return new Promise((resolve) => {
    const input = o.multiline
      ? h('textarea.textarea', { id: 'dlg-input', value: o.value || '' })
      : h('input.input', { id: 'dlg-input', value: o.value || '', autocomplete: 'off' });
    const dlg = h('dialog.modal', { 'aria-labelledby': 'dlg-title' });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const form = h('form.stack', { method: 'dialog', onsubmit: (e) => { e.preventDefault(); done(input.value.trim() || null); } },
      h('h2', { id: 'dlg-title' }, o.title),
      h('div.field', null, h('label', { for: 'dlg-input' }, o.label), input),
      h('div.row.end', null,
        button('Cancel', { variant: 'outline', onClick: () => done(null) }),
        button(o.confirm || 'Save', { type: 'submit' })));
    add(dlg, form);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    document.body.appendChild(dlg);
    dlg.showModal();
    input.focus();
  });
}

/**
 * Step timer bar for guided session steps and timed activities.
 * Shows elapsed progress in sun yellow and the remaining time.
 * @param {{seconds: number, onElapsed?: Function, label?: string}} o
 * @returns {{el: HTMLElement, tick: (elapsedSec: number) => void, setTotal: (sec: number) => void}}
 */
export function timerBar(o) {
  let total = o.seconds;
  let fired = false;
  const fill = h('div.fill');
  const bar = h('div.bar.track.grow', { role: 'progressbar', 'aria-label': o.label || 'Time elapsed', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
  const txt = h('div.timer', { 'aria-live': 'off' }, `${mmss(total)} left`);
  const el = h('div.row.grow', { class: 'timer-row' }, bar, txt);
  const tick = (elapsed) => {
    const pct = Math.min(100, (elapsed / total) * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    const left = total - elapsed;
    txt.textContent = left >= 0 ? `${mmss(left)} left` : `${mmss(-left)} over`;
    if (left <= 0 && !fired) { fired = true; o.onElapsed && o.onElapsed(); }
  };
  tick(0);
  return { el, tick, setTotal: (sec) => { total = sec; fired = false; } };
}

/** Three-dot loading indicator with an accessible label. */
export function loading(label = 'Loading') {
  return h('div.row', { role: 'status' }, h('span.spinner-dots', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span')), h('span.muted', null, label));
}

/** Empty state block. */
export function emptyState(iconName, color, title, text, action) {
  return h('div.empty', null, tile(iconName, color, true), h('h3', null, title), h('p.muted', null, text), action || null);
}
