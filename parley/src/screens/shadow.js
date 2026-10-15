/**
 * Shadow: listen to a native sentence, repeat it, get a score made of three visible parts:
 * word match (speech recognition), voice curve (pitch contour versus the reference, DTW) and rhythm.
 * Sentence length tiers S, M, L move automatically. Recordings are analysed in memory, never saved.
 */
import { h, replace, add } from '../ui/dom.js';
import { button, chip, banner, errorBanner, loading, toggle } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { SHADOW_TIERS } from '../config.js';
import { allItems, sentenceUnits } from '../content/pool.js';
import { prepareReference } from '../audio/reference.js';
import { startRecording } from '../audio/capture.js';
import { pitchTrack, semitoneContour, resample, downsample } from '../audio/pitch.js';
import { contourSimilarity } from '../audio/dtw.js';
import { rhythmProfile, rhythmScore } from '../audio/rhythm.js';
import { recognizeOnce, sttSupported } from '../speech/stt.js';
import { sessionVoice } from '../speech/voice-choice.js';
import { cancelSpeech } from '../speech/tts.js';
import { alignWords, alignmentScore } from '../learning/diff.js';
import { combineScore, nextTier, attemptsToPrune } from '../learning/shadow.js';
import { SHADOW_BANK } from '../learning/shadow-bank.js';
import { wordCount } from '../learning/text.js';
import { getProfile, saveProfile, updateSkill } from '../state/profile.js';
import { getAll, put, del } from '../state/db.js';
import { startRun } from './run.js';

const MODE_KEY = 'parley.shadowMode';
const TIER_NAMES = { S: 'Short', M: 'Medium', L: 'Long' };

const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'simultaneous'; } catch { return 'simultaneous'; } };
const writeMode = (m) => { try { localStorage.setItem(MODE_KEY, m); } catch { /* storage blocked */ } };

