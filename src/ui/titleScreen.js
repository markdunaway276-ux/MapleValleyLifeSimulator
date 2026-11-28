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
#title-screen { overflow: hidden; }
#title-screen .mv-leaves { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
#title-screen .mv-leaf-drift { position: absolute; top: -10vh; font-size: 20px; opacity: 0; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); animation: mv-fall var(--dur, 12s) linear var(--del, 0s) infinite; }
@keyframes mv-fall {
  0% { transform: translate3d(0, -8vh, 0) rotate(0deg); opacity: 0; }
  12% { opacity: 0.72; }
  85% { opacity: 0.62; }
  100% { transform: translate3d(var(--sway, 10vw), 112vh, 0) rotate(320deg); opacity: 0; }
}
#title-screen .mv-panel {
  position: relative; z-index: 2;
  background: linear-gradient(165deg, rgba(24, 19, 15, 0.80) 0%, rgba(16, 14, 12, 0.88) 100%);
  border: 1px solid rgba(238, 186, 108, 0.36);
  border-radius: 22px;
  box-shadow: 0 28px 72px rgba(0, 0, 0, 0.58), 0 0 46px rgba(214, 142, 60, 0.16), inset 0 1px 0 rgba(255, 236, 198, 0.14);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  padding: 28px 28px 22px;
  animation: mv-card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes mv-card-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
