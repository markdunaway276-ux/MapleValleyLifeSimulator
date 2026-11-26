/**
 * Simple sleep interaction for the main-house bed. The bed is a generic
 * interactable (prompt: "Press E to sleep" / "Tap to sleep"). Sleeping
 * fades to black, advances the game clock to the next morning (07:00, or
 * the same day's 07:00 if it is still earlier than that), fades back in,
 * and toasts "You slept."
 *
 * Later needs (Hunger / Energy) hook in via onSlept or the window event
 * `maple-slept` (detail: { before, after }).
 */

import * as THREE from 'three';
import { MINUTES_PER_DAY } from './time.js';
import { BED_CENTER, BED_SIZE, BED_INTERACT } from '../world/interior.js';

export { BED_CENTER, BED_SIZE, BED_INTERACT };

export const WAKE_MINUTES = 7 * 60; // 07:00
export const FADE_OUT = 0.4;
export const FADE_HOLD = 0.25;
export const FADE_IN = 0.45;
export const TOAST_MS = 2200;

const STYLE_ID = 'sleep-overlay-styles';

const CSS = `
#sleep-fade {
  position: fixed; inset: 0; z-index: 80;
  background: #000; opacity: 0; pointer-events: none;
}
#sleep-fade.is-active { pointer-events: auto; }
#sleep-toast {
  position: fixed; left: 50%; top: 42%; transform: translate(-50%, -50%);
  z-index: 81; max-width: 90vw; padding: 10px 18px; border-radius: 10px;
  font: 600 16px system-ui, sans-serif; color: #fff;
  background: rgba(0, 0, 0, 0.8); border: 1px solid rgba(255,255,255,0.3);
  pointer-events: none; opacity: 0; transition: opacity 0.2s ease;
  text-align: center;
}
#sleep-toast.is-visible { opacity: 1; }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function minutesUntilWake(time, wakeMinutes = WAKE_MINUTES) {
  const raw = (time && typeof time === 'object') ? Number(time.minutes) : Number(time);
  const n = MINUTES_PER_DAY;
  const m = ((raw % n) + n) % n;
  if (m < wakeMinutes) return wakeMinutes - m;
  return (n - m) + wakeMinutes;
}

export function wakeTarget(time, wakeMinutes = WAKE_MINUTES) {
  const t = (time && typeof time === 'object') ? time : { minutes: time, day: 1 };
  const minutes = Number(t.minutes) || 0;
  const sameDay = minutes < wakeMinutes;
  return {
    day: Math.max(1, (t.day || 1) | 0) + (sameDay ? 0 : 1),
    minutes: wakeMinutes,
    hour: Math.floor(wakeMinutes / 60),
    minute: wakeMinutes % 60,
    advance: minutesUntilWake(t, wakeMinutes)
  };
}

/** Advance the clock to the next (or same-day, if still early) 07:00. */
export function applySleep(clock, { wakeMinutes = WAKE_MINUTES } = {}) {
  if (!clock || typeof clock.advance !== 'function') return null;
  const before = clock.getTime();
  const target = wakeTarget(before, wakeMinutes);
  const after = clock.advance(target.advance);
  return { before, after, target };
}

/**
 * Invisible bed proxy used for the prompt, highlighter, and E / tap path.
 * The visible bed stays in the merged interior mesh (no extra draw call
 * while the highlighter is off).
 */
export function createBed({ onSleep } = {}) {
  const group = new THREE.Group();
  group.name = 'bed';

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(BED_SIZE.width, BED_SIZE.height, BED_SIZE.depth),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.name = 'bed-highlight';
  mesh.position.set(0, BED_SIZE.height / 2, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  group.userData.kind = 'sleep';
  group.userData.id = 'bed';
  group.userData.isBed = true;
  group.userData.highlightMesh = mesh;
  group.userData.interactLocal = new THREE.Vector3(
    BED_INTERACT.x - BED_CENTER.x,
    BED_INTERACT.y - BED_CENTER.y,
    BED_INTERACT.z - BED_CENTER.z
  );
  group.userData.getPrompt = (isMobile) => (isMobile ? 'Tap to sleep' : 'Press E to sleep');
  group.userData.onSleep = onSleep;
  group.userData.interact = (ctx = {}) => {
    const fn = ctx.sleep
      || group.userData.onSleep
      || (ctx.scene && ctx.scene.userData && ctx.scene.userData.sleep && ctx.scene.userData.sleep.start);
    if (typeof fn !== 'function') return false;
    return fn(ctx) !== false;
  };
  return group;
}

export function createSleep({
  clock,
  dayNight = null,
  sfx = null,
  save = null,
  onSlept = null,
  container = (typeof document !== 'undefined' ? document.body : null)
} = {}) {
  ensureStyles();

  let fadeEl = null;
  let toastEl = null;
  let toastTimer = null;
  if (container && typeof document !== 'undefined') {
    fadeEl = document.createElement('div');
    fadeEl.id = 'sleep-fade';
    fadeEl.setAttribute('aria-hidden', 'true');
    container.appendChild(fadeEl);
    toastEl = document.createElement('div');
    toastEl.id = 'sleep-toast';
    toastEl.setAttribute('role', 'status');
    container.appendChild(toastEl);
  }

  let phase = 'idle'; // idle | out | hold | in
  let acc = 0;
  let lastResult = null;

  function setFade(opacity, active) {
    if (!fadeEl) return;
    fadeEl.style.opacity = String(opacity);
    fadeEl.classList.toggle('is-active', !!active);
    fadeEl.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function showToast(message = 'You slept.') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      toastTimer = null;
    }, TOAST_MS);
  }

  function applyNow() {
    const result = applySleep(clock);
    lastResult = result;
    if (dayNight && typeof dayNight.apply === 'function' && result) {
      dayNight.apply(result.after);
    }
    if (typeof save === 'function') save(result);
    const detail = result || {};
    if (typeof onSlept === 'function') onSlept(detail);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('maple-slept', { detail }));
    }
    return result;
  }

  function finish() {
    phase = 'idle';
    acc = 0;
    setFade(0, false);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sleep-end'));
  }

  function start(opts = {}) {
    if (phase !== 'idle') return false;
    if (sfx && typeof sfx.play === 'function') sfx.play('sleep');
    if (opts.immediate) {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('sleep-start'));
      applyNow();
      showToast();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('sleep-end'));
      return true;
    }
    phase = 'out';
    acc = 0;
    setFade(0, true);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sleep-start'));
    return true;
  }

  function update(delta) {
    if (phase === 'idle') return;
    let remaining = Math.max(0, Number(delta) || 0);
    let guard = 0;
    while (phase !== 'idle' && guard++ < 8) {
      if (phase === 'out') {
        acc += remaining;
        remaining = 0;
        const t = Math.min(1, acc / FADE_OUT);
        setFade(t, true);
        if (t < 1) break;
        remaining = acc - FADE_OUT;
        acc = 0;
        applyNow();
        phase = 'hold';
        setFade(1, true);
      } else if (phase === 'hold') {
        acc += remaining;
        remaining = 0;
        setFade(1, true);
        if (acc < FADE_HOLD) break;
        remaining = acc - FADE_HOLD;
        acc = 0;
        phase = 'in';
        showToast();
      } else if (phase === 'in') {
        acc += remaining;
        remaining = 0;
        const t = Math.min(1, acc / FADE_IN);
        setFade(1 - t, true);
        if (t < 1) break;
        finish();
        break;
      } else {
        break;
      }
    }
  }

  function dispose() {
    if (toastTimer) clearTimeout(toastTimer);
    if (fadeEl) fadeEl.remove();
    if (toastEl) toastEl.remove();
    fadeEl = toastEl = null;
    phase = 'idle';
  }

  return {
    start,
    update,
    applyNow,
    isSleeping: () => phase !== 'idle',
    get phase() { return phase; },
    get lastResult() { return lastResult; },
    showToast,
    dispose,
    get fadeElement() { return fadeEl; },
    get toastElement() { return toastEl; }
  };
}
