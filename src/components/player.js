// Barre de lecture vocale : lecture / pause, segment en cours, vitesse, arrêt.
// Garde l'écran allumé pendant la lecture (Wake Lock) et s'affiche dans les commandes
// multimédias d'Android (Media Session).

import { h, icon, toast } from '../ui.js';
import { ICONS } from '../icons.js';
import { settings, setSetting } from '../core/userdata.js';
import { createSpeaker, frenchVoices, speechSupported, RATE_MIN, RATE_MAX } from '../core/speech.js';

const fmtRate = (r) => `${r.toFixed(1).replace('.', ',')}×`;

/**
 * @param title      titre affiché dans les commandes multimédias
 * @param segments   [{text, …}]
 * @param label(i, segment)  texte de position (« Verset 5 »)
 * @param onSegment(i, segment) / onEnd() / onStop()
 */
export function createPlayer({ title, segments, label, onSegment, onEnd, onStop }) {
  let wakeLock = null;
  const pos = h('span', { class: 'tts-pos', 'aria-live': 'polite' }, '');
  const playBtn = h('button', { class: 'btn-icon tts-play' });
  const rateOut = h('span', { class: 'tts-rate' }, fmtRate(settings().ttsRate));

  const speaker = createSpeaker({
    segments,
    onSegment: (i, s) => {
      pos.textContent = label(i, s);
      onSegment && onSegment(i, s);
    },
    onEnd: () => {
      hide();
      onEnd && onEnd();
    },
    onError: () => toast('Lecture vocale interrompue. Vérifiez la voix dans les réglages.', 4000),
    onState: (p) => {
      playBtn.replaceChildren(icon(p ? ICONS.pause : ICONS.play));
      playBtn.setAttribute('aria-label', p ? 'Pause' : 'Reprendre la lecture');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
      p ? keepAwake() : release();
    },
  });

  playBtn.addEventListener('click', () => (speaker.playing ? speaker.pause() : speaker.play()));

  const setRate = async (d) => {
    const r = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, settings().ttsRate + d)) * 10) / 10;
    await setSetting('ttsRate', r);
    rateOut.textContent = fmtRate(r);
    speaker.restart();
  };

  const el = h(
    'div',
    { class: 'tts-bar', role: 'region', 'aria-label': 'Lecture vocale', hidden: true },
    h(
      'div',
      { class: 'tts-inner' },
      playBtn,
      pos,
      h(
        'div',
        { class: 'segmented tts-speed', role: 'group', 'aria-label': 'Vitesse de lecture' },
        h('button', { 'aria-label': 'Ralentir', onclick: () => setRate(-0.1) }, '−'),
        rateOut,
        h('button', { 'aria-label': 'Accélérer', onclick: () => setRate(0.1) }, '+'),
      ),
      h('button', { class: 'btn-icon', 'aria-label': 'Arrêter la lecture', onclick: () => stop() }, icon(ICONS.stop)),
    ),
  );

  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }
  function release() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  function show() {
    if (!el.isConnected) document.body.append(el);
    el.hidden = false;
    document.body.classList.add('tts-on');
  }
  function hide() {
    el.hidden = true;
    document.body.classList.remove('tts-on');
    release();
  }

  async function start(i = 0) {
    if (!speechSupported()) {
      toast('Lecture vocale non disponible sur ce navigateur.', 4000);
      return;
    }
    if (!(await frenchVoices()).length) {
      toast('Aucune voix française trouvée : voir Réglages › Lecture vocale.', 5000);
    }
    show();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Ménélik Bible' });
        navigator.mediaSession.setActionHandler('play', () => speaker.play());
        navigator.mediaSession.setActionHandler('pause', () => speaker.pause());
        navigator.mediaSession.setActionHandler('stop', () => stop());
      } catch {
        /* commandes multimédias indisponibles */
      }
    }
    speaker.play(i);
    playBtn.focus({ preventScroll: true });
  }

  function stop() {
    speaker.stop();
    hide();
    onStop && onStop();
  }

  function destroy() {
    speaker.stop();
    hide();
    el.remove();
  }

  return {
    el,
    start,
    stop,
    destroy,
    get playing() {
      return speaker.playing;
    },
  };
}
