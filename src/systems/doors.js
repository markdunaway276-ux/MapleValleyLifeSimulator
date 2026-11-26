import * as THREE from 'three';
import { bevelBox } from '../world/shapes.js';

/** Local yaw for an open door: negative Y rotation swings the panel toward local +z (outward, toward the street). */
export const DOOR_OPEN_ANGLE = -Math.PI / 2;
/** Radians per second; a 90° swing completes in about 0.25 s. */
export const DOOR_ANIM_SPEED = (Math.PI / 2) / 0.25;

/**
 * A hinged door: the panel geometry is translated so its origin is the hinge
 * edge (left jamb, sitting on the ground). Rotating the Group around Y swings
 * the door like a real one; the hinge edge stays fixed in world space.
 * userData.interactLocal is the closed-door centre, used for range checks
 * (it does not move when the door opens).
 */
export function createHingedDoor(options = {}) {
  const width = options.width ?? 1;
  const height = options.height ?? 2;
  const depth = options.depth ?? 0.08;
  const shadows = options.shadows !== undefined ? !!options.shadows : true;
  const castShadow = options.castShadow !== undefined ? !!options.castShadow : shadows;
  const receiveShadow = options.receiveShadow !== undefined ? !!options.receiveShadow : shadows;
  const material = options.material || new THREE.MeshStandardMaterial({
    color: options.color ?? 0x654321,
    roughness: 0.72,
    metalness: 0
  });

  const pivot = new THREE.Group();
  pivot.name = 'door';

  // BoxGeometry is centred on its origin; shift it so the left face (x = 0)
  // is the hinge and the bottom sits at y = 0.
  const geometry = bevelBox(width, height, depth, { max: 0.012 });
  geometry.translate(width / 2, height / 2, 0);

  const panel = new THREE.Mesh(geometry, material);
  panel.name = 'door-panel';
  panel.position.set(0, 0, 0);
  panel.castShadow = castShadow;
  panel.receiveShadow = receiveShadow;
  pivot.add(panel);

  pivot.userData.isDoor = true;
  pivot.userData.open = false;
  pivot.userData.doorWidth = width;
  pivot.userData.doorHeight = height;
  pivot.userData.doorId = options.id || 'door';
  pivot.userData.hingeLocal = new THREE.Vector3(0, height / 2, 0);
  pivot.userData.freeEdgeLocal = new THREE.Vector3(width, height / 2, 0);
  pivot.userData.interactLocal = new THREE.Vector3(width / 2, height / 2, 0);
  return pivot;
}

function localToWorldOrFallback(door, local, target) {
  if (typeof door.updateMatrixWorld === 'function') door.updateMatrixWorld(true);
  if (local && typeof door.localToWorld === 'function') {
    return door.localToWorld(target.copy(local));
  }
  if (door.getWorldPosition) return door.getWorldPosition(target);
  if (door.position) return target.set(door.position.x, door.position.y, door.position.z);
  return target.set(0, 0, 0);
}

/** World-space point used for the 3 m interact range (closed-door centre). */
export function doorInteractPoint(door, target = new THREE.Vector3()) {
  if (!door) return target.set(0, 0, 0);
  const local = door.userData && door.userData.interactLocal;
  return localToWorldOrFallback(door, local, target);
}

/** Mid-height point on the hinge edge. Stays fixed as the door opens. */
export function doorHingePoint(door, target = new THREE.Vector3()) {
  if (!door) return target.set(0, 0, 0);
  const local = (door.userData && door.userData.hingeLocal) || new THREE.Vector3(0, 0, 0);
  return localToWorldOrFallback(door, local, target);
}

/** Mid-height point on the free (latch) edge. Moves as the door swings. */
export function doorFreeEdgePoint(door, target = new THREE.Vector3()) {
  if (!door) return target.set(0, 0, 0);
  const width = (door.userData && door.userData.doorWidth) || 0;
  const height = (door.userData && door.userData.doorHeight) || 0;
  const local = (door.userData && door.userData.freeEdgeLocal) || new THREE.Vector3(width, height / 2, 0);
  return localToWorldOrFallback(door, local, target);
}

/** World-space outward normal of the closed door (local +z, toward the street). */
export function doorOutwardNormal(door, target = new THREE.Vector3()) {
  target.set(0, 0, 1);
  if (!door || typeof door.updateMatrixWorld !== 'function') return target;
  const open = door.userData && door.userData.open;
  const yaw = door.rotation.y;
  // Closed pose: ignore current swing so the normal is the doorway outward.
  door.rotation.y = 0;
  door.updateMatrixWorld(true);
  target.set(0, 0, 1).transformDirection(door.matrixWorld).normalize();
  door.rotation.y = yaw;
  door.updateMatrixWorld(true);
  if (open) { /* yaw restored */ }
  return target;
}

/** Nearest door whose closed-door centre is strictly within `range`, or null. */
export function nearestDoor(doors, position, range) {
  if (!doors || !doors.length || !position) return null;
  const p = new THREE.Vector3();
  let best = null;
  let bestD = range;
  for (let i = 0; i < doors.length; i++) {
    const door = doors[i];
    const dist = position.distanceTo(doorInteractPoint(door, p));
    if (dist < bestD) {
      best = door;
      bestD = dist;
    }
  }
  return best;
}

export function doorTargetYaw(door) {
  return (door && door.userData && door.userData.open) ? DOOR_OPEN_ANGLE : 0;
}

export function applyDoorPose(door) {
  if (!door) return;
  door.rotation.y = doorTargetYaw(door);
}

/**
 * Toggle open state. Pass immediate=true to snap (tests); otherwise the
 * panel is animated toward the new pose by updateDoors().
 */
export function toggleDoor(door, immediate = false) {
  if (!door) return false;
  door.userData.open = !door.userData.open;
  if (immediate) applyDoorPose(door);
  return door.userData.open;
}

/** Animate every door's yaw toward its open/closed target. */
export function updateDoors(doors, delta) {
  if (!doors || !doors.length) return;
  const stepLimit = DOOR_ANIM_SPEED * Math.max(0, delta || 0);
  for (let i = 0; i < doors.length; i++) {
    const door = doors[i];
    if (!door || !door.rotation) continue;
    const target = doorTargetYaw(door);
    const cur = door.rotation.y;
    const diff = target - cur;
    if (Math.abs(diff) <= 1e-4) {
      door.rotation.y = target;
      continue;
    }
    if (stepLimit <= 0 || Math.abs(diff) <= stepLimit) door.rotation.y = target;
    else door.rotation.y = cur + Math.sign(diff) * stepLimit;
  }
}
