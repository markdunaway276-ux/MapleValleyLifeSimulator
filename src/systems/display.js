import { LOOK } from '../world/palette.js';

/**
 * Player display settings: brightness, film-look strength and film grain.
 * Stored in localStorage (like mute), not in the game save, so they belong to
 * the device. Brightness scales the renderer exposure (desktop and phone);
 * the film look drives the post grade on desktop and a CSS filter on phones.
 */
export const LOOK_PRESETS = Object.freeze({
  classic: {
    label: 'Classic',
    exposureScale: 1.0,
    gain: LOOK.grade.gain,
    curve: LOOK.grade.curve,
    saturation: LOOK.grade.saturation,
    shadowTint: LOOK.grade.shadowTint,
    highlightTint: LOOK.grade.highlightTint,
    vignette: LOOK.grade.vignette,
    bloom: LOOK.grade.bloom,
    mobile: LOOK.grade.mobile
  },
  autumn: {
    label: 'Cozy Autumn',
    exposureScale: 1.04,
    gain: 1.09,
    curve: 0.34,
    saturation: 1.14,
    shadowTint: [0.014, 0.004, -0.014],
    highlightTint: [0.045, 0.022, -0.022],
    vignette: 0.36,
    bloom: 0.30,
    mobile: { sepia: 0.14, saturate: 1.18, contrast: 1.12, brightness: 1.07, vignette: 0.28 }
  },
  pnw: {
    label: 'Sunlit PNW',
    exposureScale: 1.06,
    gain: 1.10,
    curve: 0.26,
    saturation: 1.06,
    shadowTint: [-0.012, 0.010, 0.016],
    highlightTint: [0.014, 0.020, 0.008],
    vignette: 0.24,
    bloom: 0.24,
    mobile: { sepia: 0.0, saturate: 1.10, contrast: 1.08, brightness: 1.10, vignette: 0.20 }
  },
  dusk: {
    label: 'Moody Dusk',
    exposureScale: 0.96,
    gain: 0.99,
    curve: 0.42,
    saturation: 0.82,
    shadowTint: [-0.018, 0.008, 0.026],
    highlightTint: [0.036, 0.016, -0.012],
    vignette: 0.54,
    bloom: 0.34,
    mobile: { sepia: 0.08, saturate: 0.82, contrast: 1.18, brightness: 0.98, vignette: 0.42 }
  }
});

export const DISPLAY_KEY = 'mapleValleyLife_display';
export const DISPLAY_DEFAULTS = Object.freeze({ brightness: 1, film: 1, grain: true, preset: 'classic' });
export const BRIGHTNESS_RANGE = Object.freeze({ min: 0.5, max: 2, step: 0.05 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeDisplay(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const b = Number(src.brightness);
  const f = Number(src.film);
  const preset = typeof src.preset === 'string' && LOOK_PRESETS[src.preset] ? src.preset : DISPLAY_DEFAULTS.preset;
  return {
    brightness: Number.isFinite(b) ? clamp(b, BRIGHTNESS_RANGE.min, BRIGHTNESS_RANGE.max) : DISPLAY_DEFAULTS.brightness,
    film: Number.isFinite(f) ? clamp(f, 0, 1) : DISPLAY_DEFAULTS.film,
    grain: src.grain == null ? DISPLAY_DEFAULTS.grain : !!src.grain,
    preset
  };
}

/** CSS filter string for the phone grade at strength t (0 = none, 1 = full). */
export function mobileFilterFor(t, presetId = 'classic') {
  const p = LOOK_PRESETS[presetId] || LOOK_PRESETS.classic;
  const m = p.mobile || LOOK.grade.mobile;
  const lerp = (a, b) => (a + (b - a) * t).toFixed(3);
  return `sepia(${lerp(0, m.sepia)}) saturate(${lerp(1, m.saturate)}) contrast(${lerp(1, m.contrast)}) brightness(${lerp(1, m.brightness)})`;
}

export function createDisplay({
  renderer,
  post = null,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null)
} = {}) {
  let settings = { ...DISPLAY_DEFAULTS };
  try {
    const raw = storage && storage.getItem(DISPLAY_KEY);
    if (raw) settings = normalizeDisplay(JSON.parse(raw));
  } catch { /* bad or blocked storage: keep defaults */ }

  const listeners = new Set();
  let vignetteEl = null;

  function applyMobile() {
    if (post || !renderer || !renderer.domElement || typeof document === 'undefined') return;
    const preset = LOOK_PRESETS[settings.preset] || LOOK_PRESETS.classic;
    renderer.domElement.style.filter = settings.film > 0 ? mobileFilterFor(settings.film, settings.preset) : '';
    if (!vignetteEl) {
      vignetteEl = document.createElement('div');
      vignetteEl.id = 'grade-vignette';
      Object.assign(vignetteEl.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1' });
      renderer.domElement.insertAdjacentElement('afterend', vignetteEl);
    }
    const a = ((preset.mobile?.vignette ?? LOOK.grade.mobile.vignette) * settings.film).toFixed(3);
    vignetteEl.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(10,14,18,${a}) 100%)`;
  }

  function apply() {
    const preset = LOOK_PRESETS[settings.preset] || LOOK_PRESETS.classic;
    if (renderer) renderer.toneMappingExposure = LOOK.exposure * (preset.exposureScale ?? 1) * settings.brightness;
    if (post) {
      if (typeof post.setPreset === 'function') post.setPreset(preset);
      if (typeof post.setGradeStrength === 'function') post.setGradeStrength(settings.film);
      if (typeof post.setGrain === 'function') post.setGrain(settings.grain);
    }
    applyMobile();
  }

  function persist() {
    try { if (storage) storage.setItem(DISPLAY_KEY, JSON.stringify(settings)); } catch { /* storage full or blocked */ }
  }

  function set(patch) {
    settings = normalizeDisplay({ ...settings, ...patch });
    apply();
    persist();
    listeners.forEach((fn) => fn(get()));
    return get();
  }

  function get() { return { ...settings }; }

  apply();

  return {
    get,
    set,
    setBrightness: (v) => set({ brightness: v }),
    setFilm: (v) => set({ film: v }),
    setGrain: (on) => set({ grain: on }),
    setPreset: (id) => set({ preset: id }),
    reset: () => set({ ...DISPLAY_DEFAULTS }),
    hasGrain: () => !!post,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
