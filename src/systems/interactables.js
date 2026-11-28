import * as THREE from 'three';
import { doorInteractPoint, toggleDoor } from './doors.js';

export const INTERACT_RANGE = 3;

/**
 * Generic interactables sit in scene.userData.interactables alongside doors.
 * Each entry is `{ id, kind, object, range?, getPoint? }`. The object may also
 * carry userData.getPrompt / userData.interact so the on-screen prompt and the
 * E / tap path stay the same as doors. Hidden or picked objects are skipped.
 *
 * The mailbox's userData.mail is the hook for daily mail (cash, etc.):
 * set `pending` and/or `onOpen` without changing the interact path.
 */

export function isInteractableEnabled(entry) {
  if (!entry) return false;
  if (entry.disabled) return false;
  const obj = entry.object || entry;
  if (!obj) return false;
  if (obj.visible === false) return false;
  const ud = obj.userData || {};
  if (ud.picked || ud.disabled) return false;
  if (typeof entry.enabled === 'function' && !entry.enabled()) return false;
  return true;
}

export function targetInteractPoint(target, out = new THREE.Vector3()) {
  if (!target) return out.set(0, 0, 0);
  if (typeof target.getPoint === 'function') {
    const p = target.getPoint();
    return out.set(p.x, p.y || 0, p.z);
  }
  const obj = target.isObject3D ? target : target.object;
  if (!obj) return out.set(0, 0, 0);
  if (obj.userData && obj.userData.interactLocal) return doorInteractPoint(obj, out);
  if (typeof obj.getWorldPosition === 'function') return obj.getWorldPosition(out);
  const p = obj.position || { x: 0, y: 0, z: 0 };
  return out.set(p.x || 0, p.y || 0, p.z || 0);
}

/** Enabled entries from scene.userData.interactables (doors are listed separately). */
export function enabledInteractables(scene) {
  const list = (scene && scene.userData && scene.userData.interactables) || [];
  return list.filter(isInteractableEnabled);
}

/**
 * Nearest in-range door or enabled interactable, or null.
 * Returns the Object3D (the door, or entry.object) so the prompt can read
 * userData the same way for both.
 */
/**
 * Walls between you and a target block it, so a prompt never reaches through a
 * wall (e.g. the bed's "Press E to sleep" from inside the bathroom).
 *
 * Only wall-like boxes block: thin ones (a side of WALL_MAX_THICKNESS or less,
 * like interior partitions) and big ones (a side of BLOCKER_MIN_SIZE or more,
 * like houses). Furniture never blocks, so a chair cannot hide the snack.
 * Boxes within TARGET_CLEARANCE of the target point are ignored: those are the
 * wall the light switch is on, the house a door belongs to, and so on.
 */
export const WALL_MAX_THICKNESS = 0.3;
export const BLOCKER_MIN_SIZE = 3;
export const TARGET_CLEARANCE = 0.35;

function isWallLike(c) {
  const w = c.maxX - c.minX;
  const d = c.maxZ - c.minZ;
  return Math.min(w, d) <= WALL_MAX_THICKNESS || Math.max(w, d) >= BLOCKER_MIN_SIZE;
}

function nearBox(px, pz, c, pad) {
  return px >= c.minX - pad && px <= c.maxX + pad && pz >= c.minZ - pad && pz <= c.maxZ + pad;
}

/** Does the XZ segment a -> b cross box c? (slab test) */
export function segmentHitsBox(ax, az, bx, bz, c) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  if (Math.abs(dx) < 1e-12) {
    if (ax < c.minX || ax > c.maxX) return false;
  } else {
    let ta = (c.minX - ax) / dx;
    let tb = (c.maxX - ax) / dx;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  const dz = bz - az;
  if (Math.abs(dz) < 1e-12) {
    if (az < c.minZ || az > c.maxZ) return false;
  } else {
    let ta = (c.minZ - az) / dz;
    let tb = (c.maxZ - az) / dz;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  return true;
}

/** True when no wall-like collider stands between the player and the target point. */
export function hasLineOfReach(world, from, to) {
  const list = world && world.colliders;
  if (!list) return true;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c || c.disabled || c.type !== 'aabb' || !isWallLike(c)) continue;
    if (nearBox(to.x, to.z, c, TARGET_CLEARANCE)) continue;
    if (nearBox(from.x, from.z, c, 0)) continue; // standing in a doorway gap's edge, etc.
    if (segmentHitsBox(from.x, from.z, to.x, to.z, c)) return false;
  }
  return true;
}

const _candidates = [];
const _reach = new Map();
const _point = new THREE.Vector3();

