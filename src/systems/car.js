import * as THREE from 'three';
import { pushOutOBB, syncBoxCollider, PLAYER_RADIUS } from './collision.js';
import { STREET, SURFACE_Y, surfaceHeightAt } from '../world/street.js';
import { CAR_SEAT, CAR_SIZE, CAR_SPAWN } from '../world/props.js';
import { carBoundsClamp } from './carBounds.js';
import { createFuelTank, FUEL } from './fuel.js';

/**
 * A basic drivable car (arcade physics, no physics engine).
 *
 * The car is the existing parked car (scene.userData.prop). While driving, the
 * camera sits at the driver's seat, the player body is hidden, and W/S (or the
 * joystick's Y) is throttle/reverse and A/D (or the joystick's X) steers.
 * Steering uses a bicycle model, so the turn rate scales with speed and the
 * wheel angle eases off as the car gets faster.
 *
 * Collision is an oriented box (SAT) against every collider in the world
 * (houses, trees, mailbox, vending machine, the NPCs' circles), plus the street
 * rectangle, the gas station forecourt and the park roads. It is advanced in sub-steps of at most STEP_MAX metres, so a
 * frame can never carry the car through a thin obstacle. The car's own collider
 * (id 'parked-car') moves with it, so the player and NPCs walk around it.
 */

export const CAR_PHYSICS = {
  MAX_SPEED: 7,       // m/s forward (the brief: ~6-8)
  MAX_REVERSE: 3,
  ACCEL: 4.5,         // m/s^2
  REV_ACCEL: 3,
  BRAKE: 9,
  COAST: 2,           // decel with no throttle
  WHEELBASE: 2.4,
  MAX_STEER: 0.62,    // rad at standstill; eases off with speed
  STEER_EASE: 0.55,   // fraction of MAX_STEER lost at top speed
  STEER_RATE: 4,      // rad/s the wheel angle follows the input
  STEP_MAX: 0.2,      // max metres of travel per collision sub-step
  DEADZONE: 0.1
};

export const CAR_LOOK = { YAW: 1.2, PITCH: 0.6, SENS: 0.002, RECENTER_AFTER: 1.5, RECENTER_RATE: 2 };
export const CAR_ID = 'parked-car';

const TWO_PI = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function wrapAngle(a) {
  let r = a % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  else if (r < -Math.PI) r += TWO_PI;
  return r;
}

/** Throttle (-1..1) and steer (-1..1, right is +) from keys and joystick. */
export function readDriveInput(player, blocked = false) {
  if (!player || blocked) return { throttle: 0, steer: 0 };
  const k = player.keys || {};
  let throttle = (k.forward ? 1 : 0) - (k.back ? 1 : 0);
  let steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  const dz = CAR_PHYSICS.DEADZONE;
  const jx = player.joystickX || 0;
  const jy = player.joystickY || 0;
  if (Math.abs(jx) > dz || Math.abs(jy) > dz) {
    throttle = Math.abs(jy) > dz ? clamp(jy, -1, 1) : 0;
    steer = Math.abs(jx) > dz ? clamp(jx, -1, 1) : 0;
  }
  return { throttle, steer };
}

/** World-space unit vectors for a heading: forward, right (driver's right), left. */
export function carAxes(rotY) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  return {
    fx: cos, fz: -sin,        // forward
    rx: sin, rz: cos,         // right-hand side (local +z)
    lx: -sin, lz: -cos        // left-hand side (local -z, where the driver sits)
  };
}

/** Where the driver's eye is, in world XZ. */
export function seatWorld(state, seat = CAR_SEAT) {
  const cos = Math.cos(state.rotY);
  const sin = Math.sin(state.rotY);
  return {
    x: state.x + seat.x * cos + seat.z * sin,
    z: state.z - seat.x * sin + seat.z * cos
  };
}

// ---- collision ----

