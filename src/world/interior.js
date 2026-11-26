import * as THREE from 'three';
import { Parts } from './buildings.js';
import { PLAYER_RADIUS } from '../systems/collision.js';

/**
 * Basic interior for the Kenney main house.
 *
 * The GLB is a single-sided shell: its walls are outward-facing quads with the
 * windows / doors recessed ~0.148 m behind the outer wall face, and there are
 * no inner faces. So the interior is a set of INWARD-facing planes placed on
 * those recess planes. Back-face culling hides them from outside, which keeps
 * the exterior exactly as it was; from inside they are the walls.
 *
 * Everything static is merged into one vertex-coloured mesh (+ one emissive
 * mesh for the lamps and window glass), and the colliders replace the old
 * single house box with wall slabs, a doorway gap and a gate that blocks the
 * doorway only while the front door is closed.
 *
 * Layout (world metres, z decreases away from the street):
 *   front room  x -4.27..1.36, z -9.00..-6.04 : sofa, table + 2 chairs, rug
 *   bedroom     x -4.27..-0.60, z -14.63..-9.00 : bed, nightstand (doorway 1.3 m wide)
 *   kitchen     x -0.52..4.33, z -14.63..-9.00 : counter, fridge, table + 2 chairs
 */

// Inner wall planes, measured from house_type02.glb after the 7.407x scale.
export const KENNEY_INNER = {
  west: -4.2667,
  east: 4.3259,
  front: -6.0366,
  back: -14.6292,
  frontRoomEast: 1.3630,
  notchWall: -8.9996 // the wall between the kitchen and the side porch
};
export const FLOOR_Y = 0.02;
export const CEILING_Y = 3.0;
/** Extra collider clearance on each side of the 1.04 m painted doorway. */
export const DOORWAY_PAD = 0.1;
export const INTERIOR_SPAWN = { x: 0.03, z: -7.1, yaw: 0 };

const WALL = 0xe9dfc9;
const WALL_SHADE = 0xded2b8;
const FLOOR = 0x9a7048;
const CEIL = 0xd9d2c4;
const TRIM = 0xcdbf9f;
const WOOD = 0x8a5a2b;
const WOOD_DARK = 0x5f3d1e;
const FABRIC = 0x4f6d7a;
const BED_LINEN = 0xe8e4da;
const BLANKET = 0x8a3b3b;
const RUG = 0x9c4a3a;
const COUNTER = 0xd8d4cc;
const COUNTER_TOP = 0x4a4a4a;
const FRIDGE = 0xcfd3d6;
const GLASS = 0xcfe8f5;
const LAMP = 0xfff0c8;
const DOOR_BROWN = 0x654321;

let planeGeo = null;
function getPlane() {
  if (!planeGeo) planeGeo = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  return planeGeo;
}

const FACING = {
  '+z': [0, 0, 0],
  '-z': [0, Math.PI, 0],
  '+x': [0, Math.PI / 2, 0],
  '-x': [0, -Math.PI / 2, 0],
  '+y': [-Math.PI / 2, 0, 0],
  '-y': [Math.PI / 2, 0, 0]
};
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Single-sided w x h quad centred at (x, y, z) whose visible side faces `facing`. */
function plane(parts, color, facing, w, h, x, y, z) {
  const [rx, ry, rz] = FACING[facing];
  _q.setFromEuler(_e.set(rx, ry, rz));
  const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(w, h, 1));
  parts.addGeometry(getPlane(), color, m);
}

/** Inward-facing wall rectangle between two points on the ground plan. */
function wallRect(parts, color, facing, a, b, y0, y1) {
  const h = y1 - y0;
  if (h <= 1e-6) return;
  if (facing === '-z' || facing === '+z') {
    const w = Math.abs(b - a[0]);
    if (w < 1e-6) return;
    plane(parts, color, facing, w, h, (a[0] + b) / 2, (y0 + y1) / 2, a[1]);
  } else {
    const w = Math.abs(b - a[1]);
    if (w < 1e-6) return;
    plane(parts, color, facing, w, h, a[0], (y0 + y1) / 2, (a[1] + b) / 2);
  }
}