#title-screen .mv-crest { display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 10px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(248, 200, 122, 0.38), rgba(186, 102, 38, 0.22)); border: 1px solid rgba(244, 194, 118, 0.52); box-shadow: 0 0 28px rgba(226, 146, 62, 0.38); font-size: 30px; }
#title-screen .mv-crest .leaf { display: inline-block; animation: mv-leaf 5s ease-in-out infinite; }
@keyframes mv-leaf { 0%,100% { transform: rotate(-9deg) translateY(0); } 50% { transform: rotate(11deg) translateY(2px); } }
#title-screen .mv-logo { margin: 0; text-align: center; font: 800 38px/1.02 Georgia, 'Times New Roman', serif; letter-spacing: 0.03em; background: linear-gradient(180deg, #fff8e8 0%, #f4ca82 65%, #d69445 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 3px 14px rgba(201,138,69,0.38)); }
#title-screen .mv-tagline { margin: 6px 0 0; text-align: center; font: 600 12px/1.4 system-ui, sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(245, 224, 186, 0.78); }
#title-screen .mv-rule { width: 84px; height: 2px; margin: 12px auto 12px; border-radius: 999px; background: linear-gradient(90deg, transparent, #e4a957, transparent); }
#title-screen .mv-postcard { display: inline-flex; align-items: center; gap: 6px; margin: 0 auto 16px; padding: 4px 12px; border-radius: 999px; background: rgba(255, 232, 192, 0.08); border: 1px solid rgba(242, 194, 120, 0.24); font: 600 12px/1.3 system-ui, sans-serif; color: #f4dfba; }
#title-screen .mv-postcard-wrap { text-align: center; }
#title-screen .mv-cta {
  position: relative; overflow: hidden; display: block; width: 100%; margin: 14px 0 10px; padding: 14px 20px;
  border: 1px solid rgba(255, 226, 168, 0.65); border-radius: 13px; cursor: pointer;
  background: linear-gradient(135deg, #d88f3c 0%, #c27228 55%, #a8581d 100%);
  color: #1c130b; font: 800 17px/1.1 system-ui, sans-serif; letter-spacing: 0.04em;
  box-shadow: 0 10px 26px rgba(196, 114, 40, 0.42), inset 0 1px 0 rgba(255, 244, 214, 0.55);
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}
#title-screen .mv-cta:hover { transform: translateY(-2px); filter: brightness(1.07); box-shadow: 0 14px 32px rgba(216, 134, 52, 0.54), inset 0 1px 0 rgba(255, 244, 214, 0.7); }
#title-screen .mv-cta::after {
  content: ''; position: absolute; top: 0; left: -60%; width: 45%; height: 100%;
  background: linear-gradient(105deg, transparent 0%, rgba(255, 250, 232, 0.42) 50%, transparent 100%);
  animation: mv-shimmer 3.2s ease-in-out infinite;
}
@keyframes mv-shimmer { 0%, 45% { left: -60%; } 100% { left: 135%; } }
#title-screen .mv-press { margin: 8px 0 4px; text-align: center; font: 600 12px system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(246, 228, 198, 0.78); animation: mv-pulse 2.2s ease-in-out infinite; }
@keyframes mv-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
#title-screen .mv-btn { border-radius: 12px; transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease; }
#title-screen .mv-btn:hover { transform: translateY(-1px); border-color: rgba(242, 192, 116, 0.58); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28); }
#title-screen .mv-btn.is-primary { background: linear-gradient(135deg, #d88f3c 0%, #b86923 100%); border-color: rgba(255, 224, 166, 0.6); color: #1b130b; box-shadow: 0 8px 24px rgba(196, 114, 40, 0.36); }
#title-screen .mv-btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
#title-screen .mv-btn-grid .mv-btn { margin-top: 0; padding: 10px 12px; font-size: 14px; }
#title-screen .mv-badge { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: #f0b156; color: #1e150c; font: 800 10px/1.6 system-ui, sans-serif; letter-spacing: 0.06em; vertical-align: 1px; box-shadow: 0 0 10px rgba(240, 177, 86, 0.55); }
#title-screen .mv-version { margin: 14px 0 0; text-align: center; font-size: 11px; letter-spacing: 0.08em; opacity: 0.52; }
#title-screen .mv-notes { margin: 6px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.45; }
#title-screen .mv-notes li { margin: 4px 0; }
#title-screen .mv-note-head { margin: 18px 0 2px; font: 700 16px system-ui, sans-serif; }
#title-screen .mv-note-date { font-weight: 400; font-size: 12px; opacity: 0.6; margin-left: 6px; }
#title-screen .mv-credit { margin: 6px 0 0; font-size: 14px; line-height: 1.45; }
@media (prefers-reduced-motion: reduce) { #title-screen .mv-crest .leaf, #title-screen .mv-press, #title-screen .mv-leaf-drift, #title-screen .mv-cta::after, #title-screen .mv-panel { animation: none; } }
`;

function timeOfDayPostcard() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return '🌅 Golden Morning · Maple Lane';
  if (h >= 11 && h < 17) return '☀️ Sunny Afternoon · Maple Lane';
  if (h >= 17 && h < 20) return '🌇 Warm Dusk · Maple Lane';
  return '🌙 Starry Night · Maple Lane';
}

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
  document.body.classList.add('title-open');
  const old = document.getElementById('instructions');
  if (old) old.style.display = 'none';

  const root = el('div', { id: 'title-screen', class: 'mv-overlay is-open', role: 'dialog', 'aria-label': 'Title screen' });
  root.style.background = 'radial-gradient(ellipse at 50% 45%, rgba(236,158,72,0.08), rgba(8,6,4,0.42))';
  root.style.backdropFilter = 'none';
  root.style.webkitBackdropFilter = 'none';
  root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  // Gentle drifting autumn maple leaves over the live 3D town backdrop.
  const leavesLayer = el('div', { class: 'mv-leaves', 'aria-hidden': 'true' });
  const leafSeeds = [
    { left: '8%', dur: '13s', del: '0s', sway: '8vw', size: '18px' },
    { left: '21%', dur: '16s', del: '-4s', sway: '-7vw', size: '22px' },
    { left: '36%', dur: '14s', del: '-8s', sway: '10vw', size: '16px' },
    { left: '58%', dur: '15s', del: '-2s', sway: '-9vw', size: '21px' },
    { left: '74%', dur: '12s', del: '-6s', sway: '7vw', size: '19px' },
    { left: '89%', dur: '17s', del: '-10s', sway: '-8vw', size: '17px' }
  ];
  for (const s of leafSeeds) {
    const lf = el('span', { class: 'mv-leaf-drift', text: '🍁' });
    lf.style.left = s.left;
    lf.style.fontSize = s.size;
    lf.style.setProperty('--dur', s.dur);
    lf.style.setProperty('--del', s.del);
    lf.style.setProperty('--sway', s.sway);
    leavesLayer.append(lf);
  }
  root.append(leavesLayer);

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
    document.body.classList.remove('title-open');
    onStart();
  }

  function heroHeader() {
    const frag = document.createDocumentFragment();
    const crest = el('div', { class: 'mv-crest', 'aria-hidden': 'true' });
    crest.append(el('span', { class: 'leaf', text: '🍁' }));
    const h = el('h2', { class: 'mv-logo', text: 'Maple Lane' });
    const tag = el('p', { class: 'mv-tagline', text: 'Welcome home to Maple Valley' });
    const rule = el('div', { class: 'mv-rule', 'aria-hidden': 'true' });
    const pcWrap = el('div', { class: 'mv-postcard-wrap' });
    pcWrap.append(el('span', { class: 'mv-postcard', text: timeOfDayPostcard() }));
    frag.append(crest, h, tag, rule, pcWrap);
    return frag;
  }

  function renderPress() {
    panel.append(heroHeader());
    const enterBtn = el('button', { type: 'button', class: 'mv-cta', text: 'Enter Maple Lane' });
    enterBtn.addEventListener('click', (e) => { e.stopPropagation(); leavePress(); });
    panel.append(enterBtn);
    panel.append(el('p', { class: 'mv-press', text: isMobile ? 'Tap anywhere to begin' : 'or press any key' }));
    panel.append(el('p', { class: 'mv-version', text: `v${LATEST_VERSION} · ${CHANGELOG[0].title}` }));
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
    panel.append(heroHeader());
    const active = getGameSlot();
    const data = readSlot(active);
    if (data) panel.append(button('▶  Continue', start, { primary: true, sub: `Slot ${active} · ${slotSummary(data)}` }));
    else panel.append(button('✨  Start New Game', start, { primary: true, sub: `Slot ${active} · Begin Day One` }));

    const slotsRow = el('div', { class: 'mv-btn-grid' });
    slotsRow.append(button('🌱  New Game', () => go('new')), button('📂  Load Game', () => go('load')));
    panel.append(slotsRow);

    const utilRow = el('div', { class: 'mv-btn-grid' });
    const news = button("📰  What's New", () => go('news'));
    if (hasUnseenUpdate(readSeenVersion())) news.firstChild.after(el('span', { class: 'mv-badge', text: 'NEW' }));
    const fsBtn = button(isFullscreenActive() ? '⛶  Exit Fullscreen' : '⛶  Fullscreen', async () => {
      await toggleFullscreen();
      fsBtn.textContent = isFullscreenActive() ? '⛶  Exit Fullscreen' : '⛶  Fullscreen';
    });
    utilRow.append(button('⚙️  Settings', () => go('settings')), news, button('🎞  Credits', () => go('credits')), fsBtn);
    panel.append(utilRow);

    panel.append(el('p', { class: 'mv-version', text: `v${LATEST_VERSION} · ${CHANGELOG[0].title}` }));
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
