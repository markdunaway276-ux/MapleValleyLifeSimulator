import { LOOK } from '../world/palette.js';

/**
 * Player display settings: brightness, film-look strength and film grain.
 * Stored in localStorage (like mute), not in the game save, so they belong to
 * the device. Brightness scales the renderer exposure (desktop and phone);
 * the film look drives the post grade on desktop and a CSS filter on phones.
 */
export const DISPLAY_KEY = 'mapleValleyLife_display';
export const DISPLAY_DEFAULTS = Object.freeze({ brightness: 1, film: 1, grain: true });
export const BRIGHTNESS_RANGE = Object.freeze({ min: 0.5, max: 2, step: 0.05 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeDisplay(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const b = Number(src.brightness);
  const f = Number(src.film);
  return {
    brightness: Number.isFinite(b) ? clamp(b, BRIGHTNESS_RANGE.min, BRIGHTNESS_RANGE.max) : DISPLAY_DEFAULTS.brightness,
    film: Number.isFinite(f) ? clamp(f, 0, 1) : DISPLAY_DEFAULTS.film,
    grain: src.grain == null ? DISPLAY_DEFAULTS.grain : !!src.grain
  };
}

/** CSS filter string for the phone grade at strength t (0 = none, 1 = full). */
export function mobileFilterFor(t) {
  const m = LOOK.grade.mobile;
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
    renderer.domElement.style.filter = settings.film > 0 ? mobileFilterFor(settings.film) : '';
    if (!vignetteEl) {
      vignetteEl = document.createElement('div');
      vignetteEl.id = 'grade-vignette';
      Object.assign(vignetteEl.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1' });
      renderer.domElement.insertAdjacentElement('afterend', vignetteEl);
    }
    const a = (LOOK.grade.mobile.vignette * settings.film).toFixed(3);
    vignetteEl.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(10,14,18,${a}) 100%)`;
  }

  function apply() {
    if (renderer) renderer.toneMappingExposure = LOOK.exposure * settings.brightness;
    if (post) {
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
    reset: () => set({ ...DISPLAY_DEFAULTS }),
    hasGrain: () => !!post,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