function mtvOBBvsAABB(car, b) {
  const cos = Math.cos(car.rotY);
  const sin = Math.sin(car.rotY);
  const ac = Math.abs(cos);
  const as = Math.abs(sin);
  const bcx = (b.minX + b.maxX) / 2;
  const bcz = (b.minZ + b.maxZ) / 2;
  const bhw = (b.maxX - b.minX) / 2;
  const bhd = (b.maxZ - b.minZ) / 2;
  const dx = car.x - bcx;
  const dz = car.z - bcz;
  const rx = ac * car.hw + as * car.hd;
  const rz = as * car.hw + ac * car.hd;
  const ox = rx + bhw - Math.abs(dx);
  const oz = rz + bhd - Math.abs(dz);
  if (ox <= 0 || oz <= 0) return null;
  // Car axes: u = forward (cos, -sin), w = right (sin, cos)
  const du = dx * cos + dz * -sin;
  const dw = dx * sin + dz * cos;
  const ou = car.hw + (bhw * ac + bhd * as) - Math.abs(du);
  const ow = car.hd + (bhw * as + bhd * ac) - Math.abs(dw);
  if (ou <= 0 || ow <= 0) return null;
  const skin = 1e-4;
  let best = ox;
  let mx = (dx < 0 ? -1 : 1) * (ox + skin);
  let mz = 0;
  if (oz < best) { best = oz; mx = 0; mz = (dz < 0 ? -1 : 1) * (oz + skin); }
  if (ou < best) { best = ou; const s = (du < 0 ? -1 : 1) * (ou + skin); mx = s * cos; mz = s * -sin; }
  if (ow < best) { const s = (dw < 0 ? -1 : 1) * (ow + skin); mx = s * sin; mz = s * cos; }
  return { x: mx, z: mz };
}

function mtvOBBvsCircle(car, c) {
  const p = pushOutOBB(c.x, c.z, c.radius, car);
  if (!p) return null;
  return { x: c.x - p.x, z: c.z - p.z };
}

export function streetBounds(scene) {
  const s = (scene && scene.userData && scene.userData.street) || STREET;
  const half = (s.length || 44) / 2;
  const roadHalf = (s.roadWidth || STREET.roadWidth) / 2;
  const walk = s.sidewalkWidth || STREET.sidewalkWidth;
  const cz = s.roadCenterZ !== undefined ? s.roadCenterZ : STREET.roadCenterZ;
  return {
    minX: -half + 0.5, maxX: half - 0.5,
    minZ: cz - roadHalf - walk, maxZ: cz + roadHalf + walk
  };
}

/**
 * Push the car out of everything it overlaps and keep it on the road network.
 * `pose` is { x, z, rotY }; returns { x, z, hit }.
 */
export function resolveCarPose(world, pose, { skipId = CAR_ID, bounds = null, size = CAR_SIZE } = {}) {
  const box = { x: pose.x, z: pose.z, rotY: pose.rotY, hw: size.width / 2, hd: size.depth / 2 };
  const list = (world && world.colliders) || [];
  const cos = Math.abs(Math.cos(box.rotY));
  const sin = Math.abs(Math.sin(box.rotY));
  const ex = cos * box.hw + sin * box.hd;
  const ez = sin * box.hw + cos * box.hd;
  let hit = false;
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c || c.disabled || c.id === skipId) continue;
      let m = null;
      if (c.type === 'circle') m = mtvOBBvsCircle(box, c);
      else if (c.type === 'aabb' || c.type === 'obb') m = mtvOBBvsAABB(box, c);
      if (m) { box.x += m.x; box.z += m.z; moved = true; hit = true; }
    }
    if (bounds) {
      const { x: nx, z: nz } = carBoundsClamp(box.x, box.z, ex, ez, bounds);
      if (nx !== box.x || nz !== box.z) { box.x = nx; box.z = nz; moved = true; hit = true; }
    }
    if (!moved) break;
  }
  return { x: box.x, z: box.z, hit };
}

/**
 * One physics step. `state` is { x, z, rotY, speed, steer } and is mutated.
 * `world` is the collider world (optional). Returns { hit }.
 */
