import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createHingedDoor } from '../systems/doors.js';
import { AO, BEVEL, HOUSE, SURFACE, shade } from './palette.js';
import { bevelBox } from './shapes.js';
import { createVertexMaterial, ROUGH_ATTR } from './surfaces.js';

const DEFAULTS = {
  width: 8,
  depth: 10,
  height: 3.6,
  roofType: 'gable',
  wallColor: HOUSE.walls[3],
  roofColor: HOUSE.roofs[0],
  doorColor: HOUSE.door,
  windowColor: HOUSE.glass,
  hasDoor: true,
  windowCount: 2
};

const WALL_PALETTE = HOUSE.walls;
const ROOF_PALETTE = HOUSE.roofs;
const ROOF_TYPES = ['gable', 'pyramid', 'flat', 'hip', 'shed'];
const WINDOW_LAYOUTS = ['pair', 'shutters', 'ribbon', 'grid', 'bay'];

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
    out.doorColor = HOUSE.door;
    out.windowColor = HOUSE.glass;
  }

  // Explicit values always win over random / defaults
  for (const key of Object.keys(options)) {
    if (key === 'random') continue;
    if (options[key] !== undefined) out[key] = options[key];
  }

  if (!ROOF_TYPES.includes(out.roofType)) out.roofType = 'gable';
  out._doorColorGiven = options.doorColor !== undefined;
  if (!WINDOW_LAYOUTS.includes(out.windowLayout)) out.windowLayout = 'pair';
  if (out.porch) {
    const p = typeof out.porch === 'object' ? out.porch : {};
    out.porch = {
      depth: Math.min(2.2, Math.max(1.1, p.depth ?? 1.3)),
      width: Math.min(5, Math.max(2.6, p.width ?? 3.2)),
      roof: ['shed', 'gable', 'flat'].includes(p.roof) ? p.roof : 'shed',
      posts: 2
    };
  } else out.porch = null;
  if (out.extension) {
    const e = typeof out.extension === 'object' ? out.extension : {};
    out.extension = {
      side: e.side >= 0 ? 1 : -1,
      type: e.type === 'wing' ? 'wing' : 'garage',
      width: Math.min(5, Math.max(2.6, e.width ?? 3.2)),
      depth: e.depth
    };
  } else out.extension = null;
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
  return new THREE.MeshStandardMaterial({ color, roughness: SURFACE.plaster.roughness, metalness: 0.02, ...extras });
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
  } else if (roofType === 'hip' || roofType === 'shed') {
    const ew = width / 2 + overhang;
    const ed = depth / 2 + overhang;
    const geo = roofType === 'hip'
      ? makeHipGeometry(ew, ed, roofHeight)
      : makeShedGeometry(ew, ed, roofHeight * 0.75, 0.3, 1);
    roof = mesh('roof', geo, mat(roofColor), shadows);
    roof.position.y = height;
  } else if (roofType === 'flat') {
    const thickness = Math.min(0.3, roofHeight);
    const geo = new RoundedBoxGeometry(width + overhang * 2, thickness, depth + overhang * 2, 1, 0.04);
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

function makeDoor(opts, extra = {}) {
  const { depth, height, doorColor } = opts;
  // A standard ~0.9–1.0 × 2.0 m door, shrunk only if the wall is unusually short
  const doorWidth = opts.doorWidth ?? Math.min(1.0, Math.max(0.9, opts.width * 0.12));
  const doorHeight = opts.doorHeight ?? Math.min(2.0, Math.max(1.8, height - 1.2));
  const doorDepth = 0.08;
  const door = createHingedDoor({
    width: doorWidth,
    height: doorHeight,
    depth: doorDepth,
    material: extra.shared ? doorMaterial(doorColor) : mat(doorColor),
    castShadow: !!opts.castShadow,
    receiveShadow: !!opts.receiveShadow
  });
  // Hinge at the left of the doorway, slightly proud of the front face (+z)
  door.position.set(-doorWidth / 2, extra.y || 0, depth / 2 + doorDepth / 2);
  return door;
}

function addWindow(group, x, y, z, rotY, opts, index) {
  const winW = 0.7;
  const winH = 0.85;
  const winD = 0.07;
  const material = mat(opts.windowColor, {
    roughness: SURFACE.glass.roughness,
    metalness: SURFACE.glass.metalness,
    emissive: new THREE.Color(opts.windowColor),
    emissiveIntensity: 0.22
  });
  const win = mesh(`window_${index}`, new RoundedBoxGeometry(winW, winH, winD, 1, 0.02), material, opts);
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

// ---------------------------------------------------------------------------
// Varied houses (opts.merge): shared materials, seeded details, and a single
// merged static mesh per house (plus one glass mesh and the hinged door).
// ---------------------------------------------------------------------------

const TRIM_PALETTE = HOUSE.trims;
const ACCENT_PALETTE = HOUSE.accents;
const BRICK_COLOR = HOUSE.brick;
const CAP_COLOR = HOUSE.cap;
const DECK_COLOR = HOUSE.deck;
const GARAGE_DOOR_COLOR = HOUSE.garageDoor;

const DECK_H = 0.08; // porch deck thickness; the door pivot sits on top of it
const PORCH_UNDERSIDE = 2.5; // lowest point of any porch roof (eye height is 1.6)

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// Module-level caches so every house shares the same materials.
const sharedMaterials = new Map();
function sharedMaterial(key, make) {
  let m = sharedMaterials.get(key);
  if (!m) {
    m = make();
    sharedMaterials.set(key, m);
  }
  return m;
}
function staticMaterial() {
  // Roughness comes from the per-vertex attribute Parts writes (one draw call).
  return sharedMaterial('static', () => createVertexMaterial({ metalness: 0.03 }));
}
function glassMaterial(color) {
  return sharedMaterial(`glass:${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: SURFACE.glass.roughness, metalness: SURFACE.glass.metalness,
    emissive: new THREE.Color(color), emissiveIntensity: 0.22
  }));
}
function doorMaterial(color) {
  return sharedMaterial(`door:${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: SURFACE.wood.roughness, metalness: 0
  }));
}

/**
 * Baked vertex ambient occlusion for a box in its own (untransformed) space:
 * the foot of each side face darkens and the underside is darker still, so
 * walls and furniture sit on the ground instead of floating. Tops are left
 * alone. Pure per-vertex colour: no lights, no textures, no draw calls.
 */
function boxAo(g, sy) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const n = pos.count;
  const out = new Float32Array(n);
  const span = Math.max(1e-4, Math.min(AO.height, sy));
  for (let i = 0; i < n; i++) {
    const ny = nor.getY(i);
    if (ny > 0.5) { out[i] = 1; continue; }
    if (ny < -0.5) { out[i] = 1 - AO.bottom; continue; }
    const t = Math.min(1, Math.max(0, (pos.getY(i) + sy / 2) / span));
    const s = t * t * (3 - 2 * t);
    out[i] = 1 - AO.side * (1 - s);
  }
  return out;
}

