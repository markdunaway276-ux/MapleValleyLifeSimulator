import * as THREE from 'three';
import { Parts } from './buildings.js';
import { PLAYER_RADIUS } from '../systems/collision.js';
import { INTERIOR } from './palette.js';
import { createVertexMaterial } from './surfaces.js';

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
 *   front room  x -4.27..1.36, z -9.00..-6.04 : sofa, table + 2 chairs, rug, small desk
 *   bedroom     x -4.27..-0.60, z -14.63..-9.00 : bed, nightstand (doorway 1.3 m wide)
 *   bathroom    x -1.93..-0.68, z -14.63..-12.68 : in the bedroom's back-east corner;
 *                shower, toilet, sink (doorway 0.85 m wide, facing the bedroom door)
 *   kitchen     x -0.52..4.33, z -14.63..-9.00 : counter, fridge, table + 2 chairs
 */

// Expand the main house horizontally (1.24x wider & deeper) so the living room,
// bedroom, and kitchen feel open and comfortable to walk around.
export const HOUSE_SCALE_XZ = 1.24;
export const HOUSE_CENTER_Z = -11.0;
const sx = (x) => x * HOUSE_SCALE_XZ;
const sz = (z) => HOUSE_CENTER_Z + (z + 10) * HOUSE_SCALE_XZ;

// Inner wall planes, measured from house_type02.glb and scaled by HOUSE_SCALE_XZ.
export const KENNEY_INNER = {
  west: sx(-4.2667),
  east: sx(4.3259),
  front: sz(-6.0366),
  back: sz(-14.6292),
  frontRoomEast: sx(1.3630),
  notchWall: sz(-8.9996) // the wall between the kitchen and the side porch
};
export const FLOOR_Y = 0.02;
export const CEILING_Y = 3.0;
/** Extra collider clearance on each side of the front doorway. */
export const DOORWAY_PAD = 0.1;
export const INTERIOR_SPAWN = { x: 0.03, z: -7.25, yaw: 0 };

/** Centre of the west-bedroom bed (matches the furniture boxes below). */
export const BED_CENTER = { x: -4.25, y: 0, z: -15.55 };
export const BED_SIZE = { width: 1.5, height: 0.7, depth: 2.0 };
/** Interact point on the east (room) side of the mattress. */
export const BED_INTERACT = { x: -3.35, y: 0.6, z: -15.55 };

/**
 * Home-office desk against the front room's east wall, south of the TV
 * and clear of the front door and kitchen opening.
 * Size is width (x / depth from the wall) × height × depth (z / along the wall).
 */
export const DESK_CENTER = { x: KENNEY_INNER.frontRoomEast - 0.21, y: 0, z: -9.25 };
export const DESK_SIZE = { width: 0.42, height: 0.74, depth: 0.62 };
/** Interact point on the west (room) side of the desk. */
export const DESK_INTERACT = { x: KENNEY_INNER.frontRoomEast - 0.85, y: 0.75, z: -9.25 };

/**
 * East-kitchen cook station on the back-wall counter. The visible counter
 * stays in the merged interior mesh; this is the interactable's pose.
 */
export const COOK_CENTER = { x: 3.75, y: 0, z: -16.40 };
export const COOK_SIZE = { width: 0.9, height: 0.88, depth: 0.66 };
/** Interact point on the north (room) side of the cook station. */
export const COOK_INTERACT = { x: 3.75, y: 0.92, z: -15.65 };

/**
 * Wall switch just inside the front door, on the right as you enter (west
 * jamb). The plate sits proud of the inward face of the front wall.
 */
export const SWITCH_HEIGHT = 1.15;
export const SWITCH_OFFSET = 0.16;
export const SWITCH_PROUD = 0.04;

