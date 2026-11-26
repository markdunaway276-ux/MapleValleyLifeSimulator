/**
 * On-screen door interaction prompt.
 * Desktop: "Press E to open/close". Mobile: tappable "Tap to open/close".
 * Fades in and out with a CSS opacity transition. DOM is updated only when
 * visibility or label actually changes.
 */

export const INTERACT_RANGE = 3;

const STYLE_ID = 'interact-prompt-styles';

const CSS = `
#interact-prompt {
  position: absolute;
  left: 50%;
  bottom: max(24px, 12vh);
  transform: translateX(-50%);
  z-index: 30;
  margin: 0;
  padding: 10px 18px;
  font: 600 16px system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 10px;
  letter-spacing: 0.01em;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  appearance: none;
  -webkit-appearance: none;
  user-select: none;
}
#interact-prompt.visible {
  opacity: 1;
}
body.mobile #interact-prompt.visible {
  pointer-events: auto;
  cursor: pointer;
}
body.mobile #interact-prompt.visible:active,
body.mobile #interact-prompt.visible:focus {
  background: rgba(0, 0, 0, 0.85);
  outline: none;
}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function labelFor(isMobile, open) {
  if (isMobile) return open ? 'Tap to close' : 'Tap to open';
  return open ? 'Press E to close' : 'Press E to open';
}

export function createInteractPrompt(options = {}) {
  const {
    isMobile = false,
    isStarted = () => true,
    isInventoryOpen = () => false,
    door = null,
    doors = null,
    getTarget = null,
    player = null,
    range = INTERACT_RANGE,
    container = document.body
  } = options;

  function inRangeOf(target) {
    if (!target || !player || !player.position) return false;
    const point = (target.userData && target.userData.interactLocal && typeof target.localToWorld === 'function')
      ? target.localToWorld(target.userData.interactLocal.clone())
      : target.position;
    return !!(point && player.position.distanceTo(point) < range);
  }

  function currentDoor() {
    if (typeof getTarget === 'function') return getTarget();
    if (inRangeOf(door)) return door;
    return null;
  }

  ensureStyles();

  const el = document.createElement('button');
  el.type = 'button';
  el.id = 'interact-prompt';
  el.tabIndex = -1;
  el.setAttribute('aria-hidden', 'true');
  el.textContent = labelFor(isMobile, !!(door && door.userData && door.userData.open));

  // Same toggle path as the E key: dispatch 'interact' (main.js still checks range).
  const onActivate = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new Event('interact'));
  };
  el.addEventListener('click', onActivate);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  container.appendChild(el);

  let shown = false;
  let label = el.textContent;

  function update() {
    const target = currentDoor();
    const open = !!(target && target.userData && target.userData.open);
    const nextLabel = labelFor(isMobile, open);
    const inRange = !!target;
    const nextShown = inRange && !!isStarted() && !isInventoryOpen();

    if (nextLabel !== label) {
      el.textContent = nextLabel;
      label = nextLabel;
    }
    if (nextShown !== shown) {
      el.classList.toggle('visible', nextShown);
      el.setAttribute('aria-hidden', nextShown ? 'false' : 'true');
      shown = nextShown;
    }
  }

  return {
    element: el,
    update,
    isVisible: () => shown,
    getTarget: currentDoor,
    dispose() {
      el.removeEventListener('click', onActivate);
      el.remove();
    }
  };
}