/** Collects transformed geometry pieces and merges them into one BufferGeometry. */
export class Parts {
  /**
   * `colored` writes per-vertex colour (and roughness) for a vertex-coloured
   * material. `ao` bakes the box ambient occlusion (default on for coloured
   * parts; turn it off for unlit / emissive parts).
   */
  constructor(colored, { ao = colored } = {}) {
    this.colored = colored;
    this.ao = !!(colored && ao);
    this.rough = SURFACE.plaster.roughness;
    this._boxes = new Map();
    this.list = [];
    this.frame = new THREE.Matrix4();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  setFrame(x = 0, y = 0, z = 0, ry = 0) {
    this.frame.makeRotationY(ry).setPosition(x, y, z);
  }

  resetFrame() {
    this.frame.identity();
  }

  /** Sets the roughness of everything added next: a SURFACE preset name or a number. */
  surface(kind) {
    this.rough = typeof kind === 'number' ? kind : (SURFACE[kind] || SURFACE.plaster).roughness;
  }

  addGeometry(geo, color, local, aoSy = null) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    // AO is read off the box's own normals and height, so it runs before the transform.
    const ao = this.ao && aoSy !== null ? boxAo(g, aoSy) : null;
    g.applyMatrix4(this._m.multiplyMatrices(this.frame, local));
    if (this.colored) {
      const c = new THREE.Color(color);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      const rough = new Float32Array(n).fill(this.rough);
      for (let i = 0; i < n; i++) {
        const f = ao ? ao[i] : 1;
        arr[i * 3] = c.r * f;
        arr[i * 3 + 1] = c.g * f;
        arr[i * 3 + 2] = c.b * f;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.setAttribute(ROUGH_ATTR, new THREE.BufferAttribute(rough, 1));
    }
    this.list.push(g);
  }

  /**
   * Adds a w x h x d box with absolute-radius rounded edges (see shapes.js).
   * The geometry is built at its real size, so the bevel stays the same on a
   * 9 m wall as on a 3 cm trim strip. Identical sizes are built once.
   */
  box(color, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
    this._p.set(x, y, z);
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._s.set(1, 1, 1);
    const local = new THREE.Matrix4().compose(this._p, this._q, this._s);
    const key = `${Math.round(sx * 1e4)}|${Math.round(sy * 1e4)}|${Math.round(sz * 1e4)}`;
    let geo = this._boxes.get(key);
    if (!geo) {
      geo = bevelBox(sx, sy, sz);
      this._boxes.set(key, geo);
    }
    this.addGeometry(geo, color, local, sy);
  }

  geometry(geo, color, x = 0, y = 0, z = 0) {
    this.addGeometry(geo, color, new THREE.Matrix4().makeTranslation(x, y, z));
  }

  merge() {
    this._boxes.forEach((g) => g.dispose());
    this._boxes.clear();
    if (this.list.length === 0) return null;
    const merged = mergeGeometries(this.list, false);
    this.list.forEach((g) => g.dispose());
    this.list.length = 0;
    return merged;
  }
}

/** Hip roof (ridge along z) with a closed underside; flat-shaded. */
function makeHipGeometry(ew, ed, rh) {
  const L = Math.max(0.05, ed - ew);
  const e0 = [-ew, 0, -ed], e1 = [ew, 0, -ed], e2 = [ew, 0, ed], e3 = [-ew, 0, ed];
  const r0 = [0, rh, -L], r1 = [0, rh, L];
  const tris = [
    e3, e2, r1, // front
    e2, e1, r0, e2, r0, r1, // east
    e1, e0, r0, // back
    e0, e3, r1, e0, r1, r0, // west
    e0, e1, e2, e0, e2, e3 // underside
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => pos.set(v, i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tris.length * 2), 2));
  return geo;
}

