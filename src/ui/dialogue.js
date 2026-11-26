/**
 * Touch-friendly dialogue window. Shows an NPC name and 1–2 lines, with
 * Next and Close. Esc, the Close button, or a tap on the backdrop
 * dismisses it. Pointer lock is released and movement is blocked while
 * it is open, same as the bag and the phone.
 */

import { getDialogue } from '../data/dialogue.js';

const STYLE_ID = 'maple-dialogue-css';

const CSS = `
.dialogue-overlay {
  position: fixed;
  inset: 0;
  z-index: 52;
  display: none;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px 16px max(20px, env(safe-area-inset-bottom));
  box-sizing: border-box;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.dialogue-overlay.is-open { display: flex; }
@media (min-width: 700px) {
  .dialogue-overlay { align-items: center; }
}
.dialogue-panel {
  box-sizing: border-box;
  width: min(440px, 100%);
  background: #1b1b1f;
  border: 1px solid #44444c;
  border-radius: 14px;
  padding: 16px 16px 14px;
  color: #fff;
  font: 16px/1.45 system-ui, sans-serif;
}
.dialogue-name {
  margin: 0 0 10px;
  font: 650 18px/1.2 system-ui, sans-serif;
}
.dialogue-lines {
  margin: 0 0 16px;
  min-height: 3.2em;
}
.dialogue-lines p {
  margin: 0 0 8px;
}
.dialogue-lines p:last-child { margin-bottom: 0; }
.dialogue-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialogue-row button {
  box-sizing: border-box;
  min-width: 88px;
  min-height: 44px;
  padding: 8px 16px;
  margin: 0;
  font: 600 15px/1 system-ui, sans-serif;
  color: #fff;
  background: #2a2a30;
  border: 1px solid #555;
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
}
.dialogue-row button:hover, .dialogue-row button:focus {
  background: #35353d;
  outline: none;
}
.dialogue-row button:disabled {
  opacity: 0.4;
  cursor: default;
}
.dialogue-next {
  background: #1f6f3a !important;
  border-color: #3fbf6a !important;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createDialogue({
  container = document.body,
  canvas = null,
  isMobile = false,
  isStarted = null,
  isBlocked = null,
  canOpen = null,
  onBeforeOpen = null,
  getTime = null,
  getWeather = null,
  getExtraPage = null
} = {}) {
  ensureStyles();

  let opened = false;
  let npcId = null;
  let pages = [];
  let name = '';
  let index = 0;

  const overlay = document.createElement('div');
  overlay.className = 'dialogue-overlay';
  overlay.id = 'dialogue';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Dialogue');

  const panel = document.createElement('div');
  panel.className = 'dialogue-panel';

  const nameEl = document.createElement('h3');
  nameEl.className = 'dialogue-name';
  const linesEl = document.createElement('div');
  linesEl.className = 'dialogue-lines';
  const row = document.createElement('div');
  row.className = 'dialogue-row';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'dialogue-close';
  closeBtn.textContent = 'Close';
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'dialogue-next';
  nextBtn.textContent = 'Next';
  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'dialogue-next';
  row.append(closeBtn, nextBtn, actionBtn);
  panel.append(nameEl, linesEl, row);
  overlay.appendChild(panel);
  if (container) container.appendChild(overlay);

  function started() {
    return typeof isStarted === 'function' ? !!isStarted() : true;
  }
  function blocked() {
    return typeof isBlocked === 'function' && !!isBlocked();
  }
  function allowedToOpen() {
    if (typeof canOpen === 'function') return !!canOpen();
    return started();
  }
  function mobile() {
    return !!isMobile || (typeof document !== 'undefined' && document.body.classList.contains('mobile'));
  }

  function paint() {
    nameEl.textContent = name;
    linesEl.replaceChildren();
    const page = pages[index];
    const lines = (page && page.lines) || [];
    for (let i = 0; i < lines.length; i++) {
      const p = document.createElement('p');
      p.textContent = lines[i];
      linesEl.appendChild(p);
    }
    const last = index >= pages.length - 1;
    nextBtn.disabled = last;
    nextBtn.setAttribute('aria-disabled', last ? 'true' : 'false');
    nextBtn.hidden = last;
    actionBtn.hidden = !page?.action;
    actionBtn.textContent = page?.action?.label ?? '';
  }

  function open(id, ctx = {}) {
    if (!id) return false;
    if (opened && npcId === id) return true;
    if (!allowedToOpen()) return false;
    if (typeof onBeforeOpen === 'function') onBeforeOpen();
    const time = ctx.time || (typeof getTime === 'function' ? getTime() : null);
    const weather = ctx.weather || (typeof getWeather === 'function' ? getWeather() : null);
    const tree = getDialogue(id, { time, period: time && time.period, weather });
    name = tree.name;
    pages = tree.pages && tree.pages.length ? tree.pages : [{ lines: ['…'] }];
    const extraPage = getExtraPage?.(id);
    if (extraPage) pages.push(extraPage);
    index = 0;
    npcId = id;
    opened = true;
    paint();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-label', name);
    if (typeof document !== 'undefined' && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
    window.dispatchEvent(new Event('dialogue-open'));
    return true;
  }

  function close() {
    if (!opened) return;
    opened = false;
    npcId = null;
    pages = [];
    index = 0;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new Event('dialogue-close'));
    if (!mobile() && started() && !blocked() && canvas && typeof canvas.requestPointerLock === 'function') {
      canvas.requestPointerLock();
    }
  }

  function next() {
    if (!opened) return;
    if (index < pages.length - 1) {
      index += 1;
      paint();
    }
  }

  function isOpen() { return opened; }
  function currentNpc() { return npcId; }
  function currentPage() { return index; }

  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    next();
  });
  actionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const page = pages[index];
    if (page?.action?.run()) {
      pages[index] = { lines: page.response };
      paint();
      closeBtn.focus();
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  panel.addEventListener('click', (e) => e.stopPropagation());

  function onKey(e) {
    if (!opened) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (row.contains(e.target) && e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      if (e.repeat) return;
      if (index < pages.length - 1) next();
      else close();
    }
  }
  document.addEventListener('keydown', onKey);

  window.addEventListener('inventory-open', () => { if (opened) close(); });
  window.addEventListener('phone-open', () => { if (opened) close(); });

  function dispose() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  return {
    open,
    close,
    next,
    isOpen,
    currentNpc,
    currentPage,
    element: overlay,
    dispose
  };
}
