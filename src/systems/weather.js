/**
 * Basic weather for Maple Valley: Clear, Cloudy and Light Rain.
 * A weighted roll runs every few game hours and on a new day. Transitions
 * last a few dozen real seconds. Lighting is a multiply/tint of the
 * day/night sample so this sits on top of daynight.js (and the recent
 * darker palette) instead of replacing it.
 */

export const WEATHER_STATES = [
  {
    id: 'clear',
    name: 'Clear',
    icon: '☀️',
    nightIcon: '🌙',
    sunInt: 1,
    hemiInt: 1,
    ambientInt: 1,
    tint: 0x000000,
    tintAmount: 0,
    fogNear: 1,
    fogFar: 1
  },
  {
    id: 'cloudy',
    name: 'Cloudy',
    icon: '☁️',
    sunInt: 0.55,
    hemiInt: 0.75,
    ambientInt: 0.8,
    tint: 0x8a94a0,
    tintAmount: 0.32,
    fogNear: 0.7,
    fogFar: 0.78
  },
  {
    id: 'rain',
    name: 'Light Rain',
    icon: '🌧️',
    sunInt: 0.35,
    hemiInt: 0.62,
    ambientInt: 0.68,
    tint: 0x6e7886,
    tintAmount: 0.45,
    fogNear: 0.5,
    fogFar: 0.62
  }
];

export const WEATHER_IDS = WEATHER_STATES.map((s) => s.id);
export const DEFAULT_WEATHER = 'clear';
export const WEATHER_INTERVAL_MINUTES = 3 * 60;
/** Real seconds for a sky / rain fade (not game minutes). */
export const WEATHER_TRANSITION_SECONDS = 25;
export const WEATHER_WEIGHTS = { clear: 0.45, cloudy: 0.35, rain: 0.2 };

function defById(id) {
  for (let i = 0; i < WEATHER_STATES.length; i++) {
    if (WEATHER_STATES[i].id === id) return WEATHER_STATES[i];
  }
  return WEATHER_STATES[0];
}

export function getWeatherState(id) {
  return defById(id);
}

export function weatherIcon(id, period) {
  const def = defById(normalizeWeatherId(id));
  if (def.nightIcon && period === 'night') return def.nightIcon;
  return def.icon;
}