/** Shed roof: one slope across the width, high edge on `highSide` (+1 / -1). */
function makeShedGeometry(ew, ed, hi, low, highSide) {
  const shape = new THREE.Shape();
  const lowY = low;
  shape.moveTo(-ew, 0);
  shape.lineTo(ew, 0);
  shape.lineTo(ew, highSide > 0 ? hi : lowY);
  shape.lineTo(-ew, highSide > 0 ? lowY : hi);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: ed * 2, bevelEnabled: false });
  geo.translate(0, 0, -ed);
  return geo;
}

function makeGableGeometry(ew, ed, rh) {
  const shape = new THREE.Shape();
  shape.moveTo(-ew, 0);
  shape.lineTo(0, rh);
  shape.lineTo(ew, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: ed * 2, bevelEnabled: false });
  geo.translate(0, 0, -ed);
  return geo;
}

/** Adds the main roof to `parts`; returns roofY(x, z) = roof surface height. */
function addMainRoof(parts, opts, rng) {
  const { width, depth, height, roofHeight: rh, roofType, roofColor } = opts;
  const oh = 0.25;
  const ew = width / 2 + oh;
  const ed = depth / 2 + oh;
  const clamp01 = (v) => Math.max(0, v);

  if (roofType === 'pyramid') {
    const s = Math.max(width, depth) / 2 + oh;
    const geo = new THREE.ConeGeometry(s * Math.SQRT2, rh, 4);
    geo.rotateY(Math.PI / 4);
    parts.geometry(geo, roofColor, 0, height + rh / 2, 0);
    geo.dispose();
    return (x, z) => height + rh * clamp01(1 - Math.max(Math.abs(x), Math.abs(z)) / s);
  }
  if (roofType === 'flat') {
    const t = 0.25;
    parts.box(roofColor, width + oh * 2, t, depth + oh * 2, 0, height + t / 2, 0);
    return () => height + t;
  }
  if (roofType === 'hip') {
    const geo = makeHipGeometry(ew, ed, rh);
    parts.geometry(geo, roofColor, 0, height, 0);
    geo.dispose();
    return (x, z) => height + rh * clamp01(Math.min((ew - Math.abs(x)) / ew, (ed - Math.abs(z)) / ew));
  }
  if (roofType === 'shed') {
    const highSide = rng() < 0.5 ? -1 : 1;
    const hi = rh * 0.75;
    const low = 0.3;
    const geo = makeShedGeometry(ew, ed, hi, low, highSide);
    parts.geometry(geo, roofColor, 0, height, 0);
    geo.dispose();
    return (x) => height + low + (hi - low) * clamp01(Math.min(1, (x * highSide + ew) / (2 * ew)));
  }
  const geo = makeGableGeometry(ew, ed, rh);
  parts.geometry(geo, roofColor, 0, height, 0);
  geo.dispose();
  return (x) => height + rh * clamp01(1 - Math.abs(x) / ew);
}

