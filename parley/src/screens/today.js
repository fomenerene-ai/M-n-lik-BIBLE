/**
 * Today: the guided 30-minute session (Listen 8, Talk 10, Shadow 5, Cards 4, Dictation 3).
 */
import { h } from '../ui/dom.js';
import { stepCard, levelCard, minutesChart, chip, banner } from '../ui/components.js';
import { SESSION_PLAN } from '../config.js';
import { getSession, nextStepKey } from '../state/sessions.js';
import { getProfile } from '../state/profile.js';
import { lastDays } from '../state/minutes.js';
import { levelInfo } from '../learning/xp.js';
import { localDate } from '../learning/dates.js';

/**
 * @param {HTMLElement} root
 * @param {object} route
 * @param {{go: Function}} ctx
 */
export async function render(root, route, ctx) {
  const [session, profile, days] = await Promise.all([getSession(), getProfile(), lastDays(7)]);
  const lv = levelInfo(profile.xp);
  const next = nextStepKey(session);

  root.append(h('div.screen-head', null,
    h('div', null,
      h('h1', null, "Today's session"),
      h('p.subtitle', null, session.completedAt ? 'Session complete. Free practice is open, or start a step again.' : '30 minutes, five steps. Listening comes first.')),
    h('div.head-chips', null, chip(`Level ${lv.level}`, 'sun'), chip(`${profile.xp.toLocaleString('en-US')} XP`, 'teal'))));

  if (!profile.placementDoneAt) {
    root.append(banner({
      tone: 'sun', icon: 'target', title: 'Placement test, about 5 minutes',
      text: 'Set your starting levels so listening and conversation match you.',
      action: { label: 'Take the test', onClick: () => ctx.go('placement') },
    }));
  }

  const steps = h('div.today-steps', { role: 'list', 'aria-label': 'Session steps' });
  for (const step of SESSION_PLAN) {
    const st = session.steps[step.key];
    const state = st.status === 'done' ? 'done' : step.key === next ? 'next' : 'upcoming';
    const card = stepCard({ step, state, onStart: () => ctx.go(step.route, { session: 1 }) });
    card.setAttribute('role', 'listitem');
    steps.append(card);
  }

  const today = localDate();
  root.append(h('div.today-grid', null,
    steps,
    h('div.today-rail', null,
      levelCard(lv),
      h('div.card.chart-card', null, h('h3', null, 'Minutes per day'), minutesChart(days, today)))));
}
