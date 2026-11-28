/**
 * Title screen: replaces the old "Click to start" box.
 *
 *   Continue   – play the active save slot (shown when it has a save)
 *   New game   – pick a slot (overwriting asks first), start fresh there
 *   Load game  – pick a saved slot
 *   Settings   – the same tabbed settings as the pause menu
 *
 * The game has already loaded the active slot when this shows, so Continue
 * just starts. Choosing another slot (or a new game) remembers the slot,
 * stops autosaves and reloads the page directly into the chosen slot.
 */

import { CAR_SPAWN } from '../world/props.js';
import { WHATS_NEW } from '../data/changelog.js';
import { ensureMenuStyles, el, button, heading, renderSettings } from './menuKit.js';
import { SLOT_COUNT, getGameSlot, setActiveSlot, readSlot, clearSlot, freezeSaves } from '../systems/save.js';

export function createTitleBackdrop({ camera, car, draw }) {
  const position = camera.position.clone();
  const rotation = camera.quaternion.clone();
  const parkedPosition = car.position.clone();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed = 0;

  return (delta) => {
    if (!reducedMotion.matches) elapsed += delta;
    const drift = Math.sin(elapsed * 0.085);
    const portrait = camera.aspect < 1;
    position.copy(camera.position);
    rotation.copy(camera.quaternion);
    parkedPosition.copy(car.position);
    const parkedHeading = car.rotation.y;
    const oldFov = camera.fov;

    try {
      car.position.set(CAR_SPAWN.x, 0, CAR_SPAWN.z);
      car.rotation.y = CAR_SPAWN.rotY;
      camera.position.set(15 + 3 * drift, 9 + drift, 22 + 1.4 * drift);
      camera.fov = 70;
      camera.updateProjectionMatrix();
      // Frame the truck below-right of the panel on desktop and above it on phones.
      camera.lookAt(portrait ? 11 + 1.5 * drift : -16, portrait ? 0 : 2, portrait ? 16 + 0.7 * drift : 6);
      draw();
    } finally {
      car.position.copy(parkedPosition);
      car.rotation.y = parkedHeading;
      car.updateMatrixWorld(true);
      camera.position.copy(position);
      camera.quaternion.copy(rotation);
      camera.fov = oldFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }
  };
}

const READY_FLAG = 'mapleValleyLife_slotReady';

