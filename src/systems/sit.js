/**
 * Sit / stand on furniture. The visible sofa and chairs stay in the merged
 * interior mesh; each seat is an invisible generic interactable with
 * "Press E to sit" / "Tap to sit", and "Press E to stand" / "Tap to stand"
 * while you are in that seat.
 *
 * Sitting locks movement, eases the camera down to SIT_EYE_HEIGHT facing
 * the seat's forward direction, and still lets you look around. Standing
 * puts you at a nearby spot checked with unstick. Energy slowly regenerates
 * while you sit (Hunger still drains).
 *
 * Seats are data-driven (SEAT_DEFS). They are created with the interior but
 * registered onto scene.userData.interactables from main.js, the same way
 * the kitchen Cook is, so older highlighter counts stay stable.
 */

import * as THREE from 'three';
import { PLAYER_RADIUS } from './collision.js';
import {
  SOFA_CENTER, SOFA_SIZE, SOFA_INTERACT, SOFA_SEAT, SOFA_STAND,
  CHAIR_SIZE, CHAIR_DEFS
} from '../world/interior.js';

export {
  SOFA_CENTER, SOFA_SIZE, SOFA_INTERACT, SOFA_SEAT, SOFA_STAND,
  CHAIR_SIZE, CHAIR_DEFS
};

export const SIT_EYE_HEIGHT = 1.1;
export const SIT_EASE = 0.45;
/** Energy restored per game hour while sitting (slow; a full night's sleep still wins). */
export const ENERGY_SIT_PER_HOUR = 5;
export const ENERGY_SIT_PER_GAME_MINUTE = ENERGY_SIT_PER_HOUR / 60;

/** Facing: yaw is the player Euler Y (look down -Z at 0), dx/dz is look direction, rx/rz is right. */
export const FACE = {
  '+x': { yaw: -Math.PI / 2, dx: 1, dz: 0, rx: 0, rz: 1 },
  '-x': { yaw: Math.PI / 2, dx: -1, dz: 0, rx: 0, rz: -1 },
  '+z': { yaw: Math.PI, dx: 0, dz: 1, rx: -1, rz: 0 },
  '-z': { yaw: 0, dx: 0, dz: -1, rx: 1, rz: 0 }
};

const CHAIR_BEHIND = CHAIR_SIZE.depth / 2 + 0.35;

export function chairSeatDef(raw) {
  const f = FACE[raw.facing] || FACE['-z'];
  const cx = raw.x;
  const cz = raw.z;
  return {
    id: raw.id,
    kind: 'chair',
    name: 'chair',
    facing: raw.facing,
    center: { x: cx, y: 0, z: cz },
    size: { ...CHAIR_SIZE },
    interact: { x: cx - f.dx * CHAIR_BEHIND, y: 0.7, z: cz - f.dz * CHAIR_BEHIND },
    seat: { x: cx, y: SIT_EYE_HEIGHT, z: cz, yaw: f.yaw },
    stand: { x: cx - f.dx * CHAIR_BEHIND, z: cz - f.dz * CHAIR_BEHIND }
  };
}

export const SOFA_DEF = {
  id: 'sofa',
  kind: 'sofa',
  name: 'sofa',
  facing: '+x',
  center: { ...SOFA_CENTER },
  size: { ...SOFA_SIZE },
  interact: { ...SOFA_INTERACT },
  seat: { ...SOFA_SEAT, y: SIT_EYE_HEIGHT },
  stand: { ...SOFA_STAND }
};

export const SEAT_DEFS = [SOFA_DEF, ...CHAIR_DEFS.map(chairSeatDef)];

