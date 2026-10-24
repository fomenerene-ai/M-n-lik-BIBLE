// Lecture vocale : synthèse vocale du navigateur (sous Android, le moteur du système).
// Un énoncé par segment (verset, phrase) : suivi précis du passage lu, et pas de coupure
// sur les longs textes. La pause annule l'énoncé en cours ; la reprise le relit depuis le début,
// car speechSynthesis.pause() est peu fiable sous Android.

import { settings } from './userdata.js';

export const RATE_MIN = 0.6;
export const RATE_MAX = 1.6;

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/** Voix installées ; la liste arrive parfois après coup (événement voiceschanged). */
export function loadVoices(timeout = 1500) {
  if (!speechSupported()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, timeout);
  });
}

/** Voix françaises : celles de l'appareil d'abord, puis le français de France. */
export async function frenchVoices() {
  const list = (await loadVoices()).filter((v) => /^fr\b/i.test(v.lang.replace('_', '-')));
  const score = (v) => (v.localService ? 0 : 2) + (/^fr-FR$/i.test(v.lang.replace('_', '-')) ? 0 : 1);
  return list.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'fr'));
}

/** Voix choisie dans les réglages, sinon la meilleure voix française, sinon null. */
export async function pickVoice() {
  const list = await frenchVoices();
  return list.find((v) => v.voiceURI === settings().ttsVoice) || list[0] || null;
}

/** Découpe un texte en phrases d'au plus `max` caractères environ. */
export function splitSentences(text, max = 220) {
  const out = [];
  for (const s of text.split(/(?<=[.!?…»])\s+/)) {
    if (s.length <= max) {
      if (s.trim()) out.push(s.trim());
      continue;
    }
    let cur = '';
    for (const part of s.split(/(?<=[,;:])\s+/)) {
      if (cur && cur.length + part.length + 1 > max) {
        out.push(cur);
        cur = part;
      } else cur = cur ? `${cur} ${part}` : part;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** Segments d'un chapitre : titre, puis un segment par verset. */
export function chapterSegments(bookName, chapter, verses, announce = settings().ttsAnnounce) {
  return [
    { text: `${bookName}, chapitre ${chapter}.`, n: null },
    ...verses.map((v) => ({ text: announce ? `Verset ${v.n}. ${v.t}` : v.t, n: v.n })),
  ];
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Lit une suite de segments [{text, …}].
 * onSegment(i, segment) avant chaque segment ; onEnd() à la fin naturelle ; onError(code).
 */
export function createSpeaker({ segments, onSegment, onEnd, onError, onState }) {
  let index = 0;
  let playing = false;
  let token = 0;

  const setPlaying = (p) => {
    playing = p;
    onState && onState(p);
  };

  async function speakFrom(i) {
    const my = ++token;
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      await pause(80); // certains moteurs ignorent un énoncé envoyé juste après cancel()
    }
    const voice = await pickVoice();
    if (my !== token) return;
    index = i;
    setPlaying(true);
    const next = () => {
      if (my !== token) return;
      if (index >= segments.length) {
        setPlaying(false);
        index = 0;
        onEnd && onEnd();
        return;
      }
      onSegment && onSegment(index, segments[index]);
      const u = new SpeechSynthesisUtterance(segments[index].text);
      u.lang = voice ? voice.lang : 'fr-FR';
      if (voice) u.voice = voice;
      u.rate = settings().ttsRate;
      u.onend = () => {
        if (my !== token) return;
        index++;
        next();
      };
      u.onerror = (e) => {
        if (my !== token || e.error === 'interrupted' || e.error === 'canceled') return;
        setPlaying(false);
        onError && onError(e.error);
      };
      speechSynthesis.speak(u);
    };
    next();
  }

  return {
    play: (i = index) => speakFrom(i),
    pause() {
      token++;
      setPlaying(false);
      speechSynthesis.cancel();
    },
    stop() {
      token++;
      index = 0;
      setPlaying(false);
      speechSynthesis.cancel();
    },
    /** Relit le segment en cours (après un changement de vitesse). */
    restart() {
      if (playing) speakFrom(index);
    },
    get playing() {
      return playing;
    },
    get index() {
      return index;
    },
  };
}

// Enchaînement d'un chapitre au suivant : l'écran de lecture suivant reprend la lecture.
let continueNext = false;
export function requestContinue() {
  continueNext = true;
}
export function takeContinue() {
  const c = continueNext;
  continueNext = false;
  return c;
}
