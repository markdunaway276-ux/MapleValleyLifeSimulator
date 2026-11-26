/**
 * Debug button + touch-friendly debug menu.
 * The "Debug" button sits in the bottom-right corner (Bag is top-right, the
 * joystick bottom-left, the door prompt bottom-centre) and only shows after
 * Start. The menu panel is built lazily on first open. Rows are 52px tall.
 */

const STYLE_ID = 'debug-menu-styles';
const CONFIRM_MS = 4000;

const CSS = `
#debug-button {
  position: absolute; z-index: 35; display: none; margin: 0;
  right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom));
  min-width: 56px; min-height: 44px; padding: 8px 14px;
  font: 600 14px system-ui, sans-serif; color: #fff; background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 8px; cursor: pointer;
  touch-action: manipulation; pointer-events: auto; -webkit-tap-highlight-color: transparent;
  opacity: 0.85;
}
#debug-button.is-visible { display: block; }
#debug-button:hover, #debug-button:focus { opacity: 1; background: rgba(0, 0, 0, 0.85); outline: none; }

#debug-menu {
  position: fixed; inset: 0; z-index: 60; display: none; align-items: flex-end; justify-content: center;
  background: rgba(0, 0, 0, 0.5); font: 16px system-ui, sans-serif; color: #fff;
  touch-action: none; -webkit-user-select: none; user-select: none;
}
#debug-menu.is-open { display: flex; }
@media (min-width: 700px) { #debug-menu { align-items: center; } }
#debug-menu .dm-panel {
  box-sizing: border-box; width: min(440px, 100%); max-height: 92vh; overflow-y: auto; touch-action: pan-y;
  background: #1b1b1f; border: 1px solid #44444c; border-radius: 14px 14px 0 0;
  padding: 10px 12px max(14px, env(safe-area-inset-bottom));
}
@media (min-width: 700px) { #debug-menu .dm-panel { border-radius: 14px; } }
#debug-menu .dm-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 8px; }
#debug-menu h2 { margin: 0; font-size: 18px; }
#debug-menu button {
  margin: 0; font: inherit; color: inherit; cursor: pointer; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
#debug-menu .dm-close {
  min-width: 44px; min-height: 44px; font-size: 20px; background: #2b2b31; border: 1px solid #555; border-radius: 10px;
}
#debug-menu .dm-row {
  box-sizing: border-box; width: 100%; min-height: 52px; margin-top: 8px; padding: 8px 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-row:active { background: #35353d; }
#debug-menu .dm-label { flex: 1 1 auto; font-weight: 600; }
#debug-menu .dm-key { font-size: 12px; color: #9a9aa5; font-weight: 400; display: block; }
body.mobile #debug-menu .dm-key { display: none; }
#debug-menu .dm-switch {
  flex: 0 0 auto; width: 46px; height: 26px; border-radius: 13px; background: #555; position: relative; transition: background 0.15s;
}
#debug-menu .dm-switch::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; transition: transform 0.15s;
}
#debug-menu .dm-row[aria-checked="true"] .dm-switch { background: #2e9e4f; }
#debug-menu .dm-row[aria-checked="true"] .dm-switch::after { transform: translateX(20px); }
#debug-menu .dm-danger { border-color: #8a3a35; }
#debug-menu .dm-danger.is-armed { background: #7a1f1a; border-color: #ff6b61; }
#debug-menu .dm-foot { margin: 10px 4px 0; font-size: 12px; color: #8b8b95; }


#debug-menu .dm-section { margin-top: 8px; border: 1px solid #44444c; border-radius: 10px; background: #222228; overflow: hidden; }
#debug-menu .dm-section-toggle {
  box-sizing: border-box; width: 100%; min-height: 52px; padding: 8px 14px; margin: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;
  background: #2a2a30; border: 0; border-bottom: 1px solid #44444c;
}
#debug-menu .dm-chevron { flex: 0 0 auto; font-size: 18px; color: #c8c8d0; transition: transform 0.15s; }
#debug-menu .dm-section.is-open .dm-chevron { transform: rotate(180deg); }
#debug-menu .dm-sublist { display: none; padding: 0 8px 8px; }
#debug-menu .dm-section.is-open .dm-sublist { display: block; }
#debug-menu .dm-subrow {
  box-sizing: border-box; width: 100%; min-height: 48px; margin-top: 6px; padding: 8px 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;
  background: #2a2a30; border: 1px solid #3a3a44; border-radius: 10px; font-weight: 600;
}
#debug-menu .dm-subrow:active { background: #35353d; }

#debug-toast {
  position: fixed; left: 50%; bottom: max(80px, 18vh); transform: translateX(-50%); z-index: 65;
  max-width: 90vw; padding: 8px 14px; border-radius: 8px; font: 600 14px system-ui, sans-serif; color: #fff;
  background: rgba(0, 0, 0, 0.8); border: 1px solid rgba(255,255,255,0.3); pointer-events: none;
  opacity: 0; transition: opacity 0.2s ease; text-align: center;
}
#debug-toast.is-visible { opacity: 1; }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export const MENU_ITEMS = [
  { id: 'overlay', type: 'toggle', label: 'FPS & position overlay', key: 'F3' },
  { id: 'collision', type: 'toggle', label: 'Collision boxes', key: 'F4' },
  { id: 'highlight', type: 'toggle', label: 'Highlight interactables', key: 'Shift+F4' },
  { id: 'perf', type: 'toggle', label: 'Perf stats (draw calls)', key: 'Shift+F3' },
  { id: 'screenshot', type: 'action', label: 'Screenshot + markup', key: 'F9' },
  { id: 'clearSave', type: 'action', label: 'Clear saved game', key: 'Shift+F8 twice', danger: true }
];

export function createDebugMenu({ actions, getState, getTeleports = () => [], onOpen = () => {}, onClose = () => {}, container = document.body }) {
  ensureStyles();

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'debug-button';
  button.className = 'debug-ui';
  button.textContent = 'Debug';
  button.setAttribute('aria-label', 'Open debug menu');
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (opened) close(); else open();
  });
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  container.appendChild(button);

  let root = null;
  let rows = {};
  let opened = false;
  let confirmTimer = null;
  let toastEl = null;
  let toastTimer = null;

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'debug-menu';
    root.className = 'debug-ui';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Debug menu');
    root.setAttribute('aria-hidden', 'true');

    const panel = document.createElement('div');
    panel.className = 'dm-panel';
    const head = document.createElement('div');
    head.className = 'dm-head';
    const title = document.createElement('h2');
    title.textContent = 'Debug';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dm-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close debug menu');
    closeBtn.addEventListener('click', close);
    head.append(title, closeBtn);
    panel.appendChild(head);

    for (const item of MENU_ITEMS) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'dm-row' + (item.danger ? ' dm-danger' : '');
      row.dataset.item = item.id;
      const label = document.createElement('span');
      label.className = 'dm-label';
      label.textContent = item.label;
      const key = document.createElement('span');
      key.className = 'dm-key';
      key.textContent = item.key;
      label.appendChild(key);
      row.appendChild(label);
      if (item.type === 'toggle') {
        row.setAttribute('role', 'switch');
        row.setAttribute('aria-checked', 'false');
        const sw = document.createElement('span');
        sw.className = 'dm-switch';
        row.appendChild(sw);
        row.addEventListener('click', () => {
          actions[item.id]();
          refresh();
        });
      } else if (item.id === 'clearSave') {
        row.addEventListener('click', () => onClearSaveTap(row, label));
      } else {
        row.addEventListener('click', () => {
          close();
          actions[item.id]();
        });
      }
      rows[item.id] = { row, label, item };
      panel.appendChild(row);
      if (item.id === 'screenshot') panel.appendChild(buildTeleportSection());
    }

    const foot = document.createElement('div');
    foot.className = 'dm-foot';
    foot.textContent = 'Keys: F2 or ` menu • F3 overlay • Shift+F3 perf • F4 collision • Shift+F4 highlight • F8 street start • Shift+F8 clear save • F9 screenshot';
    panel.appendChild(foot);

    root.appendChild(panel);
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    container.appendChild(root);
  }


  function buildTeleportSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'teleports';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Teleport';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    const list = document.createElement('div');
    list.className = 'dm-sublist';
    const presets = getTeleports() || [];
    for (const p of presets) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'dm-subrow';
      row.dataset.item = p.id;
      row.dataset.teleport = p.id;
      const label = document.createElement('span');
      label.className = 'dm-label';
      label.textContent = p.label;
      if (p.key) {
        const key = document.createElement('span');
        key.className = 'dm-key';
        key.textContent = p.key;
        label.appendChild(key);
      }
      row.appendChild(label);
      row.addEventListener('click', () => {
        close();
        if (typeof actions.teleportTo === 'function') actions.teleportTo(p.id);
        else if (p.id === 'street-start' && actions.teleport) actions.teleport();
      });
      rows[p.id] = { row, label, item: p };
      list.appendChild(row);
    }
    section.append(toggle, list);
    return section;
  }

  function resetConfirm() {
    if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null; }
    const r = rows.clearSave;
    if (r) {
      r.row.classList.remove('is-armed');
      r.label.firstChild.nodeValue = 'Clear saved game';
    }
  }

  function onClearSaveTap(row, label) {
    if (!row.classList.contains('is-armed')) {
      row.classList.add('is-armed');
      label.firstChild.nodeValue = 'Tap again to confirm clear';
      confirmTimer = setTimeout(resetConfirm, CONFIRM_MS);
      return;
    }
    resetConfirm();
    close();
    actions.clearSave();
  }

  function refresh() {
    if (!root) return;
    const state = getState();
    for (const id of ['overlay', 'collision', 'highlight', 'perf']) {
      if (rows[id]) rows[id].row.setAttribute('aria-checked', state[id] ? 'true' : 'false');
    }
  }

  function open() {
    build();
    if (opened) return;
    opened = true;
    refresh();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKey, true);
    onOpen();
  }

  function close() {
    if (!opened) return;
    opened = false;
    resetConfirm();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey, true);
    onClose();
  }

  function onKey(e) {
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  function setButtonVisible(v) {
    button.classList.toggle('is-visible', !!v);
  }

  function toast(message, ms = 2600) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'debug-toast';
      toastEl.setAttribute('role', 'status');
      container.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), ms);
  }

  return {
    button,
    open,
    close,
    refresh,
    toast,
    setButtonVisible,
    isOpen: () => opened,
    get element() { return root; }
  };
}
