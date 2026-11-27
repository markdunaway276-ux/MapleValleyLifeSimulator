/**
 * Data-driven player needs for Maple Valley. Each need is a 0–100 value.
 * More needs can be added to NEED_DEFS later (thirst, fun, etc.).
 *
 * Rates (game time; 1 real second = 1 game minute at the default clock scale):
 *   Hunger  — 100 points over 24 game hours (about 4.17 per hour).
 *   Energy  — 100 points over 20 game hours while idle (5 per hour),
 *             and 50% faster while moving (7.5 per hour).
 * Sleeping restores Energy to 100 (listen for maple-slept / onSlept).
 * Eating a Snack restores HUNGER_SNACK points.
 *
 * Later systems (work, etc.) can call get, set, add, or onChange.
 */

export const NEED_MIN = 0;
export const NEED_MAX = 100;
export const LOW_THRESHOLD = 25;

/** Game minutes for a full Hunger drain. */
export const HUNGER_FULL_MINUTES = 24 * 60;
export const HUNGER_PER_GAME_MINUTE = NEED_MAX / HUNGER_FULL_MINUTES; // 100 / 1440

/** Game minutes for a full Energy drain while idle. */
export const ENERGY_IDLE_FULL_MINUTES = 20 * 60;
export const ENERGY_IDLE_PER_GAME_MINUTE = NEED_MAX / ENERGY_IDLE_FULL_MINUTES; // 100 / 1200

/** Extra Energy drain while moving, as a fraction of the idle rate (50%). */
export const ENERGY_MOVE_FACTOR = 0.5;
export const ENERGY_MOVE_PER_GAME_MINUTE = ENERGY_IDLE_PER_GAME_MINUTE * ENERGY_MOVE_FACTOR;

/** Hunger restored by using one Snack. */
export const HUNGER_SNACK = 40;
/** Energy after a sleep (full rest). */
export const ENERGY_ON_SLEEP = 100;

/** Game minutes for clean clothes to get fully dirty (2 game days). Washing at the laundromat refills it. */
export const CLEAN_FULL_MINUTES = 2 * 24 * 60;
export const CLEAN_PER_GAME_MINUTE = NEED_MAX / CLEAN_FULL_MINUTES;

export const NEED_DEFS = [
  { id: 'hunger', name: 'Hunger', min: NEED_MIN, max: NEED_MAX, default: NEED_MAX },
  { id: 'energy', name: 'Energy', min: NEED_MIN, max: NEED_MAX, default: NEED_MAX },
  { id: 'clean', name: 'Clean', min: NEED_MIN, max: NEED_MAX, default: NEED_MAX }
];

function defById(defs, id) {
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].id === id) return defs[i];
  }
  return null;
}

function clampNeed(def, value) {
  const n = Number(value);
  const v = Number.isFinite(n) ? n : (def.default ?? NEED_MAX);
  const lo = def.min != null ? def.min : NEED_MIN;
  const hi = def.max != null ? def.max : NEED_MAX;
  return v < lo ? lo : v > hi ? hi : v;
}

