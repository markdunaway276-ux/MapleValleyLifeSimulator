/**
 * Calendar phone app: a month-style 30-day grid that highlights today.
 * The day number comes from the game clock (already saved).
 */
import { calendarDate, monthGrid, monthTitle, WEEKDAYS, DAYS_PER_MONTH } from '../../data/calendar.js';
import { MARKET_WEEKDAY, DERBY_WEEKDAY, eventForDay } from '../../systems/townEvents.js';

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
  position: relative;
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
.phone-cal-cell.is-event-market::after,
.phone-cal-cell.is-event-derby::after {
  content: '';
  position: absolute;
  bottom: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.phone-cal-cell.is-event-market::after { background: #6ad47c; }
.phone-cal-cell.is-event-derby::after { background: #f3c44e; }
body.mobile .phone-cal-cell {
  min-height: 40px;
  max-height: 48px;
}
.phone-cal-events {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.phone-cal-ev {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font: 500 11.5px/1.35 system-ui, sans-serif;
  color: rgba(240, 245, 255, 0.88);
}
.phone-cal-ev.is-live {
  background: rgba(68, 138, 92, 0.22);
  border-color: rgba(124, 214, 148, 0.45);
}
.phone-cal-ev-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 650;
  margin-bottom: 2px;
}
.phone-cal-live-pill {
  padding: 1px 6px;
  border-radius: 999px;
  background: #48a868;
  color: #fff;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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
  const eventsBox = document.createElement('div');
  eventsBox.className = 'phone-cal-events';

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
      const evClass = !c.empty && c.weekday === MARKET_WEEKDAY
        ? ' is-event-market'
        : (!c.empty && c.weekday === DERBY_WEEKDAY ? ' is-event-derby' : '');
      cell.className = 'phone-cal-cell' + (c.empty ? ' is-empty' : '') + (c.today ? ' is-today' : '') + evClass;
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

    // Render live weekly town events schedule
    eventsBox.replaceChildren();
    const status = ctx && typeof ctx.getTownEvents === 'function' ? ctx.getTownEvents() : null;
    const todayEv = eventForDay(day);
    const rows = [
      {
        live: !!(status ? status.marketOpen : todayEv?.id === 'farmers-market'),
        head: "🧺 Sat · Park Farmers' Market",
        detail: '8 AM–6 PM · Maple Lane Park Plaza · Rotating treats & +20% produce bonus'
      },
      {
        live: !!(status ? status.derbyOpen : todayEv?.id === 'fishing-derby'),
        head: '🏆 Sun · Pond Fishing Derby',
        detail: status && status.derbyOpen
          ? `Live now! Your score: ${status.derbyPoints} pts${status.hasTrophy ? ' · Trophy Won' : ''}`
          : `7 AM–7 PM · Maple Lane Pond${status && status.hasTrophy ? ' · Golden Trophy Won!' : ' · Win $45 & Trophy'}`
      }
    ];
    for (const r of rows) {
      const card = document.createElement('div');
      card.className = 'phone-cal-ev' + (r.live ? ' is-live' : '');
      const head = document.createElement('div');
      head.className = 'phone-cal-ev-head';
      const label = document.createElement('span');
      label.textContent = r.head;
      head.appendChild(label);
      if (r.live) {
        const pill = document.createElement('span');
        pill.className = 'phone-cal-live-pill';
        pill.textContent = 'Live';
        head.appendChild(pill);
      }
      const desc = document.createElement('div');
      desc.textContent = r.detail;
      card.append(head, desc);
      eventsBox.appendChild(card);
    }
  }

  paint();
  screen.append(title, sub, grid, eventsBox);

  let off = null;
  if (ctx && ctx.clock && typeof ctx.clock.on === 'function') {
    off = ctx.clock.on('change', paint);
  }
  return () => { if (typeof off === 'function') off(); };
}

export { calendarDate, monthGrid, monthTitle, WEEKDAYS, DAYS_PER_MONTH };