function formatClock(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0)) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${((h + 11) % 12) + 1}:${mm} ${ampm}`;
}

/** One line describing a slot, e.g. "Day 3 · 2:15 PM · $82 · saved Nov 26". */
export function slotSummary(data) {
  if (!data) return 'Empty';
  const t = data.time || {};
  const cash = data.money && typeof data.money === 'object' ? data.money.cash : data.money;
  const parts = [`Day ${t.day || 1}`];
  if (t.minutes != null) parts.push(formatClock(t.minutes));
  if (cash != null && Number.isFinite(Number(cash))) parts.push('$' + Math.round(Number(cash)));
  if (data.savedAt) {
    try { parts.push('saved ' + new Date(data.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })); } catch { /* skip */ }
  }
  return parts.join(' · ');
}

export function createTitleScreen({
  onStart,
  isMobile = false,
  getDisplay = () => null,
  getSettings = () => null,
  getSfx = () => null,
  applyLive = {},
  container = document.body
} = {}) {
  ensureMenuStyles();
  const old = document.getElementById('instructions');
  if (old) old.style.display = 'none';

  const root = el('div', { id: 'title-screen', class: 'mv-overlay is-open', role: 'dialog', 'aria-label': 'Title screen' });
  root.style.background = 'radial-gradient(ellipse at center, rgba(20,14,8,0.04), rgba(8,6,4,0.32))';
  root.style.backdropFilter = 'none';
  root.style.webkitBackdropFilter = 'none';
  root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  const panel = el('div', { class: 'mv-panel' });
  root.append(panel);
  container.append(root);

  let page = 'main';
  let pendingOverwrite = null;
  const settingsState = { tab: 'display' };
  let pendingStart = null;
  try {
    const flag = sessionStorage.getItem(READY_FLAG);
    if (flag) {
      sessionStorage.removeItem(READY_FLAG);
      pendingStart = JSON.parse(flag);
    }
  } catch { /* no session storage */ }

  const go = (p) => { page = p; pendingOverwrite = null; render(); };

  function switchTo(slot, kind) {
    if (setActiveSlot(slot) === null) {
      showStorageError();
      return;
    }
    freezeSaves();
    try { sessionStorage.setItem(READY_FLAG, JSON.stringify({ slot, kind })); } catch { /* fine */ }
    location.reload();
  }

  function showStorageError() {
    if (!panel.querySelector('.mv-storage-error')) {
      panel.append(el('p', { class: 'mv-note mv-storage-error', text: 'Could not update the save slot. Check your browser storage settings.' }));
    }
  }

  function start() {
    root.classList.remove('is-open');
    onStart();
  }

  function renderMain() {
    panel.append(heading('Maple Valley', 'A small-town life simulator'));
    const active = getGameSlot();
    const data = readSlot(active);
    if (data) panel.append(button('Continue', start, { primary: true, sub: `Slot ${active} · ${slotSummary(data)}` }));
    else panel.append(button('Start new game', start, { primary: true, sub: `Slot ${active}` }));
    panel.append(button('New game', () => go('new')));
    panel.append(button('Load game', () => go('load')));
    panel.append(button('Settings', () => go('settings')));
    panel.append(button("What's New", () => go('changelog')));
  }

  function renderSlots(kind) {
    panel.append(heading(kind === 'new' ? 'New game' : 'Load game', kind === 'new' ? 'Pick a slot to start fresh in' : 'Pick a save to play'));
    const active = getGameSlot();
    for (let n = 1; n <= SLOT_COUNT; n++) {
      const data = readSlot(n);
      const label = `Slot ${n}` + (n === active ? ' (current)' : '');
      if (kind === 'load') {
        const b = button(label, () => {
          if (!data) return;
          if (n === active) start();
          else switchTo(n, 'load');
        }, { sub: slotSummary(data) });
        if (!data) b.disabled = true, b.style.opacity = '0.5';
        panel.append(b);
      } else {
        const confirm = pendingOverwrite === n;
        panel.append(button(confirm ? `Tap again to erase ${label}` : label, () => {
          if (data && !confirm) { pendingOverwrite = n; render(); return; }
          if (!clearSlot(n)) {
            showStorageError();
            return;
          }
          switchTo(n, 'new');
        }, { danger: confirm, sub: data ? slotSummary(data) + ' — will be erased' : 'Empty' }));
      }
    }
    panel.append(button('Back', () => go('main'), { primary: true }));
  }

  function render() {
    panel.textContent = '';
    if (page === 'settings') {
      renderSettings(panel, {
        state: settingsState,
        display: getDisplay(),
        settings: getSettings(),
        sfx: getSfx(),
        isMobile,
        applyLive,
        onReload: () => location.reload(),
        onBack: () => go('main')
      });
    } else if (page === 'changelog') {
      panel.append(heading("What's New", WHATS_NEW.title));
      const list = el('ul', { class: 'mv-note' });
      for (const change of WHATS_NEW.changes) list.append(el('li', { text: change }));
      panel.append(list, button('Back', () => go('main'), { primary: true }));
    } else if (page === 'new' || page === 'load') renderSlots(page);
    else renderMain();
  }

  render();
  if (pendingStart?.slot === getGameSlot()) {
    const hasSave = !!readSlot(pendingStart.slot);
    if ((pendingStart.kind === 'load' && hasSave) || (pendingStart.kind === 'new' && !hasSave)) {
      // Wait for main.js to finish wiring the renderer and frame loop.
      queueMicrotask(start);
    }
  }

  return {
    element: root,
    isOpen: () => root.classList.contains('is-open'),
    show() { page = 'main'; render(); root.classList.add('is-open'); }
  };
}
