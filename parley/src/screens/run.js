/**
 * Activity run: active-time tracking, XP on finish, and the guided-session step frame
 * (time-boxed timer, extend, finish early) when a screen is opened with ?session=1.
 */
import { h } from '../ui/dom.js';
import { button, timerBar, chip } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { startActivity } from '../state/activity.js';
import { SESSION_PLAN } from '../config.js';
import { go } from '../router.js';

/**
 * Starts a run for an activity screen.
 * @param {string} activity
 * @param {{params: Record<string,string>}} route
 * @param {{frame?: boolean, onTimeUp?: Function}} [o] frame=false hides the step frame (Talk has its own)
 * @returns {{frameEl: HTMLElement|null, isStep: boolean, step: object|null, tracker: ReturnType<typeof startActivity>,
 *   finish: (quality?: number|null, f?: {done?: boolean, stay?: boolean}) => Promise<object|null>, dispose: () => void}}
 */
export function startRun(activity, route, o = {}) {
  const step = route.params.session === '1' ? SESSION_PLAN.find((s) => s.key === activity) : null;
  let finished = false;
  let total = step ? step.minutes * 60 : 0;
  let timeUpBanner = null;
  const timer = step && o.frame !== false ? timerBar({
    seconds: total,
    label: `${step.label} step time`,
    onElapsed: () => {
      if (o.onTimeUp) o.onTimeUp();
      if (!timeUpBanner && frameEl) {
        timeUpBanner = h('span.chip.sun.sm', { role: 'status' }, 'Time is up');
        frameEl.insertBefore(timeUpBanner, finishBtn);
      }
    },
  }) : null;
  const tracker = startActivity(activity, { step: !!step, onTick: (s) => timer && timer.tick(s) });

  const finish = async (quality = null, f = {}) => {
    if (finished) return null;
    finished = true;
    const res = await tracker.finish({ quality, done: f.done ?? !!step });
    if (res && res.xp + res.bonus > 0) {
      const parts = [`+${res.xp + res.bonus} XP`];
      if (res.bonus) parts.push('session complete');
      if (res.leveledUp) parts.push(`level ${res.level} reached`);
      toast(parts.join(', '));
    }
    if (step && !f.stay) go('today');
    return res;
  };

  const finishBtn = step && o.frame !== false ? button('Finish step', { variant: 'teal', size: 'small', icon: 'check', onClick: () => finish(o.quality ? o.quality() : null, { done: true }) }) : null;
  const frameEl = timer ? h('div.step-frame', null,
    chip('Guided session', 'coral', true),
    h('span.step-name', null, step.label),
    timer.el,
    button('+2 min', { variant: 'outline', size: 'small', ariaLabel: 'Extend the step by 2 minutes', onClick: () => {
      total += 120; timer.setTotal(total); timer.tick(tracker.activeSeconds);
      if (timeUpBanner) { timeUpBanner.remove(); timeUpBanner = null; }
    } }),
    finishBtn) : null;

  return {
    frameEl, isStep: !!step, step, tracker, finish,
    /** Ends the run when leaving the screen; minutes and XP still count, the step stays unfinished. */
    dispose() { if (!finished) finish(o.quality ? o.quality() : null, { done: false, stay: true }); },
  };
}