export function nearestActionTarget(scene, position, range = INTERACT_RANGE, { development = false, yaw = null, pitch = 0 } = {}) {
  if (!scene || !position) return null;
  _candidates.length = 0;
  _reach.clear();
  const ud = scene.userData;
  const doors = (ud && ud.doors) || null;
  if (doors) {
    for (let i = 0; i < doors.length; i++) _candidates.push(doors[i]);
  }
  const list = (ud && ud.interactables) || null;
  // An entry may set its own, shorter reach (`range`, metres from the eye).
  if (list) {
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (!isInteractableEnabled(entry)) continue;
      const obj = entry.object || entry;
      if (obj && !_candidates.includes(obj)) _candidates.push(obj);
      if (!development && obj && Number(entry.range) > 0) _reach.set(obj, Math.min(range, Number(entry.range)));
    }
  }
  const world = ud && ud.colliders;
  const useAim = yaw != null && Number.isFinite(yaw);
  const p = Number.isFinite(pitch) ? pitch : 0;
  const cosP = useAim ? Math.cos(p) : 1;
  const fx = useAim ? -Math.sin(yaw) * cosP : 0;
  const fy = useAim ? Math.sin(p) : 0;
  const fz = useAim ? -Math.cos(yaw) * cosP : -1;
  const px = position.x || 0;
  const py = position.y || 0;
  const pz = position.z || 0;

  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < _candidates.length; i++) {
    const cand = _candidates[i];
    const tp = targetInteractPoint(cand, _point);
    const dx = tp.x - px;
    const dy = tp.y - py;
    const dz = tp.z - pz;
    const dist = Math.hypot(dx, dy, dz);
    const defaultReach = (!development && cand.userData && cand.userData.isDoor) ? Math.min(range, 2.2) : range;
    const maxReach = _reach.get(cand) ?? defaultReach;
    if (dist >= maxReach || !hasLineOfReach(world, position, tp)) continue;
    let score = dist;
    if (useAim) {
      const inv = dist > 1e-4 ? 1 / dist : 0;
      const dot = THREE.MathUtils.clamp((dx * fx + dy * fy + dz * fz) * inv, -1, 1);
      // Reject peripheral / behind-the-back triggers unless practically touching them.
      if (dot < 0.42 && dist > 0.72) continue;
      const angle = Math.acos(dot);
      const isNpc = !!(cand.userData && (cand.userData.isNpc || cand.userData.kind === 'npc'));
      // Strongly prioritize what the player is directly looking at over closer side objects.
      score = angle * 3.2 + dist * 0.45 - (isNpc && angle < 0.35 ? 0.25 : 0);
    }
    if (score < bestScore) {
      best = cand;
      bestScore = score;
    }
  }
  _candidates.length = 0;
  _reach.clear();
  return best;
}

/** Run the target's interact hook, or toggle a door. */
export function activateTarget(target, ctx = {}) {
  if (!target) return false;
  const ud = target.userData || {};
  if (typeof ud.interact === 'function') return ud.interact(ctx);
  if (ud.isDoor) return toggleDoor(target);
  return false;
}

export function hidePickup(object) {
  if (!object) return;
  object.visible = false;
  if (!object.userData) object.userData = {};
  object.userData.picked = true;
}

/**
 * Persist / restore which one-time pickups have been taken. Call apply() both
 * after creating the street (mailbox) and after the interior (snack) loads.
 */
export function createWorldState(scene) {
  const state = {
    taken: Object.create(null),
    take(id) {
      state.taken[id] = true;
    },
    serialize() {
      const mb = scene.getObjectByName && scene.getObjectByName('mailbox');
      const mail = mb && mb.userData && mb.userData.mail;
      return {
        snack: !!state.taken.snack,
        letter: !!state.taken.letter,
        mailboxOpen: !!(mb && mb.userData && mb.userData.open),
        mailPending: mail && Array.isArray(mail.pending) ? mail.pending.map((p) => ({ ...p })) : [],
        lastMailDay: mail && mail.lastMailDay != null ? mail.lastMailDay : 0,
        emptyStreak: mail && mail.emptyStreak != null ? mail.emptyStreak | 0 : 0
      };
    },
    apply(data) {
      const pickups = (data && data.pickups) || {};
      if (pickups.snack) state.taken.snack = true;
      if (pickups.letter) state.taken.letter = true;
      const snack = scene.getObjectByName && scene.getObjectByName('snack-pickup');
      if (state.taken.snack && snack) hidePickup(snack);
      const mb = scene.getObjectByName && scene.getObjectByName('mailbox');
      if (mb && mb.userData) {
        if (!mb.userData.mail) mb.userData.mail = { letterTaken: false, pending: [] };
        mb.userData.mail.letterTaken = !!state.taken.letter;
        if (Array.isArray(pickups.mailPending)) mb.userData.mail.pending = pickups.mailPending.map((p) => ({ ...p }));
        if (pickups.lastMailDay != null) mb.userData.mail.lastMailDay = pickups.lastMailDay;
        if (pickups.emptyStreak != null) mb.userData.mail.emptyStreak = pickups.emptyStreak | 0;
        if (pickups.mailboxOpen && !mb.userData.open) {
          mb.userData.open = true;
          if (typeof mb.userData.applyPose === 'function') mb.userData.applyPose(true);
        }
      }
    }
  };
  return state;
}
