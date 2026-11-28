/**
 * Gradual weather for Maple Lane.
 *
 * Weather moves one step at a time along a chain instead of jumping:
 *
 *   clear ↔ partly cloudy ↔ overcast ↔ drizzle ↔ rain        (mild days)
 *                              overcast ↔ flurries ↔ snow     (cold days)
 *
 * Each step blends over STEP_MINUTES of game time, and a new step is only
 * considered every WEATHER_INTERVAL_MINUTES once the sky has settled, so a
 * clear morning takes hours to build into a downpour. Snow builds up on the
 * ground while it falls and melts slowly afterwards (snowCover).
 *
 * Lighting is a multiply/tint of the day/night sample so this sits on top
 * of daynight.js instead of replacing it.
 */

export const WEATHER_STATES = [
  { id: 'clear', name: 'Clear', icon: '☀️', nightIcon: '🌙',
    sunInt: 1, hemiInt: 1, ambientInt: 1, tint: 0x000000, tintAmount: 0,
    fogNear: 1, fogFar: 1, cloud: 0.3, rain: 0, snow: 0 },
  { id: 'partly', name: 'Partly Cloudy', icon: '🌤️', nightIcon: '☁️',
    sunInt: 0.85, hemiInt: 0.9, ambientInt: 0.92, tint: 0x9aa4ae, tintAmount: 0.14,
    fogNear: 0.9, fogFar: 0.92, cloud: 0.55, rain: 0, snow: 0 },
  { id: 'cloudy', name: 'Overcast', icon: '☁️',
    sunInt: 0.52, hemiInt: 0.74, ambientInt: 0.8, tint: 0x8a94a0, tintAmount: 0.32,
    fogNear: 0.7, fogFar: 0.78, cloud: 0.8, rain: 0, snow: 0 },
  { id: 'drizzle', name: 'Drizzle', icon: '🌦️',
    sunInt: 0.42, hemiInt: 0.66, ambientInt: 0.73, tint: 0x7a8592, tintAmount: 0.4,
    fogNear: 0.58, fogFar: 0.7, cloud: 0.86, rain: 0.38, snow: 0 },
  { id: 'rain', name: 'Rain', icon: '🌧️',
    sunInt: 0.32, hemiInt: 0.6, ambientInt: 0.66, tint: 0x6e7886, tintAmount: 0.48,
    fogNear: 0.48, fogFar: 0.6, cloud: 0.92, rain: 1, snow: 0 },
  { id: 'flurries', name: 'Flurries', icon: '🌨️',
    sunInt: 0.46, hemiInt: 0.72, ambientInt: 0.82, tint: 0xb4bcc6, tintAmount: 0.38,
    fogNear: 0.6, fogFar: 0.7, cloud: 0.86, rain: 0, snow: 0.4 },
  { id: 'snow', name: 'Snow', icon: '❄️',
    sunInt: 0.38, hemiInt: 0.72, ambientInt: 0.84, tint: 0xc6ccd4, tintAmount: 0.5,
    fogNear: 0.42, fogFar: 0.52, cloud: 0.94, rain: 0, snow: 1 }
];

export const WEATHER_IDS = WEATHER_STATES.map((s) => s.id);
export const DEFAULT_WEATHER = 'clear';
/** Game minutes between chances for the weather to take its next step. */
export const WEATHER_INTERVAL_MINUTES = 90;
/** Game minutes one step (e.g. overcast → drizzle) takes to blend in. */
export const STEP_MINUTES = 75;
/** Real seconds for a debug override fade. */
export const WEATHER_TRANSITION_SECONDS = 20;
/** Kept for older callers: rough share of time in each broad state. */
export const WEATHER_WEIGHTS = { clear: 0.4, partly: 0.3, cloudy: 0.3 };
export const COLD_DAY_CHANCE = 0.3;
/** Index of the guaranteed early 3-day cold spell (days 4–6). */
export const FIRST_COLD_SPELL = 1;
/** Game minutes of full snowfall to cover the ground. */
export const SNOW_BUILD_MINUTES = 240;
/** Game minutes to melt a full cover on a cold / mild day (rain doubles it). */
export const SNOW_MELT_COLD_MINUTES = 900;
export const SNOW_MELT_MILD_MINUTES = 200;

const STATE_BY_ID = Object.fromEntries(WEATHER_STATES.map((s) => [s.id, s]));