/**
 * @param {HTMLElement} root
 * @param {{params: Record<string,string>}} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  const scores = [];
  const run = startRun('shadow', route, { quality: () => (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length / 100 : null) });
  const profile = await getProfile();
  let tier = profile.shadowTier || 'S';
  let mode = readMode();
  let showText = true;
  let ref = null;
  let current = null;
  let busy = null; // {cancel}
  const recent = [];
  const { voice } = await sessionVoice().catch(() => ({ voice: null }));
  const items = await allItems();

  const main = h('div.activity-main');
  const tierCard = h('div.card.stack.tight');
  const modeCard = h('div.card.soft.stack.tight');
  add(root, 
    h('div.screen-head', null, h('div', null, h('h1', null, 'Shadow'), h('p.subtitle', null, 'Listen, then say it the same way: same words, same melody, same rhythm.'))),
    run.frameEl,
    h('div.activity', null, main, h('div.activity-rail', null, tierCard, modeCard,
      h('div.card.soft.stack.tight', null, h('h3', null, 'About the scores'),
        h('p.muted.small', null, 'Speech recognition tends to auto-correct mispronounced words, so the word match is generous. None of these scores is a pronunciation diagnosis.'),
        h('p.muted.small', null, 'Your recordings are analysed in memory and discarded. Nothing is saved.')))));

  const drawTier = async () => {
    const attempts = (await getAll('shadowAttempts', 'tier', IDBKeyRange.only(tier))).filter((a) => a.at >= (profile.shadowTierSince || 0)).sort((a, b) => a.at - b.at).slice(-5);
    const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : null;
    const t = SHADOW_TIERS[tier];
    replace(tierCard, h('h3', null, `${TIER_NAMES[tier]} sentences`),
      h('p.muted.small', null, `${t.min} to ${t.max} words. Average of 80 over 5 attempts moves you up, below 50 moves you down.`),
      h('div.row', null, chip(`${attempts.length} / 5 attempts`, 'sky', true), avg !== null ? chip(`Average ${avg}`, avg >= 80 ? 'teal' : avg < 50 ? 'coral' : 'sun', true) : null));
  };
  const drawMode = () => replace(modeCard, h('h3', null, 'Recording mode'),
    h('p.muted.small', null, mode === 'simultaneous' ? 'One take: speech recognition and the voice curve run at the same time.' : 'Two takes: this tablet cannot recognise and record at once, so take 1 gives the word match and take 2 the voice curve.'),
    mode === 'two-takes' ? button('Try one take again', { variant: 'outline', size: 'small', onClick: () => { mode = 'simultaneous'; writeMode(mode); drawMode(); } }) : null);
  await drawTier();
  drawMode();

  /** Candidate sentences for the tier, real recordings first. */
  const pickSentence = () => {
    const t = SHADOW_TIERS[tier];
    const units = sentenceUnits(items, t.min, t.max).filter((u) => !recent.includes(u.text));
    const real = units.filter((u) => u.item.kind === 'audio');
    const pool = real.length ? real : units;
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    const bank = SHADOW_BANK[tier].filter((s) => !recent.includes(s));
    const text = (bank.length ? bank : SHADOW_BANK[tier])[Math.floor(Math.random() * (bank.length || SHADOW_BANK[tier].length))];
    return { text };
  };

  const next = async () => {
    if (ref) ref.destroy();
    current = pickSentence();
    recent.push(current.text);
    if (recent.length > 12) recent.shift();
    replace(main, loading('Preparing the reference'));
    try { ref = await prepareReference(current, { voice }); } catch (e) { replace(main, errorBanner(e, { onRetry: next })); return; }
    drawSentence();
  };

  const drawSentence = (resultEl = null) => {
    const sourceChip = ref.kind === 'audio' ? chip('Real recording', 'coral', true) : chip('Synthetic voice', 'violet', true);
    const textEl = h('p.words', { lang: 'en' }, showText ? current.text : 'Text hidden. Listen carefully.');
    const status = h('div', { 'aria-live': 'polite' });
    const mic = h('button.mic', { type: 'button', 'aria-label': 'Record your repetition', onclick: () => record(status, mic) }, icon('mic'));
    replace(main,
      h('div.card.stack', null,
        h('div.row.between', null, h('div.row', null, chip(`${TIER_NAMES[tier]}, ${wordCount(current.text)} words`, 'sky', true), sourceChip),
          toggle('Show text', showText, (v) => { showText = v; textEl.textContent = v ? current.text : 'Text hidden. Listen carefully.'; })),
        textEl,
        h('p.muted.small', null, ref.note),
        h('div.row.center', null,
          button('Listen', { variant: 'sky', icon: 'speaker', size: 'large', onClick: () => ref.play().catch((e) => add(status, errorBanner(e))) }),
          h('div.stack.tight', null, mic, h('div.mic-caption', null, 'Tap, then repeat')),
          button('Skip', { variant: 'outline', icon: 'next', onClick: next })),
        status),
      resultEl);
  };

  /**
   * One take: recognition and/or recording.
   * @returns {Promise<{text: string|null, audio: {samples: Float32Array, rate: number, peak: number}|null}>}
   *   text is null when recognition did not run or failed for a device reason.
   */
  const take = (wantWords, wantCurve, status, mic) => new Promise((resolve, reject) => {
    let rec = null;
    let turn = null;
    let done = false;
    let watch = null;
    const maxMs = Math.max(6000, ((ref.rhythm && ref.rhythm.duration) || wordCount(current.text) * 0.45) * 2000 + 2500);
    const cleanup = () => { done = true; clearTimeout(timer); clearInterval(watch); busy = null; mic.classList.remove('listening'); };
    const finish = (text) => { if (done) return; cleanup(); resolve({ text, audio: rec ? rec.stop() : null }); };
    const abortAll = () => { if (rec) rec.cancel(); if (turn) turn.abort(); };
    const fail = (e) => { if (done) return; cleanup(); abortAll(); reject(e); };
    const timer = setTimeout(() => (turn ? turn.stop() : finish(null)), maxMs);
    busy = { cancel: () => { if (done) return; cleanup(); abortAll(); } };
    mic.classList.add('listening');
    (async () => {
      let level = 0;
      if (wantCurve) rec = await startRecording({ onLevel: (l) => { level = l; } });
      if (done) { if (rec) rec.cancel(); return; }
      if (wantWords) {
        turn = recognizeOnce({ maxMs, onPartial: (t) => replace(status, h('p.muted', null, t)) });
        turn.done.then((r) => finish(r.text), (e) => (wantCurve && (e.kind === 'no-mic-device' || e.kind === 'stt') ? finish(null) : fail(e)));
      } else {
        // Curve only: stop after 1.2 s of quiet once speech was heard.
        let heard = false;
        let quietSince = 0;
        watch = setInterval(() => {
          if (level > 0.03) { heard = true; quietSince = 0; } else if (heard) {
            quietSince = quietSince || performance.now();
            if (performance.now() - quietSince > 1200) finish(null);
          }
        }, 100);
      }
    })().catch(fail);
  });

  const record = async (status, mic) => {
    if (busy) { busy.cancel(); replace(status); return; }
    cancelSpeech();
    try {
      let text = null;
      let audio = null;
      if (!sttSupported()) {
        replace(status, banner({ tone: 'sun', icon: 'info', text: 'Speech recognition is unavailable here: only the voice curve and rhythm are scored.' }));
        ({ audio } = await take(false, true, status, mic));
      } else if (mode === 'simultaneous') {
        replace(status, h('p.muted', null, 'Listening...'));
        const r = await take(true, true, status, mic);
        text = r.text;
        audio = r.audio;
        if (r.text === null || !audio || audio.peak < 0.003) {
          // Simultaneous capture failed on this device: switch to two takes and redo.
          mode = 'two-takes';
          writeMode(mode);
          drawMode();
          replace(status, banner({ tone: 'sun', icon: 'info', text: 'This tablet cannot recognise and record at the same time. Switched to two takes: say it once for the words, then once more for the voice curve.' }));
          await new Promise((res) => setTimeout(res, 1500));
          return record(status, mic);
        }
      } else {
        replace(status, h('p', null, h('strong', null, 'Take 1 of 2: '), 'say the sentence (words).'));
        text = (await take(true, false, status, mic)).text;
        replace(status, h('p', null, h('strong', null, 'Take 2 of 2: '), 'say it again (voice curve).'));
        audio = (await take(false, true, status, mic)).audio;
      }
      analyse(text, audio);
    } catch (e) {
      replace(status, errorBanner(e, { onRetry: () => record(status, mic) }));
    }
  };

  const analyse = async (text, audio) => {
    const parts = { word: null, pitch: null, rhythm: null };
    let learnerContour = [];
    let learnerRhythm = null;
    if (text !== null) parts.word = alignmentScore(alignWords(current.text, text || ''));
    if (audio && audio.samples.length) {
      const d = downsample(audio.samples, audio.rate, 16000);
      learnerContour = semitoneContour(pitchTrack(d.samples, d.rate));
      learnerRhythm = rhythmProfile(d.samples, d.rate);
      if (ref.contour && learnerContour.length >= 10) parts.pitch = contourSimilarity(resample(ref.contour, 80), resample(learnerContour, 80));
      if (ref.rhythm && learnerRhythm) parts.rhythm = rhythmScore(ref.rhythm, learnerRhythm).score;
    }
    const score = combineScore(parts);
    if (score === null) {
      drawSentence(banner({ tone: 'sun', icon: 'info', text: 'Nothing could be measured. Speak a little louder and closer to the tablet.' }));
      return;
    }
    scores.push(score);
    const at = Date.now();
    await put('shadowAttempts', { tier, score, parts, at, source: ref.kind });
    const all = await getAll('shadowAttempts');
    for (const old of attemptsToPrune(all)) await del('shadowAttempts', old.id);
    await updateSkill('shadowLevel', score);
    const p = await getProfile();
    const nt = nextTier(tier, all, p.shadowTierSince || 0);
    if (nt !== tier) {
      const up = 'SML'.indexOf(nt) > 'SML'.indexOf(tier);
      toast(up ? `Moving up to ${TIER_NAMES[nt].toLowerCase()} sentences.` : `Back to ${TIER_NAMES[nt].toLowerCase()} sentences for now.`);
      tier = nt;
      p.shadowTier = nt;
      p.shadowTierSince = at + 1;
      profile.shadowTierSince = p.shadowTierSince;
      await saveProfile(p);
    }
    await drawTier();

    const canvas = h('canvas', { width: 800, height: 180, role: 'img', 'aria-label': ref.contour ? 'Voice curves: reference in teal, yours in coral' : 'Your voice curve in coral' });
    const part = (label, value, why) => h('div.card.soft.score-ring', null,
      h('span.score-value', null, value === null ? 'n/a' : String(value)), h('span.score-label', null, label), why ? h('span.muted.small', null, why) : null);
    const result = h('div.card.stack', null,
      h('div.row.between', null, h('h3', null, `Score ${score}`), h('div.row', null,
        button('Hear it again', { variant: 'outline', size: 'small', icon: 'replay', onClick: () => ref.play() }),
        button('Next sentence', { icon: 'next', onClick: next }))),
      h('div.metrics', null,
        part('Words', parts.word, text === null ? 'Recognition unavailable' : `Heard: "${text || ''}"`),
        part('Voice curve', parts.pitch, !ref.contour ? 'No reference curve' : learnerContour.length < 10 ? 'Too little voiced speech' : null),
        part('Rhythm', parts.rhythm, !ref.rhythm ? 'Play the reference first' : ref.kind === 'tts' ? 'Duration only' : null),
        part('Overall', score, null)),
      h('div.curve-box', null, canvas),
      h('div.legend', null, ref.contour ? h('span.tok.correct', null, 'Reference') : null, h('span.tok.wrong', null, 'You')));
    drawSentence(result);
    drawCurves(canvas, ref.contour, learnerContour);
  };

  await next();
  return () => {
    if (busy) busy.cancel();
    if (ref) ref.destroy();
    cancelSpeech();
    run.dispose();
  };
}

/** Draws the reference (teal) and learner (coral) contours, each stretched to the full width. */
function drawCurves(canvas, refC, mine) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = '#E3E7EF';
  g.lineWidth = 1;
  for (const st of [-6, 0, 6]) { const y = H / 2 - (st / 8) * (H / 2 - 10); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const line = (c, color) => {
    if (!c || c.length < 2) return;
    const pts = resample(c, 160);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach((st, i) => {
      const x = 10 + (i / (pts.length - 1)) * (W - 20);
      const y = H / 2 - (Math.max(-8, Math.min(8, st)) / 8) * (H / 2 - 10);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  };
  line(refC, '#13B5A5');
  line(mine, '#FF5B4A');
}

