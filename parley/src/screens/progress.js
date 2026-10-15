/**
 * Progress: minutes per day (7 or 30 days), level and XP, past conversation reports.
 */
import { h, replace, add } from '../ui/dom.js';
import { levelCard, minutesChart, segmented, emptyState } from '../ui/components.js';
import { getProfile } from '../state/profile.js';
import { lastDays } from '../state/minutes.js';
import { listReports } from '../state/reports.js';
import { levelInfo } from '../learning/xp.js';
import { localDate } from '../learning/dates.js';
import { hrefFor } from '../router.js';
import { icon } from '../ui/icons.js';

const RANGE_KEY = 'parley.progressRange';

/**
 * @param {HTMLElement} root
 */
export async function render(root) {
  const profile = await getProfile();
  const lv = levelInfo(profile.xp);
  let range = 7;
  try { range = Number(localStorage.getItem(RANGE_KEY)) === 30 ? 30 : 7; } catch { /* storage blocked */ }

  const chartHost = h('div.grow');
  const totalEl = h('span.muted');
  const drawChart = async () => {
    const days = await lastDays(range);
    const total = days.reduce((s, d) => s + d.total, 0);
    totalEl.textContent = `${Math.round(total)} min in ${range} days`;
    replace(chartHost, minutesChart(days, localDate(), { dense: range === 30 }));
  };
  await drawChart();

  const reports = await listReports();
  const reportList = reports.length
    ? h('div.list', null, ...reports.map((r) => h('a.list-row', { href: hrefFor('report', {}, [r.id]) },
      h('div.tile.coral', null, icon('chat')),
      h('div.grow', null, h('div.title', null, r.scenarioTitle), h('div.muted.small', null, `${new Date(r.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}, ${Math.round(r.durationSec / 60)} min`)),
      h('span.chip.sm.grey', null, `${Math.round(r.overall)} / 100`))))
    : emptyState('chat', 'coral', 'No reports yet', 'Finish a Talk session to get your first report.');

  add(root, 
    h('div.screen-head', null, h('div', null, h('h1', null, 'Progress'), h('p.subtitle', null, 'Minutes practised, your level, and past conversation reports.'))),
    h('div.activity', null,
      h('div.activity-main', null,
        h('div.card.stack', null,
          h('div.row.between', null, h('div', null, h('h3', null, 'Minutes per day'), totalEl),
            segmented([{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }], range, (v) => {
              range = v;
              try { localStorage.setItem(RANGE_KEY, String(v)); } catch { /* storage blocked */ }
              drawChart();
            }, 'Chart range')),
          chartHost),
        h('div.stack', null, h('h2', null, 'Reports'), reportList)),
      h('div.activity-rail', null, levelCard(lv))));
}