function defById(id) {
  return STATE_BY_ID[id] || STATE_BY_ID[DEFAULT_WEATHER];
}

export function getWeatherState(id) {
  return defById(id);
}

export function weatherIcon(id, period) {
  const def = defById(normalizeWeatherId(id));
  if (def.nightIcon && period === 'night') return def.nightIcon;
  return def.icon;
}

const ALIASES = {
  'light-rain': 'rain', lightRain: 'rain', 'Light Rain': 'rain',
  overcast: 'cloudy', 'partly-cloudy': 'partly', partlyCloudy: 'partly',
  'light-snow': 'flurries', heavyRain: 'rain'
};

export function normalizeWeatherId(id) {
  if (id === 'auto' || id == null || id === '') return null;
  if (ALIASES[id]) return ALIASES[id];
  for (let i = 0; i < WEATHER_STATES.length; i++) {
    if (WEATHER_STATES[i].id === id || WEATHER_STATES[i].name === id) return WEATHER_STATES[i].id;
  }
  return null;
}

/** Deterministic 0..1 from a 1-based day and an interval slot. */
export function weatherRand(day, slot) {
  let x = ((day | 0) * 374761393) ^ ((slot | 0) * 668265263);
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

export function weatherSlot(totalMinutes, interval = WEATHER_INTERVAL_MINUTES) {
  const t = Number(totalMinutes);
  const span = interval > 0 ? interval : WEATHER_INTERVAL_MINUTES;
  if (!Number.isFinite(t)) return 0;
  return Math.floor(Math.max(0, t) / span);
}

/** Cold days can snow; mild days can rain. Same answer for the same day. */
export function isColdDay(day) {
  // Cold weather arrives in 3-day spells so snow has time to build up.
  const spell = Math.floor(((day | 0) - 1) / 3);
  if (spell === FIRST_COLD_SPELL) return true; // days 4–6: the first cold snap
  return weatherRand(spell + 11, 7777) < COLD_DAY_CHANCE;
}

/** Rough °F for the HUD/phone: daily low near 4 AM, high near 3 PM. */
export function temperatureF(day, minutes = 12 * 60) {
  const cold = isColdDay(day);
  const base = cold ? 22 + weatherRand(day, 8111) * 7 : 50 + weatherRand(day, 8111) * 18;
  const swing = cold ? 6 : 9;
  const m = Number(minutes) || 0;
  const h = (((m - 4 * 60) % 1440) + 1440) % 1440 / 60; // hours since 4 AM
  const warmth = h <= 11 ? smoothstep(h / 11) : 1 - smoothstep((h - 11) / 13);
  return Math.round(base - swing / 2 + swing * warmth);
}

/** Pick a calm starting sky (no rain or snow at the very start). */
export function pickWeather(rand, weights = WEATHER_WEIGHTS) {
  const u = Number(rand);
  const ids = Object.keys(weights);
  let total = 0;
  for (const id of ids) total += Number(weights[id]) || 0;
  const x = (Number.isFinite(u) ? u : 0) * total;
  let acc = 0;
  for (const id of ids) {
    acc += Number(weights[id]) || 0;
    if (x < acc) return normalizeWeatherId(id) || DEFAULT_WEATHER;
  }
  return normalizeWeatherId(ids[ids.length - 1]) || DEFAULT_WEATHER;
}

/**
 * The only moves allowed from each state: stay, or one step to a neighbour.
 * Cold days steer precipitation to snow; mild days steer it to rain and
 * wind any snow back down (snow → flurries → overcast).
 */
export function nextWeatherOptions(id, cold) {
  switch (normalizeWeatherId(id) || DEFAULT_WEATHER) {
    case 'clear': return { clear: 0.65, partly: 0.35 };
    case 'partly': return { clear: 0.35, partly: 0.35, cloudy: 0.3 };
    case 'cloudy': return cold ? { partly: 0.3, cloudy: 0.3, flurries: 0.4 } : { partly: 0.35, cloudy: 0.35, drizzle: 0.3 };
    case 'drizzle': return cold ? { cloudy: 0.7, drizzle: 0.3 } : { cloudy: 0.4, drizzle: 0.3, rain: 0.3 };
    case 'rain': return cold ? { drizzle: 1 } : { drizzle: 0.5, rain: 0.5 };
    case 'flurries': return cold ? { cloudy: 0.3, flurries: 0.3, snow: 0.4 } : { cloudy: 0.7, flurries: 0.3 };
    case 'snow': return cold ? { flurries: 0.4, snow: 0.6 } : { flurries: 1 };
    default: return { clear: 1 };
  }
}

export function stepWeather(id, cold, rand) {
  return pickWeather(rand, nextWeatherOptions(id, cold));
}

function lerpHex(a, b, t) {
  const av = Number(a) || 0;
  const bv = Number(b) || 0;
  const ar = (av >> 16) & 255, ag = (av >> 8) & 255, ab = av & 255;
  const br = (bv >> 16) & 255, bg = (bv >> 8) & 255, bb = bv & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function smoothstep(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function emptyMix() {
  const m = {};
  for (const s of WEATHER_STATES) m[s.id] = 0;
  return m;
}

/** Blend weights for the current (and in-flight) weather. */
export function weatherMix(fromId, toId, progress) {
  const mix = emptyMix();
  const from = normalizeWeatherId(fromId) || DEFAULT_WEATHER;
  const to = normalizeWeatherId(toId) || from;
  const t = smoothstep(progress);
  mix[from] += 1 - t;
  mix[to] += t;
  return mix;
}

/** Weighted average of one numeric field of the states in a mix. */
export function mixAmount(mix, field) {
  let v = 0;
  for (const s of WEATHER_STATES) v += (Number(mix && mix[s.id]) || 0) * (s[field] || 0);
  return v;
}

function factorsFromMix(mix) {
  const m = mix || emptyMix();
  let sunInt = 0, hemiInt = 0, ambientInt = 0, tintAmount = 0, fogNear = 0, fogFar = 0, sum = 0;
  let tint = 0;
  let tintW = 0;
  for (const def of WEATHER_STATES) {
    const w = Number(m[def.id]) || 0;
    if (!w) continue;
    sum += w;
    sunInt += def.sunInt * w;
    hemiInt += def.hemiInt * w;
    ambientInt += def.ambientInt * w;
    fogNear += def.fogNear * w;
    fogFar += def.fogFar * w;
    if (def.tintAmount > 0) {
      if (!tintW) tint = def.tint;
      else tint = lerpHex(tint, def.tint, w / (tintW + w));
      tintW += w;
      tintAmount += def.tintAmount * w;
    }
  }
  return {
    sunInt: sunInt || 1,
    hemiInt: hemiInt || 1,
    ambientInt: ambientInt || 1,
    tint,
    tintAmount,
    fogNear: fogNear || 1,
    fogFar: fogFar || 1,
    sum: sum || 1
  };
}

/**
 * Multiply / tint a day/night lighting sample. sunPos and the interior
 * night factor are left alone so this cannot fight daynight.js.
 */
export function modulateLighting(sample, mix) {
  if (!sample) return sample;
  const f = factorsFromMix(mix);
  const t = f.tintAmount;
  const out = { ...sample };
  if (t > 0) {
    out.skyTop = lerpHex(sample.skyTop, f.tint, t);
    out.skyBottom = lerpHex(sample.skyBottom, f.tint, t);
    out.fog = lerpHex(sample.fog, f.tint, t);
    out.hemiSky = lerpHex(sample.hemiSky, f.tint, t * 0.7);
    out.ambient = lerpHex(sample.ambient, f.tint, t * 0.4);
    out.sun = lerpHex(sample.sun, f.tint, t * 0.25);
  }
  out.sunInt = sample.sunInt * f.sunInt;
  out.hemiInt = sample.hemiInt * f.hemiInt;
  out.ambientInt = sample.ambientInt * f.ambientInt;
  out.fogNear = f.fogNear;
  out.fogFar = f.fogFar;
  return out;
}

export function applyWeatherFog(scene, mix) {
  if (!scene || !scene.fog) return null;
  const fog = scene.fog;
  if (!fog.userData) fog.userData = {};
  if (fog.userData.baseNear == null) fog.userData.baseNear = fog.near;
  if (fog.userData.baseFar == null) fog.userData.baseFar = fog.far;
  const f = factorsFromMix(mix);
  const baseNear = fog.userData.baseNear;
  const baseFar = fog.userData.baseFar;
  fog.near = baseNear * f.fogNear;
  fog.far = baseFar * f.fogFar;
  return { near: fog.near, far: fog.far, baseNear, baseFar };
}

/** Advance ground snow cover by dm game minutes. */
export function advanceSnowCover(cover, { snow = 0, rain = 0, cold = false, minutes = 0 } = {}) {
  let c = Math.max(0, Math.min(1, Number(cover) || 0));
  const dm = Math.max(0, Number(minutes) || 0);
  if (!dm) return c;
  if (snow > 0.05) {
    c += (snow * dm) / SNOW_BUILD_MINUTES;
  } else if (c > 0) {
    const melt = (cold ? SNOW_MELT_COLD_MINUTES : SNOW_MELT_MILD_MINUTES) / (rain > 0.1 ? 2 : 1);
    c -= dm / melt;
  }
  return Math.max(0, Math.min(1, c));
}

function dominant(mix) {
  let best = DEFAULT_WEATHER, bw = -1;
  for (const s of WEATHER_STATES) {
    if ((mix[s.id] || 0) > bw) { bw = mix[s.id]; best = s.id; }
  }
  return best;
}

export function createWeather({
  clock = null,
  state = null,
  random = null,
  intervalMinutes = WEATHER_INTERVAL_MINUTES,
  stepMinutes = STEP_MINUTES,
  transitionSeconds = WEATHER_TRANSITION_SECONDS
} = {}) {
  const span = intervalMinutes > 0 ? intervalMinutes : WEATHER_INTERVAL_MINUTES;
  const step = stepMinutes > 0 ? stepMinutes : STEP_MINUTES;
  const fastSeconds = transitionSeconds > 0 ? transitionSeconds : WEATHER_TRANSITION_SECONDS;
  let current = normalizeWeatherId(state) || DEFAULT_WEATHER;
  let from = current;
  let to = current;
  let progress = 1;
  let fast = false;
  let override = null;
  let lastSlot = null;
  let lastMinutes = null;
  let snowCover = 0;
  const listeners = [];

  const rand = (day, slot) => (typeof random === 'function' ? random(day, slot) : weatherRand(day, slot));
  const nowTime = () => (clock && typeof clock.getTime === 'function' ? clock.getTime() : null);
  const atRest = () => progress >= 1;

  function mix() {
    return weatherMix(from, to, progress >= 1 ? 1 : progress);
  }

  function get() {
    const time = nowTime();
    const m = mix();
    const day = (time && time.day) || 1;
    return {
      ...snapshotOf(to, time && time.period),
      from,
      to,
      progress: progress >= 1 ? 1 : progress,
      override,
      rain: mixAmount(m, 'rain'),
      snow: mixAmount(m, 'snow'),
      cloud: mixAmount(m, 'cloud'),
      snowCover,
      cold: isColdDay(day),
      tempF: temperatureF(day, time ? time.minutes : 12 * 60)
    };
  }

  function snapshotOf(id, period) {
    const def = defById(id);
    return { id: def.id, name: def.name, icon: weatherIcon(def.id, period) };
  }

  function emit() {
    const value = get();
    for (let i = 0; i < listeners.length; i++) listeners[i](value);
    return value;
  }

  function begin(next, { immediate = false, silent = false, quick = false } = {}) {
    const id = normalizeWeatherId(next) || DEFAULT_WEATHER;
    if (atRest() && id === to) return get();
    if (immediate) {
      current = from = to = id;
      progress = 1;
      fast = false;
    } else {
      // Mid-fade: start from whatever is mostly showing now.
      from = atRest() ? to : dominant(mix());
      to = id;
      current = id;
      progress = from === to ? 1 : 0;
      fast = !!quick;
    }
    return silent ? get() : emit();
  }

  /** Take at most one step along the chain (or stay put). */
  function roll({ immediate = false, time = null, silent = false } = {}) {
    const t = time || nowTime();
    const day = (t && t.day) || 1;
    const slot = t ? weatherSlot(t.totalMinutes, span) : 0;
    lastSlot = slot;
    const next = stepWeather(to, isColdDay(day), rand(day, slot));
    return begin(next, { immediate, silent });
  }

  /** New game: a calm sky to start, no rain or snow. */
  function start({ time = null } = {}) {
    const t = time || nowTime();
    const day = (t && t.day) || 1;
    const slot = t ? weatherSlot(t.totalMinutes, span) : 0;
    lastSlot = slot;
    lastMinutes = t ? t.totalMinutes : null;
    snowCover = 0;
    return begin(pickWeather(rand(day, slot)), { immediate: true });
  }

  function crossSlots(time) {
    if (override) return;
    const slot = weatherSlot(time.totalMinutes, span);
    if (lastSlot == null) { lastSlot = slot; return; }
    if (slot <= lastSlot) { if (slot < lastSlot) lastSlot = slot; return; }
    const crossed = Math.min(16, slot - lastSlot);
    // Normally one slot at a time; a long skip (sleep) plays several steps instantly.
    for (let i = crossed - 1; i >= 0; i--) {
      if (!atRest() && i === 0) { lastSlot = slot; return; } // wait for the sky to settle
      const s = slot - i;
      const day = Math.floor(s * span / (24 * 60)) + 1;
      const next = stepWeather(to, isColdDay(day), rand(day, s));
      lastSlot = s;
      if (i > 0) begin(next, { immediate: true, silent: true });
      else begin(next);
    }
    lastSlot = slot;
  }

  function set(id, opts = {}) {
    const next = normalizeWeatherId(id);
    if (!next) return get();
    return begin(next, opts);
  }

  /** Debug override: fades over ~20 real seconds so testing stays quick. */
  function setOverride(id) {
    if (id == null || id === 'auto' || id === 'Auto') {
      if (override == null) return get();
      override = null;
      return emit();
    }
    const next = normalizeWeatherId(id);
    if (!next) return get();
    override = next;
    return begin(next, { quick: true });
  }

  function update(dt, time) {
    const realDt = Math.max(0, Number(dt) || 0);
    let dm;
    if (time && Number.isFinite(time.totalMinutes)) {
      dm = lastMinutes == null ? 0 : Math.max(0, time.totalMinutes - lastMinutes);
      lastMinutes = time.totalMinutes;
    } else {
      dm = realDt; // no clock: assume the default 1 game minute per real second
    }
    if (!atRest()) {
      progress = Math.min(1, progress + (fast ? realDt / fastSeconds : dm / step));
      if (progress >= 1) { from = to; current = to; fast = false; emit(); }
    }
    if (time) crossSlots(time);
    const day = (time && time.day) || 1;
    const m = mix();
    snowCover = advanceSnowCover(snowCover, {
      snow: mixAmount(m, 'snow'), rain: mixAmount(m, 'rain'), cold: isColdDay(day), minutes: dm
    });
    return get();
  }

  function modulate(sample) {
    return modulateLighting(sample, mix());
  }

  function applyFog(scene) {
    return applyWeatherFog(scene, mix());
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => off(fn);
  }

  function off(fn) {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  }

  function serialize() {
    return { state: current, from, to, progress, override, lastSlot, snowCover };
  }

  function apply(data) {
    const src = data && data.weather != null ? data.weather : (data || {});
    if (!src || typeof src !== 'object') {
      const id = normalizeWeatherId(src);
      if (id) begin(id, { immediate: true, silent: true });
      return get();
    }
    const next = normalizeWeatherId(src.state || src.to || src.id) || DEFAULT_WEATHER;
    current = next;
    from = normalizeWeatherId(src.from) || next;
    to = normalizeWeatherId(src.to) || next;
    const p = Number(src.progress);
    const oldElapsed = Number(src.elapsed); // saves from the 25-second version
    if (Number.isFinite(p)) progress = Math.max(0, Math.min(1, p));
    else if (Number.isFinite(oldElapsed)) progress = Math.max(0, Math.min(1, oldElapsed / 25));
    else progress = from === to ? 1 : 0;
    if (from === to) progress = 1;
    fast = false;
    override = normalizeWeatherId(src.override);
    if (src.lastSlot != null && Number.isFinite(Number(src.lastSlot))) lastSlot = Number(src.lastSlot);
    const c = Number(src.snowCover);
    snowCover = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;
    lastMinutes = null;
    return emit();
  }

  function sync(time, opts = {}) {
    if (!time) return get();
    lastSlot = weatherSlot(time.totalMinutes, span);
    lastMinutes = time.totalMinutes;
    if (opts.roll) return roll({ immediate: !!opts.immediate, time });
    return get();
  }

  return {
    get,
    set,
    setOverride,
    roll,
    start,
    sync,
    update,
    modulate,
    applyFog,
    rainAmount: () => mixAmount(mix(), 'rain'),
    snowAmount: () => mixAmount(mix(), 'snow'),
    cloudAmount: () => mixAmount(mix(), 'cloud'),
    snowCover: () => snowCover,
    mix,
    onChange,
    off,
    serialize,
    apply,
    getOverride: () => override
  };
}
