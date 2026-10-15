/**
 * Anthropic Messages API client for the browser (fetch, no SDK: the app has no dependencies).
 * - Headers: x-api-key, anthropic-version, content-type, anthropic-dangerous-direct-browser-access.
 * - Retries with backoff on 429, 5xx, 529 and network errors (never after streamed text was shown).
 * - Timeouts (idle timeout while streaming), abort on cancel.
 * - Spend guard: max_tokens capped by API.maxTokensCap.
 * - JSON mode through structured outputs, validated locally, one repair retry.
 * The API key is never logged and never appears in error messages.
 */
import { API } from '../config.js';
import { getApiKey, getSettings } from '../state/settings.js';
import { createSseParser } from './sse.js';
import { validate, toApiSchema, parseJsonLoose } from './schema.js';

/** Error with a `kind` used by the UI to show a friendly message. */
export class ApiError extends Error {
  /**
   * @param {string} kind no-key|auth|permission|rate|overloaded|network|timeout|bad-request|refusal|invalid-output|aborted|spend-guard
   * @param {string} message
   * @param {{status?: number, detail?: string, retryable?: boolean}} [o]
   */
  constructor(kind, message, o = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = o.status;
    this.detail = o.detail;
    this.retryable = !!o.retryable;
  }
}

let fallbackRejected = false;
let formatRejected = false;

/**
 * Builds request headers.
 * @param {string} key
 * @param {boolean} fallback
 */
export function buildHeaders(key, fallback) {
  const h = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': API.version,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (fallback) h['anthropic-beta'] = API.fallbackBeta;
  return h;
}

/**
 * Builds the request body. Pure.
 * @param {{model: string, system?: string, messages: object[], maxTokens?: number, stream?: boolean,
 *   effort?: string, schema?: object|null, cache?: boolean, fallback?: boolean}} o
 */
export function buildBody(o) {
  const body = {
    model: o.model,
    max_tokens: Math.min(API.maxTokensCap, Math.max(16, Math.round(o.maxTokens || 1024))),
    messages: o.messages,
  };
  if (o.system) body.system = o.system;
  if (o.stream) body.stream = true;
  const oc = {};
  if (o.effort) oc.effort = o.effort;
  if (o.schema) oc.format = { type: 'json_schema', schema: toApiSchema(o.schema) };
  if (Object.keys(oc).length) body.output_config = oc;
  if (o.cache) body.cache_control = { type: 'ephemeral' };
  if (o.fallback) body.fallbacks = 'default';
  return body;
}

/** Whether the server-side refusal fallback can be sent for a model. */
export function supportsFallback(model) {
  return !fallbackRejected && API.fallbackModels.includes(model);
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new ApiError('aborted', 'Cancelled')); }, { once: true });
});

function scrub(text, key) {
  let t = String(text || '').slice(0, 300);
  if (key) t = t.split(key).join('[key]');
  return t.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[key]');
}

async function errorFromResponse(res, key) {
  let detail = '';
  try { const j = await res.json(); detail = scrub(j && j.error && j.error.message, key); } catch { /* not JSON */ }
  const s = res.status;
  if (s === 401) return new ApiError('auth', 'API key rejected', { status: s, detail });
  if (s === 403) return new ApiError('permission', 'Access denied', { status: s, detail });
  if (s === 429) return new ApiError('rate', 'Rate limited', { status: s, detail, retryable: true });
  if (s === 529 || s === 503) return new ApiError('overloaded', 'Overloaded', { status: s, detail, retryable: true });
  if (s >= 500) return new ApiError('overloaded', `Server error ${s}`, { status: s, detail, retryable: true });
  return new ApiError('bad-request', `Request rejected (${s})`, { status: s, detail });
}

function retryDelay(attempt, res) {
  const ra = res && Number(res.headers.get('retry-after'));
  if (ra > 0 && ra < 30) return ra * 1000;
  return Math.min(8000, 1000 * 2 ** attempt) + Math.random() * 300;
}

/**
 * Sends a Messages API request.
 * @param {{system?: string, messages: object[], maxTokens?: number, stream?: boolean, effort?: string,
 *   schema?: object, cache?: boolean, onText?: (delta: string, full: string) => void, signal?: AbortSignal,
 *   apiKey?: string, model?: string, timeoutMs?: number}} o
 * @returns {Promise<{text: string, stopReason: string, usage: object}>}
 */
