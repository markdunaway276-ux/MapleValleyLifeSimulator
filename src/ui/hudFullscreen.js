/**
 * Fullscreen toggle button — available from the very first (title) screen,
 * throughout the Route 9 opening, and during gameplay.
 */

const STYLE_ID = 'hud-fullscreen-styles';

const ENTER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
const EXIT_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';

const CSS = `
#hud-fullscreen {
  position: fixed;
  z-index: 210;
  display: flex;
  box-sizing: border-box;
  bottom: max(12px, env(safe-area-inset-bottom));
  left: max(12px, env(safe-area-inset-left));
  width: 42px; height: 42px; min-width: 42px; min-height: 42px;
  padding: 0; margin: 0;
  color: #f3ece2;
  background: rgba(16, 18, 22, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  align-items: center;
  justify-content: center;
  opacity: 0.92;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
#hud-fullscreen:hover, #hud-fullscreen:focus-visible {
  opacity: 1;
  background: rgba(24, 28, 34, 0.92);
  border-color: rgba(255, 255, 255, 0.52);
  outline: none;
}
#hud-fullscreen.is-active {
  border-color: #d4a657;
  color: #f7dfaa;
}
/* Mobile portrait: neat right-hand column under Mute; mobile landscape: top-right row */
body.mobile #hud-fullscreen {
  bottom: auto;
  left: auto;
  top: calc(max(10px, env(safe-area-inset-top)) + 230px);
  right: max(10px, env(safe-area-inset-right));
  width: 40px; height: 40px; min-width: 40px; min-height: 40px;
}
@media (max-height: 500px) {
  body.mobile #hud-fullscreen {
    top: max(8px, env(safe-area-inset-top));
    right: calc(max(10px, env(safe-area-inset-right)) + 212px);
    width: 36px; height: 36px; min-width: 36px; min-height: 36px;
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

export function isFullscreenActive(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function toggleFullscreen(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false;
  try {
    if (isFullscreenActive(doc)) {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (typeof exit === 'function') await exit.call(doc);
      return false;
    }
    const el = doc.documentElement;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (typeof req === 'function') {
      await req.call(el);
      return true;
    }
  } catch {
    // Fullscreen may be blocked or unsupported (e.g. some iOS Safari views).
  }
  return isFullscreenActive(doc);
}

export function createHudFullscreen({ container = document.body, onUnsupported = null } = {}) {
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'hud-fullscreen';
  button.className = 'hud-ui';

  function refresh() {
    const active = isFullscreenActive();
    button.innerHTML = active ? EXIT_SVG : ENTER_SVG;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.title = active ? 'Exit fullscreen' : 'Fullscreen';
  }

  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.documentElement;
    const supported = !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
    if (!supported && !isFullscreenActive()) {
      if (typeof onUnsupported === 'function') onUnsupported();
      return;
    }
    await toggleFullscreen();
    refresh();
  });

  const onFsChange = () => refresh();
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  container.appendChild(button);
  refresh();

  return {
    element: button,
    refresh,
    toggle: toggleFullscreen,
    isFullscreen: isFullscreenActive,
    dispose() {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      button.remove();
    }
  };
}