export function lightSwitchPose(doorway, frontZ = KENNEY_INNER.front) {
  const doorX = doorway && typeof doorway === 'object'
    ? (doorway.minX != null && doorway.maxX != null
      ? (doorway.minX + doorway.maxX) / 2
      : doorway.x)
    : doorway;
  const front = (doorway && typeof doorway === 'object' && doorway.z != null) ? doorway.z : frontZ;
  const gapL = (doorway && typeof doorway === 'object' && doorway.minX != null)
    ? doorway.minX
    : (Number(doorX) - 0.64);
  return {
    x: gapL - SWITCH_OFFSET,
    y: SWITCH_HEIGHT,
    z: front - SWITCH_PROUD
  };
}

/** Front-room sofa against the west wall, facing into the open living room (+x). */
export const SOFA_CENTER = { x: KENNEY_INNER.west + 0.45, y: 0, z: -7.80 };
export const SOFA_SIZE = { width: 0.9, height: 0.88, depth: 1.7 };
/** Interact point on the east (room) side of the sofa. */
export const SOFA_INTERACT = { x: KENNEY_INNER.west + 0.9 + 0.35, y: 0.7, z: -7.80 };
export const SOFA_SEAT = { x: KENNEY_INNER.west + 0.55, y: 1.1, z: -7.80, yaw: -Math.PI / 2 };
export const SOFA_STAND = { x: KENNEY_INNER.west + 0.9 + 0.45, z: -7.80 };

/**
 * TV on a stand against the front-room east wall, facing the sofa (-x) across
 * the open living room, north of the home-office desk.
 */
export const TV_CENTER = { x: KENNEY_INNER.frontRoomEast - 0.15, y: 0, z: -7.80 };
export const TV_SIZE = { width: 0.7, height: 0.92, depth: 0.26 };
export const TV_INTERACT = { x: KENNEY_INNER.frontRoomEast - 0.15 - 0.42, y: 0.82, z: -7.80 };
export const TV_COLLIDER = {
  minX: KENNEY_INNER.frontRoomEast - 0.26,
  maxX: KENNEY_INNER.frontRoomEast - 0.01,
  minZ: -7.80 - 0.38,
  maxZ: -7.80 + 0.38
};
/** World yaw so the screen (built on local +z) faces the sofa (-x). */
export const TV_YAW = -Math.PI / 2;

/**
 * Chairs: a cozy corner reading chair (chair1) and desk chair (chair2) in the
 * living room (clear of the sofa), plus dining chairs at the kitchen table (chair3, chair4).
 */
export const CHAIR_SIZE = { width: 0.42, height: 0.7, depth: 0.42 };
export const CHAIR_DEFS = [
  { id: 'chair1', x: -3.45, z: -9.25, facing: '+z' },
  { id: 'chair2', x: 0.85, z: -9.25, facing: '+x' },
  { id: 'chair3', x: 2.25, z: -13.85, facing: '+z' },
  { id: 'chair4', x: 2.25, z: -12.15, facing: '-z' }
];

// Colours live in palette.js (INTERIOR): deeper plaster, walnut floor, teal fabric.
const WALL = INTERIOR.wall;
const WALL_SHADE = INTERIOR.wallShade;
const FLOOR = INTERIOR.floor;
const CEIL = INTERIOR.ceil;
const TRIM = INTERIOR.trim;
const WOOD = INTERIOR.wood;
const WOOD_DARK = INTERIOR.woodDark;
const FABRIC = INTERIOR.fabric;
const BED_LINEN = INTERIOR.bedLinen;
const BLANKET = INTERIOR.blanket;
const RUG = INTERIOR.rug;
const COUNTER = INTERIOR.counter;
const COUNTER_TOP = INTERIOR.counterTop;
const FRIDGE = INTERIOR.fridge;
const GLASS = INTERIOR.glass;
const LAMP = INTERIOR.lamp;
const DOOR_BROWN = INTERIOR.door;

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

/**
 * Desktop gets PBR with per-vertex roughness (glossier floor and appliances,
 * matte plaster and fabric). Mobile keeps the cheap Lambert it always had.
 */