export function stepCar(state, input, dt, { world = null, bounds = null, braking = false } = {}) {
  const P = CAR_PHYSICS;
  const t = clamp(input.throttle || 0, -1, 1);
  const s = clamp(input.steer || 0, -1, 1);
  let v = state.speed;

  if (braking) {
    v = v > 0 ? Math.max(0, v - P.BRAKE * dt) : Math.min(0, v + P.BRAKE * dt);
  } else if (t > 0.05) {
    if (v < -0.05) v = Math.min(0, v + P.BRAKE * dt);
    else {
      const top = P.MAX_SPEED * t;
      if (v < top) v = Math.min(top, v + P.ACCEL * dt);
      else v = Math.max(top, v - P.COAST * dt);
    }
  } else if (t < -0.05) {
    if (v > 0.05) v = Math.max(0, v - P.BRAKE * dt);
    else {
      const top = -P.MAX_REVERSE * -t;
      if (v > top) v = Math.max(top, v - P.REV_ACCEL * dt);
      else v = Math.min(top, v + P.COAST * dt);
    }
  } else {
    v = v > 0 ? Math.max(0, v - P.COAST * dt) : Math.min(0, v + P.COAST * dt);
  }
  if (Math.abs(v) < 0.02 && Math.abs(t) <= 0.05) v = 0;

  // Wheel angle: scaled down as speed rises, and eased toward the target.
  const speedFrac = clamp(Math.abs(v) / P.MAX_SPEED, 0, 1);
  const target = s * P.MAX_STEER * (1 - P.STEER_EASE * speedFrac);
  const dSteer = target - state.steer;
  const maxD = P.STEER_RATE * dt;
  state.steer += clamp(dSteer, -maxD, maxD);

  const dist = Math.abs(v) * dt;
  const turn = Math.abs(v / P.WHEELBASE * Math.tan(state.steer)) * dt;
  const n = clamp(Math.ceil(Math.max(dist / P.STEP_MAX, turn / 0.1)), 1, 12);
  const sub = dt / n;
  let hit = false;
  for (let i = 0; i < n; i++) {
    const omega = v / P.WHEELBASE * Math.tan(state.steer);
    state.rotY = wrapAngle(state.rotY - omega * sub); // right turn lowers rotY
    const fx = Math.cos(state.rotY);
    const fz = -Math.sin(state.rotY);
    const nx = state.x + fx * v * sub;
    const nz = state.z + fz * v * sub;
    if (world || bounds) {
      const r = resolveCarPose(world, { x: nx, z: nz, rotY: state.rotY }, { bounds });
      if (r.hit) {
        hit = true;
        const along = ((r.x - state.x) * fx + (r.z - state.z) * fz) / sub;
        // Head-on stops dead; a scrape loses speed in proportion to how much
        // of the move the obstacle took (so the car can slide along a wall).
        if (Math.abs(v) < 0.05 || along * v <= 0) v = 0;
        else if (Math.abs(along) < Math.abs(v)) v *= Math.exp(-6 * (1 - Math.abs(along) / Math.abs(v)) * sub);
      }
      state.x = r.x;
      state.z = r.z;
    } else {
      state.x = nx;
      state.z = nz;
    }
  }
  state.speed = v;
  return { hit };
}

// ---- controller ----