export function normalizeWeatherId(id) {
  if (id === 'auto' || id == null || id === '') return null;
  if (id === 'light-rain' || id === 'lightRain' || id === 'Light Rain') return 'rain';
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

export function pickWeather(rand, weights = WEATHER_WEIGHTS) {
  const u = Number(rand);
  const x = (Number.isFinite(u) ? u : 0) * (
    (Number(weights.clear) || 0) + (Number(weights.cloudy) || 0) + (Number(weights.rain) || 0)
  );
  let acc = Number(weights.clear) || 0;
  if (x < acc) return 'clear';
  acc += Number(weights.cloudy) || 0;
  if (x < acc) return 'cloudy';
  return 'rain';
}

function lerp(a, b, t) { return a + (b - a) * t; }

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
  return { clear: 0, cloudy: 0, rain: 0 };
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

function factorsFromMix(mix) {
  const m = mix || emptyMix();
  let sunInt = 0, hemiInt = 0, ambientInt = 0, tintAmount = 0, fogNear = 0, fogFar = 0;
  let tint = 0;
  let tintW = 0;
  for (let i = 0; i < WEATHER_STATES.length; i++) {
    const def = WEATHER_STATES[i];
    const w = Number(m[def.id]) || 0;
    if (!w) continue;
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
  const sum = (m.clear || 0) + (m.cloudy || 0) + (m.rain || 0) || 1;
  return {
    sunInt: sunInt || 1,
    hemiInt: hemiInt || 1,
    ambientInt: ambientInt || 1,
    tint,
    tintAmount,
    fogNear: fogNear || 1,
    fogFar: fogFar || 1,
    sum
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

export function applyWeatherFog(scene, mix, quality = {}) {
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

function snapshotOf(id, period, extra = {}) {
  const def = defById(id);
  return {
    id: def.id,
    name: def.name,
    icon: weatherIcon(def.id, period),
    ...extra
  };
}

export function createWeather({
  clock = null,
  state = null,
  random = null,
  intervalMinutes = WEATHER_INTERVAL_MINUTES,
  transitionSeconds = WEATHER_TRANSITION_SECONDS
} = {}) {
  const span = intervalMinutes > 0 ? intervalMinutes : WEATHER_INTERVAL_MINUTES;
  const fade = transitionSeconds > 0 ? transitionSeconds : WEATHER_TRANSITION_SECONDS;
  let current = normalizeWeatherId(state) || DEFAULT_WEATHER;
  let from = current;
  let to = current;
  let elapsed = fade;
  let override = null;
  let lastSlot = null;
  const listeners = [];

  function mix() {
    const t = elapsed >= fade ? 1 : elapsed / fade;
    return weatherMix(from, to, t);
  }

  function period() {
    const time = clock && typeof clock.getTime === 'function' ? clock.getTime() : null;
    return time && time.period;
  }

  function get() {
    return snapshotOf(to, period(), {
      from,
      to,
      progress: elapsed >= fade ? 1 : elapsed / fade,
      override,
      rain: mix().rain
    });
  }

  function emit() {
    const value = get();
    for (let i = 0; i < listeners.length; i++) listeners[i](value);
    return value;
  }

  function begin(next, { immediate = false, silent = false } = {}) {
    const id = normalizeWeatherId(next) || DEFAULT_WEATHER;
    const atRest = elapsed >= fade && from === to;
    if (atRest && id === current && id === to) return get();
    if (immediate) {
      current = from = to = id;
      elapsed = fade;
    } else {
      // Mid-fade: start from the current dominant blend, then go to id.
      const m = mix();
      from = m.rain >= m.cloudy && m.rain >= m.clear ? 'rain'
        : (m.cloudy >= m.clear ? 'cloudy' : 'clear');
      to = id;
      current = id;
      elapsed = 0;
    }
    return silent ? get() : emit();
  }

  function roll({ immediate = false, time = null, silent = false } = {}) {
    const t = time || (clock && clock.getTime && clock.getTime()) || null;
    const day = (t && t.day) || 1;
    const slot = t ? weatherSlot(t.totalMinutes, span) : 0;
    const u = typeof random === 'function' ? random(day, slot) : weatherRand(day, slot);
    const next = pickWeather(u);
    lastSlot = slot;
    return begin(next, { immediate, silent });
  }

  function maybeRoll(time) {
    if (override) return;
    if (!time) return;
    const slot = weatherSlot(time.totalMinutes, span);
    if (lastSlot == null) {
      lastSlot = slot;
      return;
    }
    if (slot !== lastSlot) {
      lastSlot = slot;
      roll({ immediate: false, time, silent: false });
    }
  }

  function set(id, opts = {}) {
    const next = normalizeWeatherId(id);
    if (!next) return get();
    return begin(next, opts);
  }

  function setOverride(id) {
    if (id == null || id === 'auto' || id === 'Auto') {
      if (override == null) return get();
      override = null;
      return emit();
    }
    const next = normalizeWeatherId(id);
    if (!next) return get();
    override = next;
    return begin(next, { immediate: false });
  }

  function update(dt, time) {
    if (time) maybeRoll(time);
    if (elapsed < fade) {
      elapsed = Math.min(fade, elapsed + Math.max(0, Number(dt) || 0));
      if (elapsed >= fade) {
        from = to;
        current = to;
      }
    }
    return get();
  }

  function modulate(sample) {
    return modulateLighting(sample, mix());
  }

  function applyFog(scene, quality) {
    return applyWeatherFog(scene, mix(), quality);
  }

  function rainAmount() {
    return mix().rain;
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
    return {
      state: current,
      from,
      to,
      elapsed,
      override,
      lastSlot
    };
  }

  function apply(data) {
    const src = data && data.weather != null ? data.weather : (data || {});
    if (!src || typeof src !== 'object') return get();
    const next = normalizeWeatherId(src.state || src.to || src.id) || DEFAULT_WEATHER;
    const srcFrom = normalizeWeatherId(src.from) || next;
    const srcTo = normalizeWeatherId(src.to) || next;
    current = next;
    from = srcFrom;
    to = srcTo;
    const e = Number(src.elapsed);
    elapsed = Number.isFinite(e) ? Math.max(0, Math.min(fade, e)) : (srcFrom === srcTo ? fade : 0);
    override = normalizeWeatherId(src.override);
    if (src.lastSlot != null && Number.isFinite(Number(src.lastSlot))) lastSlot = Number(src.lastSlot);
    return emit();
  }

  function sync(time, opts = {}) {
    if (!time) return get();
    lastSlot = weatherSlot(time.totalMinutes, span);
    if (opts.roll) return roll({ immediate: !!opts.immediate, time });
    return get();
  }

  if (clock && typeof clock.on === 'function') {
    clock.on('newDay', (e) => {
      if (override) return;
      const time = (e && e.time) || (clock.getTime && clock.getTime());
      if (!time) return;
      const slot = weatherSlot(time.totalMinutes, span);
      if (lastSlot === slot) return;
      lastSlot = slot;
      roll({ immediate: false, time });
    });
  }

  return {
    get,
    set,
    setOverride,
    roll,
    sync,
    update,
    modulate,
    applyFog,
    rainAmount,
    mix,
    onChange,
    off,
    serialize,
    apply,
    getOverride: () => override
  };
}