// ---------------------------------------------------------------- furniture

function table(parts, cx, cz, w, d, h = 0.75) {
  parts.box(WOOD, w, 0.06, d, cx, h - 0.03, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.box(WOOD_DARK, 0.07, h - 0.06, 0.07, cx + sx * (w / 2 - 0.07), (h - 0.06) / 2, cz + sz * (d / 2 - 0.07));
    }
  }
}

/** Chair facing `dir` ('+z' | '-z' | '+x' | '-x'): seat, legs and a back on the far side. */
function chair(parts, cx, cz, dir) {
  const s = 0.42;
  parts.box(WOOD, s, 0.05, s, cx, 0.45, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.box(WOOD_DARK, 0.05, 0.43, 0.05, cx + sx * (s / 2 - 0.04), 0.215, cz + sz * (s / 2 - 0.04));
    }
  }
  const o = s / 2 - 0.025;
  if (dir === '+z') parts.box(WOOD, s, 0.5, 0.05, cx, 0.72, cz - o);
  else if (dir === '-z') parts.box(WOOD, s, 0.5, 0.05, cx, 0.72, cz + o);
  else if (dir === '+x') parts.box(WOOD, 0.05, 0.5, s, cx - o, 0.72, cz);
  else parts.box(WOOD, 0.05, 0.5, s, cx + o, 0.72, cz);
}

function frame(parts, facing, x, y, z, w, h, color) {
  // thin picture on a wall; `facing` is the room-side direction
  const d = 0.03;
  if (facing === '+x' || facing === '-x') {
    const sx = facing === '+x' ? 1 : -1;
    parts.box(WOOD_DARK, d, h, w, x + sx * d / 2, y, z);
    parts.box(color, d + 0.01, h - 0.1, w - 0.1, x + sx * d / 2, y, z);
  } else {
    const sz = facing === '+z' ? 1 : -1;
    parts.box(WOOD_DARK, w, h, d, x, y, z + sz * d / 2);
    parts.box(color, w - 0.1, h - 0.1, d + 0.01, x, y, z + sz * d / 2);
  }
}

/**
 * Build the interior. `outer` is the Kenney world Box3-ish { minX, maxX, minZ, maxZ }
 * (old house collider outline, used for the outer faces of the wall colliders),
 * `doorX` the doorway centre and `doorZ` the front door slab plane.
 */