export function createNeeds({
  defs = NEED_DEFS,
  values = null
} = {}) {
  const list = (defs && defs.length ? defs : NEED_DEFS).map((d) => ({ ...d }));
  const state = Object.create(null);
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const seed = values && values[d.id] != null ? values[d.id] : d.default;
    state[d.id] = clampNeed(d, seed);
  }

  const listeners = { change: [] };
  let developmentMode = false;

  function emit() {
    const snap = snapshot();
    const fns = listeners.change;
    for (let i = 0; i < fns.length; i++) fns[i](snap);
    return snap;
  }

  function snapshot() {
    const valuesOut = {};
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const value = get(d.id);
      valuesOut[d.id] = value;
      items.push({
        id: d.id,
        name: d.name,
        value,
        min: d.min != null ? d.min : NEED_MIN,
        max: d.max != null ? d.max : NEED_MAX,
        low: value <= LOW_THRESHOLD
      });
    }
    return { values: valuesOut, items };
  }

  function get(id) {
    if (id == null) return snapshot();
    if (developmentMode && state[id] != null) return defById(list, id).max ?? NEED_MAX;
    return state[id];
  }

  function set(id, value) {
    const def = defById(list, id);
    if (!def) return undefined;
    if (developmentMode) return get(id);
    const next = clampNeed(def, value);
    if (next === state[id]) return next;
    state[id] = next;
    emit();
    return next;
  }

  function add(id, delta) {
    if (state[id] == null) return undefined;
    return set(id, state[id] + (Number(delta) || 0));
  }

  function refill(id) {
    if (developmentMode) return get();
    if (id) {
      const def = defById(list, id);
      if (!def) return get();
      set(id, def.max != null ? def.max : NEED_MAX);
      return get();
    }
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const hi = d.max != null ? d.max : NEED_MAX;
      if (state[d.id] !== hi) { state[d.id] = hi; changed = true; }
    }
    if (changed) emit();
    return get();
  }

  function drain(id) {
    if (developmentMode) return get();
    if (id) {
      const def = defById(list, id);
      if (!def) return get();
      set(id, def.min != null ? def.min : NEED_MIN);
      return get();
    }
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const lo = d.min != null ? d.min : NEED_MIN;
      if (state[d.id] !== lo) { state[d.id] = lo; changed = true; }
    }
    if (changed) emit();
    return get();
  }

  /**
   * Apply decay for `gameMinutes` of simulated time.
   * Pass { moving: true } to use the faster Energy rate.
   * Pass { sleep: true } or { hungerOnly: true } to decay Hunger only
   * (Energy is handled by the sleep hook or a job's own drain).
   */
  function update(gameMinutes, opts = {}) {
    if (developmentMode) return get();
    const dt = Number(gameMinutes);
    if (!(dt > 0)) return get();
    let changed = false;
    if (state.hunger != null) {
      const def = defById(list, 'hunger');
      const next = clampNeed(def, state.hunger - dt * HUNGER_PER_GAME_MINUTE);
      if (next !== state.hunger) { state.hunger = next; changed = true; }
    }
    if (state.clean != null) {
      const def = defById(list, 'clean');
      const next = clampNeed(def, state.clean - dt * CLEAN_PER_GAME_MINUTE);
      if (next !== state.clean) { state.clean = next; changed = true; }
    }
    if (!opts.sleep && !opts.hungerOnly && state.energy != null) {
      const def = defById(list, 'energy');
      let rate = ENERGY_IDLE_PER_GAME_MINUTE;
      if (opts.moving) rate += ENERGY_MOVE_PER_GAME_MINUTE;
      const next = clampNeed(def, state.energy - dt * rate);
      if (next !== state.energy) { state.energy = next; changed = true; }
    }
    if (changed) emit();
    return get();
  }

  /** Restore Energy after a sleep. Optionally decay Hunger for the time skipped. */
  function applySleep(detail = {}) {
    const before = detail.before;
    const after = detail.after;
    let mins = Number(detail.minutes);
    if (!Number.isFinite(mins) && before && after && before.totalMinutes != null && after.totalMinutes != null) {
      mins = after.totalMinutes - before.totalMinutes;
    }
    if (mins > 0) update(mins, { moving: false, sleep: true });
    set('energy', ENERGY_ON_SLEEP);
    return get();
  }

  function serialize() {
    const out = {};
    for (let i = 0; i < list.length; i++) out[list[i].id] = state[list[i].id];
    return out;
  }

  function apply(data) {
    const raw = (data && data.needs && typeof data.needs === 'object') ? data.needs : (data || {});
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (raw[d.id] == null) continue;
      const next = clampNeed(d, raw[d.id]);
      if (next !== state[d.id]) { state[d.id] = next; changed = true; }
    }
    if (changed) emit();
    return get();
  }

  function on(name, fn) {
    if (!listeners[name] || typeof fn !== 'function') return () => {};
    listeners[name].push(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const listn = listeners[name];
    if (!listn) return;
    const i = listn.indexOf(fn);
    if (i >= 0) listn.splice(i, 1);
  }

  function onChange(fn) {
    return on('change', fn);
  }

  return {
    get,
    set,
    add,
    update,
    refill,
    drain,
    applySleep,
    serialize,
    apply,
    on,
    off,
    onChange,
    defs: list,
    LOW_THRESHOLD,
    isDevelopmentMode: () => developmentMode,
    setDevelopmentMode(on) {
      if (developmentMode === !!on) return;
      developmentMode = !!on;
      emit();
    }
  };
}
