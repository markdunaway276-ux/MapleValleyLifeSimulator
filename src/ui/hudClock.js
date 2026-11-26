/**
 * Small read-only game-clock label. Sits at the top-centre so it stays clear
 * of Bag / the camera button (top-right), the info card (top-left), Debug
 * (bottom-right), the joystick (bottom-left) and the interact prompt
 * (bottom-centre). pointer-events:none — it never steals look or lock.
 */

const STYLE_ID = 'hud-clock-styles';

const CSS = `
#hud-clock {
  position: absolute;
  z-index: 34;
  display: none;
  box-sizing: border-box;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 12px;
  font: 600 13px/1.2 system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  letter-spacing: 0.02em;
  opacity: 0.9;
}
#hud-clock.is-visible { display: block; }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createHudClock({ container = document.body } = {}) {
  ensureStyles();
  const el = document.createElement('div');
  el.id = 'hud-clock';
  el.className = 'hud-ui';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Game time');
  container.appendChild(el);

  let label = '';

  function setVisible(v) {
    el.classList.toggle('is-visible', !!v);
  }

  function update(time) {
    if (!time) return;
    const text = time.label || '';
    if (text !== label) {
      el.textContent = text;
      label = text;
    }
  }

  function dispose() {
    el.remove();
  }

  return { element: el, setVisible, update, dispose };
}
