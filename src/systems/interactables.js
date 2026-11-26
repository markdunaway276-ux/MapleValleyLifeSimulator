import * as THREE from 'three';
import { doorInteractPoint, toggleDoor } from './doors.js';
import { INTERACT_RANGE } from '../ui/interactPrompt.js';

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
  const dz = bz - az;
  const slabs = [[dx, ax, c.minX, c.maxX], [dz, az, c.minZ, c.maxZ]];
  for (let i = 0; i < 2; i++) {
    const [d, a, lo, hi] = slabs[i];
    if (Math.abs(d) < 1e-12) {
      if (a < lo || a > hi) return false;
      continue;
    }
    let ta = (lo - a) / d;
    let tb = (hi - a) / d;
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

export function nearestActionTarget(scene, position, range = INTERACT_RANGE) {
  if (!scene || !position) return null;
  const candidates = [];
  const doors = (scene.userData && scene.userData.doors) || [];
  for (let i = 0; i < doors.length; i++) candidates.push(doors[i]);
  const extras = enabledInteractables(scene);
  for (let i = 0; i < extras.length; i++) {
    const obj = extras[i].object || extras[i];
    if (obj && !candidates.includes(obj)) candidates.push(obj);
  }
  const world = scene.userData && scene.userData.colliders;
  const p = new THREE.Vector3();
  let best = null;
  let bestD = range;
  for (let i = 0; i < candidates.length; i++) {
    const dist = position.distanceTo(targetInteractPoint(candidates[i], p));
    if (dist < bestD && hasLineOfReach(world, position, p)) {
      best = candidates[i];
      bestD = dist;
    }
  }
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
