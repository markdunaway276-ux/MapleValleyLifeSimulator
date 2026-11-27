/**
 * Debug button + touch-friendly debug menu.
 * The "Debug" button sits in the bottom-right corner (Bag is top-right, the
 * joystick bottom-left, the door prompt bottom-centre) and only shows after
 * Start. The menu panel is built lazily on first open from per-tab modules
 * under src/ui/debug/. Rows are 52px tall.
 */

import { ensureStyles } from './debug/style.js';
import { buildQuickBar } from './debug/quickBar.js';
import { buildWorldTab } from './debug/worldTab.js';
import { buildPlayerTab } from './debug/playerTab.js';
import { buildViewTab } from './debug/viewTab.js';
import { buildToolsTab } from './debug/toolsTab.js';

const CONFIRM_MS = 4000;
const LAYOUT_KEY = 'mapleValleyDebugLayout';

const TABS = [
  { id: 'world', label: 'World' },
  { id: 'player', label: 'Player' },
  { id: 'view', label: 'View' },
  { id: 'tools', label: 'Tools' }
];

export const MENU_ITEMS = [
  { id: 'overlay', type: 'toggle', label: 'FPS & position overlay', key: 'F3' },
  { id: 'collision', type: 'toggle', label: 'Collision boxes', key: 'F4' },
  { id: 'highlight', type: 'toggle', label: 'Highlight interactables', key: 'Shift+F4' },
  { id: 'perf', type: 'toggle', label: 'Perf stats (draw calls)', key: 'Shift+F3' },
  { id: 'screenshot', type: 'action', label: 'Screenshot + markup', key: 'F9' },
  { id: 'clearSave', type: 'action', label: 'Clear saved game', key: 'Shift+F8 twice', danger: true }
];

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
    return { tab: typeof saved.tab === 'string' ? saved.tab : 'world', open: Array.isArray(saved.open) ? saved.open : [] };
  } catch {
    return { tab: 'world', open: [] };
  }
}

function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* storage unavailable */ }
}

export function createDebugMenu({
  actions,
  getState,
  getTeleports = () => [],
  getClock = null,
  getSfx = null,
  getNeeds = null,
  getMoney = null,
  getMinimap = null,
  getWeather = null,
  getSaveHud = null,
  getSkills = null,
  getDisplay = null,
  getDev = null,
  onOpen = () => {},
  onClose = () => {},
  container = document.body
}) {
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
  const rows = {};
  let opened = false;
  let confirmTimer = null;
  let toastEl = null;
  let toastTimer = null;

  let worldTab = null;
  let playerTab = null;
  let viewTab = null;

  const refreshTime = () => worldTab?.refreshTime();
  const refreshWeather = () => worldTab?.refreshWeather();
  const refreshDev = () => playerTab?.refreshDev();
  const refreshNeeds = () => playerTab?.refreshNeeds();
  const refreshMoney = () => playerTab?.refreshMoney();
  const refreshSkills = () => playerTab?.refreshSkills();
  const refreshDisplay = () => viewTab?.refreshDisplay();
  const refreshMinimap = () => viewTab?.refreshMinimap();
  const refreshSaveHud = () => viewTab?.refreshSaveHud();
  const refreshMute = () => viewTab?.refreshMute();

  function toggleDevelopment() {
    const dev = getDev && getDev();
    if (dev) { dev.setOn(!dev.isOn()); return; }
    const needs = getNeeds && getNeeds();
    if (needs && typeof needs.setDevelopmentMode === 'function') needs.setDevelopmentMode(!needs.isDevelopmentMode());
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

  function makeMenuRow(item) {
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
    return row;
  }

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

    const quick = buildQuickBar({
      actions,
      getTeleports,
      getClock,
      rows,
      close,
      toggleDevelopment,
      refresh,
      refreshTime
    });
    panel.append(head, quick.bar);

    const layout = loadLayout();
    const tabBar = document.createElement('div');
    tabBar.className = 'dm-tabs';
    tabBar.setAttribute('role', 'tablist');
    const panes = {};
    const tabBtns = {};
    for (const t of TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dm-tab';
      b.setAttribute('role', 'tab');
      b.dataset.tab = t.id;
      b.textContent = t.label;
      tabBar.appendChild(b);
      tabBtns[t.id] = b;
      const pane = document.createElement('div');
      pane.className = 'dm-pane';
      pane.dataset.tab = t.id;
      pane.setAttribute('role', 'tabpanel');
      panes[t.id] = pane;
    }
    function showTab(id) {
      if (!panes[id]) id = 'world';
      for (const t of TABS) {
        panes[t.id].hidden = t.id !== id;
        tabBtns[t.id].setAttribute('aria-selected', String(t.id === id));
      }
      layout.tab = id;
      saveLayout(layout);
    }
    for (const t of TABS) tabBtns[t.id].addEventListener('click', () => showTab(t.id));

    worldTab = buildWorldTab(panes.world, { getClock, getWeather });
    playerTab = buildPlayerTab(panes.player, {
      getDev,
      getNeeds,
      getMoney,
      getSkills,
      toggleDevelopment,
      refresh,
      quickEls: quick
    });
    viewTab = buildViewTab(panes.view, {
      menuItems: MENU_ITEMS,
      makeMenuRow,
      getDisplay,
      getMinimap,
      getSaveHud,
      getSfx
    });
    buildToolsTab(panes.tools, { menuItems: MENU_ITEMS, makeMenuRow });

    // Sections start closed; remember the ones you open.
    for (const pane of Object.values(panes)) {
      for (const section of pane.querySelectorAll('.dm-section')) {
        const id = section.dataset.item || '';
        const isOpen = layout.open.includes(id);
        section.classList.toggle('is-open', isOpen);
        const t = section.querySelector('.dm-section-toggle');
        if (!t) continue;
        t.setAttribute('aria-expanded', String(isOpen));
        t.addEventListener('click', () => {
          const nowOpen = section.classList.contains('is-open');
          t.setAttribute('aria-expanded', String(nowOpen));
          layout.open = layout.open.filter((x) => x !== id);
          if (nowOpen) layout.open.push(id);
          saveLayout(layout);
        });
      }
    }

    panel.appendChild(tabBar);
    for (const t of TABS) panel.appendChild(panes[t.id]);
    showTab(layout.tab);

    root.appendChild(panel);
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    container.appendChild(root);
  }

  function refresh() {
    if (!root) return;
    const state = getState();
    for (const id of ['overlay', 'collision', 'highlight', 'perf']) {
      if (rows[id]) rows[id].row.setAttribute('aria-checked', state[id] ? 'true' : 'false');
    }
    refreshDisplay();
    refreshTime();
    refreshMute();
    refreshNeeds();
    refreshMoney();
    refreshMinimap();
    refreshWeather();
    refreshSaveHud();
    refreshSkills();
    refreshDev();
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
    refreshTime,
    refreshMute,
    refreshNeeds,
    refreshMoney,
    refreshMinimap,
    refreshWeather,
    refreshSaveHud,
    refreshSkills,
    toast,
    setButtonVisible,
    isOpen: () => opened,
    get element() { return root; }
  };
}
