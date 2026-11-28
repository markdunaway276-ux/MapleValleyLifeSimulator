/**
 * Title screen: replaces the old "Click to start" box.
 *
 *   Continue   – play the active save slot (shown when it has a save)
 *   New game   – pick a slot (overwriting asks first), start fresh there
 *   Load game  – pick a saved slot
 *   Settings   – the same tabbed settings as the pause menu
 *   What's New – patch notes (src/data/changelog.js), NEW badge until read
 *   Credits    – asset credits from CREDITS.md
 *
 * On a fresh page load a "press start" screen comes first (it also lets
 * the browser unlock audio before the menu music/sounds play).
 *
 * The game has already loaded the active slot when this shows, so Continue
 * just starts. Choosing another slot (or a new game) remembers the slot,
 * stops autosaves and reloads the page directly into the chosen slot.
 */

import { CAR_SPAWN } from '../world/props.js';
import { ensureMenuStyles, el, button, heading, renderSettings } from './menuKit.js';
import { isFullscreenActive, toggleFullscreen } from './hudFullscreen.js';
import { SLOT_COUNT, getGameSlot, setActiveSlot, readSlot, clearSlot, freezeSaves } from '../systems/save.js';
import { CHANGELOG, LATEST_VERSION, hasUnseenUpdate, readSeenVersion, markUpdatesSeen, formatNoteDate } from '../data/changelog.js';
import { BUILT_WITH, loadCredits } from '../data/credits.js';

const TITLE_CSS_ID = 'mv-title-styles';
const TITLE_CSS = `
#title-screen .mv-logo { margin: 2px 0 0; text-align: center; font: 800 34px/1.05 Georgia, 'Times New Roman', serif; letter-spacing: 0.02em; color: #f6e3c4; text-shadow: 0 2px 14px rgba(201,138,69,0.35); }
#title-screen .mv-logo .leaf { display: inline-block; margin-right: 6px; animation: mv-leaf 5s ease-in-out infinite; }
@keyframes mv-leaf { 0%,100% { transform: rotate(-8deg) translateY(0); } 50% { transform: rotate(10deg) translateY(3px); } }
#title-screen .mv-press { margin: 26px 0 8px; text-align: center; font: 600 15px system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; animation: mv-pulse 2.2s ease-in-out infinite; }
@keyframes mv-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
#title-screen .mv-badge { display: inline-block; margin-left: 8px; padding: 1px 7px; border-radius: 999px; background: #c98a45; color: #1e1a16; font: 800 11px/1.6 system-ui, sans-serif; letter-spacing: 0.06em; vertical-align: 2px; }
#title-screen .mv-version { margin: 12px 0 0; text-align: center; font-size: 12px; opacity: 0.5; }
#title-screen .mv-notes { margin: 6px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.45; }
#title-screen .mv-notes li { margin: 4px 0; }
#title-screen .mv-note-head { margin: 18px 0 2px; font: 700 16px system-ui, sans-serif; }
#title-screen .mv-note-date { font-weight: 400; font-size: 12px; opacity: 0.6; margin-left: 6px; }
#title-screen .mv-credit { margin: 6px 0 0; font-size: 14px; line-height: 1.45; }
@media (prefers-reduced-motion: reduce) { #title-screen .mv-logo .leaf, #title-screen .mv-press { animation: none; } }
`;