export async function chat(o) {
  const key = o.apiKey ?? await getApiKey();
  const model = o.model ?? (await getSettings()).model;
  if (!key) throw new ApiError('no-key', 'No API key');
  let lastErr = null;
  for (let attempt = 0; attempt <= API.retries; attempt++) {
    if (o.signal && o.signal.aborted) throw new ApiError('aborted', 'Cancelled');
    const fallback = supportsFallback(model);
    const schema = formatRejected ? null : o.schema;
    const body = buildBody({ ...o, model, schema, fallback });
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });
    let timer = null;
    let timedOut = false;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, o.timeoutMs || API.timeoutMs); };
    let emitted = false;
    let res = null;
    try {
      arm();
      res = await fetch(API.url, { method: 'POST', headers: buildHeaders(key, fallback), body: JSON.stringify(body), signal: ctrl.signal, referrerPolicy: 'no-referrer' });
      if (!res.ok) {
        const err = await errorFromResponse(res, key);
        if (err.status === 400 && fallback && /fallback|beta/i.test(err.detail)) { fallbackRejected = true; attempt -= 1; continue; }
        if (err.status === 400 && schema && /output_config|format|schema/i.test(err.detail)) { formatRejected = true; attempt -= 1; continue; }
        throw err;
      }
      let result;
      if (o.stream) {
        result = await readStream(res, arm, (d, full) => { emitted = true; if (o.onText) o.onText(d, full); });
      } else {
        const j = await res.json();
        const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        result = { text, stopReason: j.stop_reason, usage: j.usage || {} };
      }
      if (result.stopReason === 'refusal') throw new ApiError('refusal', 'Declined');
      return result;
    } catch (e) {
      let err = e;
      if (!(e instanceof ApiError)) {
        if (o.signal && o.signal.aborted) err = new ApiError('aborted', 'Cancelled');
        else if (timedOut) err = new ApiError('timeout', 'Timed out', { retryable: true });
        else err = new ApiError('network', 'Network error', { retryable: true });
      }
      lastErr = err;
      if (!err.retryable || emitted || attempt === API.retries) throw err;
      await sleep(retryDelay(attempt, res), o.signal);
    } finally {
      clearTimeout(timer);
      if (o.signal) o.signal.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr || new ApiError('network', 'Network error');
}

async function readStream(res, arm, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let stopReason = null;
  const usage = {};
  let streamErr = null;
  const parser = createSseParser((type, data) => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'message_start' && data.message) Object.assign(usage, data.message.usage || {});
    else if (data.type === 'content_block_delta' && data.delta && data.delta.type === 'text_delta') {
      text += data.delta.text;
      onDelta(data.delta.text, text);
    } else if (data.type === 'message_delta') {
      if (data.delta && data.delta.stop_reason) stopReason = data.delta.stop_reason;
      Object.assign(usage, data.usage || {});
    } else if (data.type === 'error') {
      const t = data.error && data.error.type;
      streamErr = t === 'overloaded_error' ? new ApiError('overloaded', 'Overloaded', { retryable: true })
        : t === 'rate_limit_error' ? new ApiError('rate', 'Rate limited', { retryable: true })
          : new ApiError('bad-request', 'Stream error', { detail: scrub(data.error && data.error.message) });
    }
  });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    arm();
    parser.feed(decoder.decode(value, { stream: true }));
    if (streamErr) { reader.cancel().catch(() => {}); throw streamErr; }
  }
  parser.end();
  if (streamErr) throw streamErr;
  return { text, stopReason, usage };
}

/**
 * Requests a JSON answer validated against a schema. Retries once with a repair instruction.
 * @param {{system: string, messages: object[], schema: object, maxTokens?: number, effort?: string,
 *   check?: (value: any) => string[], signal?: AbortSignal, apiKey?: string, model?: string}} o check adds semantic validation
 * @returns {Promise<any>}
 */
export async function chatJson(o) {
  let messages = o.messages;
  let lastErrors = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chat({ system: o.system, messages, maxTokens: o.maxTokens || 4000, effort: o.effort || 'low', schema: o.schema, signal: o.signal, apiKey: o.apiKey, model: o.model });
    let value;
    let errors;
    try {
      value = parseJsonLoose(res.text);
      errors = [...validate(value, o.schema), ...(o.check ? o.check(value) : [])];
    } catch {
      errors = [res.stopReason === 'max_tokens' ? 'the answer was cut off: make it shorter' : 'the answer was not valid JSON'];
    }
    if (!errors.length) return value;
    lastErrors = errors;
    messages = [...o.messages,
      { role: 'assistant', content: res.text || '(empty)' },
      { role: 'user', content: `Your previous answer was not valid: ${errors.slice(0, 8).join('; ')}. Reply again with only the corrected JSON object, nothing else.` }];
  }
  throw new ApiError('invalid-output', 'Invalid JSON', { detail: lastErrors.join('; ') });
}

/**
 * Checks a key and model with a tiny request.
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<true>} resolves when the key works, rejects with ApiError otherwise
 */
export async function testKey(apiKey, model) {
  await chat({ apiKey, model, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], maxTokens: 256, effort: 'low', timeoutMs: 30000 });
  return true;
}
