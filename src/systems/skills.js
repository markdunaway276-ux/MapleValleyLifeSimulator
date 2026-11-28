/**
 * Data-driven skills for Maple Valley. Each skill has XP and a level.
 * More skills can be added to SKILL_DEFS later.
 *
 * Fitness  — a little XP for distance walked (not while driving), and from
 *            finishing a job (`maple-worked`).
 * Cooking  — XP from Eat (inventory-use with action "eat") and from the
 *            kitchen-counter Cook interactable (a little time and hunger).
 *
 * A small level-up toast sits under the Hunger / Cash card and to the right
 * of the minimap, clear of the other HUD bits. Skills are stored in the
 * merged save. Later systems can call get, addXp, or onChange.
 */

import * as THREE from 'three';
import { COOK_CENTER, COOK_SIZE, COOK_INTERACT } from '../world/interior.js';

export { COOK_CENTER, COOK_SIZE, COOK_INTERACT };

export const MAX_LEVEL = 10;
export const XP_WALK_PER_METER = 0.25;
export const XP_WORK = 15;
export const XP_EAT = 8;
export const XP_COOK = 20;
export const COOK_MINUTES = 8;
export const COOK_HUNGER_COST = 5;
export const DEBUG_XP = 50;
export const COOK_HUNGRY = 'Too hungry to cook.';
export const COOK_DONE = 'Cooked a meal.';

/** XP needed to go from `level` to `level + 1` (level is 1-based). */
export function xpForNextLevel(level) {
  const n = Math.max(1, level | 0);
  return 50 + (n - 1) * 25;
}

/** Total XP required to *reach* `level` (0 at level 1). */
export function totalXpForLevel(level) {
  const target = Math.max(1, level | 0);
  let total = 0;
  for (let l = 1; l < target; l++) total += xpForNextLevel(l);
  return total;
}

export const MAX_XP = totalXpForLevel(MAX_LEVEL);