export function buildMainHouseInterior({ shadows = false, outer, doorX, doorZ, door } = {}) {
  const K = KENNEY_INNER;
  const fy = FLOOR_Y;
  const cy = CEILING_Y;
  const gapL = doorX - 0.52;
  const gapR = doorX + 0.52;
  const parts = new Parts(true);
  const emissive = new Parts(true);
  const colliders = [];
  const solid = (id, minX, maxX, minZ, maxZ) => colliders.push({ id, minX, maxX, minZ, maxZ });

  // --- floors and ceilings (front room + rear block) --------------------
  const rooms = [
    { x0: K.west, x1: K.frontRoomEast, z0: K.notchWall, z1: K.front },
    { x0: K.west, x1: K.east, z0: K.back, z1: K.notchWall }
  ];
  for (const r of rooms) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    plane(parts, FLOOR, '+y', w, d, (r.x0 + r.x1) / 2, fy, (r.z0 + r.z1) / 2);
    plane(emissive, CEIL, '-y', w, d, (r.x0 + r.x1) / 2, cy, (r.z0 + r.z1) / 2); // flat-lit ceiling
  }

  // --- inward-facing outer walls ----------------------------------------
  // front wall (faces -z) with the doorway cut out
  wallRect(parts, WALL, '-z', [K.west, K.front], gapL, fy, cy);
  wallRect(parts, WALL, '-z', [gapR, K.front], K.frontRoomEast, fy, cy);
  wallRect(parts, WALL, '-z', [gapL, K.front], gapR, 2.0, cy); // lintel
  wallRect(parts, WALL_SHADE, '-x', [K.frontRoomEast, K.notchWall], K.front, fy, cy); // front-room east wall
  wallRect(parts, WALL, '-z', [K.frontRoomEast, K.notchWall], K.east, fy, cy); // kitchen front wall
  wallRect(parts, WALL_SHADE, '-x', [K.east, K.back], K.notchWall, fy, cy); // east wall
  wallRect(parts, WALL, '+z', [K.west, K.back], K.east, fy, cy); // back wall
  wallRect(parts, WALL_SHADE, '+x', [K.west, K.back], K.front, fy, cy); // west wall

  // baseboard strip along the longest runs (plain boxes, cheap)
  parts.box(TRIM, K.east - K.west - 0.02, 0.12, 0.03, (K.west + K.east) / 2, fy + 0.06, K.back + 0.017);

  // --- window panes on the inner walls (ground-floor window holes) ---------
  const pane = (facing, a, b, y0, y1) => {
    const off = 0.006;
    const glassOff = off + 0.004;
    const f = facing;
    const sign = f[0] === '+' ? 1 : -1;
    const isZ = f[1] === 'z';
    const mid = (a[1] + b) / 2;
    const w = Math.abs(b - a[1]);
    const h = y1 - y0;
    const pos = (inset) => (isZ ? [mid, (y0 + y1) / 2, a[0] + sign * inset] : [a[0] + sign * inset, (y0 + y1) / 2, mid]);
    const fr = pos(off);
    const gl = pos(glassOff);
    plane(parts, TRIM, f, w + 0.16, h + 0.16, ...fr);
    plane(emissive, GLASS, f, w, h, ...gl);
    // mullions
    const mp = pos(glassOff + 0.004);
    plane(parts, TRIM, f, isZ ? 0.04 : 0.04, h, ...mp);
  };
  // for z-facing walls: a = [z, x0]; for x-facing walls: a = [x, z0]
  pane('-z', [K.front, -3.6741], -2.1859, 1.1111, 1.8519); // front-left window
  pane('+x', [K.west, -11.0737], -9.5922, 1.1111, 1.8519); // west window (bedroom)
  pane('+z', [K.back, -3.6741], -2.1859, 1.1111, 1.8519); // back window (bedroom)
  pane('+z', [K.back, 2.25], 3.7333, 1.1111, 1.8519); // back window (kitchen)

  // decorative doors: back door and the double door to the side porch
  const decoDoor = (facing, a, b, w0, w1) => {
    const isZ = facing[1] === 'z';
    const sign = facing[0] === '+' ? 1 : -1;
    const mid = (w0 + w1) / 2;
    const p = isZ ? [mid, 1.0 + fy / 2, a + sign * 0.008] : [a + sign * 0.008, 1.0 + fy / 2, mid];
    plane(parts, DOOR_BROWN, facing, w1 - w0, 2.0 - fy, ...p);
  };
  decoDoor('+z', K.back, 0, doorX - 0.52, doorX + 0.52); // back door
  decoDoor('-z', K.notchWall, 0, 2.0296, 3.9556); // side double door
  {
    const p = [(2.3259 + 3.5852) / 2, (1.3333 + 1.6296) / 2, K.notchWall - 0.014];
    plane(emissive, GLASS, '-z', 3.5852 - 2.3259, 1.6296 - 1.3333, ...p);
  }

  // --- partitions (thin boxes, solid colliders) -------------------------
  const T = 0.15;
  // P1: south wall of the front room's west half; the bedroom doorway is the gap to P2
  parts.box(WALL, -2.0 - K.west, cy - fy, T, (K.west + -2.0) / 2, (cy + fy) / 2 - 0.01, K.notchWall);
  solid('main-int-p1', K.west, -2.0, K.notchWall - T / 2, K.notchWall + T / 2);
  // P2: east wall of the bedroom
  const p2x = -0.6;
  parts.box(WALL, T, cy - fy, K.notchWall - K.back, p2x, (cy + fy) / 2 - 0.01, (K.notchWall + K.back) / 2);
  solid('main-int-p2', p2x - T / 2, p2x + T / 2, K.back, K.notchWall);

  // --- front room: sofa, table + chairs, rug -------------------------------
  plane(parts, RUG, '+y', 2.6, 1.8, 0.0, fy + 0.006, -7.45);
  // sofa against the west wall
  const sofaX = K.west + 0.45;
  parts.box(FABRIC, 0.9, 0.42, 1.5, sofaX, 0.21 + fy, -7.65);
  parts.box(FABRIC, 0.22, 0.5, 1.5, K.west + 0.11, 0.67 + fy, -7.65);
  parts.box(0x3f5963, 0.18, 0.3, 1.5, sofaX, 0.57 + fy, -7.65);
  parts.box(FABRIC, 0.7, 0.2, 0.2, sofaX, 0.52 + fy, -8.3); // arms
  parts.box(FABRIC, 0.7, 0.2, 0.2, sofaX, 0.52 + fy, -7.0);
  solid('main-int-sofa', K.west, K.west + 0.9, -8.4, -6.9);
  table(parts, -1.55, -7.7, 0.8, 1.3);
  solid('main-int-table1', -1.95, -1.15, -8.35, -7.05);
  chair(parts, -2.3, -7.7, '+x');
  solid('main-int-chair1', -2.51, -2.09, -7.91, -7.49);
  chair(parts, -0.8, -7.7, '-x');
  solid('main-int-chair2', -1.01, -0.59, -7.91, -7.49);
  frame(parts, '-x', K.frontRoomEast, 1.7, -7.7, 0.7, 0.5, 0x6d8f6a);

  // --- bedroom ---------------------------------------------------------
  parts.box(WOOD_DARK, 1.5, 0.3, 2.0, -3.4, 0.15 + fy, -13.55); // frame
  parts.box(BED_LINEN, 1.4, 0.2, 1.9, -3.4, 0.4 + fy, -13.55); // mattress
  parts.box(BLANKET, 1.42, 0.08, 1.2, -3.4, 0.54 + fy, -13.15); // blanket
  parts.box(0xf4f0e8, 0.5, 0.1, 0.32, -3.7, 0.55 + fy, -14.3); // pillows
  parts.box(0xf4f0e8, 0.5, 0.1, 0.32, -3.1, 0.55 + fy, -14.3);
  parts.box(WOOD_DARK, 1.5, 0.85, 0.08, -3.4, 0.6 + fy, -14.6); // headboard
  solid('main-int-bed', -4.15, -2.65, -14.55, -12.55);
  parts.box(WOOD, 0.45, 0.5, 0.45, -2.3, 0.25 + fy, -14.35);
  solid('main-int-nightstand', -2.525, -2.075, -14.575, -14.125);
  plane(parts, 0x6a7d9a, '+y', 1.6, 1.0, -3.2, fy + 0.006, -11.4);
  frame(parts, '+x', K.west, 1.7, -12.4, 0.6, 0.45, 0xb08a5a);

  // --- kitchen --------------------------------------------------------
  parts.box(COUNTER, 2.7, 0.88, 0.66, 2.97, 0.44 + fy, -14.29);
  parts.box(COUNTER_TOP, 2.7, 0.05, 0.68, 2.97, 0.905 + fy, -14.28);
  solid('main-int-counter', 1.62, 4.32, K.back, -13.93);
  parts.box(FRIDGE, 0.7, 1.8, 0.7, 3.95, 0.9 + fy, -9.38);
  parts.box(0x9aa0a4, 0.04, 0.5, 0.04, 3.95 - 0.12, 1.35 + fy, -9.0 - 0.38 - 0.02);
  solid('main-int-fridge', 3.6, 4.3, -9.73, -9.03);
  table(parts, 2.0, -11.3, 1.3, 0.8);
  solid('main-int-table2', 1.35, 2.65, -11.7, -10.9);
  chair(parts, 2.0, -12.15, '+z');
  solid('main-int-chair3', 1.79, 2.21, -12.36, -11.94);
  chair(parts, 2.0, -10.45, '-z');
  solid('main-int-chair4', 1.79, 2.21, -10.66, -10.24);
  frame(parts, '-x', K.east, 1.7, -11.5, 0.6, 0.45, 0xa9b87a);

  // --- lamps (emissive) --------------------------------------------------
  const lamps = [[-1.55, -7.7], [-2.4, -11.8], [2.0, -11.3]];
  for (const [lx, lz] of lamps) {
    emissive.box(LAMP, 0.42, 0.06, 0.42, lx, cy - 0.04, lz);
  }

  // --- wall colliders (replace the old single house box) ---------------------
  const o = outer;
  solid('main-house-back', o.minX, o.maxX, o.minZ, K.back);
  solid('main-house-west', o.minX, K.west, K.back, o.maxZ);
  solid('main-house-east', K.east, o.maxX, K.back, K.notchWall);
  solid('main-house-notch', K.frontRoomEast, o.maxX, K.notchWall, o.maxZ);
  solid('main-house-front-left', K.west, gapL - DOORWAY_PAD, K.front, o.maxZ);
  solid('main-house-front-right', gapR + DOORWAY_PAD, K.frontRoomEast, K.front, o.maxZ);
  const gate = { id: 'main-house-door', minX: gapL - DOORWAY_PAD, maxX: gapR + DOORWAY_PAD, minZ: K.front, maxZ: o.maxZ, gate: true };
  colliders.push(gate);

  // --- meshes -------------------------------------------------------------
  const group = new THREE.Group();
  group.name = 'main-interior';
  const mesh = new THREE.Mesh(parts.merge(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a251d }));
  mesh.name = 'interior-static';
  mesh.castShadow = false; // the ceiling casts the shadow via the GLB; keeps the shadow pass cheap
  mesh.receiveShadow = !!shadows;
  group.add(mesh);
  const glow = new THREE.Mesh(emissive.merge(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  glow.name = 'interior-glow';
  group.add(glow);

  if (shadows) {
    // One cheap point light on desktop only; mobile relies on the emissive lamps.
    const light = new THREE.PointLight(0xffe2b0, 14, 14, 1.6);
    light.name = 'interior-light';
    light.position.set(0.4, 2.6, -9.6);
    group.add(light);
  }

  // The front door pivot sits at the left jamb; the gate is enabled whenever the
  // door is closed, unless the player is standing in the doorway (so shutting
  // the door on yourself never traps you).
  const r = PLAYER_RADIUS;
  function gateDisabled(world) {
    if (door && door.userData && door.userData.open) return true;
    const p = world && world.lastPoint;
    if (!p) return false;
    const dx = p.x - Math.min(Math.max(p.x, gate.minX), gate.maxX);
    const dz = p.z - Math.min(Math.max(p.z, gate.minZ), gate.maxZ);
    return dx * dx + dz * dz < r * r;
  }

  return {
    group,
    colliders,
    gate,
    gateDisabled,
    spawn: { ...INTERIOR_SPAWN, y: 1.6 },
    bounds: { minX: K.west, maxX: K.east, minZ: K.back, maxZ: K.front },
    doorway: { minX: gapL, maxX: gapR, z: K.front }
  };
}

/**
 * Remove the GLB's painted front door (and its glass) so the hinged door is
 * the only door: with the door open you can see straight into the house.
 * Only triangles on the front-door plane within the doorway are dropped.
 */
export function removePaintedFrontDoor(model, { x, z }) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let removed = 0;
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.index) return;
    const name = o.material && o.material.name;
    if (name !== 'door' && name !== 'window') return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const keep = [];
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(o.matrixWorld);
      const inPlane = Math.abs(a.z - z) < 0.03 && Math.abs(b.z - z) < 0.03 && Math.abs(c.z - z) < 0.03;
      const cx = (a.x + b.x + c.x) / 3;
      const maxY = Math.max(a.y, b.y, c.y);
      const inDoorway = Math.abs(cx - x) < 0.6 && maxY < 2.1;
      if (inPlane && inDoorway) {
        removed++;
        continue;
      }
      keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    }
    if (keep.length !== idx.count) o.geometry.setIndex(keep);
  });
  return removed;
}
