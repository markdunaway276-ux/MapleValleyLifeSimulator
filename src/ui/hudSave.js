/**
 * A small "Saved ✓" fade on the HUD after each successful autosave or manual
 * save. Sits under the Hunger / Energy / Cash card (top-left) so it stays
 * clear of the clock (top-centre), the camera / mute / phone / Bag cluster
 * (top-right), the minimap (bottom-left), Debug (bottom-right) and the
 * interact prompt (bottom-centre). pointer-events:none — it never steals
 * look or lock. Hidden under menus with the other HUD bits. The Debug menu
 * can hide it; that choice is remembered in localStorage (on by default).
 */

export const SAVE_INDICATOR_KEY = 'maple-save-indicator';
export const SAVE_EVENT = 'maple-saved';

/** CSS `top` is `max(12px, safe-top) + TOP_EXTRA`. Kept in one place so tests can check overlap. */
export const SAVE_HUD_LAYOUT = {
  topExtra: 232,
  left: 10,
  maxWidth: 110,
  height: 28,
  fadeMs: 220,
  holdMs: 1400
};

const STYLE_ID = 'hud-save-styles';

const CSS = `
#hud-save {
  position: absolute;
  z-index: 34;
  display: none;
  box-sizing: border-box;
  top: calc(max(12px, env(safe-area-inset-top)) + ${SAVE_HUD_LAYOUT.topExtra}px);
  left: max(${SAVE_HUD_LAYOUT.left}px, env(safe-area-inset-left));
  margin: 0;
  padding: 4px 10px;
  font: 600 12px/1.2 system-ui, sans-serif;
  color: #c8f0d0;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(200, 240, 208, 0.28);
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.02em;
  white-space: nowrap;
  opacity: 0;
  transition: opacity ${SAVE_HUD_LAYOUT.fadeMs}ms ease;
}
#hud-save.is-visible { display: block; }
#hud-save.is-flash { opacity: 0.95; }
body.mobile #hud-save { top: calc(max(10px, env(safe-area-inset-top)) + 114px); }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function readSaveIndicatorEnabled(storage) {
  if (!storage) return true;
  try {
    const v = storage.getItem(SAVE_INDICATOR_KEY);
    if (v == null || v === '') return true;
    return v === '1' || v === 'true' || v === 'on';
  } catch {
    return true;
  }
}

export function writeSaveIndicatorEnabled(storage, on) {
  if (!storage) return;
  try { storage.setItem(SAVE_INDICATOR_KEY, on ? '1' : '0'); } catch { /* private mode, quota, … */ }
}

export function createHudSave({
  container = (typeof document !== 'undefined' ? document.body : null),
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  holdMs = SAVE_HUD_LAYOUT.holdMs,
  listen = true
} = {}) {
  ensureStyles();
  const el = document.createElement('div');
  el.id = 'hud-save';
  el.className = 'hud-ui';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Saved');
  el.textContent = 'Saved ✓';
  if (container) container.appendChild(el);

  let enabled = readSaveIndicatorEnabled(storage);
  let hudVisible = false;
  let hideTimer = 0;
  const listeners = [];

  function emit() {
    for (let i = 0; i < listeners.length; i++) listeners[i](enabled);
  }

  function clearFlash() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    el.classList.remove('is-flash');
  }

  function flash() {
    if (!enabled) return false;
    clearFlash();
    // Force a style flush so a back-to-back save retriggers the fade.
    void el.offsetWidth;
    el.classList.add('is-flash');
    hideTimer = setTimeout(() => {
      el.classList.remove('is-flash');
      hideTimer = 0;
    }, holdMs);
    return true;
  }

  function onSaved() { flash(); }

  if (listen && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener(SAVE_EVENT, onSaved);
  }

  function setEnabled(next) {
    const v = !!next;
    if (v === enabled) {
      writeSaveIndicatorEnabled(storage, enabled);
      return enabled;
    }
    enabled = v;
    writeSaveIndicatorEnabled(storage, enabled);
    if (!enabled) clearFlash();
    emit();
    return enabled;
  }

  function setVisible(v) {
    hudVisible = !!v;
    el.classList.toggle('is-visible', hudVisible && enabled);
    if (!hudVisible) el.classList.remove('is-flash');
  }

  function refreshVisible() {
    el.classList.toggle('is-visible', hudVisible && enabled);
    if (!enabled) clearFlash();
  }

  return {
    element: el,
    flash,
    setVisible,
    setEnabled,
    toggle() {
      const next = setEnabled(!enabled);
      refreshVisible();
      return next;
    },
    isEnabled: () => enabled,
    isHudVisible: () => hudVisible && enabled,
    isFlashing: () => el.classList.contains('is-flash'),
    onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    dispose() {
      clearFlash();
      if (listen && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener(SAVE_EVENT, onSaved);
      }
      listeners.length = 0;
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  };
}
