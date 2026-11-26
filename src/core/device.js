/**
 * Phone / tablet detection. Decides the joystick, touch look, shadows,
 * post-processing and texture sizes, so it goes by the device, not by how
 * wide the window happens to be (a narrow desktop window is still a desktop).
 *
 * Touch-first device = a mobile user agent, an iPad that reports itself as a
 * Mac (iPadOS 13+), or a primary pointer that is coarse (a finger) with no
 * hover. A laptop with a touchscreen keeps its mouse as the primary pointer,
 * so it stays a desktop.
 *
 * Override for testing: add ?mobile=1 or ?mobile=0 to the URL.
 */
export function detectMobile(env = {}) {
  const ua = env.userAgent || '';
  const search = env.search || '';
  const override = /[?&]mobile=(1|0|true|false)\b/i.exec(search);
  if (override) return override[1] === '1' || override[1].toLowerCase() === 'true';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (env.platform === 'MacIntel' && (env.maxTouchPoints || 0) > 1) return true;
  return !!(env.coarsePointer && !env.canHover);
}

/** Reads the browser's values and runs detectMobile. */
export function isMobileDevice() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mm = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  return detectMobile({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    coarsePointer: mm('(pointer: coarse)'),
    canHover: mm('(hover: hover)'),
    search: typeof location !== 'undefined' ? location.search : ''
  });
}
