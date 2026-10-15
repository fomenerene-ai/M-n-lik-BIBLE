/**
 * Speech recognition (Chrome webkitSpeechRecognition): one learner turn at a time.
 * Restarts automatically when Chrome ends the session early, ends the turn after a silence.
 */
import { markActive } from '../state/activity.js';
import { mergeResults } from './stt-merge.js';
import { LONG_SILENCE_MS } from '../config.js';

const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

/** Whether speech recognition exists. */
export function sttSupported() {
  return !!Recognition;
}

function sttError(code) {
  const kind = code === 'not-allowed' || code === 'service-not-allowed' ? 'no-mic' : code === 'audio-capture' ? 'no-mic-device'
    : code === 'network' ? 'stt-network' : code === 'unsupported' ? 'no-stt' : 'stt';
  return Object.assign(new Error(`Speech recognition error: ${code}`), { kind, code });
}

/**
 * Listens to one turn.
 * @param {{lang?: string, silenceMs?: number, maxMs?: number, onPartial?: (text: string) => void,
 *   onSpeech?: Function}} [o] silenceMs: end of turn after this much silence once something was said
 * @returns {{done: Promise<{text: string, firstResultAt: number|null, lastResultAt: number|null, startedAt: number,
 *   longPauses: number}>, stop: () => void, abort: () => void}}
 */
export function listenTurn(o = {}) {
  if (!Recognition) {
    const done = Promise.reject(sttError('unsupported'));
    done.catch(() => {});
    return { done, stop() {}, abort() {} };
  }
  const silenceMs = o.silenceMs ?? 1200;
  const startedAt = performance.now();
  let committed = '';
  let sessionText = { finalText: '', interim: '' };
  let firstResultAt = null;
  let lastResultAt = null;
  let longPauses = 0;
  let finished = false;
  let aborted = false;
  let rec = null;
  let silenceTimer = null;
  let maxTimer = null;
  let resolveFn, rejectFn;
  const done = new Promise((res, rej) => { resolveFn = res; rejectFn = rej; });

  const fullText = () => [committed, sessionText.finalText, sessionText.interim].filter(Boolean).join(' ').trim();
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(silenceTimer);
    clearTimeout(maxTimer);
    try { rec && rec.stop(); } catch { /* already stopped */ }
    resolveFn({ text: fullText(), firstResultAt, lastResultAt, startedAt, longPauses });
  };
  const fail = (e) => {
    if (finished) return;
    finished = true;
    clearTimeout(silenceTimer);
    clearTimeout(maxTimer);
    try { rec && rec.abort(); } catch { /* ignore */ }
    rejectFn(e);
  };

  const begin = () => {
    rec = new Recognition();
    rec.lang = o.lang || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      markActive();
      const now = performance.now();
      if (firstResultAt === null) firstResultAt = now;
      else if (now - lastResultAt > LONG_SILENCE_MS) longPauses += 1;
      lastResultAt = now;
      const list = [];
      for (let i = 0; i < e.results.length; i++) list.push({ transcript: e.results[i][0].transcript, isFinal: e.results[i].isFinal });
      sessionText = mergeResults(list);
      if (o.onPartial) o.onPartial(fullText());
      clearTimeout(silenceTimer);
      if (fullText()) silenceTimer = setTimeout(finish, silenceMs);
    };
    rec.onspeechstart = () => { markActive(); if (o.onSpeech) o.onSpeech(); };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      fail(sttError(e.error));
    };
    rec.onend = () => {
      if (finished || aborted) return;
      // Chrome (Android in particular) ends sessions after short pauses: keep the text and restart.
      committed = [committed, sessionText.finalText, sessionText.interim].filter(Boolean).join(' ').trim();
      sessionText = { finalText: '', interim: '' };
      if (committed && lastResultAt !== null && performance.now() - lastResultAt >= silenceMs) { finish(); return; }
      try { begin(); } catch (err) { fail(sttError('start-failed')); }
    };
    rec.start();
  };

  try { begin(); } catch { fail(sttError('start-failed')); }
  if (o.maxMs) maxTimer = setTimeout(finish, o.maxMs);
  return {
    done,
    /** Ends the turn now, keeping what was recognised. */
    stop: finish,
    /** Cancels without a result (resolves with empty text). */
    abort() { aborted = true; committed = ''; sessionText = { finalText: '', interim: '' }; finish(); },
  };
}

/**
 * Recognises one short utterance (cards "Say it", shadowing take).
 * @param {{lang?: string, maxMs?: number, onPartial?: (t: string) => void}} [o]
 */
export function recognizeOnce(o = {}) {
  return listenTurn({ lang: o.lang, silenceMs: 1200, maxMs: o.maxMs || 15000, onPartial: o.onPartial });
}
