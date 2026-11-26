import * as THREE from 'three';
import { createHingedDoor } from '../systems/doors.js';

const DEFAULTS = {
  width: 8,
  depth: 10,
  height: 3.6,
  roofType: 'gable',
  wallColor: 0xd2b48c,
  roofColor: 0x8b4513,
  doorColor: 0x654321,
  windowColor: 0x87ceeb,
  hasDoor: true,
  windowCount: 2
};

const WALL_PALETTE = [0xd2b48c, 0xf5e6d3, 0xe8d5b7, 0xc9a66b, 0xa8c5e0, 0xe0c8b0, 0xd4d0c8, 0xbfc5b8];
const ROOF_PALETTE = [0x8b4513, 0x7a2e2e, 0x4a5560, 0x5c4033, 0x6b3a2a, 0x3e4a3d];
const ROOF_TYPES = ['gable', 'pyramid', 'flat'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function resolveOptions(options = {}) {
  const random = !!options.random;
  const out = { ...DEFAULTS };

  if (random) {
    out.width = rand(6, 10);
    out.depth = rand(7, 12);
    out.height = rand(3.2, 4.5);
    out.roofType = pick(ROOF_TYPES);
    out.wallColor = pick(WALL_PALETTE);
    out.roofColor = pick(ROOF_PALETTE);
    out.doorColor = 0x5a3a22;
    out.windowColor = 0x9fd0ea;
  }

  // Explicit values always win over random / defaults
  for (const key of Object.keys(options)) {
    if (key === 'random') continue;
    if (options[key] !== undefined) out[key] = options[key];
  }

  if (!ROOF_TYPES.includes(out.roofType)) out.roofType = 'gable';
  out.windowCount = Math.max(0, Math.floor(Number(out.windowCount) || 0));
  out.roofHeight = out.roofHeight ?? Math.max(1.2, out.height * 0.55);

  // shadows: a single flag, or per-mesh cast/receive
  if (options.shadows !== undefined) {
    out.castShadow = !!options.shadows;
    out.receiveShadow = !!options.shadows;
  } else {
    out.castShadow = options.castShadow !== undefined ? !!options.castShadow : true;
    out.receiveShadow = options.receiveShadow !== undefined ? !!options.receiveShadow : true;
  }

  return out;
}

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extras });
}

function mesh(name, geometry, material, shadows) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = shadows.castShadow;
  m.receiveShadow = shadows.receiveShadow;
  return m;
}

function makeRoof(opts) {
  const { width, depth, height, roofHeight, roofType, roofColor } = opts;
  const overhang = 0.2;
  const shadows = opts;
  let roof;

  if (roofType === 'pyramid') {
    // 4-sided cone, rotated 45° so the square base lines up with the walls
    const radius = (Math.max(width, depth) / 2 + overhang) * Math.SQRT2;
    const geo = new THREE.ConeGeometry(radius, roofHeight, 4);
    roof = mesh('roof', geo, mat(roofColor), shadows);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = height + roofHeight / 2;
  } else if (roofType === 'flat') {
    const thickness = Math.min(0.3, roofHeight);
    const geo = new THREE.BoxGeometry(width + overhang * 2, thickness, depth + overhang * 2);
    roof = mesh('roof', geo, mat(roofColor), shadows);
    roof.position.y = height + thickness / 2;
  } else {
    // Gable: triangular prism. Ridge runs along Z so the gable faces +z (front).
    const hw = width / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(0, roofHeight);
    shape.lineTo(hw, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth + overhang * 2,
      bevelEnabled: false
    });
    roof = mesh('roof', geo, mat(roofColor), shadows);
    // ExtrudeGeometry starts at z=0 and goes to +depth; center it on the body
    roof.position.set(0, height, -(depth / 2 + overhang));
  }

  return roof;
}

