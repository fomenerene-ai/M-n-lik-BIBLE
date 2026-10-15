/**
 * First launch: welcome, API key, microphone test, voice test, placement offer.
 */
import { h, replace, add } from '../ui/dom.js';
import { button, banner, errorBanner, chip, loading } from '../ui/components.js';
import { APP_NAME } from '../config.js';
import { getSettings, setApiKey, setSetting } from '../state/settings.js';
import { testKey } from '../ai/claude.js';
import { openMic } from '../audio/capture.js';
import { recognizeOnce, sttSupported } from '../speech/stt.js';
import { getVoices, englishVoiceGroups, pickVoice, speak, cancelSpeech } from '../speech/tts.js';

const SAMPLE = 'Hi there! This is how I sound. Shall we get started?';

/**
 * @param {HTMLElement} root
 * @param {object} route
 * @param {{go: Function, setFocusMode: Function}} ctx
 */
export async function render(root, route, ctx) {
  ctx.setFocusMode(true);
  const settings = await getSettings();
  let step = 0;
  let mic = null;
  let meterTimer = null;
  const stopMic = () => { clearInterval(meterTimer); if (mic) { mic.close(); mic = null; } };
  const wrap = h('div.welcome.stack.loose');
  add(root, wrap);

  const dots = () => h('div.dots', { 'aria-label': `Step ${step + 1} of 5` }, ...[0, 1, 2, 3, 4].map((i) => h(`span${i <= step ? '.on' : ''}`)));
  const nav = (...buttons) => h('div.row.between', null, step > 0 ? button('Back', { variant: 'outline', onClick: () => { step -= 1; draw(); } }) : h('span'), h('div.row', null, ...buttons));
  const next = () => { step += 1; draw(); };

  const steps = [
    () => [
      h('h1', null, `Welcome to ${APP_NAME}`),
      h('p.subtitle', null, 'Understand native speakers at real speed, and speak without freezing.'),
      h('div.card.soft.stack.tight', null,
        h('p', null, 'Each day: a guided 30 minute session in five steps. Listen, Talk, Shadow, Cards and Dictation.'),
        h('p', null, 'Everything stays on this tablet. No account, no tracking. You can export a backup any time.')),
      nav(button('Get started', { onClick: next })),
    ],
    () => {
      const input = h('input.input', { id: 'key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Paste your Anthropic API key' });
      const out = h('div', { 'aria-live': 'polite' });
      const save = async () => {
        const key = input.value.trim();
        if (!key) { input.focus(); return; }
        replace(out, loading('Testing the key'));
        try {
          await testKey(key, settings.model);
          await setApiKey(key);
          replace(out, banner({ tone: 'teal', icon: 'check', text: 'Key works and is saved on this tablet.' }));
          setTimeout(next, 700);
        } catch (e) { replace(out, errorBanner(e)); }
      };
      return [
        h('h1', null, 'Your API key'),
        h('p.subtitle', null, 'Conversations, reports and generated listening use the Anthropic API with your own key.'),
        h('div.field', null, h('label', { for: 'key' }, 'Anthropic API key'), input),
        banner({ tone: 'sun', icon: 'info', title: 'Be careful with costs', text: 'Create a dedicated key in the Anthropic Console and set a monthly spend limit. The key stays on this tablet: it is never exported, and it is only sent to the Anthropic API.' }),
        out,
        nav(button('Skip for now', { variant: 'outline', onClick: next }), button('Test and save', { onClick: save })),
      ];
    },
    () => {
      const meter = h('div.bar.teal', { role: 'meter', 'aria-label': 'Microphone level', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div.fill'));
      const out = h('div.stack', { 'aria-live': 'polite' });
      const test = async () => {
        stopMic();
        replace(out, h('p.muted', null, 'Say something. The bar should move.'));
        try {
          mic = await openMic();
          meterTimer = setInterval(() => {
            const v = Math.min(100, Math.round(mic.level() * 400));
            meter.firstChild.style.width = `${v}%`;
            meter.setAttribute('aria-valuenow', String(v));
          }, 80);
          setTimeout(() => { stopMic(); sttTest(); }, 4000);
        } catch (e) { replace(out, errorBanner(e)); }
      };
      const sttTest = async () => {
        if (!sttSupported()) { replace(out, errorBanner({ kind: 'no-stt' })); return; }
        replace(out, h('p', null, 'Now say: "I\'d like a coffee, please."'));
        const said = h('p.muted');
        add(out, said);
        try {
          const r = await recognizeOnce({ maxMs: 8000, onPartial: (t) => { said.textContent = t; } }).done;
          replace(out, r.text ? banner({ tone: 'teal', icon: 'check', text: `Heard: "${r.text}". Speech recognition works.` }) : banner({ tone: 'sun', icon: 'info', text: 'Nothing was recognised. Check the microphone and try again.' }));
        } catch (e) { replace(out, errorBanner(e)); }
      };
      return [
        h('h1', null, 'Microphone'),
        h('p.subtitle', null, 'Chrome will ask for permission. Recordings are analysed in memory and never saved.'),
        h('div.card.stack', null, meter, button('Test microphone', { variant: 'outline', icon: 'mic', onClick: test }), out),
        nav(button('Continue', { onClick: () => { stopMic(); next(); } })),
      ];
    },
    () => {
      const box = h('div.stack', null, loading('Looking for English voices'));
      getVoices().then((voices) => {
        const groups = englishVoiceGroups(voices);
        if (!groups.length) { replace(box, errorBanner({ kind: 'no-voice' })); return; }
        const play = (lang) => { cancelSpeech(); speak(SAMPLE, { voice: pickVoice(voices, lang, settings.voices) }).catch((e) => add(box, errorBanner(e))); };
        replace(box,
          h('div.row', null, ...groups.map((g) => chip(`${g.label}: ${g.voices.length}`, g.lang === 'en-US' || g.lang === 'en-GB' ? 'teal' : 'grey', true))),
          h('div.row', null,
            button('Play American voice', { variant: 'outline', icon: 'speaker', onClick: () => play('en-US') }),
            button('Play British voice', { variant: 'outline', icon: 'speaker', onClick: () => play('en-GB') })),
          groups.some((g) => g.lang === 'en-GB') && groups.some((g) => g.lang === 'en-US') ? null : banner({ tone: 'sun', icon: 'info', text: 'For mixed accents, install both English (US) and English (UK) in Android text-to-speech settings: Speech Services by Google, Install voice data.' }));
      });
      return [
        h('h1', null, 'Voices'),
        h('p.subtitle', null, 'The app uses the voices installed on the tablet, at natural speed.'),
        h('div.card', null, box),
        nav(button('Continue', { onClick: () => { cancelSpeech(); next(); } })),
      ];
    },
    () => {
      const finish = async (route) => { await setSetting('onboardedAt', new Date().toISOString()); ctx.setFocusMode(false); ctx.go(route); };
      return [
        h('h1', null, 'Placement test'),
        h('p.subtitle', null, 'About 5 minutes: short listening clips, then three spoken questions. It sets your starting levels.'),
        h('div.card.soft', null, h('p', null, 'You can skip it and take it later from Today. Levels then start at B1 and adapt as you practise.')),
        nav(button('Later', { variant: 'outline', onClick: () => finish('today') }), button('Take the test', { onClick: () => finish('placement') })),
      ];
    },
  ];

  const draw = () => {
    replace(wrap, dots(), ...steps[step]());
    const hd = wrap.querySelector('h1');
    if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus(); }
  };
  draw();
  return () => { stopMic(); cancelSpeech(); ctx.setFocusMode(false); };
}