export function createCar({
  scene,
  player,
  camera,
  isStarted = () => true,
  isBlocked = () => false,
  sfx = null,
  onDrivingChange = null,
  isMobile = false,
  object = null,
  toast = null,
  isFuelFree = () => false,
  getInventory = () => null
} = {}) {
  const car = object || (scene.userData && scene.userData.prop) || scene.getObjectByName('parked-car');
  if (!car) return null;
  const world = scene.userData && scene.userData.colliders;
  const size = (car.userData && car.userData.size) || CAR_SIZE;
  const seat = (car.userData && car.userData.seat) || CAR_SEAT;
  // The street, plus any lots you can drive onto (the gas station forecourt).
  const street = (scene && scene.userData && scene.userData.street) || STREET;
  const bounds = [streetBounds(scene), ...((scene.userData && scene.userData.driveAreas) || []), ...(street.expansion?.drive || [])];
  const fuel = createFuelTank(FUEL.START);
  let warnedLow = false;
  let warnedEmpty = false;
  const defaultPose = { x: CAR_SPAWN.x, z: CAR_SPAWN.z, rotY: CAR_SPAWN.rotY };

  const state = {
    x: car.position.x,
    z: car.position.z,
    rotY: car.rotation.y,
    speed: 0,
    steer: 0
  };
  let driving = false;
  let lookYaw = 0;
  let lookPitch = 0;
  let lookIdle = 0;
  let hitFlash = 0;
  const lastSeat = { x: 0, z: 0 };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const colliderOf = () => (world && world.colliders ? world.colliders.find((c) => c.id === CAR_ID) : null);

  function syncCollider() {
    let c = colliderOf();
    if (!c && world && typeof world.addHouse === 'function') {
      c = world.addHouse({ id: CAR_ID, x: state.x, z: state.z, width: size.width, depth: size.depth, rotY: state.rotY });
    }
    if (c) syncBoxCollider(c, { x: state.x, z: state.z, width: size.width, depth: size.depth, rotY: state.rotY });
  }

  function syncMesh() {
    car.position.set(state.x, 0, state.z);
    car.rotation.y = state.rotY;
    const wheels = car.userData && car.userData.frontWheels;
    if (wheels) for (let i = 0; i < wheels.length; i++) wheels[i].rotation.y = -state.steer;
    const shadow = car.userData && car.userData.contactShadow;
    if (shadow) shadow.position.y = Math.max(SURFACE_Y.road, surfaceHeightAt(state.x, state.z));
    syncCollider();
  }

  function applyPose(p) {
    state.x = p.x;
    state.z = p.z;
    state.rotY = wrapAngle(p.rotY || 0);
    state.speed = 0;
    state.steer = 0;
    syncMesh();
  }

  /** True when the car's box at `pose` overlaps nothing and is inside the street. */
  function poseIsFree(p) {
    const r = resolveCarPose(world, { x: p.x, z: p.z, rotY: p.rotY || 0 }, { bounds, size });
    return !r.hit;
  }

  function serialize() {
    const r = (n) => Math.round(n * 1000) / 1000;
    return { x: r(state.x), z: r(state.z), rotY: r(state.rotY), fuel: r(fuel.get()) };
  }

  function apply(data) {
    const saved = data && data.car;
    if (saved && Number.isFinite(saved.fuel)) fuel.set(saved.fuel);
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return false;
    const pose = { x: saved.x, z: saved.z, rotY: Number.isFinite(saved.rotY) ? saved.rotY : 0 };
    // Put the car back where it was parked, unless something now sits there.
    if (world && !poseIsFree(pose)) {
      applyPose(defaultPose);
      return false;
    }
    applyPose(pose);
    return true;
  }

  // ---- exit spot ----
  function exitSpot() {
    if (!world) return null;
    const a = carAxes(state.rotY);
    const R = player.radius || PLAYER_RADIUS;
    const side = size.depth / 2 + R + 0.3;
    const back = size.width / 2 + R + 0.3;
    const sx = seat.x;
    const candidates = [
      { x: state.x + a.fx * sx + a.lx * side, z: state.z + a.fz * sx + a.lz * side }, // left (driver's door)
      { x: state.x + a.fx * sx + a.rx * side, z: state.z + a.fz * sx + a.rz * side }, // right
      { x: state.x - a.fx * back, z: state.z - a.fz * back },                           // behind
      { x: state.x + a.fx * back, z: state.z + a.fz * back }                            // in front
    ];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const out = world.unstick(c.x, c.z, R, null);
      const moved = Math.hypot(out.x - c.x, out.z - c.z);
      if (moved > 0.8) continue; // pushed through something; not a safe place
      if (world.overlaps(out.x, out.z, R * 0.99)) continue;
      return { x: out.x, z: out.z, side: ['left', 'right', 'behind', 'front'][i] };
    }
    const spawn = (scene.userData && scene.userData.spawn) || STREET.spawn;
    const out = world.unstick(spawn.x, spawn.z, R, spawn);
    return { x: out.x, z: out.z, side: 'spawn' };
  }

  // ---- enter / exit ----
  function interactPoint() {
    // Nearest point of the car's box to the player's eye, so any side counts.
    const px = player.position.x;
    const pz = player.position.z;
    const cos = Math.cos(state.rotY);
    const sin = Math.sin(state.rotY);
    const dx = px - state.x;
    const dz = pz - state.z;
    const lx = clamp(dx * cos - dz * sin, -size.width / 2, size.width / 2);
    const lz = clamp(dx * sin + dz * cos, -size.depth / 2, size.depth / 2);
    return { x: state.x + lx * cos + lz * sin, y: 1.6, z: state.z - lx * sin + lz * cos };
  }

  function setLook() {
    const yaw = state.rotY - Math.PI / 2 + lookYaw;
    euler.set(lookPitch, yaw, 0, 'YXZ');
    player.rotation.set(lookPitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  }

  function placeCamera() {
    const s = seatWorld(state, seat);
    camera.position.set(s.x, seat.y, s.z);
    player.position.set(s.x, 1.6, s.z);
    lastSeat.x = s.x;
    lastSeat.z = s.z;
  }

  /** Getting in with an empty tank and a gas can in your bag pours it in. */
  function pourGasCan() {
    if (!fuel.isEmpty() && fuel.get() > FUEL.LOW) return false;
    const inv = getInventory && getInventory();
    if (!inv || typeof inv.getItems !== 'function') return false;
    const index = inv.getItems().findIndex((it) => it && it.id === 'gas-can');
    if (index < 0) return false;
    inv.consume(index, 1);
    fuel.add(FUEL.CAN_LITRES);
    if (toast) toast('Poured in the gas can: +' + FUEL.CAN_LITRES + ' L. Head to Fuel & Go to fill up.');
    return true;
  }

  function enter() {
    if (driving) return false;
    if (!isStarted()) return false;
    pourGasCan();
    driving = true;
    state.speed = 0;
    state.steer = 0;
    lookYaw = 0;
    lookPitch = 0;
    lookIdle = 0;
    player.velocity.set(0, 0, 0);
    player.onGround = true;
    placeCamera();
    setLook();
    if (onDrivingChange) onDrivingChange(true);
    if (sfx && typeof sfx.play === 'function') sfx.play('car');
    window.dispatchEvent(new CustomEvent('car-enter'));
    return true;
  }

  /** Leave the car. `place` false keeps the player where something else put them. */
  function exit({ place = true } = {}) {
    if (!driving) return false;
    const spot = place ? exitSpot() : null;
    driving = false;
    state.speed = 0;
    state.steer = 0;
    syncMesh();
    if (spot) {
      player.position.set(spot.x, 1.6, spot.z);
      player.rotation.x = 0;
      camera.position.copy(player.position);
      camera.quaternion.setFromEuler(player.rotation);
    }
    player.velocity.set(0, 0, 0);
    if (sfx) {
      if (typeof sfx.setCar === 'function') sfx.setCar(false);
      if (place && typeof sfx.play === 'function') sfx.play('car');
    }
    if (onDrivingChange) onDrivingChange(false);
    window.dispatchEvent(new CustomEvent('car-exit', { detail: { side: spot ? spot.side : null } }));
    return spot || true;
  }

  car.userData.getPrompt = (mobile) => {
    if (driving) return mobile ? 'Exit car' : 'Press E to exit car';
    const empty = fuel.isEmpty() ? ' (out of gas)' : '';
    return (mobile ? 'Tap to enter car' : 'Press E to enter car') + empty;
  };
  car.userData.interact = () => (driving ? !!exit() : enter());

  const entry = {
    id: 'car',
    kind: 'car',
    object: car,
    getPoint: () => (driving ? { x: player.position.x, y: 1.6, z: player.position.z } : interactPoint())
  };
  // The generic interact path measures from the object's getPoint, so any side
  // of the car (nearest point of its box) counts as being in range.
  car.getPoint = entry.getPoint;
  if (scene.userData) {
    if (!scene.userData.interactables) scene.userData.interactables = [];
    scene.userData.interactables.push(entry);
  }

  function update(delta, { blocked = false } = {}) {
    if (!driving) return;
    // Something else moved the player (debug teleport): get out where they are.
    if (Math.hypot(player.position.x - lastSeat.x, player.position.z - lastSeat.z) > 0.5) {
      exit({ place: false });
      return;
    }
    const dt = Math.max(0, Math.min(delta || 0, 0.1));
    const input = readDriveInput(player, blocked);
    // Out of gas: the engine stalls, so the car only coasts to a stop.
    if (fuel.isEmpty()) input.throttle = 0;
    const fromX = state.x;
    const fromZ = state.z;
    const r = stepCar(state, input, dt, { world, bounds, braking: blocked });
    if (!isFuelFree() && !fuel.isEmpty()) {
      fuel.burn(Math.hypot(state.x - fromX, state.z - fromZ), dt);
      if (fuel.isLow() && !warnedLow) {
        warnedLow = true;
        if (toast) toast('Running low on gas. Fuel & Go is in the middle of Maple Lane, north side.');
      }
      if (fuel.isEmpty() && !warnedEmpty) {
        warnedEmpty = true;
        if (toast) toast('Out of gas! Walk to Fuel & Go and buy a gas can.');
      }
    }
    if (fuel.get() > FUEL.LOW + 1) warnedLow = false;
    if (!fuel.isEmpty()) warnedEmpty = false;
    if (r.hit) hitFlash = 0.15; else hitFlash = Math.max(0, hitFlash - dt);
    syncMesh();

    // A slight look around, which eases back to straight ahead when idle.
    const mx = player.mouseX || 0;
    const my = player.mouseY || 0;
    player.mouseX = 0;
    player.mouseY = 0;
    if (!blocked && (mx || my)) {
      const look = CAR_LOOK.SENS * (player.lookSensitivity || 1);
      lookYaw = clamp(lookYaw - mx * look, -CAR_LOOK.YAW, CAR_LOOK.YAW);
      lookPitch = clamp(lookPitch - my * look * (player.invertY ? -1 : 1), -CAR_LOOK.PITCH, CAR_LOOK.PITCH);
      lookIdle = 0;
    } else {
      lookIdle += dt;
      if (lookIdle > CAR_LOOK.RECENTER_AFTER) {
        const k = Math.min(1, CAR_LOOK.RECENTER_RATE * dt);
        lookYaw -= lookYaw * k;
        lookPitch -= lookPitch * k;
      }
    }
    placeCamera();
    setLook();
    if (sfx && typeof sfx.setCar === 'function') sfx.setCar(!fuel.isEmpty(), Math.abs(state.speed) / CAR_PHYSICS.MAX_SPEED);
  }

  syncMesh();

  const api = {
    object: car,
    entry,
    state,
    isDriving: () => driving,
    fuel,
    /** True when the car's centre is within `range` m of (x, z) and it is parked. */
    isNear: (x, z, range) => Math.hypot(state.x - x, state.z - z) <= range && Math.abs(state.speed) < 0.1,
    enter,
    exit,
    update,
    apply,
    serialize,
    applyPose,
    resetToSpawn: () => applyPose(defaultPose),
    exitSpot,
    getSpeed: () => state.speed,
    getLook: () => ({ yaw: lookYaw, pitch: lookPitch }),
    didHit: () => hitFlash > 0,
    poseIsFree,
    getMarker: () => ({
      id: 'car', kind: 'car', x: state.x, z: state.z, rotY: state.rotY,
      width: size.width, depth: size.depth, driving
    }),
    dispose() {
      const list = scene.userData && scene.userData.interactables;
      if (list) {
        const i = list.indexOf(entry);
        if (i >= 0) list.splice(i, 1);
      }
      if (driving) exit({ place: false });
      delete car.userData.getPrompt;
      delete car.userData.interact;
      delete car.getPoint;
      if (scene.userData && scene.userData.car === api) delete scene.userData.car;
    }
  };
  if (scene.userData) scene.userData.car = api;
  return api;
}
