/**
 * Device settings (not part of a save slot): look sensitivity, invert look,
 * field of view, sound volumes and graphics quality. Stored in localStorage
 * like mute and the display settings (display.js), so they follow the device,
 * not the save.
 */

export const SETTINGS_KEY = 'mapleValleyLife_settings';
export const QUALITY_LEVELS = Object.freeze(['auto', 'low', 'medium', 'high']);

export const SETTINGS_DEFAULTS = Object.freeze({
  sensitivity: 1,
  touchLookSpeed: 1.6,
  invertY: false,
  fov: 70,
  volume: Object.freeze({ master: 1, effects: 1, ambience: 1 }),
  quality: 'auto'
});

const clamp = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const v = s.volume && typeof s.volume === 'object' ? s.volume : {};
  const D = SETTINGS_DEFAULTS;
  return {
    sensitivity: clamp(s.sensitivity, 0.2, 3, D.sensitivity),
    touchLookSpeed: clamp(s.touchLookSpeed ?? D.touchLookSpeed, 0.5, 3, D.touchLookSpeed),
    invertY: !!s.invertY,
    fov: clamp(s.fov, 50, 100, D.fov),
    volume: {
      master: clamp(v.master, 0, 1, D.volume.master),
      effects: clamp(v.effects, 0, 1, D.volume.effects),
      ambience: clamp(v.ambience, 0, 1, D.volume.ambience)
    },
    quality: QUALITY_LEVELS.includes(s.quality) ? s.quality : D.quality
  };
}

function defaultStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function readSettings(storage = defaultStorage()) {
  try {
    const raw = storage && storage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSettings(null);
  }
}

/**
 * Renderer quality for a level. 'auto' keeps the old per-device choice
 * (phones: no shadows or post; desktops: both).
 */
export function qualityFor(level, isMobile, dpr = 1) {
  const d = Math.max(1, Number(dpr) || 1);
  switch (level) {
    case 'low': return { shadows: false, post: false, pixelRatio: 1, far: 60 };
    case 'medium': return { shadows: false, post: true, pixelRatio: Math.min(d, 1.5), far: 90 };
    case 'high': return { shadows: true, post: true, pixelRatio: Math.min(d, 2), far: 120 };
    default: return isMobile
      ? { shadows: false, post: false, pixelRatio: Math.min(d, 1.5), far: 60 }
      : { shadows: true, post: true, pixelRatio: Math.min(d, 2), far: 120 };
  }
}

export function createSettings({ storage = defaultStorage() } = {}) {
  let settings = readSettings(storage);
  const listeners = new Set();

  function get() {
    return { ...settings, volume: { ...settings.volume } };
  }

  function set(patch = {}) {
    const next = { ...settings, ...patch };
    if (patch.volume) next.volume = { ...settings.volume, ...patch.volume };
    settings = normalizeSettings(next);
    try { if (storage) storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* full or blocked */ }
    listeners.forEach((fn) => fn(get()));
    return get();
  }

  return {
    get,
    set,
    reset: () => set({ ...SETTINGS_DEFAULTS, volume: { ...SETTINGS_DEFAULTS.volume } }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
