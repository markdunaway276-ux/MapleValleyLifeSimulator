/**
 * Small mute toggle. Sits in the top-right cluster, directly under the
 * camera button (and so under Bag's left neighbour on a phone). That keeps
 * it clear of the clock (top-centre), the info card (top-left), Debug
 * (bottom-right), the joystick (bottom-left) and the interact prompt
 * (bottom-centre). Touch-look ignores it via .hud-ui.
 */

const STYLE_ID = 'hud-mute-styles';

const CSS = `
#hud-mute {
  position: absolute;
  z-index: 36;
  display: none;
  box-sizing: border-box;
  top: calc(max(12px, env(safe-area-inset-top)) + 52px);
  right: max(12px, env(safe-area-inset-right));
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  padding: 0; margin: 0;
  font: 20px/1 system-ui, sans-serif;
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
#hud-mute.is-visible { display: flex; }
#hud-mute:hover, #hud-mute:focus { opacity: 1; background: rgba(0, 0, 0, 0.85); outline: none; }
/* Single neat right-hand column on mobile (under Bag / Phone / Pause / View). */
body.mobile #hud-mute {
  top: calc(max(10px, env(safe-area-inset-top)) + 184px);
  right: max(10px, env(safe-area-inset-right));
  width: 40px; height: 40px; min-width: 40px; min-height: 40px;
  font-size: 18px;
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

export function createHudMute({
  isMuted = () => false,
  onToggle = () => {},
  container = document.body
} = {}) {
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'hud-mute';
  button.className = 'hud-ui';
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(e);
    refresh();
  });
  container.appendChild(button);

  function refresh() {
    const muted = !!isMuted();
    button.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    button.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
    button.title = muted ? 'Unmute' : 'Mute';
  }

  function setVisible(v) {
    button.classList.toggle('is-visible', !!v);
  }

  function dispose() {
    button.remove();
  }

  refresh();
  return { element: button, setVisible, refresh, dispose };
}