export function getSeatDef(id) {
  if (!id) return null;
  for (let i = 0; i < SEAT_DEFS.length; i++) {
    if (SEAT_DEFS[i].id === id) return SEAT_DEFS[i];
  }
  return null;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function smoothstep(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function sitPrompt(isMobile, seated) {
  if (seated) return isMobile ? 'Tap to stand' : 'Press E to stand';
  return isMobile ? 'Tap to sit' : 'Press E to sit';
}

/**
 * Invisible seat proxy for the prompt, highlighter, and E / tap path.
 * The visible furniture stays in the merged interior mesh.
 */
export function createSeat(def) {
  const d = def && def.id ? def : getSeatDef(def);
  if (!d) return null;
  const group = new THREE.Group();
  group.name = d.id;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(d.size.width, d.size.height, d.size.depth),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.name = d.id + '-highlight';
  mesh.position.set(0, d.size.height / 2, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  group.userData.kind = 'sit';
  group.userData.id = d.id;
  group.userData.isSeat = true;
  group.userData.seat = d;
  group.userData.highlightMesh = mesh;
  group.userData.interactLocal = new THREE.Vector3(
    d.interact.x - d.center.x,
    d.interact.y - d.center.y,
    d.interact.z - d.center.z
  );
  group.userData.getPrompt = (isMobile) => {
    const api = group.userData.sit;
    const seated = !!(api && typeof api.isSeated === 'function' && api.isSeated() && api.object() === group);
    return sitPrompt(isMobile, seated);
  };
  group.userData.interact = (ctx = {}) => {
    const api = ctx.sit
      || group.userData.sit
      || (ctx.scene && ctx.scene.userData && ctx.scene.userData.sit);
    if (!api) return false;
    if (typeof api.isSeated === 'function' && api.isSeated() && api.object() === group) {
      return api.stand() !== false;
    }
    return api.sit(group, ctx) !== false;
  };
  return group;
}

export function createSeats(defs = SEAT_DEFS) {
  const list = [];
  for (let i = 0; i < defs.length; i++) {
    const obj = createSeat(defs[i]);
    if (!obj) continue;
    obj.position.set(defs[i].center.x, defs[i].center.y, defs[i].center.z);
    list.push(obj);
  }
  return list;
}

/** Attach sofa / chair entries once the interior exists (called from main.js). */
export function registerSitInteractables(scene) {
  if (!scene || !scene.userData) return [];
  const seats = scene.userData.seats;
  if (!seats || !seats.length) return [];
  const list = scene.userData.interactables || (scene.userData.interactables = []);
  const added = [];
  for (let i = 0; i < seats.length; i++) {
    const obj = seats[i];
    if (!obj) continue;
    const id = (obj.userData && obj.userData.id) || obj.name;
    if (list.some((e) => e && (e.id === id || e.object === obj))) {
      added.push(obj);
      continue;
    }
    list.push({ id, kind: 'sit', object: obj });
    if (scene.userData.sit) obj.userData.sit = scene.userData.sit;
    added.push(obj);
  }
  return added;
}

export function createSit({
  scene,
  player,
  camera,
  needs = null,
  isStarted = () => true,
  onSeatedChange = null
} = {}) {
  let seated = false;
  let current = null;
  let easeT = 1;
  let from = null;
  let to = null;

  function object() {
    return current;
  }

  function isSeated() {
    return seated;
  }

  function currentDef() {
    return current && current.userData && current.userData.seat;
  }

  function stopKeys() {
    if (!player || !player.keys) return;
    player.keys.forward = player.keys.back = player.keys.left = player.keys.right = player.keys.jump = false;
    player.joystickX = 0;
    player.joystickY = 0;
    player.velocity.set(0, 0, 0);
  }

  function applyLook() {
    if (!player || !camera) return;
    player.rotation.y -= (player.mouseX || 0) * 0.002;
    player.rotation.x -= (player.mouseY || 0) * 0.002;
    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
    camera.quaternion.setFromEuler(player.rotation);
    player.mouseX = 0;
    player.mouseY = 0;
  }

  function placeAt(x, y, z, yaw, pitch) {
    player.position.set(x, y, z);
    if (yaw != null) player.rotation.y = yaw;
    if (pitch != null) player.rotation.x = pitch;
    camera.position.copy(player.position);
    camera.quaternion.setFromEuler(player.rotation);
  }

  function exitSpot() {
    const def = currentDef();
    const world = scene && scene.userData && scene.userData.colliders;
    const R = (player && player.radius) || PLAYER_RADIUS;
    const f = def && FACE[def.facing] ? FACE[def.facing] : FACE['+x'];
    const sx = def && def.seat ? def.seat.x : (player ? player.position.x : 0);
    const sz = def && def.seat ? def.seat.z : (player ? player.position.z : 0);
    const side = (def && def.size ? Math.max(def.size.width, def.size.depth) : 0.5) / 2 + R + 0.3;
    const candidates = [];
    if (def && def.stand) candidates.push({ x: def.stand.x, z: def.stand.z, side: 'front' });
    candidates.push(
      { x: sx + f.rx * side, z: sz + f.rz * side, side: 'right' },
      { x: sx - f.rx * side, z: sz - f.rz * side, side: 'left' },
      { x: sx + f.dx * (R + 0.55), z: sz + f.dz * (R + 0.55), side: 'ahead' }
    );
    const interior = scene && scene.userData && scene.userData.interior;
    const spawn = (interior && interior.spawn) || (scene && scene.userData && scene.userData.spawn) || { x: 0, z: -1.15 };
    if (!world || typeof world.unstick !== 'function') {
      const c = candidates[0] || spawn;
      return { x: c.x, z: c.z, side: c.side || 'front' };
    }
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const out = world.unstick(c.x, c.z, R, null);
      const moved = Math.hypot(out.x - c.x, out.z - c.z);
      if (moved > 0.8) continue;
      if (typeof world.overlaps === 'function' && world.overlaps(out.x, out.z, R * 0.99)) continue;
      return { x: out.x, z: out.z, side: c.side };
    }
    const out = world.unstick(spawn.x, spawn.z, R, spawn);
    return { x: out.x, z: out.z, side: 'spawn' };
  }

  function sit(target, ctx = {}) {
    if (seated && current === (target && target.isObject3D ? target : current)) return true;
    if (typeof isStarted === 'function' && !isStarted()) return false;
    const obj = target && target.isObject3D ? target : (target && target.object) || null;
    const def = (obj && obj.userData && obj.userData.seat) || (target && target.id && getSeatDef(target.id)) || getSeatDef(target);
    if (!def || !player || !camera) return false;
    const seatObj = obj || (scene && scene.userData && scene.userData.seats && scene.userData.seats.find((s) => s.userData && s.userData.id === def.id));
    if (seated) stand({ place: true });
    seated = true;
    current = seatObj || obj || null;
    stopKeys();
    player.onGround = true;
    from = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.rotation.y,
      pitch: player.rotation.x
    };
    to = { x: def.seat.x, y: def.seat.y != null ? def.seat.y : SIT_EYE_HEIGHT, z: def.seat.z, yaw: def.seat.yaw, pitch: 0 };
    easeT = 0;
    if (typeof onSeatedChange === 'function') onSeatedChange(true, def);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('maple-sat', { detail: { id: def.id, seat: def } }));
    }
    return true;
  }

  function stand({ place = true } = {}) {
    if (!seated) return false;
    const def = currentDef();
    const spot = place ? exitSpot() : null;
    seated = false;
    const was = current;
    current = null;
    easeT = 1;
    from = null;
    to = null;
    stopKeys();
    if (spot) {
      placeAt(spot.x, 1.6, spot.z, player.rotation.y, 0);
    } else {
      player.position.y = 1.6;
      camera.position.copy(player.position);
    }
    player.onGround = true;
    if (typeof onSeatedChange === 'function') onSeatedChange(false, def);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('maple-stood', {
        detail: { id: def && def.id, side: spot ? spot.side : null, from: was && was.userData && was.userData.id }
      }));
    }
    return spot || true;
  }

  function update(delta, { blocked = false } = {}) {
    if (!seated || !player || !camera) return;
    stopKeys();
    if (easeT < 1 && from && to) {
      easeT = Math.min(1, easeT + Math.max(0, Number(delta) || 0) / SIT_EASE);
      const k = smoothstep(easeT);
      placeAt(
        lerp(from.x, to.x, k),
        lerp(from.y, to.y, k),
        lerp(from.z, to.z, k),
        lerpAngle(from.yaw, to.yaw, k),
        lerp(from.pitch, to.pitch, k)
      );
      player.mouseX = 0;
      player.mouseY = 0;
      return;
    }
    // Keep the eye at the seat even if something bumped the player.
    const def = currentDef();
    if (def && def.seat) {
      player.position.x = def.seat.x;
      player.position.y = def.seat.y != null ? def.seat.y : SIT_EYE_HEIGHT;
      player.position.z = def.seat.z;
      camera.position.copy(player.position);
    }
    if (!blocked) applyLook();
    else {
      player.mouseX = 0;
      player.mouseY = 0;
      camera.quaternion.setFromEuler(player.rotation);
    }
  }

  function applyEnergy(gameMinutes) {
    if (!seated || !needs || typeof needs.add !== 'function') return null;
    const dt = Number(gameMinutes);
    if (!(dt > 0)) return null;
    return needs.add('energy', dt * ENERGY_SIT_PER_GAME_MINUTE);
  }

  const api = {
    sit,
    stand,
    update,
    applyEnergy,
    isSeated,
    object,
    currentDef,
    exitSpot,
    SEAT_DEFS
  };

  if (scene && scene.userData) scene.userData.sit = api;
  if (scene && scene.userData && scene.userData.seats) {
    for (let i = 0; i < scene.userData.seats.length; i++) {
      scene.userData.seats[i].userData.sit = api;
    }
  }

  return api;
}
