/**
 * Pause menu. Esc on a desktop (the browser turns the first Esc into
 * "release the mouse", so losing mouse look while playing opens it too), or
 * the II HUD button on any device. While it is open the frame loop skips the
 * world (loop.js), so the clock, needs, neighbours and weather stand still.
 *
 * Pages: main (Resume, Map, Stats, Settings, Save game, Quit to title),
 * Map (a large labelled map), Stats (days, money, walking, skills,
 * neighbours) and Settings (menuKit.js tabs: Display, Sound, Controls, Graphics).
 */

import { ensureMenuStyles, el, button, heading, renderSettings } from './menuKit.js';
import { createMinimapSurface, gatherMinimapWorld, toMap, MINIMAP_COLORS } from './minimap.js';
import { requestPointerLock, exitPointerLock } from '../core/pointerLock.js';

const BUTTON_CSS_ID = 'pause-button-styles';
const BUTTON_CSS = `
#pause-button {
  position: fixed; z-index: 36; display: none; align-items: center; justify-content: center;
  top: calc(max(12px, env(safe-area-inset-top)) + 156px); right: max(12px, env(safe-area-inset-right));
  width: 44px; height: 44px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.55); color: #fff; font: 800 15px system-ui, sans-serif; letter-spacing: 1px; cursor: pointer;
}
#pause-button.is-visible { display: flex; }
`;

const money = (n) => '$' + (Math.round(Number(n) || 0)).toLocaleString();