function interiorMaterial(desktop) {
  if (!desktop) return new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a251d });
  return createVertexMaterial({ metalness: 0, emissive: 0x2a251d });
}

// ---------------------------------------------------------------- furniture

function table(parts, cx, cz, w, d, h = 0.75) {
  parts.surface('wood');
  parts.box(WOOD, w, 0.06, d, cx, h - 0.03, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.box(WOOD_DARK, 0.07, h - 0.06, 0.07, cx + sx * (w / 2 - 0.07), (h - 0.06) / 2, cz + sz * (d / 2 - 0.07));
    }
  }
}

/** Chair facing `dir` ('+z' | '-z' | '+x' | '-x'): seat, legs and a back on the far side. */
function chair(parts, cx, cz, dir) {
  parts.surface('wood');
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
  parts.surface('wood');
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
export function buildMainHouseInterior({ shadows = false, outer, doorX, doorZ, door, doorWidth = 1.04 * HOUSE_SCALE_XZ } = {}) {
  const K = KENNEY_INNER;
  const fy = FLOOR_Y;
  const cy = CEILING_Y;
  const halfDoor = doorWidth / 2;
  const gapL = doorX - halfDoor;
  const gapR = doorX + halfDoor;
  const parts = new Parts(true);
  // Unlit parts (window glass, lamps, ceiling) keep their flat colour: no baked AO.
  const emissive = new Parts(true, { ao: false });
  const lampParts = new Parts(true, { ao: false });
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
    parts.surface('wood');
    plane(parts, FLOOR, '+y', w, d, (r.x0 + r.x1) / 2, fy, (r.z0 + r.z1) / 2);
    plane(lampParts, CEIL, '-y', w, d, (r.x0 + r.x1) / 2, cy, (r.z0 + r.z1) / 2); // lit with the interior lamps
  }
  parts.surface('plaster');

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
  parts.surface('trim');
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
    parts.surface('trim');
    plane(parts, TRIM, f, w + 0.16, h + 0.16, ...fr);
    plane(emissive, GLASS, f, w, h, ...gl);
    // mullions
    const mp = pos(glassOff + 0.004);
    plane(parts, TRIM, f, isZ ? 0.04 : 0.04, h, ...mp);
  };
  // for z-facing walls: a = [z, x0]; for x-facing walls: a = [x, z0]
  pane('-z', [K.front, sx(-3.6741)], sx(-2.1859), 1.1111, 1.8519); // front-left window
  pane('+x', [K.west, sz(-11.0737)], sz(-9.5922), 1.1111, 1.8519); // west window (bedroom)
  pane('+z', [K.back, sx(-3.6741)], sx(-2.1859), 1.1111, 1.8519); // back window (bedroom)
  pane('+z', [K.back, sx(2.25)], sx(3.7333), 1.1111, 1.8519); // back window (kitchen)

  // decorative doors: back door and the double door to the side porch
  const decoDoor = (facing, a, b, w0, w1) => {
    const isZ = facing[1] === 'z';
    const sign = facing[0] === '+' ? 1 : -1;
    const mid = (w0 + w1) / 2;
    const p = isZ ? [mid, 1.0 + fy / 2, a + sign * 0.008] : [a + sign * 0.008, 1.0 + fy / 2, mid];
    parts.surface('wood');
    plane(parts, DOOR_BROWN, facing, w1 - w0, 2.0 - fy, ...p);
  };
  decoDoor('+z', K.back, 0, doorX - halfDoor, doorX + halfDoor); // back door
  decoDoor('-z', K.notchWall, 0, sx(2.0296), sx(3.9556)); // side double door
  {
    const p = [(sx(2.3259) + sx(3.5852)) / 2, (1.3333 + 1.6296) / 2, K.notchWall - 0.014];
    plane(emissive, GLASS, '-z', sx(3.5852) - sx(2.3259), 1.6296 - 1.3333, ...p);
  }

  // --- partitions (thin boxes, solid colliders) -------------------------
  parts.surface('plaster');
  const T = 0.15;
  // P1: south wall of the front room's west half; leaves a wide 1.7 m doorway into the bedroom
  const p1End = -2.35;
  parts.box(WALL, p1End - K.west, cy - fy, T, (K.west + p1End) / 2, (cy + fy) / 2 - 0.01, K.notchWall);
  solid('main-int-p1', K.west, p1End, K.notchWall - T / 2, K.notchWall + T / 2);
  // P2: east wall of the bedroom
  const p2x = -0.65;
  parts.box(WALL, T, cy - fy, K.notchWall - K.back, p2x, (cy + fy) / 2 - 0.01, (K.notchWall + K.back) / 2);
  solid('main-int-p2', p2x - T / 2, p2x + T / 2, K.back, K.notchWall);

  // --- front room: open living room with sofa, low coffee table, rug, corner & desk chairs ---
  parts.surface('fabric');
  plane(parts, RUG, '+y', 3.1, 2.2, -2.95, fy + 0.006, -7.80);
  // plush sofa against the west wall, facing east toward the TV with clear open floor
  const sofaX = K.west + 0.45;
  parts.box(FABRIC, 0.9, 0.42, 1.7, sofaX, 0.21 + fy, -7.80);
  parts.box(FABRIC, 0.22, 0.5, 1.7, K.west + 0.11, 0.67 + fy, -7.80);
  parts.box(INTERIOR.fabricDark, 0.18, 0.3, 1.7, sofaX, 0.57 + fy, -7.80);
  parts.box(FABRIC, 0.7, 0.2, 0.2, sofaX, 0.52 + fy, -8.55); // arms
  parts.box(FABRIC, 0.7, 0.2, 0.2, sofaX, 0.52 + fy, -7.05);
  solid('main-int-sofa', K.west, K.west + 0.9, -8.65, -6.95);
  // compact low coffee table in front of the sofa (generous legroom & wide walkway to door/TV)
  table(parts, -3.45, -7.80, 0.55, 1.15, 0.42);
  solid('main-int-table1', -3.73, -3.17, -8.38, -7.22);
  // reading chair tucked near the back-west living room corner, clear of the sofa
  chair(parts, -3.45, -9.25, '+z');
  solid('main-int-chair1', -3.66, -3.24, -9.46, -9.04);
  // desk chair pulled up to the home-office desk
  chair(parts, 0.85, -9.25, '+x');
  solid('main-int-chair2', 0.64, 1.06, -9.46, -9.04);
  frame(parts, '-x', K.frontRoomEast, 1.7, -7.80, 0.75, 0.52, INTERIOR.frames[0]);
  // home-office desk + laptop against the east wall (south of the TV)
  {
    const cx = DESK_CENTER.x, cz = DESK_CENTER.z;
    const w = DESK_SIZE.width, d = DESK_SIZE.depth, h = DESK_SIZE.height;
    parts.surface('wood');
    parts.box(WOOD, w, 0.05, d, cx, h - 0.025 + fy, cz);
    for (const sxSign of [-1, 1]) {
      for (const szSign of [-1, 1]) {
        parts.box(WOOD_DARK, 0.055, h - 0.05, 0.055, cx + sxSign * (w / 2 - 0.06), (h - 0.05) / 2 + fy, cz + szSign * (d / 2 - 0.06));
      }
    }
    // laptop (base + a short upright lid facing the room)
    parts.surface('appliance');
    parts.box(INTERIOR.laptop, 0.24, 0.02, 0.18, cx - 0.02, h + 0.01 + fy, cz);
    parts.box(INTERIOR.laptopLid, 0.02, 0.16, 0.18, cx + 0.11, h + 0.09 + fy, cz);
    parts.box(INTERIOR.laptopScreen, 0.01, 0.13, 0.15, cx + 0.095, h + 0.09 + fy, cz);
    solid('main-int-desk', cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
  }

  // --- bedroom ---------------------------------------------------------
  parts.surface('wood');
  parts.box(WOOD_DARK, 1.5, 0.3, 2.0, -4.25, 0.15 + fy, -15.55); // frame
  parts.surface('fabric');
  parts.box(BED_LINEN, 1.4, 0.2, 1.9, -4.25, 0.4 + fy, -15.55); // mattress
  parts.box(BLANKET, 1.42, 0.08, 1.2, -4.25, 0.54 + fy, -15.15); // blanket
  parts.box(INTERIOR.pillow, 0.5, 0.1, 0.32, -4.55, 0.55 + fy, -16.30); // pillows
  parts.box(INTERIOR.pillow, 0.5, 0.1, 0.32, -3.95, 0.55 + fy, -16.30);
  parts.surface('wood');
  parts.box(WOOD_DARK, 1.5, 0.85, 0.08, -4.25, 0.6 + fy, -16.65); // headboard
  solid('main-int-bed', -5.00, -3.50, -16.55, -14.55);
  parts.box(WOOD, 0.45, 0.5, 0.45, -3.05, 0.25 + fy, -16.45);
  solid('main-int-nightstand', -3.275, -2.825, -16.675, -16.225);
  parts.surface('fabric');
  plane(parts, INTERIOR.rug2, '+y', 1.9, 1.2, -3.8, fy + 0.006, -13.0);
  frame(parts, '+x', K.west, 1.7, -14.0, 0.65, 0.48, INTERIOR.frames[1]);

  // --- bathroom (back-east corner of the bedroom) ------------------------
  const bathWest = -2.35;         // wall centre; clear of the nightstand
  const bathEast = p2x;           // reuses P2 as the bathroom's east wall
  const bathBack = K.back;
  const bathFront = -14.45;       // wall centre; roomy 2.29 m deep bathroom
  const bathDoorL = -1.85;
  const bathDoorR = -0.85;        // 1.0 m opening
  const bathDoorTop = 2.1 + fy;

  parts.surface('plaster');
  parts.box(WALL, T, cy - fy, bathFront + T / 2 - bathBack, bathWest, (cy + fy) / 2 - 0.01, (bathBack + bathFront + T / 2) / 2);
  solid('main-int-bath-west', bathWest - T / 2, bathWest + T / 2, bathBack, bathFront + T / 2);
  parts.box(WALL, bathDoorL - (bathWest + T / 2), cy - fy, T, (bathWest + T / 2 + bathDoorL) / 2, (cy + fy) / 2 - 0.01, bathFront);
  parts.box(WALL, (bathEast - T / 2) - bathDoorR, cy - fy, T, (bathDoorR + bathEast - T / 2) / 2, (cy + fy) / 2 - 0.01, bathFront);
  parts.box(WALL, bathDoorR - bathDoorL, cy - bathDoorTop, T, (bathDoorL + bathDoorR) / 2, (cy + bathDoorTop) / 2 - 0.01, bathFront);
  solid('main-int-bath-front-left', bathWest - T / 2, bathDoorL, bathFront - T / 2, bathFront + T / 2);
  solid('main-int-bath-front-right', bathDoorR, bathEast, bathFront - T / 2, bathFront + T / 2);

  const inW = bathWest + T / 2;

  // shower in the back-east corner (0.85 x 0.85 m), glass on two sides
  parts.surface('appliance');
  parts.box(0xd0d8e0, 0.85, 0.06, 0.85, -1.15, 0.03 + fy, -16.30);
  parts.surface('glass');
  parts.box(0xa0c0d0, 0.04, 1.8, 0.85, -1.555, 0.96 + fy, -16.30);
  parts.box(0xa0c0d0, 0.42, 1.8, 0.04, -1.34, 0.96 + fy, -15.89);
  parts.surface('metal');
  parts.box(0xc0c0c0, 0.08, 0.15, 0.12, -1.15, 1.9 + fy, -16.65);
  solid('main-int-shower', -1.575, bathEast - T / 2, bathBack, -15.87);

  // toilet in the back-west corner, facing the doorway
  parts.surface('appliance');
  parts.box(0xe8e8e8, 0.38, 0.42, 0.55, -2.02, 0.21 + fy, -16.40);
  parts.box(0xf5f5f5, 0.34, 0.08, 0.42, -2.02, 0.46 + fy, -16.34);
  parts.box(0xe8e8e8, 0.38, 0.35, 0.16, -2.02, 0.6 + fy, -16.60);
  solid('main-int-toilet', -2.21, -1.83, bathBack, -16.12);

  // sink against the west wall, between the toilet and the doorway
  parts.surface('paint');
  parts.box(0xd0d0d0, 0.4, 0.8, 0.55, inW + 0.2, 0.4 + fy, -15.25);
  parts.surface('stone');
  parts.box(0xe0e0e0, 0.36, 0.06, 0.5, inW + 0.22, 0.82 + fy, -15.25);
  solid('main-int-sink', inW, inW + 0.4, -15.525, -14.975);

  // --- kitchen --------------------------------------------------------
  parts.surface('paint');
  parts.box(COUNTER, 3.2, 0.88, 0.66, 3.70, 0.44 + fy, -16.40);
  parts.surface('stone');
  parts.box(COUNTER_TOP, 3.2, 0.05, 0.68, 3.70, 0.905 + fy, -16.39);
  solid('main-int-counter', 2.10, K.east, K.back, -16.04);
  parts.surface('appliance');
  parts.box(FRIDGE, 0.72, 1.82, 0.72, 4.98, 0.91 + fy, -10.18);
  parts.surface('metal');
  parts.box(INTERIOR.handle, 0.04, 0.5, 0.04, 4.98 - 0.12, 1.36 + fy, -10.18 - 0.38);
  solid('main-int-fridge', 4.62, 5.34, -10.54, -9.82);
  table(parts, 2.25, -13.0, 1.4, 0.85);
  solid('main-int-table2', 1.55, 2.95, -13.425, -12.575);
  chair(parts, 2.25, -13.85, '+z');
  solid('main-int-chair3', 2.04, 2.46, -14.06, -13.64);
  chair(parts, 2.25, -12.15, '-z');
  solid('main-int-chair4', 2.04, 2.46, -12.36, -11.94);
  frame(parts, '-x', K.east, 1.7, -13.2, 0.65, 0.48, INTERIOR.frames[2]);

  // --- lamps (toggled with the wall switch; not in the 2-draw-call group) --
  const lampSpots = [[-1.8, -7.85], [-3.0, -13.2], [2.25, -13.0]];
  for (const [lx, lz] of lampSpots) {
    lampParts.box(LAMP, 0.45, 0.06, 0.45, lx, cy - 0.04, lz);
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
  const mesh = new THREE.Mesh(parts.merge(), interiorMaterial(!!shadows));
  mesh.name = 'interior-static';
  mesh.castShadow = false; // the ceiling casts the shadow via the GLB; keeps the shadow pass cheap
  mesh.receiveShadow = !!shadows;
  group.add(mesh);
  const glow = new THREE.Mesh(emissive.merge(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  glow.name = 'interior-glow';
  group.add(glow);

  // Ceiling + fixture glow live outside the interior group so that group stays
  // at 2 draw calls. daynight.js dims this mesh when the wall switch is off.
  const lamps = new THREE.Mesh(lampParts.merge(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  lamps.name = 'interior-lamps';
  lamps.castShadow = false;
  lamps.receiveShadow = false;

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
    lamps,
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
      const inDoorway = Math.abs(cx - x) < 0.72 && maxY < 2.1;
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
