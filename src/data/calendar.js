/**
 * Maple Valley's simple calendar. The game clock already stores a 1-based
 * day number (saved with the rest of the game). Months are 30 days and
 * Day 1 is a Monday, so a month is a 7-column grid with weekday names.
 */

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function clampDay(day) {
  const n = Number(day);
  const d = Number.isFinite(n) ? (n | 0) : 1;
  return d < 1 ? 1 : d;
}

/** Break a game day into year / month / day-of-month and weekday (0 = Mon). */
export function calendarDate(day) {
  const d = clampDay(day);
  const month = Math.floor((d - 1) / DAYS_PER_MONTH) + 1;
  const dayOfMonth = ((d - 1) % DAYS_PER_MONTH) + 1;
  const year = Math.floor((month - 1) / MONTHS_PER_YEAR) + 1;
  const monthOfYear = ((month - 1) % MONTHS_PER_YEAR) + 1;
  const weekday = (d - 1) % 7;
  return {
    day: d,
    month,
    monthOfYear,
    year,
    dayOfMonth,
    weekday,
    weekdayName: WEEKDAYS[weekday]
  };
}

/**
 * Cells for a month-style grid covering the month that contains `day`.
 * Leading blanks pad the first week so weekday columns line up.
 */
export function monthGrid(day) {
  const info = calendarDate(day);
  const firstGameDay = (info.month - 1) * DAYS_PER_MONTH + 1;
  const startWeekday = (firstGameDay - 1) % 7;
  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ empty: true, weekday: i });
  }
  for (let n = 1; n <= DAYS_PER_MONTH; n++) {
    const weekday = (startWeekday + n - 1) % 7;
    cells.push({
      empty: false,
      dayOfMonth: n,
      gameDay: firstGameDay + n - 1,
      today: n === info.dayOfMonth,
      weekday,
      weekdayName: WEEKDAYS[weekday]
    });
  }
  return {
    ...info,
    daysInMonth: DAYS_PER_MONTH,
    weekdays: WEEKDAYS.slice(),
    startWeekday,
    cells
  };
}

export function monthTitle(day) {
  const { monthOfYear, year } = calendarDate(day);
  return `Month ${monthOfYear}, Year ${year}`;
}
