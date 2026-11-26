/**
 * Game clock for Maple Valley. 1 real second = 1 game minute at the default
 * scale (a full day lasts 24 real minutes). Later systems hook into this:
 * sleep calls advance(), needs decay over time, daily mail uses onNewDay,
 * and work shifts pass game time.
 *
 * Time is stored as a 1-based day number plus minutes past midnight [0, 1440).
 */

export const MINUTES_PER_DAY = 24 * 60;
export const DEFAULT_START_MINUTES = 8 * 60; // 08:00
export const DEFAULT_SCALE = 60; // game-seconds per real second (1s = 1 game min)
export const DEFAULT_DAY = 1;

export function wrapMinutes(m) {
  const n = MINUTES_PER_DAY;
  const x = Number(m) || 0;
  return ((x % n) + n) % n;
}

export function periodAt(minutes) {
  const h = wrapMinutes(minutes) / 60;
  if (h >= 5.5 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}

export function formatClock(minutes, day = 1) {
  const m = Math.floor(wrapMinutes(minutes));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `Day ${Math.max(1, day | 0)}  ${hh}:${mm}`;
}

function snapshot(clock) {
  const minutes = wrapMinutes(clock.minutes);
  return {
    minutes,
    hour: Math.floor(minutes / 60),
    minute: Math.floor(minutes) % 60,
    day: clock.day,
    totalMinutes: (clock.day - 1) * MINUTES_PER_DAY + minutes,
    period: periodAt(minutes),
    fraction: minutes / MINUTES_PER_DAY,
    paused: clock.paused,
    scale: clock.scale,
    label: formatClock(minutes, clock.day)
  };
}

export function createClock({
  minutes = DEFAULT_START_MINUTES,
  day = DEFAULT_DAY,
  scale = DEFAULT_SCALE,
  paused = false
} = {}) {
  const listeners = { change: [], newDay: [] };

  const clock = {
    minutes: wrapMinutes(minutes),
    day: Math.max(1, day | 0),
    scale: Number(scale) > 0 ? Number(scale) : DEFAULT_SCALE,
    paused: !!paused
  };

  function emit(name, payload) {
    const list = listeners[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }

  function getTime() {
    return snapshot(clock);
  }

  function setTime(value, { silent = false } = {}) {
    if (typeof value === 'number') {
      clock.minutes = wrapMinutes(value);
    } else if (value && typeof value === 'object') {
      if (value.day != null) clock.day = Math.max(1, value.day | 0);
      if (value.hour != null || value.hours != null) {
        const h = value.hour != null ? value.hour : value.hours;
        const m = value.minute != null ? value.minute : (value.minutes != null ? value.minutes : 0);
        clock.minutes = wrapMinutes(h * 60 + m);
      } else if (value.minutes != null) {
        clock.minutes = wrapMinutes(value.minutes);
      }
    }
    if (!silent) emit('change', getTime());
    return getTime();
  }

  function advance(deltaMinutes, { fromTick = false } = {}) {
    const d = Number(deltaMinutes);
    if (!d) return getTime();
    const prevFloor = Math.floor(wrapMinutes(clock.minutes));
    let next = clock.minutes + d;
    let day = clock.day;
    const crossed = [];
    while (next >= MINUTES_PER_DAY) {
      next -= MINUTES_PER_DAY;
      day += 1;
      crossed.push(day);
    }
    while (next < 0) {
      next += MINUTES_PER_DAY;
      day = Math.max(1, day - 1);
    }
    clock.minutes = wrapMinutes(next);
    clock.day = day;
    for (let i = 0; i < crossed.length; i++) emit('newDay', { day: crossed[i], time: snapshot(clock) });
    const nowFloor = Math.floor(clock.minutes);
    if (!fromTick || nowFloor !== prevFloor || crossed.length) emit('change', getTime());
    return getTime();
  }

  function tick(deltaSeconds) {
    if (clock.paused) return getTime();
    const dt = Math.max(0, Number(deltaSeconds) || 0);
    if (!dt) return getTime();
    // scale is game-seconds per real second; 60 scale → 1 game minute per real second.
    return advance((dt * clock.scale) / 60, { fromTick: true });
  }

  function setPaused(p) {
    clock.paused = !!p;
    emit('change', getTime());
    return getTime();
  }

  function setScale(s) {
    const n = Number(s);
    clock.scale = n > 0 ? n : DEFAULT_SCALE;
    emit('change', getTime());
    return getTime();
  }

  function on(name, fn) {
    if (!listeners[name] || typeof fn !== 'function') return () => {};
    listeners[name].push(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const list = listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  function serialize() {
    return {
      minutes: wrapMinutes(clock.minutes),
      day: clock.day,
      paused: !!clock.paused,
      scale: clock.scale
    };
  }

  function apply(data) {
    const t = (data && data.time) ? data.time : (data || {});
    if (t.day != null) clock.day = Math.max(1, t.day | 0);
    if (t.minutes != null) clock.minutes = wrapMinutes(t.minutes);
    if (t.scale != null && Number(t.scale) > 0) clock.scale = Number(t.scale);
    if (t.paused != null) clock.paused = !!t.paused;
    return getTime();
  }

  return {
    getTime,
    setTime,
    advance,
    tick,
    setPaused,
    setScale,
    isPaused: () => clock.paused,
    getScale: () => clock.scale,
    on,
    off,
    serialize,
    apply
  };
}
