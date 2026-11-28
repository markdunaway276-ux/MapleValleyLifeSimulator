/**
 * Basic HTML inventory panel. Items live in an array of slotCount entries
 * (null when empty). Each slot has data-index and a render() method so
 * real items and drag-and-drop can be added later without rewriting the UI.
 *
 * Click or tap a slot to select it and show its details. Selection is kept
 * when the panel is closed and reopened.
 */
import { createItem, formatItemCount, ITEM_DEFS } from '../data/items.js';
import { requestPointerLock, exitPointerLock } from '../core/pointerLock.js';

const STYLE_ID = 'inventory-styles';
const HINT = 'Tap an item to see details';

const CSS = `
#inventory-toggle {
  display: none;
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 36;
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
body.mobile #inventory-toggle.is-visible {
  display: flex;
  align-items: center;
  justify-content: center;
  top: max(10px, env(safe-area-inset-top));
  right: max(10px, env(safe-area-inset-right));
  min-width: 40px;
  height: 40px;
  padding: 0 8px;
  font-size: 12px;
}
#inventory-toggle:hover, #inventory-toggle:focus {
  background: rgba(0, 0, 0, 0.85);
  outline: none;
}

.inventory-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 45;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  font-family: system-ui, sans-serif;
  pointer-events: auto;
}
.inventory-overlay.is-open { display: flex; }

.inventory-panel {
  width: min(94vw, 680px);
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

.inventory-body {
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 2vmin, 16px);
}
@media (min-width: 600px) {
  .inventory-body {
    flex-direction: row;
    align-items: stretch;
  }
  .inventory-grid { flex: 1 1 auto; }
  .inventory-detail {
    flex: 0 0 200px;
    width: 200px;
  }
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
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}
.inventory-slot:hover, .inventory-slot:focus {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}
.inventory-slot.filled { border-color: rgba(255, 255, 255, 0.4); }
.inventory-slot.selected {
  border-color: #f3d27a;
  background: rgba(243, 210, 122, 0.14);
  box-shadow: 0 0 0 2px rgba(243, 210, 122, 0.55);
}
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

.inventory-detail {
  box-sizing: border-box;
  min-height: 88px;
  padding: clamp(10px, 1.8vmin, 14px);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.inventory-detail-hint,
.inventory-detail-empty {
  margin: 0;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
}
.inventory-detail-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.inventory-detail-icon {
  font-size: 28px;
  line-height: 1;
  flex: 0 0 auto;
}
.inventory-detail-name {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}
.inventory-detail-count {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}
.inventory-detail-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.82);
}
.inventory-use {
  box-sizing: border-box;
  margin: 10px 0 0;
  min-height: 44px;
  padding: 8px 14px;
  font: 600 14px system-ui, sans-serif;
  color: #fff;
  background: #2e6b3f;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  align-self: flex-start;
}
.inventory-use:hover, .inventory-use:focus {
  background: #37824c;
  outline: none;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function normalizeItem(entry) {
  if (!entry) return null;
  if (entry.id && ITEM_DEFS[entry.id]) {
    const { id, ...extras } = entry;
    return createItem(id, extras);
  }
  return { ...entry };
}

function shouldShowCount(item) {
  if (!item || item.count == null) return false;
  return item.id === 'cash' || item.count > 1;
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

  if (shouldShowCount(item)) {
    const count = document.createElement('span');
    count.className = 'inventory-count';
    count.textContent = formatItemCount(item);
    slot.appendChild(count);
  }
}

export function createInventory({
  slotCount = 16,
  container = document.body,
  canvas = null,
  isStarted = null,
  isBlocked = null,
  items: initialItems = null,
  onSelect = null,
  onUse = null
} = {}) {
  ensureStyles();

  const items = Array.from({ length: slotCount }, () => null);
  let opened = false;
  let selected = -1;

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

  const body = document.createElement('div');
  body.className = 'inventory-body';

  const grid = document.createElement('div');
  grid.className = 'inventory-grid';

  const detail = document.createElement('div');
  detail.className = 'inventory-detail';
  detail.setAttribute('aria-live', 'polite');

  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.dataset.index = String(i);
    slot.tabIndex = 0;
    slot.setAttribute('role', 'button');
    slot.render = () => renderSlot(slot, items[i]);
    slot.render();
    grid.appendChild(slot);
    slots.push(slot);
  }

  body.append(grid, detail);
  panel.append(header, body);
  overlay.appendChild(panel);
  container.append(toggleBtn, overlay);

  function isMobile() {
    return typeof document !== 'undefined' && document.body.classList.contains('mobile');
  }

  function started() {
    return typeof isStarted === 'function' ? !!isStarted() : true;
  }

  function blocked() {
    return typeof isBlocked === 'function' && !!isBlocked();
  }

  function renderDetail() {
    detail.replaceChildren();
    if (selected < 0) {
      const hint = document.createElement('p');
      hint.className = 'inventory-detail-hint';
      hint.textContent = HINT;
      detail.appendChild(hint);
      return;
    }

    const item = items[selected];
    if (!item) {
      const empty = document.createElement('p');
      empty.className = 'inventory-detail-empty';
      empty.textContent = 'Empty slot';
      detail.appendChild(empty);
      return;
    }

    const top = document.createElement('div');
    top.className = 'inventory-detail-top';
    if (item.icon && !/^(https?:|data:|blob:|\.\/|\.\.\/|\/)/.test(String(item.icon))) {
      const icon = document.createElement('div');
      icon.className = 'inventory-detail-icon';
      icon.textContent = item.icon;
      top.appendChild(icon);
    } else if (item.icon) {
      const img = document.createElement('img');
      img.className = 'inventory-detail-icon';
      img.src = item.icon;
      img.alt = item.name || '';
      top.appendChild(img);
    } else if (item.color) {
      const swatch = document.createElement('span');
      swatch.className = 'inventory-swatch inventory-detail-icon';
      swatch.style.background = item.color;
      top.appendChild(swatch);
    }

    const heading = document.createElement('div');
    const name = document.createElement('h3');
    name.className = 'inventory-detail-name';
    name.textContent = item.name || 'Item';
    heading.appendChild(name);
    if (item.count != null) {
      const count = document.createElement('p');
      count.className = 'inventory-detail-count';
      count.textContent = formatItemCount(item);
      heading.appendChild(count);
    }
    top.appendChild(heading);
    detail.appendChild(top);

    if (item.description) {
      const desc = document.createElement('p');
      desc.className = 'inventory-detail-desc';
      desc.textContent = item.description;
      detail.appendChild(desc);
    }

    const use = item.use || (ITEM_DEFS[item.id] && ITEM_DEFS[item.id].use);
    if (use) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inventory-use';
      btn.textContent = use.label || 'Use';
      btn.setAttribute('aria-label', use.label || 'Use');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        useItem(selected);
      });
      detail.appendChild(btn);
    }
  }

  function selectSlot(index) {
    if (index == null || index === -1) {
      selected = -1;
    } else {
      const i = Number(index);
      if (i < 0 || i >= slotCount || Number.isNaN(i)) return;
      selected = i;
    }
    slots.forEach((s, i) => s.classList.toggle('selected', i === selected));
    renderDetail();
    const payload = selected < 0 ? { index: -1, item: null } : { index: selected, item: items[selected] };
    if (typeof onSelect === 'function') onSelect(payload);
    window.dispatchEvent(new CustomEvent('inventory-select', { detail: payload }));
  }

  function getSelected() {
    if (selected < 0) return null;
    return { index: selected, item: items[selected] };
  }

  function open() {
    if (opened || !started() || blocked()) return;
    opened = true;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    exitPointerLock();
    window.dispatchEvent(new Event('inventory-open'));
  }

  function close() {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new Event('inventory-close'));
    if (!isMobile() && started() && !blocked()) {
      requestPointerLock(canvas);
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
    items[index] = normalizeItem(item);
    slots[index].render();
    if (selected === index) renderDetail();
  }

  function getItems() {
    return items.slice();
  }

  /** Add `count` of an item, stacking onto an existing stackable entry. */
  function addItem(id, count = 1) {
    const def = ITEM_DEFS[id];
    if (!def) return null;
    const n = Math.max(1, Number(count) || 1);
    if (def.stackable) {
      const i = items.findIndex((it) => it && it.id === id);
      if (i >= 0) {
        items[i] = normalizeItem({ ...items[i], count: (items[i].count || 1) + n });
        slots[i].render();
        if (selected === i) renderDetail();
        return items[i];
      }
    }
    const empty = items.findIndex((it) => !it);
    if (empty < 0) return null;
    items[empty] = createItem(id, { count: n });
    slots[empty].render();
    return items[empty];
  }

  /** Remove `count` of the item in `index`. Drops the slot when the stack hits 0. */
  function consume(index, count = 1) {
    if (index < 0 || index >= slotCount) return null;
    const item = items[index];
    if (!item) return null;
    const n = Math.max(1, Number(count) || 1);
    const next = (item.count || 1) - n;
    const id = item.id;
    if (next <= 0) {
      items[index] = null;
      slots[index].render();
      if (selected === index) renderDetail();
      return { id, count: 0, removed: true };
    }
    items[index] = normalizeItem({ ...item, count: next });
    slots[index].render();
    if (selected === index) renderDetail();
    return items[index];
  }

  function useItem(index = selected) {
    if (index == null || index < 0 || index >= slotCount) return null;
    const item = items[index];
    if (!item) return null;
    const use = item.use || (ITEM_DEFS[item.id] && ITEM_DEFS[item.id].use);
    if (!use) return null;
    const consumed = use.consume === false
      ? { id: item.id, count: item.count || 1, removed: false }
      : consume(index, 1);
    const detail = { item, use, index, consumed };
    if (typeof onUse === 'function') onUse(detail);
    window.dispatchEvent(new CustomEvent('inventory-use', { detail }));
    return consumed;
  }

  function serialize() {
    return items.map((it) => (it ? { id: it.id, count: it.count || 1 } : null));
  }

  function loadItems(list) {
    for (let i = 0; i < slotCount; i++) {
      items[i] = list && list[i] ? normalizeItem(list[i]) : null;
      slots[i].render();
    }
    if (selected >= 0) renderDetail();
  }

  if (initialItems) {
    initialItems.forEach((entry, i) => {
      if (i < slotCount) {
        items[i] = normalizeItem(entry);
        slots[i].render();
      }
    });
  }
  renderDetail();

  function onSlotActivate(e) {
    e.stopPropagation();
    selectSlot(Number(e.currentTarget.dataset.index));
  }
  slots.forEach((slot) => {
    // click covers mouse and (because document touch handlers do not
    // preventDefault) the synthetic click that follows a mobile tap.
    // pointerup handles touch in case the click is suppressed; skip
    // mouse here so we do not select twice (pointerup + click).
    let choseOnPointer = false;
    slot.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      choseOnPointer = true;
      onSlotActivate(e);
    });
    slot.addEventListener('click', (e) => {
      if (choseOnPointer) { choseOnPointer = false; return; }
      onSlotActivate(e);
    });
    slot.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        selectSlot(Number(slot.dataset.index));
      }
    });
  });

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
      if (!opened && (!started() || blocked())) return;
      e.preventDefault();
      if (e.repeat) return;
      toggle();
    } else if (e.code === 'Escape' && opened) {
      e.preventDefault();
      close();
    }
  });

  function setHudVisible(v) {
    toggleBtn.classList.toggle('is-visible', !!v);
  }

  return {
    open,
    close,
    toggle,
    isOpen,
    setHudVisible,
    setItem,
    getItems,
    addItem,
    consume,
    useItem,
    serialize,
    loadItems,
    selectSlot,
    getSelected,
    button: toggleBtn,
    element: overlay
  };
}