function addWindowUnit(parts, glass, trim, accent, spec) {
  // Local frame: origin at the wall surface, +z pointing out of the wall.
  const { w, h, mullV = 0, mullH = 0, shutters = false } = spec;
  parts.surface('trim');
  glass.box(null, w, h, 0.04, 0, 0, 0.02);
  const f = 0.06;
  parts.box(trim, w + f * 2, f, 0.1, 0, h / 2 + f / 2, 0.04);
  parts.box(trim, w + f * 2, f, 0.1, 0, -h / 2 - f / 2, 0.04);
  parts.box(trim, f, h, 0.1, -w / 2 - f / 2, 0, 0.04);
  parts.box(trim, f, h, 0.1, w / 2 + f / 2, 0, 0.04);
  for (let i = 1; i <= mullV; i++) {
    parts.box(trim, 0.035, h, 0.07, -w / 2 + (w * i) / (mullV + 1), 0, 0.045);
  }
  for (let i = 1; i <= mullH; i++) {
    parts.box(trim, w, 0.035, 0.07, 0, -h / 2 + (h * i) / (mullH + 1), 0.045);
  }
  parts.box(trim, w + 0.26, 0.06, 0.18, 0, -h / 2 - f - 0.03, 0.07);
  if (shutters) {
    parts.surface('paint');
    const sw = Math.max(0.2, w * 0.42);
    parts.box(accent, sw, h + 0.12, 0.04, -w / 2 - f - sw / 2 - 0.01, 0, 0.03);
    parts.box(accent, sw, h + 0.12, 0.04, w / 2 + f + sw / 2 + 0.01, 0, 0.03);
  }
}

function doorSize(opts) {
  return {
    width: opts.doorWidth ?? Math.min(1.0, Math.max(0.9, opts.width * 0.12)),
    height: opts.doorHeight ?? Math.min(2.0, Math.max(1.8, opts.height - 1.2))
  };
}

