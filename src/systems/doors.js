import * as THREE from 'three';

/** Local yaw applied to a hinged door pivot when it is open (inward). */
export const DOOR_OPEN_ANGLE = Math.PI / 2;

/**
 * A hinged door: a Group pivoted on the left edge of the doorway (x=0).
 * The panel sits at x = width/2 so rotation.y swings it like a real door.
 * userData.interactLocal is the closed-door centre, used for range checks.
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
    roughness: 0.85,
    metalness: 0.05
  });

  const pivot = new THREE.Group();
  pivot.name = 'door';

  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  panel.name = 'door-panel';
  panel.position.set(width / 2, height / 2, 0);
  panel.castShadow = castShadow;
  panel.receiveShadow = receiveShadow;
  pivot.add(panel);

  pivot.userData.isDoor = true;
  pivot.userData.open = false;
  pivot.userData.doorWidth = width;
  pivot.userData.doorHeight = height;
  pivot.userData.doorId = options.id || 'door';
  pivot.userData.interactLocal = new THREE.Vector3(width / 2, height / 2, 0);
  return pivot;
}

/** World-space point used for the 3 m interact range (closed-door centre). */
export function doorInteractPoint(door, target = new THREE.Vector3()) {
  if (!door) return target.set(0, 0, 0);
  if (typeof door.updateMatrixWorld === 'function') door.updateMatrixWorld(true);
  if (door.userData && door.userData.interactLocal && typeof door.localToWorld === 'function') {
    return door.localToWorld(target.copy(door.userData.interactLocal));
  }
  if (door.getWorldPosition) return door.getWorldPosition(target);
  if (door.position) return target.set(door.position.x, door.position.y, door.position.z);
  return target.set(0, 0, 0);
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

export function toggleDoor(door) {
  if (!door) return false;
  door.userData.open = !door.userData.open;
  door.rotation.y = door.userData.open ? DOOR_OPEN_ANGLE : 0;
  return door.userData.open;
}