function ensureTitleStyles() {
  if (document.getElementById(TITLE_CSS_ID)) return;
  const st = document.createElement('style');
  st.id = TITLE_CSS_ID;
  st.textContent = TITLE_CSS;
  document.head.appendChild(st);
}

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
  ensureTitleStyles();
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

  let page = 'press';
  let credits = null;
  let creditsLoading = false;
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
  if (pendingStart) page = 'main';

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

  function logo() {
    const h = el('h2', { class: 'mv-logo' });
    h.append(el('span', { class: 'leaf', 'aria-hidden': 'true', text: '🍁' }), 'Maple Valley');
    return h;
  }

  function renderPress() {
    panel.append(logo(), el('p', { class: 'mv-sub', text: 'A small-town life simulator' }));
    panel.append(el('p', { class: 'mv-press', text: isMobile ? 'Tap to begin' : 'Press any key' }));
    panel.append(el('p', { class: 'mv-version', text: `v${LATEST_VERSION}` }));
  }

  function leavePress() {
    if (page !== 'press') return;
    go('main');
  }
  root.addEventListener('click', leavePress);
  window.addEventListener('keydown', (e) => {
    if (page !== 'press' || !root.classList.contains('is-open')) return;
    e.preventDefault();
    leavePress();
  });

  function renderMain() {
    panel.append(logo(), el('p', { class: 'mv-sub', text: 'A small-town life simulator' }));
    const active = getGameSlot();
    const data = readSlot(active);
    if (data) panel.append(button('Continue', start, { primary: true, sub: `Slot ${active} · ${slotSummary(data)}` }));
    else panel.append(button('Start new game', start, { primary: true, sub: `Slot ${active}` }));
    panel.append(button('New game', () => go('new')));
    panel.append(button('Load game', () => go('load')));
    panel.append(button('Settings', () => go('settings')));
    const news = button("What's New", () => go('news'), { sub: `v${LATEST_VERSION} · ${CHANGELOG[0].title}` });
    if (hasUnseenUpdate(readSeenVersion())) news.firstChild.after(el('span', { class: 'mv-badge', text: 'NEW' }));
    panel.append(news);
    panel.append(button('Credits', () => go('credits')));
    const fsBtn = button(isFullscreenActive() ? 'Exit fullscreen' : 'Fullscreen', async () => {
      await toggleFullscreen();
      fsBtn.textContent = isFullscreenActive() ? 'Exit fullscreen' : 'Fullscreen';
    });
    panel.append(fsBtn);
    panel.append(el('p', { class: 'mv-version', text: `v${LATEST_VERSION}` }));
  }

  function renderNews() {
    markUpdatesSeen();
    panel.append(heading("What's New", 'Patch notes'));
    for (const entry of CHANGELOG) {
      const head = el('p', { class: 'mv-note-head', text: `v${entry.version} · ${entry.title}` });
      head.append(el('span', { class: 'mv-note-date', text: formatNoteDate(entry.date) }));
      const list = el('ul', { class: 'mv-notes' });
      for (const n of entry.notes) list.append(el('li', { text: n }));
      panel.append(head, list);
    }
    panel.append(button('Back', () => go('main'), { primary: true }));
  }

  function renderCredits() {
    panel.append(heading('Credits', 'Maple Valley · A small-town life simulator'));
    if (!credits && !creditsLoading) {
      creditsLoading = true;
      loadCredits().then((c) => {
        credits = c || [];
        creditsLoading = false;
        if (page === 'credits') render();
      });
    }
    if (!credits) panel.append(el('p', { class: 'mv-note', text: 'Loading…' }));
    for (const sec of credits || []) {
      if (sec.title) panel.append(el('h3', { text: sec.title }));
      for (const para of sec.paragraphs) {
        const p = el('p', { class: 'mv-credit' });
        for (const part of para) {
          p.append(part.href ? el('a', { href: part.href, target: '_blank', rel: 'noopener noreferrer', text: part.text }) : part.text);
        }
        panel.append(p);
      }
    }
    panel.append(el('h3', { text: 'Built with' }));
    for (const b of BUILT_WITH) {
      const p = el('p', { class: 'mv-credit' });
      p.append(el('a', { href: b.href, target: '_blank', rel: 'noopener noreferrer', text: b.text }));
      panel.append(p);
    }
    panel.append(button('Back', () => go('main'), { primary: true }));
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
    } else if (page === 'new' || page === 'load') renderSlots(page);
    else if (page === 'press') renderPress();
    else if (page === 'news') renderNews();
    else if (page === 'credits') renderCredits();
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
