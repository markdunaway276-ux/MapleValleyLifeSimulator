/**
 * Basic HTML inventory panel. Items live in an array of slotCount entries
 * (null when empty). Each slot has data-index and a render() method so
 * real items and drag-and-drop can be added later without rewriting the UI.
 */
const STYLE_ID = 'inventory-styles';

const CSS = `
#inventory-toggle {
  display: none;
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 45;
  padding: 8px 14px;
  font: 600 14px system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
}
body.mobile #inventory-toggle { display: block; }
#inventory-toggle:hover, #inventory-toggle:focus {
  background: rgba(0, 0, 0, 0.85);
  outline: none;
}

.inventory-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 40;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  font-family: system-ui, sans-serif;
  pointer-events: auto;
}
.inventory-overlay.is-open { display: flex; }

.inventory-panel {
  width: min(92vw, 520px);
  max-height: 90vh;
  overflow: auto;
  background: rgba(16, 16, 18, 0.92);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  padding: clamp(12px, 2.4vmin, 20px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.inventory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: clamp(8px, 1.6vmin, 14px);
}
.inventory-header h2 {
  margin: 0;
  font-size: clamp(16px, 3.2vmin, 20px);
  font-weight: 650;
  letter-spacing: 0.02em;
}
.inventory-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.inventory-close:hover, .inventory-close:focus {
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(6px, 1.2vmin, 10px);
  justify-items: center;
}
@media (min-width: 600px) {
  .inventory-grid { grid-template-columns: repeat(5, 1fr); }
}

.inventory-slot {
  box-sizing: border-box;
  width: 100%;
  max-width: clamp(52px, 9vmin, 80px);
  aspect-ratio: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
}
.inventory-slot:hover, .inventory-slot:focus {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}
.inventory-slot.filled { border-color: rgba(255, 255, 255, 0.4); }
.inventory-slot img, .inventory-slot .inventory-swatch {
  width: 70%;
  height: 70%;
  object-fit: contain;
  pointer-events: none;
}
.inventory-swatch { display: block; border-radius: 4px; }
.inventory-icon, .inventory-label {
  font-size: clamp(11px, 2.6vmin, 18px);
  line-height: 1.1;
  text-align: center;
  padding: 2px;
  pointer-events: none;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
}
.inventory-label { font-size: clamp(9px, 1.8vmin, 12px); }
.inventory-count {
  position: absolute;
  right: 3px;
  bottom: 2px;
  font-size: 11px;
  font-weight: 700;
  text-shadow: 0 1px 2px #000;
  pointer-events: none;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function renderSlot(slot, item) {
  slot.replaceChildren();
  slot.classList.toggle('filled', !!item);
  slot.title = item && item.name ? item.name : '';
  if (!item) return;

  if (item.icon) {
    const src = String(item.icon);
    if (/^(https?:|data:|blob:|\.\/|\.\.\/|\/)/.test(src)) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = item.name || '';
      slot.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.className = 'inventory-icon';
      icon.textContent = src;
      slot.appendChild(icon);
    }
  } else if (item.color) {
    const swatch = document.createElement('span');
    swatch.className = 'inventory-swatch';
    swatch.style.background = item.color;
    slot.appendChild(swatch);
  }

  if (item.name && !item.icon) {
    const label = document.createElement('span');
    label.className = 'inventory-label';
    label.textContent = item.name;
    slot.appendChild(label);
  }

  if (item.count != null && item.count > 1) {
    const count = document.createElement('span');
    count.className = 'inventory-count';
    count.textContent = String(item.count);
    slot.appendChild(count);
  }
}

export function createInventory({
  slotCount = 16,
  container = document.body,
  canvas = null,
  isStarted = null
} = {}) {
  ensureStyles();

  const items = Array.from({ length: slotCount }, () => null);
  let opened = false;

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'inventory-toggle';
  toggleBtn.type = 'button';
  toggleBtn.textContent = 'Bag';
  toggleBtn.setAttribute('aria-label', 'Inventory');

  const overlay = document.createElement('div');
  overlay.className = 'inventory-overlay';
  overlay.id = 'inventory';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Inventory');

  const panel = document.createElement('div');
  panel.className = 'inventory-panel';

  const header = document.createElement('div');
  header.className = 'inventory-header';
  const title = document.createElement('h2');
  title.textContent = 'Inventory';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'inventory-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  header.append(title, closeBtn);

  const grid = document.createElement('div');
  grid.className = 'inventory-grid';

  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.dataset.index = String(i);
    slot.tabIndex = 0;
    slot.render = () => renderSlot(slot, items[i]);
    slot.render();
    grid.appendChild(slot);
    slots.push(slot);
  }

  panel.append(header, grid);
  overlay.appendChild(panel);
  container.append(toggleBtn, overlay);

  function isMobile() {
    return typeof document !== 'undefined' && document.body.classList.contains('mobile');
  }

  function started() {
    return typeof isStarted === 'function' ? !!isStarted() : true;
  }

  function open() {
    if (opened) return;
    opened = true;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof document.exitPointerLock === 'function') document.exitPointerLock();
    window.dispatchEvent(new Event('inventory-open'));
  }

  function close() {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new Event('inventory-close'));
    if (!isMobile() && started() && canvas && typeof canvas.requestPointerLock === 'function') {
      canvas.requestPointerLock();
    }
  }

  function toggle() {
    if (opened) close();
    else open();
  }

  function isOpen() {
    return opened;
  }

  function setItem(index, item) {
    if (index < 0 || index >= slotCount) return;
    items[index] = item || null;
    slots[index].render();
  }

  function getItems() {
    return items.slice();
  }

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  panel.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.code === 'KeyI') {
      e.preventDefault();
      toggle();
    } else if (e.code === 'Escape' && opened) {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    toggle,
    isOpen,
    setItem,
    getItems,
    element: overlay
  };
}