function buildVariedHouse(group, opts) {
  const rng = mulberry32((opts.seed ?? 1) >>> 0);
  const { width, depth, height, wallColor, hasDoor, windowCount } = opts;
  const hw = width / 2;
  const hd = depth / 2;
  const trim = pickFrom(rng, TRIM_PALETTE);
  const accent = opts.accentColor ?? pickFrom(rng, ACCENT_PALETTE);
  const doorColor = opts._doorColorGiven ? opts.doorColor : accent;
  const dSize = doorSize(opts);
  const dw = dSize.width;
  const parts = new Parts(true);
  const glass = new Parts(false);
  const foot = { boxes: [], posts: [], minX: -hw, maxX: hw, minZ: -hd, maxZ: hd };
  const grow = (x0, x1, z0, z1) => {
    foot.minX = Math.min(foot.minX, x0); foot.maxX = Math.max(foot.maxX, x1);
    foot.minZ = Math.min(foot.minZ, z0); foot.maxZ = Math.max(foot.maxZ, z1);
  };

  const porch = opts.porch;
  const ext = opts.extension;
  const eSide = ext ? (ext.side >= 0 ? 1 : -1) : 0;
  const features = [];

  // --- walls, corner boards, roof --------------------------------------
  parts.surface('plaster');
  parts.box(wallColor, width, height, depth, 0, height / 2, 0);
  parts.surface('trim');
  for (const sx of [-1, 1]) {
    if (sx === eSide) continue;
    for (const sz of [-1, 1]) {
      parts.box(trim, 0.14, height, 0.14, sx * (hw + 0.005), height / 2, sz * (hd + 0.005));
    }
  }
  parts.surface('roof');
  const roofY = addMainRoof(parts, opts, rng);
  features.push(`${opts.roofType} roof`);

  // --- chimney ----------------------------------------------------------
  if (opts.chimney) {
    const cfg = typeof opts.chimney === 'object' ? opts.chimney : {};
    const side = cfg.side ? (cfg.side >= 0 ? 1 : -1) : (rng() < 0.5 ? -1 : 1);
    const cx = side * width * 0.24;
    const cz = -depth * (0.1 + rng() * 0.1);
    const s = 0.62;
    let lo = Infinity;
    let hi = -Infinity;
    for (const dx of [-s / 2, s / 2]) {
      for (const dz of [-s / 2, s / 2]) {
        const y = roofY(cx + dx, cz + dz);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
    const base = lo - 0.2;
    const top = hi + 0.8;
    parts.surface('brick');
    parts.box(BRICK_COLOR, s, top - base, s, cx, (base + top) / 2, cz);
    parts.surface('stone');
    parts.box(CAP_COLOR, s + 0.14, 0.1, s + 0.14, cx, top + 0.05, cz);
    features.push('chimney');
  }

  // --- porch --------------------------------------------------------------
  let frontClear = dw / 2 + 0.4; // half-width of the front wall reserved for door/porch
  let deckH = 0;
  if (porch) {
    const pd = porch.depth;
    const pw = porch.width;
    deckH = DECK_H;
    parts.surface('woodRaw');
    parts.box(DECK_COLOR, pw + 0.2, DECK_H, pd, 0, DECK_H / 2, hd + pd / 2);
    parts.surface('roof');
    const roofLen = pd + 0.2;
    const frontZ = hd + roofLen;
    let tan = 0;
    if (porch.roof === 'gable') {
      const g = makeGableGeometry((pw + 0.4) / 2, roofLen / 2, 0.55);
      parts.geometry(g, opts.roofColor, 0, PORCH_UNDERSIDE, hd + roofLen / 2);
      g.dispose();
    } else if (porch.roof === 'flat') {
      parts.box(opts.roofColor, pw + 0.3, 0.1, roofLen, 0, PORCH_UNDERSIDE + 0.05, hd + roofLen / 2);
    } else {
      const theta = 0.09;
      tan = Math.tan(theta);
      const cy = PORCH_UNDERSIDE + 0.05 * Math.cos(theta) + (roofLen / 2) * Math.sin(theta);
      parts.box(opts.roofColor, pw + 0.3, 0.1, roofLen, 0, cy, hd + roofLen / 2, theta, 0, 0);
    }
    const postZ = hd + pd - 0.1;
    const underAt = PORCH_UNDERSIDE + (frontZ - postZ) * tan;
    parts.surface('trim');
    for (const sx of [-1, 1]) {
      const px = sx * (pw / 2 - 0.05);
      parts.box(trim, 0.14, underAt + 0.03 - DECK_H, 0.14, px, (DECK_H + underAt + 0.03) / 2, postZ);
      foot.posts.push({ x: px, z: postZ, radius: 0.12 });
    }
    grow(-(pw / 2 + 0.15), pw / 2 + 0.15, -hd, frontZ);
    frontClear = pw / 2 + 0.15 + 0.12;
    features.push(`${porch.roof} porch`);
  }

  // --- door lintel ------------------------------------------------------
  if (hasDoor) {
    parts.surface('trim');
    parts.box(trim, dw + 0.3, 0.1, 0.12, 0, deckH + dSize.height + 0.05, hd + 0.04);
  }

  // --- extension (garage / wing) -----------------------------------------
  let extCfg = null;
  if (ext) {
    const eW = ext.width;
    const eType = ext.type;
    const eH = eType === 'garage' ? 2.75 : Math.min(3.0, height - 0.5);
    const eD = ext.depth ?? Math.min(depth - 1.6, eType === 'garage' ? 6.2 : 5.5);
    const setback = 0.5;
    const zF = hd - setback;
    const zB = zF - eD;
    const xCenter = eSide * (hw + eW / 2);
    parts.surface('plaster');
    parts.box(wallColor, eW, eH, eD, xCenter, eH / 2, (zF + zB) / 2);
    if (eType === 'garage') {
      parts.surface('roof');
      parts.box(opts.roofColor, eW + 0.3, 0.2, eD + 0.5, eSide * (hw + (eW + 0.3) / 2), eH + 0.1, (zF + zB) / 2);
      const gw = Math.min(eW - 0.5, 2.6);
      const gh = 2.1;
      parts.surface('trim');
      parts.box(trim, gw + 0.2, 0.12, 0.08, xCenter, gh + 0.06, zF + 0.03);
      parts.surface('metal');
      parts.box(GARAGE_DOOR_COLOR, gw, gh, 0.06, xCenter, gh / 2, zF + 0.03);
      for (const gy of [0.55, 1.05, 1.55]) {
        parts.box(shade(GARAGE_DOOR_COLOR, 0.82), gw, 0.03, 0.02, xCenter, gy, zF + 0.065);
      }
      features.push('garage');
    } else {
      const rise = 0.4;
      const outer = eW + 0.3;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(eSide * outer, 0);
      shape.lineTo(eSide * outer, 0.12);
      shape.lineTo(0, rise);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: eD + 0.5, bevelEnabled: false });
      parts.surface('roof');
      parts.geometry(g, opts.roofColor, eSide * hw, eH, zB - 0.25);
      g.dispose();
      parts.setFrame(xCenter, 1.4, zF, 0);
      glass.setFrame(xCenter, 1.4, zF, 0);
      addWindowUnit(parts, glass, trim, accent, { w: 0.8, h: 1.0, mullV: 1 });
      parts.resetFrame();
      glass.resetFrame();
      features.push('side wing');
    }
    const x0 = eSide > 0 ? hw : -hw - eW;
    foot.boxes.push({ id: 'ext', minX: x0, maxX: x0 + eW, minZ: zB, maxZ: zF });
    grow(x0, x0 + eW + 0.3, zB, zF + 0.25);
    extCfg = { side: eSide, width: eW, type: eType };
  }

  // --- front window layout -----------------------------------------------
  const layout = opts.windowLayout;
  const winY = 1.5;
  const lo = Math.max(dw / 2 + 0.4, frontClear);
  const hiEdge = hw - 0.5;
  const mid = (lo + hiEdge) / 2;
  const frontWins = []; // { x, w, h, y, mullV, mullH, shutters }
  let bay = null;
  if (layout === 'ribbon') {
    const w = Math.min(2.2, hiEdge - lo);
    for (const sx of [-1, 1]) frontWins.push({ x: sx * mid, w, h: 0.95, y: 1.6, mullV: 2, mullH: 0 });
  } else if (layout === 'grid') {
    const w = Math.min(1.15, hiEdge - lo);
    for (const sx of [-1, 1]) frontWins.push({ x: sx * mid, w, h: 1.3, y: 1.5, mullV: 1, mullH: 1 });
  } else if (layout === 'bay' && hiEdge - lo >= 1.95) {
    bay = { x: -mid, w: 1.9, d: 0.55 };
    frontWins.push({ x: mid, w: 0.85, h: 1.15, y: winY, mullV: 0, mullH: 1 });
  } else {
    const shut = layout === 'shutters';
    const w = shut ? 0.75 : 0.85;
    const reach = w / 2 + (shut ? 0.36 : 0.1);
    let c = width * 0.28;
    c = Math.min(Math.max(c, lo + reach), hiEdge - reach);
    if (!(c >= lo + reach - 1e-6)) c = mid;
    for (const sx of [-1, 1]) {
      frontWins.push({ x: sx * c, w, h: 1.15, y: winY, mullV: 0, mullH: 1, shutters: shut });
    }
  }
  for (const fw of frontWins) {
    parts.setFrame(fw.x, fw.y, hd, 0);
    glass.setFrame(fw.x, fw.y, hd, 0);
    addWindowUnit(parts, glass, trim, accent, fw);
  }
  parts.resetFrame();
  glass.resetFrame();

  if (bay) {
    const by = 0.35;
    const bh = 1.7;
    const zc = hd + bay.d / 2 - 0.05;
    parts.surface('plaster');
    parts.box(wallColor, bay.w, bh, bay.d + 0.1, bay.x, by + bh / 2, zc);
    parts.surface('trim');
    parts.box(trim, bay.w + 0.1, 0.08, bay.d + 0.2, bay.x, by + 0.04, zc + 0.05);
    parts.surface('roof');
    parts.box(opts.roofColor, bay.w + 0.3, 0.1, bay.d + 0.35, bay.x, by + bh + 0.05, zc + 0.1);
    parts.setFrame(bay.x, by + bh / 2 + 0.02, hd + bay.d, 0);
    glass.setFrame(bay.x, by + bh / 2 + 0.02, hd + bay.d, 0);
    addWindowUnit(parts, glass, trim, accent, { w: bay.w - 0.45, h: bh - 0.5, mullV: 2, mullH: 0 });
    parts.resetFrame();
    glass.resetFrame();
    foot.boxes.push({ id: 'bay', minX: bay.x - bay.w / 2, maxX: bay.x + bay.w / 2, minZ: hd, maxZ: hd + bay.d });
    grow(bay.x - bay.w / 2 - 0.15, bay.x + bay.w / 2 + 0.15, -hd, hd + bay.d + 0.15);
    features.push('bay window');
  }
  if (!bay) features.push(`${layout} windows`);

  // --- side windows ------------------------------------------------------
  const sideCount = Math.max(0, windowCount - 2);
  for (let i = 0; i < sideCount; i++) {
    const sx = i % 2 === 0 ? -1 : 1;
    if (sx === eSide) continue;
    const zc = ((Math.floor(i / 2) % 2) === 0 ? -1 : 1) * depth * 0.22;
    parts.setFrame(sx * hw, winY, zc, sx * Math.PI / 2);
    glass.setFrame(sx * hw, winY, zc, sx * Math.PI / 2);
    addWindowUnit(parts, glass, trim, accent, { w: 0.8, h: 1.1, mullV: 1, shutters: layout === 'shutters' });
  }
  parts.resetFrame();
  glass.resetFrame();

  // --- build the merged meshes ---------------------------------------------
  const body = new THREE.Mesh(parts.merge(), staticMaterial());
  body.name = 'body';
  body.castShadow = opts.castShadow;
  body.receiveShadow = opts.receiveShadow;
  group.add(body);

  const glassGeo = glass.merge();
  if (glassGeo) {
    const windows = new THREE.Mesh(glassGeo, glassMaterial(opts.windowColor));
    windows.name = 'windows';
    group.add(windows);
  }

  if (hasDoor) {
    const door = makeDoor({ ...opts, doorColor }, { shared: true, y: deckH });
    group.add(door);
    group.userData.door = door;
  } else {
    group.userData.door = null;
  }

  foot.bounds = { minX: foot.minX, maxX: foot.maxX, minZ: foot.minZ, maxZ: foot.maxZ };
  delete foot.minX; delete foot.maxX; delete foot.minZ; delete foot.maxZ;
  group.userData.footprint = foot;
  group.userData.features = features;
  group.userData.porch = porch ? { depth: porch.depth, width: porch.width, roof: porch.roof, underside: PORCH_UNDERSIDE, deckHeight: deckH } : null;
  group.userData.extension = extCfg;
  group.userData.windowLayout = layout;
  group.userData.chimney = !!opts.chimney;
}