function makeDoor(opts) {
  const { depth, height, doorColor } = opts;
  // A standard ~0.9–1.0 × 2.0 m door, shrunk only if the wall is unusually short
  const doorWidth = opts.doorWidth ?? Math.min(1.0, Math.max(0.9, opts.width * 0.12));
  const doorHeight = opts.doorHeight ?? Math.min(2.0, Math.max(1.8, height - 1.2));
  const doorDepth = 0.08;
  const door = createHingedDoor({
    width: doorWidth,
    height: doorHeight,
    depth: doorDepth,
    material: mat(doorColor),
    castShadow: !!opts.castShadow,
    receiveShadow: !!opts.receiveShadow
  });
  // Hinge at the left of the doorway, slightly proud of the front face (+z)
  door.position.set(-doorWidth / 2, 0, depth / 2 + doorDepth / 2);
  return door;
}

function addWindow(group, x, y, z, rotY, opts, index) {
  const winW = 0.7;
  const winH = 0.85;
  const winD = 0.07;
  const material = mat(opts.windowColor, {
    roughness: 0.35,
    metalness: 0.1,
    emissive: new THREE.Color(opts.windowColor),
    emissiveIntensity: 0.35
  });
  const win = mesh(`window_${index}`, new THREE.BoxGeometry(winW, winH, winD), material, opts);
  win.position.set(x, y, z);
  win.rotation.y = rotY;
  group.add(win);
}

function addWindows(group, opts) {
  const { width, depth, height, windowCount, hasDoor } = opts;
  if (windowCount <= 0) return;

  const winH = 0.85;
  const winD = 0.07;
  const doorH = hasDoor ? (opts.doorHeight ?? 2.0) : 0;
  const y = Math.min(
    Math.max(height * 0.62, doorH + winH / 2 + 0.2),
    height - winH / 2 - 0.15
  );
  const frontZ = depth / 2 + winD / 2;
  const sideX = width / 2 + winD / 2;

  // Front gets up to 2 windows; any leftover go to the sides (left, then right, repeating)
  const frontCount = Math.min(windowCount, 2);
  let index = 0;

  if (frontCount === 1) {
    const x = hasDoor ? -width * 0.28 : 0;
    addWindow(group, x, y, frontZ, 0, opts, index++);
  } else if (frontCount === 2) {
    const xOff = width * 0.28;
    addWindow(group, -xOff, y, frontZ, 0, opts, index++);
    addWindow(group, xOff, y, frontZ, 0, opts, index++);
  }

  const sideCount = windowCount - frontCount;
  for (let i = 0; i < sideCount; i++) {
    const onLeft = i % 2 === 0;
    const x = onLeft ? -sideX : sideX;
    const zOff = ((Math.floor(i / 2) % 2) === 0 ? -1 : 1) * depth * 0.22;
    addWindow(group, x, y, zOff, Math.PI / 2, opts, index++);
  }
}

/**
 * Build a simple procedural house as a THREE.Group.
 *
 * Options (all optional):
 *   width, depth, height   body size in metres (defaults 8, 10, 3.6)
 *   roofType               'gable' | 'pyramid' | 'flat'  (default 'gable')
 *   roofHeight             roof rise in metres (default ~0.55 * height)
 *   wallColor, roofColor, doorColor, windowColor
 *   hasDoor                default true
 *   doorWidth, doorHeight  default ~1.0 × 2.0 m
 *   windowCount            default 2 (front first, then sides)
 *   shadows                sets both castShadow and receiveShadow
 *   castShadow, receiveShadow   (default true if shadows is omitted)
 *   random                 if true, randomize any size/color/roofType
 *                          that was not given explicitly
 *
 * The group's origin is the center of the base (y=0). The front faces +z.
 * Named children: body, roof, door (hinged Group), window_0...
 * Door pivot is also on group.userData.door (null when hasDoor is false).
 */
export function generateHouse(options = {}) {
  const opts = resolveOptions(options);
  const { width, depth, height, wallColor, hasDoor } = opts;

  const group = new THREE.Group();
  group.name = 'house';

  const body = mesh(
    'body',
    new THREE.BoxGeometry(width, height, depth),
    mat(wallColor),
    opts
  );
  body.position.y = height / 2;
  group.add(body);

  group.add(makeRoof(opts));

  if (hasDoor) {
    const door = makeDoor(opts);
    group.add(door);
    group.userData.door = door;
  } else {
    group.userData.door = null;
  }

  addWindows(group, opts);

  group.userData.roofType = opts.roofType;
  group.userData.size = { width, depth, height };
  return group;
}

export { DEFAULTS as HOUSE_DEFAULTS };
