import { createCollisionViz } from './collisionViz.js';
import { createInteractableHighlight } from './interactableHighlight.js';
import { TELEPORT_PRESETS, resolveTeleport } from './teleports.js';
import { createDebugOverlay } from '../ui/debugOverlay.js';
import { createDebugMenu } from '../ui/debugMenu.js';
import { createFeedback, snapshotCanvas } from '../ui/feedback.js';
import { createHudScreenshotButton } from '../ui/hudScreenshot.js';

/**
 * Optional debug utilities. Everything is OFF by default and built lazily:
 *   - corner "Debug" button (visible after Start) -> touch-friendly menu
 *   - HUD camera button (visible after Start, hidden under inventory/menus)
 *   - FPS / position / quality-tier overlay, perf stats (draw calls, triangles)
 *   - collision visualizer
 *   - interactable highlighter (doors + scene.userData.interactables)
 *   - screenshot + markup (src/ui/feedback.js)
 *   - teleport list (street start, doors, street ends, parked car)
 *   - clear save (with confirm)
 *   - time-of-day slider, pause and speed (when a game clock is passed in)
 *   - sound mute toggle (when an sfx API is passed in)
 *   - needs refill / drain (when a needs API is passed in)
 *   - money +$100 / reset cash (when a money API is passed in)
 * Further ideas: DEBUG-TODO.md
 * While nothing is toggled on, update() only compares one boolean per frame.
 *
 * Keys (desktop; also on Mac via fn):
 *   F2 or `   open / close the Debug menu
 *   F3        FPS / position / tier overlay
 *   Shift+F3  perf stats (draw calls, triangles, geometries, textures)
 *   F4        collision visualizer
 *   Shift+F4  interactable highlighter
 *   F8        teleport to street start
 *   Shift+F8  clear saved game (press twice within 4 s to confirm)
 *   F9        screenshot + markup
 */

export const DEBUG_KEYS = {
  menu: 'F2 or `',
  overlay: 'F3',
  perf: 'Shift+F3',
  collision: 'F4',
  highlight: 'Shift+F4',
  teleport: 'F8',
  clearSave: 'Shift+F8 (twice)',
  screenshot: 'F9'
};

const TEXT_REFRESH_MS = 250;
const CLEAR_CONFIRM_MS = 4000;

function localTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function isTextTarget(t) {
  return !!(t && t.tagName && /^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName)) || !!(t && t.isContentEditable);
}