/**
 * World-space colliders for a house built with `merge: true`: extension / bay
 * boxes and porch-post circles. The porch deck has no collider (walkable).
 * `placement` is { x, z, rotY, id }; rotY must be a multiple of PI / 2.
 */
export function getHouseColliders(house, placement) {
  const fp = house.userData.footprint;
  const out = { boxes: [], posts: [] };
  if (!fp) return out;
  const { x, z, rotY = 0, id } = placement;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const toWorld = (lx, lz) => ({
    x: r6(x + lx * cos + lz * sin),
    z: r6(z - lx * sin + lz * cos)
  });
  fp.boxes.forEach((b) => {
    const a = toWorld(b.minX, b.minZ);
    const c = toWorld(b.maxX, b.maxZ);
    out.boxes.push({
      id: `${id}-${b.id}`,
      minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x),
      minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z)
    });
  });
  fp.posts.forEach((p, i) => {
    const w = toWorld(p.x, p.z);
    out.posts.push({ id: `${id}-post-${i}`, x: w.x, z: w.z, radius: p.radius });
  });
  return out;
}

/** World-space XZ bounds of the whole house incl. porch, extension and bay. */
export function getHouseBounds(house, placement) {
  const b = house.userData.footprint?.bounds;
  if (!b) return null;
  const { x, z, rotY = 0 } = placement;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const pts = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]].map(([lx, lz]) => ({
    x: x + lx * cos + lz * sin,
    z: z - lx * sin + lz * cos
  }));
  return {
    minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z))
  };
}

