/**
 * HUD screenshot button, shown during normal play after Start. It sits in the
 * top-right corner (just left of Bag on a phone, where Bag is hidden on
 * desktop). Tapping it captures the current view and opens the markup dialog
 * (the same one as F9 / Debug → Screenshot). Hidden while inventory, the
 * Debug menu, or the markup dialog is open. Touch-look and the joystick
 * ignore it; it never requests pointer lock.
 */

const STYLE_ID = 'hud-screenshot-styles';

const CSS = `
#hud-screenshot {
  position: absolute;
  z-index: 36;
  display: none;
  box-sizing: border-box;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  padding: 0; margin: 0;
  font: 22px/1 system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}
#hud-screenshot.is-visible { display: flex; }
#hud-screenshot:hover, #hud-screenshot:focus { opacity: 1; background: rgba(0, 0, 0, 0.85); outline: none; }
/* Single neat right-hand column on mobile (under Bag / Phone / Pause / View / Mute). */
body.mobile #hud-screenshot {
  top: calc(max(10px, env(safe-area-inset-top)) + 230px);
  right: max(10px, env(safe-area-inset-right));
  width: 40px; height: 40px; min-width: 40px; min-height: 40px;
  font-size: 19px;
}
@media (max-height: 500px) {
  body.mobile #hud-screenshot {
    top: max(8px, env(safe-area-inset-top));
    right: calc(max(10px, env(safe-area-inset-right)) + 212px);
    width: 36px; height: 36px; min-width: 36px; min-height: 36px;
    font-size: 16px;
  }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createHudScreenshotButton({
  onClick = () => {},
  container = document.body
} = {}) {
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'hud-screenshot';
  button.className = 'hud-ui';
  button.textContent = '\u{1F4F7}';
  button.setAttribute('aria-label', 'Screenshot');
  button.title = 'Screenshot';
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(e);
  });
  container.appendChild(button);

  function setVisible(v) {
    button.classList.toggle('is-visible', !!v);
  }

  function dispose() {
    button.remove();
  }

  return { element: button, setVisible, dispose };
}
