/**
 * Pause menu. Esc on a desktop (the browser turns the first Esc into "release
 * the mouse", so losing mouse look while playing opens it too), or the ⏸ HUD
 * button on any device. While it is open the frame loop skips the world
 * (loop.js), so the clock, needs, neighbours and weather all stand still.
 *
 * Pages: main (Resume, Settings, Controls, Save game), Settings (brightness,
 * film look, grain, sound) and Controls (keys or touch help).
 */

const STYLE_ID = 'pause-menu-styles';
const CSS = `
#pause-button {
  position: fixed; z-index: 40; display: none; align-items: center; justify-content: center;
  top: calc(max(12px, env(safe-area-inset-top)) + 156px); right: max(12px, env(safe-area-inset-right));
  width: 44px; height: 44px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.55); color: #fff; font: 700 16px system-ui, sans-serif; cursor: pointer;
}
#pause-button.is-visible { display: flex; }
#pause-menu {
  position: fixed; inset: 0; z-index: 70; display: none; align-items: center; justify-content: center;
  background: rgba(12, 9, 6, 0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  font: 15px system-ui, sans-serif; color: #f3ece2;
}
#pause-menu.is-open { display: flex; }
#pause-menu .pm-panel {
  width: min(360px, 88vw); max-height: 86vh; overflow-y: auto; padding: 22px 20px 18px;
  background: rgba(30, 26, 22, 0.94); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.5);
}
#pause-menu h2 { margin: 0 0 4px; font-size: 24px; letter-spacing: 0.04em; text-align: center; }
#pause-menu .pm-sub { margin: 0 0 16px; text-align: center; opacity: 0.7; font-size: 13px; }
#pause-menu button.pm-btn {
  display: block; width: 100%; min-height: 48px; margin: 8px 0 0; border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.14); background: #3a322a; color: inherit; font: 600 16px system-ui, sans-serif;
}
#pause-menu button.pm-btn:hover, #pause-menu button.pm-btn:focus-visible { background: #4a4036; outline: none; }
#pause-menu button.pm-primary { background: #6b4a2a; border-color: #a8763f; }
#pause-menu button.pm-primary:hover { background: #7d5731; }
#pause-menu .pm-row { margin: 14px 0 0; }
#pause-menu .pm-row label { display: block; font-weight: 600; margin-bottom: 4px; }
#pause-menu input[type=range] { width: 100%; height: 36px; accent-color: #c98a45; }
#pause-menu .pm-keys { width: 100%; border-collapse: collapse; margin-top: 6px; }
#pause-menu .pm-keys td { padding: 7px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); }
#pause-menu .pm-keys td:first-child { font-weight: 700; white-space: nowrap; padding-right: 14px; }
#pause-menu .pm-note { margin-top: 10px; font-size: 13px; opacity: 0.75; text-align: center; min-height: 1em; }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

const DESKTOP_KEYS = [
  ['W A S D', 'Walk'], ['Mouse', 'Look around'], ['Space', 'Jump'], ['E', 'Use / talk / sit / drive'],
  ['Esc', 'Pause'], ['F2', 'Debug menu'], ['F9', 'Screenshot + note']
];
const TOUCH_KEYS = [
  ['Left stick', 'Walk'], ['Drag right side', 'Look around'], ['Tap prompt', 'Use / talk / sit / drive'],
  ['⏸ button', 'Pause']
];

export function createPauseMenu({
  mode,
  isMobile = false,
  canvas = null,
  getDisplay = () => null,
  getSfx = () => null,
  save = null,
  container = document.body
} = {}) {
  ensureStyles();
  let opened = false;
  let page = 'main';

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'pause-button';
  button.className = 'hud-ui';
  button.textContent = 'II';
  button.setAttribute('aria-label', 'Pause');
  ['pointerdown', 'touchstart'].forEach((ev) => button.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  button.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  container.appendChild(button);

  const root = document.createElement('div');
  root.id = 'pause-menu';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Pause menu');
  root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  const panel = document.createElement('div');
  panel.className = 'pm-panel';
  root.appendChild(panel);
  container.appendChild(root);

  function btn(label, onClick, primary = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pm-btn' + (primary ? ' pm-primary' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function heading(title, sub) {
    const h = document.createElement('h2');
    h.textContent = title;
    panel.appendChild(h);
    const p = document.createElement('p');
    p.className = 'pm-sub';
    p.textContent = sub;
    panel.appendChild(p);
  }

  function slider(label, min, max, step, value, onInput, fmt) {
    const row = document.createElement('div');
    row.className = 'pm-row';
    const l = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    input.setAttribute('aria-label', label);
    const text = () => { l.textContent = `${label} ${fmt(Number(input.value))}`; };
    input.addEventListener('input', () => { onInput(Number(input.value)); text(); });
    text();
    row.append(l, input);
    panel.appendChild(row);
  }

  function render() {
    panel.textContent = '';
    if (page === 'settings') {
      heading('Settings', 'Saved on this device');
      const d = getDisplay();
      if (d) {
        const s = d.get();
        const pct = (v) => Math.round(v * 100) + '%';
        slider('Brightness', 0.5, 2, 0.05, s.brightness, (v) => d.setBrightness(v), pct);
        slider('Film look', 0, 1, 0.05, s.film, (v) => d.setFilm(v), pct);
        if (d.hasGrain()) {
          panel.appendChild(btn(s.grain ? 'Film grain: On' : 'Film grain: Off', () => { d.setGrain(!d.get().grain); render(); }));
        }
      }
      const sfx = getSfx();
      if (sfx && typeof sfx.toggleMuted === 'function') {
        panel.appendChild(btn(sfx.isMuted() ? 'Sound: Off' : 'Sound: On', () => { sfx.toggleMuted(); render(); }));
      }
      if (d) panel.appendChild(btn('Reset display', () => { d.reset(); render(); }));
      panel.appendChild(btn('Back', () => { page = 'main'; render(); }, true));
    } else if (page === 'controls') {
      heading('Controls', isMobile ? 'Touch' : 'Keyboard and mouse');
      const table = document.createElement('table');
      table.className = 'pm-keys';
      for (const [k, v] of (isMobile ? TOUCH_KEYS : DESKTOP_KEYS)) {
        const tr = document.createElement('tr');
        const a = document.createElement('td'); a.textContent = k;
        const b = document.createElement('td'); b.textContent = v;
        tr.append(a, b);
        table.appendChild(tr);
      }
      panel.appendChild(table);
      panel.appendChild(btn('Back', () => { page = 'main'; render(); }, true));
    } else {
      heading('Paused', 'Maple Valley');
      panel.appendChild(btn('Resume', close, true));
      panel.appendChild(btn('Settings', () => { page = 'settings'; render(); }));
      panel.appendChild(btn('Controls', () => { page = 'controls'; render(); }));
      const note = document.createElement('div');
      note.className = 'pm-note';
      panel.appendChild(btn('Save game', () => {
        try { if (typeof save === 'function') save(); note.textContent = 'Game saved.'; } catch { note.textContent = 'Could not save.'; }
      }));
      panel.appendChild(note);
    }
  }

  function canPause() {
    return mode.started() && !mode.busy() && !mode.menuOpen({ except: 'pause' });
  }

  function open() {
    if (opened || !canPause()) return false;
    opened = true;
    page = 'main';
    render();
    root.classList.add('is-open');
    window.dispatchEvent(new Event('pause-open'));
    if (!isMobile && document.pointerLockElement) document.exitPointerLock();
    const first = panel.querySelector('button');
    if (first) first.focus();
    return true;
  }

  function close() {
    if (!opened) return false;
    opened = false;
    root.classList.remove('is-open');
    window.dispatchEvent(new Event('pause-close'));
    if (!isMobile && canvas && typeof canvas.requestPointerLock === 'function') {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* refused (Chrome waits ~1 s after Esc); a click on the game locks again */ }
    }
    return true;
  }

  // Esc: capture phase, so a menu that closes itself on this same Esc
  // (bag, phone, Debug) is still seen as open and the pause does not stack on top.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' && e.code !== 'KeyP') return;
    if (opened) {
      if (page !== 'main') { page = 'main'; render(); } else close();
      e.preventDefault();
      return;
    }
    if (canPause()) { open(); e.preventDefault(); }
  }, true);

  // The browser eats the Esc that releases the mouse, so a lost lock while
  // playing (Esc, Alt+Tab) means "pause". Wait a beat so a menu that released
  // the mouse to open itself is already counted as open.
  if (!isMobile) {
    let hadLock = false;
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (hadLock && !locked) setTimeout(() => { if (!document.pointerLockElement && canPause()) open(); }, 60);
      hadLock = locked;
    });
  }

  // Show the ⏸ button only with the rest of the HUD.
  setInterval(() => {
    button.classList.toggle('is-visible', !opened && mode.hudVisible());
  }, 250);

  return { open, close, isOpen: () => opened, button, element: root };
}