/**
 * Build a simple procedural house as a THREE.Group.
 *
 * Options (all optional):
 *   width, depth, height   body size in metres (defaults 8, 10, 3.6)
 *   roofType               'gable' | 'pyramid' | 'flat' | 'hip' | 'shed'  (default 'gable')
 *   roofHeight             roof rise in metres (default ~0.55 * height)
 *   wallColor, roofColor, doorColor, windowColor
 *   hasDoor                default true
 *   doorWidth, doorHeight  default ~1.0 × 2.0 m
 *   windowCount            default 2 (front first, then sides)
 *   shadows                sets both castShadow and receiveShadow
 *   castShadow, receiveShadow   (default true if shadows is omitted)
 *   merge                  true builds the lightweight, varied version: one merged
 *                          static mesh + one glass mesh + the hinged door, with:
 *   seed                   integer; seeds trim / accent / chimney / shed-slope choices
 *   windowLayout           'pair' | 'shutters' | 'ribbon' | 'grid' | 'bay'
 *   porch                  { depth, width, roof: 'shed'|'gable'|'flat', posts: 2 }
 *   chimney                true | { side: -1 | 1 }
 *   extension              { side: -1 | 1, type: 'garage' | 'wing', width, depth? }
 *   accentColor            shutters / door colour (seeded if omitted)
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

  if (opts.merge) {
    buildVariedHouse(group, opts);
    group.userData.roofType = opts.roofType;
    group.userData.size = { width, depth, height };
    group.userData.seed = opts.seed ?? 1;
    return group;
  }

  const body = mesh(
    'body',
    bevelBox(width, height, depth, { segments: 2, max: BEVEL.max * 1.5 }),
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
