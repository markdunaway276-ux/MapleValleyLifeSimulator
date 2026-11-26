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
  align-items: center;
  gap: 6px;
}
#hud-clock.is-visible { display: flex; }
#hud-clock-icon {
  font-size: 14px;
  line-height: 1;
}
#hud-clock-icon:empty { display: none; }
#hud-clock-label { margin: 0; }
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
  const iconEl = document.createElement('span');
  iconEl.id = 'hud-clock-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  const labelEl = document.createElement('span');
  labelEl.id = 'hud-clock-label';
  el.append(iconEl, labelEl);
  container.appendChild(el);

  let label = '';
  let icon = '';

  function setVisible(v) {
    el.classList.toggle('is-visible', !!v);
  }

  function update(time, weather) {
    if (!time && !weather) return;
    const text = (time && time.label) || label;
    const nextIcon = (weather && weather.icon) || '';
    if (text !== label) {
      labelEl.textContent = text;
      label = text;
    }
    if (nextIcon !== icon) {
      iconEl.textContent = nextIcon;
      iconEl.setAttribute('aria-label', (weather && weather.name) || '');
      icon = nextIcon;
    }
    const name = (weather && weather.name) || '';
    el.setAttribute('aria-label', name ? ('Game time, ' + name) : 'Game time');
  }

  function dispose() {
    el.remove();
  }

  return { element: el, setVisible, update, dispose };
}
