/**
 * Compact Cash readout, mounted with the Hunger / Energy bars (top-left
 * under the info card) so it stays clear of the clock, camera, mute, Bag,
 * Debug, joystick and prompts. pointer-events:none. Hidden under menus
 * with the other HUD bits. Also provides a short "+$X" toast.
 */

const STYLE_ID = 'hud-money-styles';

const CSS = `
#hud-money {
  position: absolute;
  z-index: 34;
  display: none;
  box-sizing: border-box;
  top: calc(max(12px, env(safe-area-inset-top)) + 96px);
  left: max(10px, env(safe-area-inset-left));
  width: 152px;
  margin: 0;
  padding: 6px 8px 7px;
  font: 600 11px/1.2 system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
  opacity: 0.9;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
#hud-money.is-visible { display: flex; }
#hud-needs #hud-money {
  position: static;
  display: flex;
  width: auto;
  margin: 0 0 6px;
  padding: 0 0 6px;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 0;
  opacity: 1;
}
#hud-money .hud-money-label { letter-spacing: 0.01em; }
#hud-money .hud-money-value {
  font-variant-numeric: tabular-nums;
  color: #8fddb0;
  text-align: right;
}
#game-toast {
  position: fixed; left: 50%; top: 42%; transform: translate(-50%, -50%);
  z-index: 85; max-width: 90vw; padding: 10px 18px; border-radius: 10px;
  font: 600 16px system-ui, sans-serif; color: #fff;
  background: rgba(0, 0, 0, 0.8); border: 1px solid rgba(255,255,255,0.3);
  pointer-events: none; opacity: 0; transition: opacity 0.2s ease;
  text-align: center;
}
#game-toast.is-visible { opacity: 1; }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function formatCash(amount) {
  const n = Number(amount);
  const v = Number.isFinite(n) ? n : 0;
  const shown = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return '$' + shown;
}

export function createHudMoney({
  getMoney = () => 0,
  container = document.body
} = {}) {
  ensureStyles();
  const el = document.createElement('div');
  el.id = 'hud-money';
  el.className = 'hud-ui';
  el.setAttribute('aria-label', 'Cash');
  const label = document.createElement('span');
  label.className = 'hud-money-label';
  label.textContent = 'Cash';
  const value = document.createElement('span');
  value.className = 'hud-money-value';
  el.append(label, value);

  const host = (typeof document !== 'undefined' && document.getElementById('hud-needs')) || container;
  if (host && host.id === 'hud-needs') host.insertBefore(el, host.firstChild);
  else (container || document.body).appendChild(el);

  let shown = null;
  let toastEl = null;
  let toastTimer = null;

  function update(amount) {
    const raw = amount != null ? amount : (typeof getMoney === 'function' ? getMoney() : 0);
    const n = Number(raw);
    const v = Number.isFinite(n) ? n : 0;
    const text = formatCash(v);
    if (shown === text) return;
    shown = text;
    value.textContent = text;
  }

  function setVisible(v) {
    el.classList.toggle('is-visible', !!v);
    if (v) update();
  }

  function toast(message, ms = 2200) {
    if (typeof document === 'undefined') return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'game-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      toastTimer = null;
    }, ms);
  }

  function dispose() {
    el.remove();
    if (toastEl) toastEl.remove();
    if (toastTimer) clearTimeout(toastTimer);
  }

  update();
  return { element: el, setVisible, update, toast, dispose };
}