export function progressFromXp(xp) {
  const raw = Number(xp);
  const total = Number.isFinite(raw) && raw > 0 ? Math.min(MAX_XP, raw) : 0;
  let remaining = total;
  let level = 1;
  while (level < MAX_LEVEL && remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  const toNext = level >= MAX_LEVEL ? 0 : xpForNextLevel(level);
  const into = level >= MAX_LEVEL ? 0 : remaining;
  const progress = toNext > 0 ? Math.max(0, Math.min(1, into / toNext)) : 1;
  return { xp: total, level, xpIntoLevel: into, xpToNext: toNext, progress };
}

export const SKILL_DEFS = [
  { id: 'fitness', name: 'Fitness', icon: '💪' },
  { id: 'cooking', name: 'Cooking', icon: '🍳' }
];

/** CSS `top` is `max(12px, safe-top) + TOP_EXTRA`, pinned to the right edge. */
export const SKILL_TOAST_LAYOUT = {
  topExtra: 248,
  right: 12,
  maxWidth: 150,
  height: 32,
  fadeMs: 200,
  holdMs: 2200
};

const STYLE_ID = 'skill-toast-styles';

const CSS = `
#skill-toast {
  position: absolute;
  z-index: 90;
  display: none;
  box-sizing: border-box;
  top: calc(max(12px, env(safe-area-inset-top)) + ${SKILL_TOAST_LAYOUT.topExtra}px);
  right: max(${SKILL_TOAST_LAYOUT.right}px, env(safe-area-inset-right));
  max-width: ${SKILL_TOAST_LAYOUT.maxWidth}px;
  margin: 0;
  padding: 6px 10px;
  font: 600 12px/1.2 system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.01em;
  white-space: nowrap;
  opacity: 0;
  transition: opacity ${SKILL_TOAST_LAYOUT.fadeMs}ms ease;
  text-align: right;
}
#skill-toast.is-visible { display: block; opacity: 0.95; }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function defById(defs, id) {
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].id === id) return defs[i];
  }
  return null;
}

/**
 * Invisible cook-station proxy for the prompt, highlighter, and E / tap path.
 * The visible kitchen counter stays in the merged interior mesh.
 */
export function createCook({ onCook } = {}) {
  const group = new THREE.Group();
  group.name = 'cook';

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(COOK_SIZE.width, COOK_SIZE.height, COOK_SIZE.depth),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.name = 'cook-highlight';
  mesh.position.set(0, COOK_SIZE.height / 2, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  group.userData.kind = 'cook';
  group.userData.id = 'cook';
  group.userData.isCook = true;
  group.userData.highlightMesh = mesh;
  group.userData.interactLocal = new THREE.Vector3(
    COOK_INTERACT.x - COOK_CENTER.x,
    COOK_INTERACT.y - COOK_CENTER.y,
    COOK_INTERACT.z - COOK_CENTER.z
  );
  group.userData.getPrompt = (isMobile) => (isMobile ? 'Tap to cook' : 'Press E to cook');
  group.userData.onCook = onCook;
  group.userData.interact = (ctx = {}) => {
    const fn = ctx.cook
      || group.userData.onCook
      || (ctx.scene && ctx.scene.userData && ctx.scene.userData.skills && ctx.scene.userData.skills.cook);
    if (typeof fn !== 'function') return false;
    return fn(ctx) !== false;
  };
  return group;
}

/** Attach the kitchen Cook entry to scene.userData.interactables once the interior exists. */
export function registerCookInteractable(scene) {
  if (!scene || !scene.userData) return null;
  const cook = scene.userData.cook;
  if (!cook) return null;
  const list = scene.userData.interactables || (scene.userData.interactables = []);
  if (!list.some((e) => e && (e.id === 'cook' || e.object === cook))) {
    list.push({ id: 'cook', kind: 'cook', object: cook, range: 2.0 });
  }
  return cook;
}

export function createSkills({
  defs = SKILL_DEFS,
  values = null,
  clock = null,
  needs = null,
  sfx = null,
  toast = null,
  save = null,
  container = (typeof document !== 'undefined' ? document.body : null)
} = {}) {
  ensureStyles();
  const list = (defs && defs.length ? defs : SKILL_DEFS).map((d) => ({ ...d }));
  const xp = Object.create(null);
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const seed = values && values[d.id] != null ? readXp(values[d.id]) : 0;
    xp[d.id] = clampXp(seed);
  }

  const listeners = { change: [], levelup: [] };
  let toastEl = null;
  let toastTimer = null;
  const toastQueue = [];

  if (container && typeof document !== 'undefined') {
    toastEl = document.createElement('div');
    toastEl.id = 'skill-toast';
    toastEl.className = 'hud-ui';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    container.appendChild(toastEl);
  }

  function readXp(raw) {
    if (raw == null) return 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'object' && raw.xp != null) return Number(raw.xp);
    return 0;
  }

  function clampXp(value) {
    const n = Number(value);
    const v = Number.isFinite(n) ? n : 0;
    if (v < 0) return 0;
    if (v > MAX_XP) return MAX_XP;
    return v;
  }

  function snapshotOne(d) {
    const prog = progressFromXp(xp[d.id]);
    return {
      id: d.id,
      name: d.name,
      icon: d.icon || '',
      xp: prog.xp,
      level: prog.level,
      xpIntoLevel: prog.xpIntoLevel,
      xpToNext: prog.xpToNext,
      progress: prog.progress
    };
  }

  function snapshot() {
    const valuesOut = {};
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const row = snapshotOne(list[i]);
      valuesOut[row.id] = row;
      items.push(row);
    }
    return { items, values: valuesOut };
  }

  function emit(name, payload) {
    const fns = listeners[name];
    if (!fns) return;
    for (let i = 0; i < fns.length; i++) fns[i](payload);
  }

  function showToast(message) {
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      toastTimer = null;
      if (toastQueue.length) showToast(toastQueue.shift());
    }, SKILL_TOAST_LAYOUT.holdMs);
  }

  function queueToast(message) {
    if (!message) return;
    if (toastEl && toastEl.classList.contains('is-visible')) toastQueue.push(message);
    else showToast(message);
  }

  function get(id) {
    if (id) {
      const d = defById(list, id);
      return d ? snapshotOne(d) : null;
    }
    return snapshot();
  }

  function addXp(id, amount) {
    const d = defById(list, id);
    if (!d) return null;
    const add = Number(amount);
    if (!Number.isFinite(add) || add === 0) return get(id);
    const before = progressFromXp(xp[d.id]);
    xp[d.id] = clampXp(xp[d.id] + add);
    const after = progressFromXp(xp[d.id]);
    const snap = snapshot();
    emit('change', snap);
    if (after.level > before.level) {
      const msg = d.name + ' up! Lv. ' + after.level;
      queueToast(msg);
      emit('levelup', { id: d.id, name: d.name, before: before.level, level: after.level, skill: after });
    }
    return after;
  }

  function addWalk(meters) {
    const d = Number(meters);
    if (!Number.isFinite(d) || d <= 0) return null;
    return addXp('fitness', d * XP_WALK_PER_METER);
  }

  function cook(ctx = {}) {
    const needsApi = ctx.needs || needs;
    const clockApi = ctx.clock || clock;
    const sfxApi = ctx.sfx || sfx;
    const inv = ctx.inventory || null;
    const toastFn = typeof ctx.toast === 'function' ? ctx.toast : toast;

    // Check if the player has Groceries to cook a full hot home meal!
    let grocerySlot = -1;
    const slots = inv && typeof inv.getItems === 'function'
      ? inv.getItems()
      : (inv && typeof inv.getSlots === 'function' ? inv.getSlots() : null);
    if (Array.isArray(slots)) {
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] && slots[i].id === 'groceries' && (slots[i].count || 0) > 0) {
          grocerySlot = i;
          break;
        }
      }
    }

    const consumeSlot = inv && typeof inv.consume === 'function'
      ? (idx, n) => inv.consume(idx, n)
      : (inv && typeof inv.removeAt === 'function' ? (idx, n) => inv.removeAt(idx, n) : null);

    if (grocerySlot >= 0 && consumeSlot) {
      consumeSlot(grocerySlot, 1);
      if (clockApi && typeof clockApi.advance === 'function') clockApi.advance(COOK_MINUTES);
      if (needsApi && typeof needsApi.add === 'function') {
        needsApi.add('hunger', 75);
        needsApi.add('mood', 18);
      }
      addXp('cooking', XP_COOK + 10);
      if (sfxApi && typeof sfxApi.play === 'function') sfxApi.play('eat');
      if (typeof toastFn === 'function') toastFn('Cooked a hot home meal! (+75 Hunger, +9 Energy)');
      if (typeof save === 'function') save();
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('maple-cooked', {
          detail: { minutes: COOK_MINUTES, meal: true, hunger: 75, mood: 18, xp: XP_COOK + 10 }
        }));
      }
      return true;
    }

    const hunger = needsApi && typeof needsApi.get === 'function' ? Number(needsApi.get('hunger')) : Infinity;
    if (Number.isFinite(hunger) && hunger < COOK_HUNGER_COST) {
      if (typeof toastFn === 'function') toastFn(COOK_HUNGRY);
      return false;
    }
    if (clockApi && typeof clockApi.advance === 'function') clockApi.advance(COOK_MINUTES);
    if (needsApi && typeof needsApi.add === 'function') needsApi.add('hunger', -COOK_HUNGER_COST);
    addXp('cooking', XP_COOK);
    if (sfxApi && typeof sfxApi.play === 'function') sfxApi.play('eat');
    if (typeof toastFn === 'function') toastFn(COOK_DONE);
    if (typeof save === 'function') save();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('maple-cooked', {
        detail: { minutes: COOK_MINUTES, meal: false, hunger: COOK_HUNGER_COST, xp: XP_COOK }
      }));
    }
    return true;
  }

  function serialize() {
    const out = {};
    for (let i = 0; i < list.length; i++) {
      const id = list[i].id;
      const prog = progressFromXp(xp[id]);
      out[id] = { xp: prog.xp, level: prog.level };
    }
    return out;
  }

  function apply(data) {
    const raw = (data && data.skills && typeof data.skills === 'object') ? data.skills : (data || {});
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const id = list[i].id;
      if (raw[id] == null) continue;
      const next = clampXp(readXp(raw[id]));
      if (next !== xp[id]) { xp[id] = next; changed = true; }
    }
    if (changed) emit('change', snapshot());
    return get();
  }

  function on(name, fn) {
    if (!listeners[name] || typeof fn !== 'function') return () => {};
    listeners[name].push(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const listn = listeners[name];
    if (!listn) return;
    const i = listn.indexOf(fn);
    if (i >= 0) listn.splice(i, 1);
  }

  function onChange(fn) {
    return on('change', fn);
  }

  function onWorked() {
    addXp('fitness', XP_WORK);
    if (typeof save === 'function') save();
  }

  function onInventoryUse(e) {
    const use = e && e.detail && e.detail.use;
    if (use && use.action === 'eat') {
      addXp('cooking', XP_EAT);
      if (typeof save === 'function') save();
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('maple-worked', onWorked);
    window.addEventListener('inventory-use', onInventoryUse);
  }

  function dispose() {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('maple-worked', onWorked);
      window.removeEventListener('inventory-use', onInventoryUse);
    }
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    toastQueue.length = 0;
    if (toastEl) toastEl.remove();
    toastEl = null;
  }

  return {
    get,
    addXp,
    addWalk,
    cook,
    serialize,
    apply,
    on,
    off,
    onChange,
    dispose,
    defs: list,
    toastElement: toastEl,
    isToastVisible: () => !!(toastEl && toastEl.classList.contains('is-visible')),
    showToast,
    DEBUG_XP
  };
}