export function createPauseMenu({
  mode,
  isMobile = false,
  canvas = null,
  scene = null,
  player = null,
  getDisplay = () => null,
  getSettings = () => null,
  getSfx = () => null,
  getStats = () => null,
  getClock = () => null,
  getMoney = () => null,
  getSkills = () => null,
  getNpcName = (id) => id,
  applyLive = {},
  save = null,
  onQuitToTitle = null,
  isCursorFree = () => false,
  container = document.body
} = {}) {
  ensureMenuStyles();
  if (!document.getElementById(BUTTON_CSS_ID)) {
    const s = document.createElement('style');
    s.id = BUTTON_CSS_ID;
    s.textContent = BUTTON_CSS;
    document.head.appendChild(s);
  }
  let opened = false;
  let page = 'main';
  const settingsState = { tab: 'display' };
  let mapTimer = null;

  const pauseBtn = el('button', { type: 'button', id: 'pause-button', class: 'hud-ui', 'aria-label': 'Pause', text: 'II' });
  ['pointerdown', 'touchstart'].forEach((ev) => pauseBtn.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  container.appendChild(pauseBtn);

  const root = el('div', { id: 'pause-menu', class: 'mv-overlay', role: 'dialog', 'aria-label': 'Pause menu' });
  root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  const panel = el('div', { class: 'mv-panel' });
  root.appendChild(panel);
  container.appendChild(root);

  const go = (p) => { page = p; render(); };

  function fullscreenLabel() {
    return document.fullscreenElement ? 'Exit full screen' : 'Full screen';
  }

  document.addEventListener('fullscreenchange', () => {
    const control = panel.querySelector('#maple-fullscreen');
    if (control) control.textContent = fullscreenLabel();
  });

  function renderMain() {
    const clock = getClock();
    const t = clock && clock.getTime ? clock.getTime() : null;
    panel.append(heading('Paused', t ? t.label : 'Maple Valley'));
    panel.append(button('Resume', close, { primary: true }));
    panel.append(button('Map', () => go('map')));
    panel.append(button('Stats', () => go('stats')));
    panel.append(button('Settings', () => go('settings')));
    const note = el('div', { class: 'mv-note' });
    if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
      const fullscreen = button(fullscreenLabel(), async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch {
          note.textContent = 'Could not switch fullscreen mode.';
        }
      });
      fullscreen.id = 'maple-fullscreen';
      panel.append(fullscreen);
    }
    panel.append(button('Save game', () => {
      try { if (typeof save === 'function') save(); note.textContent = 'Game saved.'; } catch { note.textContent = 'Could not save.'; }
    }));
    if (typeof onQuitToTitle === 'function') {
      panel.append(button('Quit to title', () => {
        try { if (typeof save === 'function') save(); } catch { /* still leave */ }
        onQuitToTitle();
      }, { sub: 'Your game is saved first' }));
    }
    panel.append(note);
  }

  function renderStats() {
    panel.append(heading('Stats', 'This save'));
    const stats = getStats() ? getStats().get() : { moneyEarned: 0, walked: 0, met: [] };
    const clock = getClock();
    const t = clock && clock.getTime ? clock.getTime() : null;
    const m = getMoney();
    const rows = [
      ['Day', t ? String(t.day) : '—'],
      ['Cash', money(m && m.get ? m.get() : 0)],
      ['Money earned', money(stats.moneyEarned)],
      ['Distance walked', stats.walked >= 1000 ? (stats.walked / 1000).toFixed(2) + ' km' : Math.round(stats.walked) + ' m'],
      ['Neighbours met', stats.met.length ? stats.met.map(getNpcName).join(', ') : 'Nobody yet — say hi!']
    ];
    for (const [k, v] of rows) panel.append(el('div', { class: 'mv-stat' }, el('span', { text: k }), el('b', { text: v })));
    const skills = getSkills();
    const snap = skills && skills.get ? skills.get() : null;
    const list = Array.isArray(snap) ? snap : (snap && Array.isArray(snap.items) ? snap.items : []);
    if (Array.isArray(list) && list.length) {
      panel.append(el('h3', { text: 'Skills' }));
      for (const sk of list) {
        const row = el('div', { class: 'mv-row' });
        row.append(el('div', { class: 'mv-stat' }, el('span', { text: `${sk.icon || ''} ${sk.name}`.trim() }), el('b', { text: 'Level ' + sk.level })));
        const bar = el('div', { class: 'mv-bar' });
        const fill = el('i');
        fill.style.width = Math.round((sk.progress || 0) * 100) + '%';
        bar.append(fill);
        row.append(bar);
        panel.append(row);
      }
    }
    panel.append(button('Back', () => go('main'), { primary: true }));
  }

  function renderMap() {
    panel.classList.add('is-wide');
    panel.append(heading('Map', 'Maple Valley'));
    const canvasEl = el('canvas', { class: 'mv-map', 'aria-label': 'Map of the neighbourhood' });
    panel.append(canvasEl);
    const C = MINIMAP_COLORS;
    panel.append(el('div', { class: 'mv-legend' },
      el('span', { style: `--c:${C.player || '#ffd24a'}`, text: 'You' }),
      el('span', { style: `--c:${C.npc || '#e07a4a'}`, text: 'Neighbours' }),
      el('span', { style: `--c:${C.car || '#4aa3e0'}`, text: 'Car' })));
    panel.append(button('Back', () => go('main'), { primary: true }));

    // Size the drawing surface to the space the panel gives it, then draw names on top.
    requestAnimationFrame(() => {
      const w = Math.max(200, Math.round(canvasEl.clientWidth));
      const h = Math.max(200, Math.round(canvasEl.clientHeight || w));
      const surface = createMinimapSurface({
        canvas: canvasEl,
        getWorld: () => gatherMinimapWorld(scene),
        getPlayer: () => player,
        getNpcs: () => (scene && scene.userData && scene.userData.npcs) || [],
        getVehicles: () => {
          const car = scene && scene.userData && scene.userData.car;
          return car && typeof car.getMarker === 'function' ? [car.getMarker()] : [];
        },
        cssWidth: w,
        cssHeight: h,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1)
      });
      const labels = () => {
        const view = surface.getView();
        const ctx = canvasEl.getContext('2d');
        if (!view || !ctx) return;
        const dpr = canvasEl.width / w;
        ctx.font = `600 ${Math.round(12 * dpr)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const tag = (text, x, z, dy = -10) => {
          const p = toMap(view, x, z);
          ctx.lineWidth = 3 * dpr;
          ctx.strokeStyle = 'rgba(0,0,0,0.65)';
          ctx.strokeText(text, p.x, p.y + dy * dpr);
          ctx.fillStyle = '#fff';
          ctx.fillText(text, p.x, p.y + dy * dpr);
        };
        tag('Home', 0, -10, 4);
        const npcs = (scene && scene.userData && scene.userData.npcs) || [];
        for (const n of npcs) if (n && n.position) tag(n.name || n.id, n.position.x, n.position.z);
        if (player && player.position) tag('You', player.position.x, player.position.z, 18);
      };
      labels();
      clearInterval(mapTimer);
      mapTimer = setInterval(() => { if (!opened || page !== 'map') { clearInterval(mapTimer); return; } surface.redraw(); labels(); }, 500);
    });
  }

  function render() {
    panel.textContent = '';
    panel.classList.remove('is-wide');
    if (page === 'settings') {
      renderSettings(panel, {
        state: settingsState,
        display: getDisplay(),
        settings: getSettings(),
        sfx: getSfx(),
        isMobile,
        applyLive,
        onReload: () => { try { if (typeof save === 'function') save(); } catch { /* reload anyway */ } location.reload(); },
        onBack: () => go('main')
      });
    } else if (page === 'stats') renderStats();
    else if (page === 'map') renderMap();
    else renderMain();
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
    if (!isMobile) exitPointerLock();
    const first = panel.querySelector('button');
    if (first) first.focus();
    return true;
  }

  function close() {
    if (!opened) return false;
    opened = false;
    clearInterval(mapTimer);
    root.classList.remove('is-open');
    window.dispatchEvent(new Event('pause-close'));
    if (!isMobile) requestPointerLock(canvas);
    return true;
  }

  // Esc: capture phase, so a menu that closes itself on this same Esc
  // (bag, phone, Debug) is still seen as open and the pause does not stack on top.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (opened) {
      if (page !== 'main') go('main'); else close();
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
      // Tab frees the mouse on purpose (main.js): that is not a pause.
      if (hadLock && !locked && !isCursorFree()) setTimeout(() => { if (!document.pointerLockElement && !isCursorFree() && canPause()) open(); }, 60);
      hadLock = locked;
    });
  }

  // Driven by hud.js (mode.hudVisible()) so the II button only shows with the rest of the HUD.
  function setHudVisible(v) {
    pauseBtn.classList.toggle('is-visible', !opened && !!v);
  }

  return { open, close, isOpen: () => opened, setHudVisible, button: pauseBtn, element: root };
}
