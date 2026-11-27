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
#debug-menu .dm-subrow[aria-checked="true"] .dm-switch { background: #2e9e4f; }
#debug-menu .dm-subrow[aria-checked="true"] .dm-switch::after { transform: translateX(20px); }
#debug-menu .dm-subrow[role="switch"] { width: 100%; }
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
#debug-menu .dm-time { padding: 10px 14px 12px; }
#debug-menu .dm-time-label { font-weight: 600; margin: 0 0 6px; }
#debug-menu .dm-time input[type=range] {
  display: block; width: 100%; height: 44px; margin: 0; padding: 0; cursor: pointer;
  accent-color: #3fbf6a; background: transparent;
}
#debug-menu .dm-time-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
#debug-menu .dm-time-row button {
  min-height: 44px; min-width: 52px; padding: 8px 10px; font-weight: 600;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-time-row button[aria-pressed="true"] { background: #1f6f3a; border-color: #3fbf6a; }
#debug-menu .dm-needs { padding: 10px 14px 12px; }
#debug-menu .dm-needs-label { font-weight: 600; margin: 0 0 8px; }
#debug-menu .dm-needs-row { display: flex; gap: 6px; flex-wrap: wrap; }
#debug-menu .dm-needs-row button {
  min-height: 44px; min-width: 72px; padding: 8px 10px; font-weight: 600;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-quick { margin: 0 0 8px; padding: 8px; background: #222228; border: 1px solid #44444c; border-radius: 10px; }
#debug-menu .dm-quick-row { display: flex; gap: 6px; flex-wrap: wrap; }
#debug-menu .dm-quick-row + .dm-quick-row { margin-top: 6px; }
#debug-menu .dm-chip {
  min-height: 44px; padding: 8px 12px; font-weight: 600; flex: 1 1 auto;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-chip-small { flex: 1 1 0; padding: 8px 6px; }
#debug-menu .dm-chip-dev[aria-pressed="true"] { background: #1f6f3a; border-color: #3fbf6a; }
#debug-menu .dm-select {
  flex: 3 1 auto; min-height: 44px; padding: 8px 10px; font: inherit; color: #fff;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-tabs { display: flex; gap: 4px; margin: 4px 0 2px; position: sticky; top: -10px; z-index: 1; background: #1b1b1f; padding: 4px 0; }
#debug-menu .dm-tab {
  flex: 1 1 0; min-height: 40px; font-weight: 600; color: #c8c8d0;
  background: #222228; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-tab[aria-selected="true"] { color: #fff; background: #3a3a44; border-color: #8a8a96; }
#debug-menu .dm-help { font-size: 13px; color: #a8a8b2; margin: 8px 4px 2px; }
#debug-menu .dm-money { padding: 10px 14px 12px; }
#debug-menu .dm-money-label { font-weight: 600; margin: 0 0 8px; }
#debug-menu .dm-money-row { display: flex; gap: 6px; flex-wrap: wrap; }
#debug-menu .dm-money-row button {
  min-height: 44px; min-width: 72px; padding: 8px 10px; font-weight: 600;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
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

export function createDebugMenu({ actions, getState, getTeleports = () => [], getClock = null, getSfx = null, getNeeds = null, getMoney = null, getMinimap = null, getWeather = null, getSaveHud = null, getSkills = null, getDisplay = null, getDev = null, onOpen = () => {}, onClose = () => {}, container = document.body }) {
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

  // Which tab and which sections were open last time (sections start closed).
  const LAYOUT_KEY = 'mapleValleyDebugLayout';
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
  const TABS = [
    { id: 'world', label: 'World' },
    { id: 'player', label: 'Player' },
    { id: 'view', label: 'View' },
    { id: 'tools', label: 'Tools' }
  ];
  let quickEls = null;

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

  function toggleDevelopment() {
    const dev = getDev && getDev();
    if (dev) { dev.setOn(!dev.isOn()); return; }
    const needs = getNeeds && getNeeds();
    if (needs && typeof needs.setDevelopmentMode === 'function') needs.setDevelopmentMode(!needs.isDevelopmentMode());
  }

  /** Development mode, screenshot, teleport and time skips: always at the top. */
  function buildQuickBar() {
    const bar = document.createElement('div');
    bar.className = 'dm-quick';

    const devBtn = document.createElement('button');
    devBtn.type = 'button';
    devBtn.className = 'dm-chip dm-chip-dev';
    devBtn.dataset.item = 'development-quick';
    devBtn.addEventListener('click', () => { toggleDevelopment(); refresh(); });
    const shotBtn = document.createElement('button');
    shotBtn.type = 'button';
    shotBtn.className = 'dm-chip';
    shotBtn.textContent = 'Screenshot';
    shotBtn.addEventListener('click', () => { close(); actions.screenshot(); });
    const top = document.createElement('div');
    top.className = 'dm-quick-row';
    top.append(devBtn, shotBtn);

    // Teleport: one dropdown instead of a column of buttons.
    const tpRow = document.createElement('div');
    tpRow.className = 'dm-quick-row';
    const select = document.createElement('select');
    select.className = 'dm-select';
    select.setAttribute('aria-label', 'Teleport to');
    for (const p of getTeleports() || []) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      select.appendChild(opt);
      rows[p.id] = { row: opt, label: opt, item: p };
    }
    select.addEventListener('pointerdown', (e) => e.stopPropagation());
    const goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'dm-chip';
    goBtn.textContent = 'Teleport';
    goBtn.dataset.item = 'teleport-go';
    goBtn.addEventListener('click', () => {
      close();
      if (typeof actions.teleportTo === 'function') actions.teleportTo(select.value);
      else if (select.value === 'street-start' && actions.teleport) actions.teleport();
    });
    tpRow.append(select, goBtn);
    bar.append(top, tpRow);

    // Skip to a time of day.
    if (typeof getClock === 'function') {
      const timeRow = document.createElement('div');
      timeRow.className = 'dm-quick-row';
      for (const [label, minutes] of [['6 AM', 360], ['Noon', 720], ['6 PM', 1080], ['Midnight', 0]]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dm-chip dm-chip-small';
        b.textContent = label;
        b.addEventListener('click', () => {
          const clock = getClock();
          if (clock) clock.setTime(minutes);
          refreshTime();
        });
        timeRow.appendChild(b);
      }
      bar.appendChild(timeRow);
    }
    quickEls = { devBtn, select };
    return bar;
  }

  /** Development extras: fly, fast laundry machines, fill the car's tank. */
  let devEls = null;
  function buildDevSection() {
    const section = document.createElement('div');
    section.className = 'dm-section';
    section.dataset.item = 'development';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Development';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    toggle.addEventListener('click', () => section.classList.toggle('is-open'));
    const list = document.createElement('div');
    list.className = 'dm-sublist';
    const help = document.createElement('div');
    help.className = 'dm-help';
    help.textContent = 'Fly and fast machines also turn on development mode; turning development mode off turns them off.';
    list.appendChild(help);
    const dev = () => (getDev && getDev()) || null;
    const makeSwitch = (id, label, sub, get, set) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'dm-subrow';
      row.dataset.item = id;
      row.setAttribute('role', 'switch');
      const text = document.createElement('span');
      text.className = 'dm-label';
      text.textContent = label;
      const key = document.createElement('span');
      key.className = 'dm-key';
      key.textContent = sub;
      text.appendChild(key);
      const sw = document.createElement('span');
      sw.className = 'dm-switch';
      row.append(text, sw);
      row.addEventListener('click', () => { set(!get()); refresh(); });
      list.appendChild(row);
      return { row, get };
    };
    const switches = [
      makeSwitch('dev-mode', 'Development mode', 'Needs stay full · reach up to 12 m (not through walls)',
        () => (dev() ? dev().isOn() : !!getNeeds?.()?.isDevelopmentMode?.()), () => toggleDevelopment()),
      makeSwitch('dev-fly', 'Fly', 'Move where you look · Space up · C down · passes through walls',
        () => !!dev()?.isFly(), (v) => dev()?.setFly(v)),
      makeSwitch('dev-fast', 'Fast laundry machines', 'Washers and dryers finish in a minute · new bags every 5 min',
        () => !!dev()?.isFast(), (v) => dev()?.setFast(v))
    ];
    // Plain button: fill the car's tank, or empty a full one to test running out.
    const fuelRow = document.createElement('button');
    fuelRow.type = 'button';
    fuelRow.className = 'dm-subrow';
    fuelRow.dataset.item = 'dev-fuel';
    const fuelText = document.createElement('span');
    fuelText.className = 'dm-label';
    fuelText.textContent = 'Fill car tank';
    const fuelKey = document.createElement('span');
    fuelKey.className = 'dm-key';
    fuelKey.textContent = 'Fills the gas tank · press again on a full tank to empty it';
    fuelText.appendChild(fuelKey);
    fuelRow.appendChild(fuelText);
    fuelRow.addEventListener('click', () => dev()?.fillTank?.());
    list.appendChild(fuelRow);
    section.append(toggle, list);
    devEls = { switches };
    return section;
  }

  function refreshDev() {
    if (!root) return;
    const dev = getDev && getDev();
    const needs = getNeeds && getNeeds();
    const on = dev ? dev.isOn() : !!(needs && needs.isDevelopmentMode && needs.isDevelopmentMode());
    if (quickEls) {
      quickEls.devBtn.textContent = 'Development mode: ' + (on ? 'On' : 'Off');
      quickEls.devBtn.setAttribute('aria-pressed', String(on));
    }
    if (devEls) for (const s of devEls.switches) s.row.setAttribute('aria-checked', s.get() ? 'true' : 'false');
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
    panel.append(head, buildQuickBar());

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

    // World: time and weather.
    if (typeof getClock === 'function') panes.world.appendChild(buildTimeSection());
    if (typeof getWeather === 'function') panes.world.appendChild(buildWeatherSection());
    // Player: development, needs, money, skills.
    panes.player.appendChild(buildDevSection());
    if (typeof getNeeds === 'function') panes.player.appendChild(buildNeedsSection());
    if (typeof getMoney === 'function') panes.player.appendChild(buildMoneySection());
    if (typeof getSkills === 'function') panes.player.appendChild(buildSkillsSection());
    // View: display, overlays, map, HUD, sound.
    if (typeof getDisplay === 'function') panes.view.appendChild(buildDisplaySection());
    for (const item of MENU_ITEMS) if (item.type === 'toggle') panes.view.appendChild(makeMenuRow(item));
    if (typeof getMinimap === 'function') panes.view.appendChild(buildMinimapSection());
    if (typeof getSaveHud === 'function') panes.view.appendChild(buildSaveHudSection());
    if (typeof getSfx === 'function') panes.view.appendChild(buildSoundSection());
    // Tools: screenshot and clear save, plus the key list.
    for (const item of MENU_ITEMS) if (item.type !== 'toggle') panes.tools.appendChild(makeMenuRow(item));
    const foot = document.createElement('div');
    foot.className = 'dm-foot';
    foot.textContent = 'Keys: F2 or ` menu • F3 overlay • Shift+F3 perf • F4 collision • Shift+F4 highlight • F8 street start • Shift+F8 clear save • F9 screenshot';
    panes.tools.appendChild(foot);

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

  let timeEls = null;

  let displayEls = null;

  function makeSlider({ label, min, max, step, onInput }) {
    const wrap = document.createElement('div');
    const text = document.createElement('div');
    text.className = 'dm-time-label';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('aria-label', label);
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('input', () => onInput(Number(input.value)));
    wrap.append(text, input);
    return { wrap, text, input };
  }

  function buildDisplaySection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'display';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Display';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const body = document.createElement('div');
    body.className = 'dm-sublist dm-time';
    const d = () => getDisplay && getDisplay();
    const bright = makeSlider({ label: 'Brightness', min: 0.5, max: 2, step: 0.05, onInput: (v) => { const x = d(); if (x) x.setBrightness(v); refreshDisplay(); } });
    const film = makeSlider({ label: 'Film look', min: 0, max: 1, step: 0.05, onInput: (v) => { const x = d(); if (x) x.setFilm(v); refreshDisplay(); } });
    const row = document.createElement('div');
    row.className = 'dm-time-row';
    const grainBtn = document.createElement('button');
    grainBtn.type = 'button';
    grainBtn.dataset.displayAction = 'grain';
    grainBtn.addEventListener('click', () => { const x = d(); if (x) x.setGrain(!x.get().grain); refreshDisplay(); });
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.dataset.displayAction = 'reset';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => { const x = d(); if (x) x.reset(); refreshDisplay(); });
    const x0 = d();
    if (x0 && x0.hasGrain()) row.appendChild(grainBtn);
    row.appendChild(resetBtn);
    body.append(bright.wrap, film.wrap, row);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, body);
    displayEls = { section, bright, film, grainBtn };
    refreshDisplay();
    return section;
  }

  function refreshDisplay() {
    if (!displayEls || typeof getDisplay !== 'function') return;
    const x = getDisplay();
    if (!x) return;
    const s = x.get();
    displayEls.bright.text.textContent = `Brightness ${Math.round(s.brightness * 100)}%`;
    displayEls.film.text.textContent = `Film look ${Math.round(s.film * 100)}%`;
    if (document.activeElement !== displayEls.bright.input) displayEls.bright.input.value = String(s.brightness);
    if (document.activeElement !== displayEls.film.input) displayEls.film.input.value = String(s.film);
    displayEls.grainBtn.textContent = s.grain ? 'Grain: on' : 'Grain: off';
    displayEls.grainBtn.setAttribute('aria-pressed', s.grain ? 'true' : 'false');
  }

  function buildTimeSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'time';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Time of day';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const body = document.createElement('div');
    body.className = 'dm-sublist dm-time';
    const label = document.createElement('div');
    label.className = 'dm-time-label';
    label.dataset.timeLabel = '1';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1439';
    slider.step = '1';
    slider.setAttribute('aria-label', 'Time of day');
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    slider.addEventListener('input', () => {
      const clock = getClock && getClock();
      if (clock) clock.setTime(Number(slider.value));
    });
    const row = document.createElement('div');
    row.className = 'dm-time-row';
    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.dataset.timeAction = 'pause';
    pauseBtn.addEventListener('click', () => {
      const clock = getClock && getClock();
      if (!clock) return;
      clock.setPaused(!clock.isPaused());
      refreshTime();
    });
    row.appendChild(pauseBtn);
    const speeds = [1, 4, 16, 60];
    const speedBtns = speeds.map((mult) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.timeScale = String(mult);
      b.textContent = mult === 1 ? '1×' : mult + '×';
      b.addEventListener('click', () => {
        const clock = getClock && getClock();
        if (!clock) return;
        clock.setScale(60 * mult);
        refreshTime();
      });
      row.appendChild(b);
      return b;
    });
    body.append(label, slider, row);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, body);
    timeEls = { section, label, slider, pauseBtn, speedBtns };
    refreshTime();
    return section;
  }

  let soundEls = null;

  function buildSoundSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'sound';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Sound';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const list = document.createElement('div');
    list.className = 'dm-sublist';
    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'dm-subrow';
    muteBtn.dataset.item = 'mute';
    muteBtn.setAttribute('role', 'switch');
    const label = document.createElement('span');
    label.className = 'dm-label';
    label.textContent = 'Mute';
    const sw = document.createElement('span');
    sw.className = 'dm-switch';
    muteBtn.append(label, sw);
    muteBtn.addEventListener('click', () => {
      const sfx = getSfx && getSfx();
      if (sfx && typeof sfx.toggleMuted === 'function') sfx.toggleMuted();
      refreshMute();
    });
    list.appendChild(muteBtn);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, list);
    soundEls = { section, muteBtn };
    refreshMute();
    return section;
  }

  function refreshMute() {
    if (!soundEls || typeof getSfx !== 'function') return;
    const sfx = getSfx();
    const muted = !!(sfx && sfx.isMuted && sfx.isMuted());
    soundEls.muteBtn.setAttribute('aria-checked', muted ? 'true' : 'false');
    soundEls.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    const label = soundEls.muteBtn.querySelector('.dm-label');
    if (label) label.textContent = muted ? 'Muted' : 'Mute';
  }

  function refreshTime() {

    if (!timeEls || typeof getClock !== 'function') return;
    const clock = getClock();
    if (!clock) return;
    const t = clock.getTime();
    timeEls.label.textContent = t.label + (t.paused ? '  (paused)' : '');
    if (document.activeElement !== timeEls.slider) timeEls.slider.value = String(Math.floor(t.minutes));
    timeEls.pauseBtn.textContent = t.paused ? 'Resume' : 'Pause';
    timeEls.pauseBtn.setAttribute('aria-pressed', t.paused ? 'true' : 'false');
    const scale = clock.getScale();
    for (const b of timeEls.speedBtns) {
      const on = Math.abs(scale - 60 * Number(b.dataset.timeScale)) < 1e-6;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  let needsEls = null;

  function buildNeedsSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'needs';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Needs';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const body = document.createElement('div');
    body.className = 'dm-sublist dm-needs';
    const label = document.createElement('div');
    label.className = 'dm-needs-label';
    const row = document.createElement('div');
    row.className = 'dm-needs-row';
    const refillBtn = document.createElement('button');
    refillBtn.type = 'button';
    refillBtn.dataset.needsAction = 'refill';
    refillBtn.textContent = 'Refill';
    refillBtn.addEventListener('click', () => {
      const needs = getNeeds && getNeeds();
      if (needs && typeof needs.refill === 'function') needs.refill();
      refreshNeeds();
    });
    const drainBtn = document.createElement('button');
    drainBtn.type = 'button';
    drainBtn.dataset.needsAction = 'drain';
    drainBtn.textContent = 'Drain';
    drainBtn.addEventListener('click', () => {
      const needs = getNeeds && getNeeds();
      if (needs && typeof needs.drain === 'function') needs.drain();
      refreshNeeds();
    });
    const developmentBtn = document.createElement('button');
    developmentBtn.type = 'button';
    developmentBtn.addEventListener('click', () => {
      const needs = getNeeds();
      needs.setDevelopmentMode(!needs.isDevelopmentMode());
      refreshNeeds();
    });
    const help = document.createElement('p');
    help.hidden = true;
    row.append(developmentBtn, refillBtn, drainBtn);
    body.append(help);
    body.append(label, row);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, body);
    needsEls = { section, label, refillBtn, drainBtn, developmentBtn };
    refreshNeeds();
    return section;
  }

  function refreshNeeds() {
    if (!needsEls || typeof getNeeds !== 'function') return;
    const needs = getNeeds();
    if (!needs || typeof needs.get !== 'function') return;
    const development = !!needs.isDevelopmentMode?.();
    needsEls.developmentBtn.hidden = true; // now in the quick bar and Player → Development
    needsEls.developmentBtn.textContent = 'Development mode: ' + (development ? 'On' : 'Off');
    needsEls.developmentBtn.setAttribute('aria-pressed', String(development));
    needsEls.refillBtn.disabled = needsEls.drainBtn.disabled = development;
    const snap = needs.get();
    const parts = (snap.items || []).map((it) => it.name + ' ' + Math.round(it.value));
    needsEls.label.textContent = parts.length ? parts.join('  ·  ') : 'Needs';
  }

  let moneyEls = null;

  function buildMoneySection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'money';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Money';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const body = document.createElement('div');
    body.className = 'dm-sublist dm-money';
    const label = document.createElement('div');
    label.className = 'dm-money-label';
    const row = document.createElement('div');
    row.className = 'dm-money-row';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.dataset.moneyAction = 'add';
    addBtn.textContent = '+$100';
    addBtn.addEventListener('click', () => {
      const money = getMoney && getMoney();
      if (money && typeof money.add === 'function') money.add(100, { category: 'Adjustment', label: 'Debug cash added' });
      refreshMoney();
    });
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.dataset.moneyAction = 'reset';
    resetBtn.textContent = 'Reset cash';
    resetBtn.addEventListener('click', () => {
      const money = getMoney && getMoney();
      if (money && typeof money.reset === 'function') money.reset();
      else if (money && typeof money.set === 'function') money.set(50);
      refreshMoney();
    });
    row.append(addBtn, resetBtn);
    body.append(label, row);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, body);
    moneyEls = { section, label, addBtn, resetBtn };
    refreshMoney();
    return section;
  }

  function refreshMoney() {
    if (!moneyEls || typeof getMoney !== 'function') return;
    const money = getMoney();
    if (!money || typeof money.get !== 'function') return;
    const n = money.get();
    const shown = Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
    moneyEls.label.textContent = 'Cash $' + shown;
  }

  let minimapEls = null;

  function buildMinimapSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'minimap';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Map';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const list = document.createElement('div');
    list.className = 'dm-sublist';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dm-subrow';
    btn.dataset.item = 'minimap-toggle';
    btn.setAttribute('role', 'switch');
    const label = document.createElement('span');
    label.className = 'dm-label';
    label.textContent = 'Minimap';
    const key = document.createElement('span');
    key.className = 'dm-key';
    key.textContent = 'M';
    label.appendChild(key);
    const sw = document.createElement('span');
    sw.className = 'dm-switch';
    btn.append(label, sw);
    btn.addEventListener('click', () => {
      const map = getMinimap && getMinimap();
      if (map && typeof map.toggle === 'function') map.toggle();
      refreshMinimap();
    });
    list.appendChild(btn);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, list);
    minimapEls = { section, btn };
    refreshMinimap();
    return section;
  }

  function refreshMinimap() {
    if (!minimapEls || typeof getMinimap !== 'function') return;
    const map = getMinimap();
    const on = !!(map && map.isEnabled && map.isEnabled());
    minimapEls.btn.setAttribute('aria-checked', on ? 'true' : 'false');
    minimapEls.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  let weatherEls = null;

  function buildWeatherSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'weather';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Weather';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const body = document.createElement('div');
    body.className = 'dm-sublist';
    const box = document.createElement('div');
    box.className = 'dm-time';
    const label = document.createElement('p');
    label.className = 'dm-time-label';
    label.textContent = 'Weather';
    const row = document.createElement('div');
    row.className = 'dm-time-row';
    const btns = [];
    const choices = [
      { id: 'auto', label: 'Auto' },
      { id: 'clear', label: 'Clear' },
      { id: 'cloudy', label: 'Cloudy' },
      { id: 'rain', label: 'Rain' }
    ];
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.weather = c.id;
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        const w = getWeather && getWeather();
        if (w && typeof w.setOverride === 'function') w.setOverride(c.id);
        refreshWeather();
      });
      btns.push(btn);
      row.appendChild(btn);
    }
    box.append(label, row);
    body.appendChild(box);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, body);
    weatherEls = { section, label, btns };
    refreshWeather();
    return section;
  }

  function refreshWeather() {
    if (!weatherEls || typeof getWeather !== 'function') return;
    const w = getWeather();
    const cur = w && typeof w.get === 'function' ? w.get() : w;
    const override = w && typeof w.getOverride === 'function' ? w.getOverride() : (cur && cur.override);
    const active = override || 'auto';
    const name = (cur && cur.name) || 'Clear';
    weatherEls.label.textContent = override ? (name + '  (override)') : (name + '  (auto)');
    for (const b of weatherEls.btns) {
      b.setAttribute('aria-pressed', b.dataset.weather === active ? 'true' : 'false');
    }
  }

  let saveHudEls = null;

  function buildSaveHudSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'save-indicator';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'HUD';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const list = document.createElement('div');
    list.className = 'dm-sublist';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dm-subrow';
    btn.dataset.item = 'save-indicator-toggle';
    btn.setAttribute('role', 'switch');
    const label = document.createElement('span');
    label.className = 'dm-label';
    label.textContent = 'Save indicator';
    const sw = document.createElement('span');
    sw.className = 'dm-switch';
    btn.append(label, sw);
    btn.addEventListener('click', () => {
      const hud = getSaveHud && getSaveHud();
      if (hud && typeof hud.toggle === 'function') hud.toggle();
      refreshSaveHud();
    });
    list.appendChild(btn);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, list);
    saveHudEls = { section, btn };
    refreshSaveHud();
    return section;
  }

  function refreshSaveHud() {
    if (!saveHudEls || typeof getSaveHud !== 'function') return;
    const hud = getSaveHud();
    const on = !!(hud && hud.isEnabled && hud.isEnabled());
    saveHudEls.btn.setAttribute('aria-checked', on ? 'true' : 'false');
    saveHudEls.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  let skillsEls = null;

  function buildSkillsSection() {
    const section = document.createElement('div');
    section.className = 'dm-section is-open';
    section.dataset.item = 'skills';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dm-section-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    const title = document.createElement('span');
    title.className = 'dm-label';
    title.textContent = 'Skills';
    const chev = document.createElement('span');
    chev.className = 'dm-chevron';
    chev.textContent = '▾';
    toggle.append(title, chev);
    const body = document.createElement('div');
    body.className = 'dm-sublist dm-money dm-skills';
    const label = document.createElement('div');
    label.className = 'dm-money-label';
    const row = document.createElement('div');
    row.className = 'dm-money-row';
    const fitBtn = document.createElement('button');
    fitBtn.type = 'button';
    fitBtn.dataset.skillsAction = 'fitness';
    fitBtn.textContent = '+50 Fitness';
    fitBtn.addEventListener('click', () => {
      const skills = getSkills && getSkills();
      const amount = (skills && skills.DEBUG_XP) || 50;
      if (skills && typeof skills.addXp === 'function') skills.addXp('fitness', amount);
      refreshSkills();
    });
    const cookBtn = document.createElement('button');
    cookBtn.type = 'button';
    cookBtn.dataset.skillsAction = 'cooking';
    cookBtn.textContent = '+50 Cooking';
    cookBtn.addEventListener('click', () => {
      const skills = getSkills && getSkills();
      const amount = (skills && skills.DEBUG_XP) || 50;
      if (skills && typeof skills.addXp === 'function') skills.addXp('cooking', amount);
      refreshSkills();
    });
    row.append(fitBtn, cookBtn);
    body.append(label, row);
    toggle.addEventListener('click', () => {
      const open = !section.classList.contains('is-open');
      section.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    section.append(toggle, body);
    skillsEls = { section, label, fitBtn, cookBtn };
    refreshSkills();
    return section;
  }

  function refreshSkills() {
    if (!skillsEls || typeof getSkills !== 'function') return;
    const skills = getSkills();
    if (!skills || typeof skills.get !== 'function') return;
    const snap = skills.get();
    const parts = (snap.items || []).map((it) => it.name + ' Lv.' + it.level);
    skillsEls.label.textContent = parts.length ? parts.join('  ·  ') : 'Skills';
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
