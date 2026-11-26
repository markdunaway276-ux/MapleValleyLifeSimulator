/**
 * Calendar phone app: a month-style 30-day grid that highlights today.
 * The day number comes from the game clock (already saved).
 */
import { calendarDate, monthGrid, monthTitle, WEEKDAYS, DAYS_PER_MONTH } from '../../data/calendar.js';

const STYLE_ID = 'phone-calendar-styles';

const CSS = `
.phone-cal-title { margin: 8px 0 2px; }
.phone-cal-sub {
  margin: 0 0 10px;
  font: 600 13px/1.3 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.75);
}
.phone-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  width: 100%;
}
.phone-cal-dow {
  margin: 0;
  padding: 4px 0;
  font: 650 11px/1 system-ui, sans-serif;
  letter-spacing: 0.02em;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
  user-select: none;
}
.phone-cal-cell {
  box-sizing: border-box;
  min-width: 0;
  min-height: 36px;
  height: auto;
  aspect-ratio: 1;
  max-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #fff;
  font: 650 13px/1 system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  user-select: none;
  pointer-events: none;
}
.phone-cal-cell.is-empty { visibility: hidden; }
.phone-cal-cell.is-today {
  background: #3d6cb5;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}
body.mobile .phone-cal-cell {
  min-height: 40px;
  max-height: 48px;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function dayFromCtx(ctx) {
  const t = ctx && typeof ctx.getTime === 'function' ? ctx.getTime() : null;
  const d = t && t.day != null ? t.day : 1;
  return d < 1 ? 1 : d | 0;
}

export function renderCalendarApp(screen, ctx) {
  ensureStyles();
  const title = document.createElement('h3');
  title.className = 'phone-app-title phone-cal-title';
  title.textContent = 'Calendar';
  const sub = document.createElement('p');
  sub.className = 'phone-cal-sub';
  const grid = document.createElement('div');
  grid.className = 'phone-cal-grid';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Calendar');

  function paint() {
    const day = dayFromCtx(ctx);
    const info = monthGrid(day);
    sub.textContent = `Day ${info.day}  ·  ${monthTitle(day)}`;
    grid.replaceChildren();
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const h = document.createElement('div');
      h.className = 'phone-cal-dow';
      h.textContent = WEEKDAYS[i];
      h.setAttribute('aria-hidden', 'true');
      grid.appendChild(h);
    }
    for (let i = 0; i < info.cells.length; i++) {
      const c = info.cells[i];
      const cell = document.createElement('div');
      cell.className = 'phone-cal-cell' + (c.empty ? ' is-empty' : '') + (c.today ? ' is-today' : '');
      cell.setAttribute('role', 'gridcell');
      if (c.empty) {
        cell.textContent = '';
        cell.setAttribute('aria-hidden', 'true');
      } else {
        cell.textContent = String(c.dayOfMonth);
        cell.dataset.day = String(c.dayOfMonth);
        cell.dataset.gameDay = String(c.gameDay);
        if (c.today) {
          cell.setAttribute('aria-current', 'date');
          cell.setAttribute('aria-label', `Day ${c.gameDay}, today`);
        } else {
          cell.setAttribute('aria-label', `Day ${c.gameDay}`);
        }
      }
      grid.appendChild(cell);
    }
    grid.setAttribute('aria-label', `Calendar, ${monthTitle(day)}, Day ${day}`);
  }

  paint();
  screen.append(title, sub, grid);

  let off = null;
  if (ctx && ctx.clock && typeof ctx.clock.on === 'function') {
    off = ctx.clock.on('change', paint);
  }
  return () => { if (typeof off === 'function') off(); };
}

export { calendarDate, monthGrid, monthTitle, WEEKDAYS, DAYS_PER_MONTH };