export function createDebug({
  renderer,
  scene,
  camera,
  player,
  quality = {},
  isMobile = false,
  isStarted = () => true,
  isInventoryOpen = () => false,
  getSpawn = () => (scene.userData && scene.userData.spawn) || { x: 0, y: 1.6, z: -1.15 },
  getWorld = () => scene.userData && scene.userData.colliders,
  saveApi = {},
  clock = null,
  sfx = null,
  needs = null,
  money = null,
  getMinimap = null,
  getWeather = null,
  getSaveHud = null,
  container = document.body,
  now = () => performance.now()
}) {
  const state = { overlay: false, collision: false, highlight: false, perf: false };
  const tier = quality.tier || (isMobile ? 'mobile' : 'desktop');

  let overlay = null;
  let viz = null;
  let highlighter = null;
  let frames = 0;
  let lastTick = 0;
  let fps = 0;
  let lastStarted = false;
  let clearArmedUntil = 0;

  const menu = createDebugMenu({
    actions: {
      overlay: () => toggleOverlay(),
      collision: () => toggleCollision(),
      highlight: () => toggleHighlight(),
      perf: () => togglePerf(),
      screenshot: () => screenshot(),
      teleport: () => teleportToStart(),
      teleportTo: (id) => teleportTo(id),
      clearSave: () => clearSave()
    },
    getState: () => state,
    getTeleports: () => TELEPORT_PRESETS,
    getClock: clock ? () => clock : null,
    getSfx: sfx ? () => sfx : null,
    getNeeds: needs ? () => needs : null,
    getMoney: money ? () => money : null,
    getMinimap: typeof getMinimap === 'function' ? getMinimap : null,
    getWeather: typeof getWeather === 'function' ? getWeather : null,
    getSaveHud: typeof getSaveHud === 'function' ? getSaveHud : null,
    onOpen: modalOpened,
    onClose: modalClosed,
    container
  });

  if (sfx && typeof sfx.on === 'function') {
    sfx.on('mute', () => menu.refreshMute());
  }
  if (needs && typeof needs.onChange === 'function') {
    needs.onChange(() => { if (menu.isOpen()) menu.refreshNeeds(); });
  }
  if (money && typeof money.onChange === 'function') {
    money.onChange(() => { if (menu.isOpen()) menu.refreshMoney(); });
  }
  if (typeof getMinimap === 'function') {
    const map = getMinimap();
    if (map && typeof map.onChange === 'function') {
      map.onChange(() => { if (menu.isOpen()) menu.refreshMinimap(); });
    }
  }
  if (typeof getWeather === 'function') {
    const weather = getWeather();
    if (weather && typeof weather.onChange === 'function') {
      weather.onChange(() => { if (menu.isOpen()) menu.refreshWeather(); });
    }
  }
  if (typeof getSaveHud === 'function') {
    const hud = getSaveHud();
    if (hud && typeof hud.onChange === 'function') {
      hud.onChange(() => { if (menu.isOpen()) menu.refreshSaveHud(); });
    }
  }

  const feedback = createFeedback({
    getMeta: captionMeta,
    onOpen: modalOpened,
    onClose: modalClosed,
    onSaved: (info) => menu.toast(info.method === 'share' ? 'Shared screenshot' : 'Saved ' + info.filename),
    container
  });

  const hudShot = createHudScreenshotButton({
    onClick: () => screenshot(),
    container
  });

  function syncHud() {
    hudShot.setVisible(!!isStarted() && !isInventoryOpen() && !isModalOpen());
  }

  window.addEventListener('inventory-open', syncHud);
  window.addEventListener('inventory-close', syncHud);
  window.addEventListener('debug-modal-open', syncHud);
  window.addEventListener('debug-modal-close', syncHud);

  function active() {
    return state.overlay || state.collision || state.highlight || state.perf;
  }

  function isModalOpen() {
    return menu.isOpen() || feedback.isOpen();
  }

  function modalOpened() {
    if (typeof document.exitPointerLock === 'function') document.exitPointerLock();
    window.dispatchEvent(new Event('debug-modal-open'));
  }

  function modalClosed() {
    if (isModalOpen()) return;
    window.dispatchEvent(new Event('debug-modal-close'));
    const canvas = renderer && renderer.domElement;
    if (!isMobile && isStarted() && !isInventoryOpen() && canvas && typeof canvas.requestPointerLock === 'function') {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* ignore */ }
    }
  }

  function facingDegrees() {
    const yaw = player.rotation ? player.rotation.y : 0;
    const deg = ((yaw * 180) / Math.PI) % 360;
    return Math.round(deg < 0 ? deg + 360 : deg);
  }

  function captionMeta() {
    const p = player.position;
    return [
      `x ${p.x.toFixed(2)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(2)}`,
      `facing ${facingDegrees()}° (yaw)`,
      `tier ${tier}`,
      `view ${window.innerWidth}x${window.innerHeight}`,
      clock ? clock.getTime().label : null,
      localTimestamp()
    ];
  }

  function overlayLines() {
    const lines = [];
    const p = player.position;
    lines.push(`FPS ${fps.toFixed(0)}`);
    if (state.overlay) {
      lines.push(`pos ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`);
      lines.push(`facing ${facingDegrees()}° (yaw)`);
      const bits = [`tier ${tier}`];
      if (quality.shadows !== undefined) bits.push(quality.shadows ? 'shadows on' : 'shadows off');
      if (quality.pixelRatio !== undefined) bits.push(`pr ${Number(quality.pixelRatio).toFixed(2)}`);
      if (quality.far !== undefined) bits.push(`far ${quality.far}`);
      lines.push(bits.join(' • '));
    }
    if (state.perf) {
      const info = renderer && renderer.info;
      if (info) {
        lines.push(`draw calls ${info.render.calls}  tris ${info.render.triangles}`);
        lines.push(`geoms ${info.memory.geometries}  textures ${info.memory.textures}`);
      }
    }
    if (state.collision && viz) lines.push(`colliders ${viz.count()}`);
    if (state.highlight && highlighter) lines.push(`interactables ${highlighter.count()}`);
    return lines.join('\n');
  }

  function refreshOverlay() {
    if (!overlay) return;
    const show = state.overlay || state.perf;
    overlay.setVisible(show);
    if (show) overlay.setText(overlayLines());
  }

  function restartClock() {
    frames = 0;
    lastTick = now();
  }

  function toggleOverlay(next = !state.overlay) {
    state.overlay = !!next;
    if (state.overlay && !overlay) overlay = createDebugOverlay({ container });
    restartClock();
    refreshOverlay();
    menu.refresh();
    return state.overlay;
  }

  function togglePerf(next = !state.perf) {
    state.perf = !!next;
    if (state.perf && !overlay) overlay = createDebugOverlay({ container });
    restartClock();
    refreshOverlay();
    menu.refresh();
    return state.perf;
  }

  function toggleCollision(next = !state.collision) {
    state.collision = !!next;
    if (state.collision) {
      if (!viz) viz = createCollisionViz({ scene, getWorld, getPlayerRadius: () => player.radius || 0.32 });
      viz.enable();
      viz.updatePlayer(player.position);
    } else if (viz) {
      viz.disable();
    }
    restartClock();
    refreshOverlay();
    menu.refresh();
    return state.collision;
  }

  function toggleHighlight(next = !state.highlight) {
    state.highlight = !!next;
    if (state.highlight) {
      if (!highlighter) highlighter = createInteractableHighlight({ scene, getPlayer: () => player });
      highlighter.enable();
      highlighter.update(player.position);
    } else if (highlighter) {
      highlighter.disable();
    }
    restartClock();
    refreshOverlay();
    menu.refresh();
    return state.highlight;
  }

  function applyPose(x, y, z, yaw = 0, { save = true } = {}) {
    player.position.set(x, y, z);
    if (player.velocity && typeof player.velocity.set === 'function') player.velocity.set(0, 0, 0);
    player.onGround = true;
    if (player.rotation) {
      player.rotation.x = 0;
      player.rotation.y = yaw;
    }
    if (camera) {
      camera.position.copy(player.position);
      if (camera.quaternion && camera.quaternion.setFromEuler && player.rotation) {
        camera.quaternion.setFromEuler(player.rotation);
      }
    }
    if (save && saveApi.saveGame) {
      saveApi.saveGame({ position: { x: player.position.x, y: player.position.y, z: player.position.z } });
    }
    if (viz && viz.isEnabled()) viz.updatePlayer(player.position);
    if (highlighter && highlighter.isEnabled()) highlighter.update(player.position);
    return { x, y, z, yaw };
  }

  function teleportTo(id, { save = true, quiet = false } = {}) {
    const world = getWorld();
    const pose = resolveTeleport(id, scene, world, player.radius || 0.32);
    if (!pose) {
      if (!quiet) menu.toast('Could not teleport there');
      return null;
    }
    applyPose(pose.x, pose.y, pose.z, pose.yaw, { save });
    if (!quiet) menu.toast('Teleported to ' + pose.label);
    return pose;
  }

  function teleportToStart(opts = {}) {
    const result = teleportTo('street-start', opts);
    if (result && opts.quiet) return { x: result.x, y: result.y, z: result.z };
    if (result) return { x: result.x, y: result.y, z: result.z, yaw: result.yaw };
    // Fallback if the preset list is missing.
    const s = getSpawn();
    return applyPose(s.x, s.y, s.z, 0, { save: opts.save !== false });
  }

  /** Remove the saved game and put the player back at the street start. The next autosave writes a fresh save. */
  function clearSave() {
    clearArmedUntil = 0;
    const ok = saveApi.clearSave ? saveApi.clearSave() : false;
    teleportToStart({ save: false, quiet: true });
    menu.toast(ok ? 'Save cleared — back at street start' : 'Could not clear save');
    return ok;
  }

  /** Keyboard path: first call arms, second call within 4 s clears. */
  function requestClearSave() {
    const t = now();
    if (t < clearArmedUntil) {
      clearSave();
      return 'cleared';
    }
    clearArmedUntil = t + CLEAR_CONFIRM_MS;
    menu.toast('Press Shift+F8 again within 4 s to clear the save', CLEAR_CONFIRM_MS);
    return 'armed';
  }

  /** Snapshot the 3D canvas now (fresh render, copied synchronously) and open the markup dialog. */
  function screenshot() {
    if (feedback.isOpen()) return false;
    const canvas = renderer.domElement;
    renderer.render(scene, camera);
    const snap = snapshotCanvas(canvas);
    menu.close();
    feedback.open(snap);
    return true;
  }

  function openMenu() { menu.open(); }
  function closeMenu() { menu.close(); }
  function toggleMenu() { if (menu.isOpen()) menu.close(); else menu.open(); }

  function onKeyDown(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!isStarted()) return;
    if (feedback.isOpen()) return;
    switch (e.code) {
      case 'F2':
        e.preventDefault();
        toggleMenu();
        break;
      case 'Backquote':
        if (isTextTarget(e.target)) return;
        e.preventDefault();
        toggleMenu();
        break;
      case 'F3':
        e.preventDefault();
        if (e.shiftKey) togglePerf(); else toggleOverlay();
        break;
      case 'F4':
        e.preventDefault();
        if (e.shiftKey) toggleHighlight(); else toggleCollision();
        break;
      case 'F8':
        e.preventDefault();
        if (e.shiftKey) requestClearSave(); else teleportToStart();
        break;
      case 'F9':
        e.preventDefault();
        screenshot();
        break;
      default:
        break;
    }
  }
  window.addEventListener('keydown', onKeyDown);

  /** Call once per frame after renderer.render(). Costs one boolean compare when everything is off. */
  function update() {
    const started = !!isStarted();
    if (started !== lastStarted) {
      lastStarted = started;
      menu.setButtonVisible(started);
    }
    syncHud();
    if (menu.isOpen() && clock) menu.refreshTime();
    if (menu.isOpen() && needs) menu.refreshNeeds();
    if (menu.isOpen() && money) menu.refreshMoney();
    if (!active()) return;
    frames++;
    if (viz && viz.isEnabled()) viz.updatePlayer(player.position);
    if (highlighter && highlighter.isEnabled()) highlighter.update(player.position);
    const t = now();
    const dt = t - lastTick;
    if (dt >= TEXT_REFRESH_MS) {
      fps = (frames * 1000) / dt;
      frames = 0;
      lastTick = t;
      if (viz && viz.isEnabled()) viz.sync();
      if (highlighter && highlighter.isEnabled()) highlighter.sync();
      refreshOverlay();
    }
  }

  function refresh() {
    lastStarted = !!isStarted();
    menu.setButtonVisible(lastStarted);
    syncHud();
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('inventory-open', syncHud);
    window.removeEventListener('inventory-close', syncHud);
    window.removeEventListener('debug-modal-open', syncHud);
    window.removeEventListener('debug-modal-close', syncHud);
    hudShot.dispose();
    if (viz) viz.disable();
    if (highlighter) highlighter.disable();
  }

  return {
    state,
    menu,
    feedback,
    get overlay() { return overlay; },
    get viz() { return viz; },
    toggleOverlay,
    togglePerf,
    toggleCollision,
    toggleHighlight,
    teleportToStart,
    teleportTo,
    clearSave,
    requestClearSave,
    screenshot,
    hudButton: hudShot,
    openMenu,
    closeMenu,
    toggleMenu,
    isModalOpen,
    update,
    refresh,
    dispose,
    captionMeta,
    get highlighter() { return highlighter; }
  };
}
