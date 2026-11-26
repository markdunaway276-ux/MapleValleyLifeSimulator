/**
 * Small text overlay for FPS / position / quality tier / perf stats.
 * Created lazily the first time it is shown; hidden elements cost nothing.
 */

const STYLE_ID = 'debug-overlay-styles';
const CSS = `
#debug-overlay {
  position: absolute; left: 10px; top: 88px; z-index: 25; display: none;
  margin: 0; padding: 6px 10px; border-radius: 6px; pointer-events: none;
  font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #8dff9b;
  background: rgba(0, 0, 0, 0.65); white-space: pre; user-select: none;
}
#debug-overlay.is-open { display: block; }
`;

export function createDebugOverlay({ container = document.body } = {}) {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.setAttribute('aria-hidden', 'true');
  container.appendChild(el);
  let text = '';
  return {
    element: el,
    setVisible(v) {
      el.classList.toggle('is-open', !!v);
      el.setAttribute('aria-hidden', v ? 'false' : 'true');
    },
    setText(next) {
      if (next !== text) {
        text = next;
        el.textContent = next;
      }
    },
    dispose() { el.remove(); }
  };
}
