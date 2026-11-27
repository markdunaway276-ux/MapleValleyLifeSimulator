import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHingedDoor } from '../systems/doors.js';
import { createSeat, SIT_EYE_HEIGHT, SIT_RANGE } from '../systems/sit.js';
import { getShop } from '../data/shops.js';
import { buyFromShop } from '../systems/shop.js';
import { Parts } from './parts.js';
import { contactMaterial, createContactShadows } from './contact.js';
import { STREET } from './street.js';
import { WASHER_IDS, DRYER_IDS } from '../systems/laundry.js';

/**
 * Maple Lane Laundromat — Elbolilloduro's "Laundry" scene (CC0), cut down to
 * the one building and baked so the shop front faces the street (+z) with
 * the front doorway at the model origin (model space below: x along the
 * front, z back from the doorway, the back room on the -x side).
 *
 * Gameplay lives in systems/laundry.js (scene.userData.laundry); this file
 * places the colliders, interactables and the bits that move: drums turning
 * in running machines, status lights, customer bags on the counter, the
 * front door, the time clock and the night-time glow of the sign.
 */
export const LAUNDROMAT = { x: 29.5, z: -6.3 };
const URL = './assets/models/laundromat.glb';
/** Outside surfaces keep normal lighting; everything else glows a little, like strip lights left on. */
const OUTSIDE = /^(BrickSmallPainted$|Roof_tiles|RooftilesMetal|Glass|Emissor|Vending_machine|Board|trash_can|Garbage_bag)/;
const STRIP_LIGHT = 0.42;

/** Solid parts in model space. */
const SOLIDS = [
  ['front-w', -6.2, -0.6, -0.15, 0.15],
  ['front-e', 0.6, 8.2, -0.15, 0.15],
  ['back', -6.2, 8.2, -10.35, -10.05],
  ['side-e', 8.0, 8.3, -10.35, 0.15],
  ['side-w', -6.3, -6.0, -10.35, 0.15],
  ['partition-back', -1.5, -1.25, -10.05, -5.2],
  ['partition-mid', -1.5, -1.25, -4.05, -3.45],
  // The service counter: thick enough not to count as a wall, so you can talk and hand bags across it.
  ['counter', -1.75, -1.0, -3.45, -0.55],
  ['partition-front', -1.5, -1.25, -0.55, -0.15],
  ['dryers', 0.1, 8.0, -7.75, -6.75],
  ['washers-wall', 7.1, 8.0, -5.35, -0.25],
  ['washers-island', 1.1, 5.3, -4.65, -2.85],
  ['shelves', 1.4, 7.8, -9.75, -9.15],
  ['benches', 1.3, 5.9, -0.85, -0.25],
  ['folding-table', -1.3, -0.4, -6.85, -5.25],
  ['staff-shelf-1', -4.1, -3.3, -4.75, -1.65],
  ['staff-shelf-2', -6.0, -5.2, -4.75, -1.65],
  ['filing-cabinets', -6.0, -5.4, -7.55, -5.65],
  ['water-cooler', -2.2, -1.55, -6.95, -5.65],
  ['vending', -6.2, -4.9, 0.05, 0.85],
  ['bench-out', -2.8, -1.0, 0.05, 0.65]
];

/** Floor of the shop, for "am I indoors" checks (rain, rain sound). */
const INSIDE = { minX: -6.0, maxX: 8.0, minZ: -10.05, maxZ: -0.1 };

/** Front-loading washers on the island, doors facing the shop windows. */
const WASHERS = WASHER_IDS.map((id, i) => ({ id, x: [1.5, 2.35, 3.2, 4.05, 4.9][i], z: -2.83, y: 0.66, r: 0.25 }));
/** Dryer stacks (2×2 drums each) along the dryer wall; you use the lower right drum of each. */
const DRYERS = DRYER_IDS.map((id, i) => ({ id, x: [1.6, 3.6, 5.5, 7.5][i], z: -6.73, y: 0.6, r: 0.31 }));

const TABLE_SPOT = { x: -0.05, z: -6.1 };
const COUNTER_SPOT = { x: -0.85, z: -2.0 };
const BAG_SPOTS = [[-1.38, -2.95], [-1.38, -2.05], [-1.38, -1.15]];
const CLOCK = { x: -5.97, y: 1.35, z: -5.2 };

const BENCHES = [
  { id: 'laundromat-bench-1', x: 5.0, z: -0.55, w: 1.8, facing: -1 },
  { id: 'laundromat-bench-2', x: 2.2, z: -0.55, w: 1.8, facing: -1 },
  { id: 'laundromat-bench-out', x: -1.9, z: 0.35, w: 1.8, facing: 1 }
];

function drumTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, '#5b7894');
  g.addColorStop(1, '#1d2a38');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const colors = ['#c94f4f', '#e8e2d0', '#4a7fb8', '#d9b443', '#6c9a5a', '#9a6cc0'];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = 26 + (i % 3) * 10;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.ellipse(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, 14, 8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bagMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a6d52, roughness: 0.95 });
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat);
  sack.scale.set(1, 0.85, 0.8);
  sack.position.y = 0.17;
  const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.1, 6), mat);
  knot.position.y = 0.36;
  g.add(sack, knot);
  return g;
}

function buildEntrance(group, quality) {
  const parts = new Parts(true);
  parts.surface('metal');
  const frame = 0x46504f;
  for (const side of [-1, 1]) {
    parts.box(frame, 0.085, 2.64, 0.11, side * 0.62, 1.32, 0.16);
  }
  parts.box(frame, 1.32, 0.10, 0.15, 0, 2.56, 0.16);
  parts.box(0x7b776b, 1.28, 0.022, 0.22, 0, 0.011, 0.19);
  parts.box(frame, 0.42, 0.09, 0.24, 0, 2.69, 0.25);
  parts.surface('stone');
  parts.box(0x615c53, 5.49, 0.16, 0.08, -3.36, 0.08, 0.16);
  parts.box(0x615c53, 7.48, 0.16, 0.08, 4.36, 0.08, 0.16);
  const sidewalk = STREET.roadCenterZ - STREET.roadWidth / 2 - STREET.sidewalkWidth - LAUNDROMAT.z;
  const start = 0.22;
  const span = (sidewalk - start) / 3;
  for (let i = 0; i < 3; i++) {
    parts.box([0x9a9487, 0xaaa294, 0xa39a8a][i], 1.55, 0.028, span - 0.012,
      0, 0.014, start + (i + 0.5) * span);
  }
  const entrance = new THREE.Mesh(parts.merge(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
  entrance.name = 'laundromat-entrance';
  entrance.receiveShadow = !!quality.shadows;
  group.add(entrance, createContactShadows([
    { kind: 'rect', x: 0, z: 0.27, y: 0.028, w: 1.53, d: 0.13, margin: 0.23, strength: 0.48 },
    { kind: 'rect', x: -3.25, z: 0.15, w: 5.3, d: 0.19, margin: 0.35, strength: 0.55 },
    { kind: 'rect', x: 4.3, z: 0.14, w: 7.3, d: 0.20, margin: 0.35, strength: 0.55 },
    { x: -1.9, z: 0.35, rx: 1.10, rz: 0.49, strength: 0.74 }
  ], quality));
  const lensMaterial = new THREE.MeshStandardMaterial({ color: 0xb1a28a, emissive: 0xffd3a0, emissiveIntensity: 0 });
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.16), lensMaterial);
  lens.position.set(0, 2.64, 0.25);
  group.add(lens);
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: 0xe6a662, alphaMap: contactMaterial().alphaMap, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.55), poolMaterial);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.034, 0.83);
  pool.visible = false;
  group.add(pool);
  return night => {
    lensMaterial.emissiveIntensity = 1.18 * night;
    poolMaterial.opacity = 0.22 * night;
    pool.visible = night > 0;
  };
}

export function buildLaundromat(scene, quality) {
  const ud = scene.userData;
  const world = (x, z) => ({ x: LAUNDROMAT.x + x, z: LAUNDROMAT.z + z });
  const laundry = () => ud.laundry || null;

  for (const [id, x0, x1, z0, z1] of SOLIDS) {
    ud.colliders.addHouse({
      id: 'laundromat-' + id,
      minX: LAUNDROMAT.x + x0, maxX: LAUNDROMAT.x + x1,
      minZ: LAUNDROMAT.z + z0, maxZ: LAUNDROMAT.z + z1
    });
  }

  const group = new THREE.Group();
  group.name = 'laundromat';
  group.position.set(LAUNDROMAT.x, 0, LAUNDROMAT.z);
  scene.add(group);
  ud.laundromat = group;
  const updateEntrance = buildEntrance(group, quality);

  ud.indoorZones = ud.indoorZones || [];
  ud.indoorZones.push({
    id: 'laundromat',
    minX: LAUNDROMAT.x + INSIDE.minX, maxX: LAUNDROMAT.x + INSIDE.maxX,
    minZ: LAUNDROMAT.z + INSIDE.minZ, maxZ: LAUNDROMAT.z + INSIDE.maxZ
  });
  ud.mapBuildings = ud.mapBuildings || [];
  ud.mapBuildings.push({
    id: 'laundromat',
    minX: LAUNDROMAT.x - 6.3, maxX: LAUNDROMAT.x + 8.3,
    minZ: LAUNDROMAT.z - 10.35, maxZ: LAUNDROMAT.z + 0.15
  });

  /** An invisible interactable whose prompt and use come from `option()` ({ prompt, run } or null). */
  function spot(id, x, y, z, range, option) {
    const object = new THREE.Group();
    object.name = id;
    object.position.set(x, y, z);
    object.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + (option()?.prompt || '');
    object.userData.interact = (ctx) => {
      const o = option(ctx);
      return o ? o.run(ctx) : false;
    };
    group.add(object);
    const p = world(x, z);
    ud.interactables.push({
      id, object, range,
      enabled: () => !!option(),
      getPoint: () => ({ x: p.x, y, z: p.z })
    });
    return object;
  }

  // Washers and dryers: an animated drum over the model's door plus a status light.
  const drumTex = drumTexture();
  const drums = [];
  for (const m of [...WASHERS, ...DRYERS]) {
    const drum = new THREE.Mesh(
      new THREE.CircleGeometry(m.r, 20),
      new THREE.MeshBasicMaterial({ map: drumTex, transparent: true, opacity: 0.92 })
    );
    drum.position.set(m.x, m.y, m.z + 0.012);
    drum.visible = false;
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.03, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x3a3a3a })
    );
    led.position.set(m.x + m.r * 0.9, m.y + m.r + 0.12, m.z + 0.012);
    group.add(drum, led);
    drums.push({ ...m, drum, led });
    const isWasher = m.id.startsWith('washer');
    spot('laundromat-' + m.id, m.x, 0.95, m.z + (isWasher ? 0.25 : 0.3), isWasher ? 1.05 : 1.25, () => laundry()?.machineOption(m.id) || null);
  }

  spot('laundromat-table', TABLE_SPOT.x, 1.1, TABLE_SPOT.z, 1.25, () => laundry()?.tableOption() || null);
  spot('laundromat-counter', COUNTER_SPOT.x, 1.1, COUNTER_SPOT.z, 1.35, () => laundry()?.counterOption() || null);

  const bags = BAG_SPOTS.map(([x, z]) => {
    const b = bagMesh();
    b.position.set(x, 1.08, z);
    b.visible = false;
    group.add(b);
    return b;
  });

  // Time clock on the back-room wall.
  const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.26), new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.6 }));
  clockBody.position.set(CLOCK.x, CLOCK.y, CLOCK.z);
  const clockScreen = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.16), new THREE.MeshBasicMaterial({ color: 0x2a4a2a }));
  clockScreen.position.set(CLOCK.x + 0.035, CLOCK.y + 0.08, CLOCK.z);
  group.add(clockBody, clockScreen);
  spot('laundromat-timeclock', CLOCK.x + 0.15, CLOCK.y, CLOCK.z, 1.5, () => laundry()?.clockOption() || null);

  // Vending machine out front: detergent on the left button, snacks on the right.
  const vend = getShop('laundromat-vending');
  vend.stock.forEach((offer, i) => {
    spot('laundromat-vend-' + offer.item, -5.85 + i * 0.6, 1.2, 1.15, 0.95, () => ({
      prompt: `buy ${offer.name} ($${offer.price})`,
      run: (ctx) => (buyFromShop(vend, ctx, offer) ? 'press' : false)
    }));
  });

  // Benches you can sit on (two inside facing the machines, one outside facing the street).
  ud.seats = ud.seats || [];
  for (const b of BENCHES) {
    const c = world(b.x, b.z);
    const f = b.facing; // -1 faces -z (into the shop), +1 faces +z (the street)
    const def = {
      id: b.id, kind: 'bench', name: 'bench', facing: f < 0 ? '-z' : '+z',
      center: { x: c.x, y: 0, z: c.z },
      size: { width: b.w, height: 0.5, depth: 0.6 },
      interact: { x: c.x, y: 0.7, z: c.z + f * 0.75 },
      seat: { x: c.x, y: SIT_EYE_HEIGHT, z: c.z - f * 0.05, yaw: f < 0 ? 0 : Math.PI },
      stand: { x: c.x, z: c.z + f * 0.9 }
    };
    const seat = createSeat(def);
    seat.position.set(def.center.x, 0, def.center.z);
    scene.add(seat);
    ud.seats.push(seat);
    if (ud.sit) seat.userData.sit = ud.sit;
    ud.interactables.push({ id: b.id, kind: 'sit', object: seat, range: SIT_RANGE });
  }

  // A real front door (glazed), swinging out toward the street.
  const door = createHingedDoor({ width: 1.1, height: 2.5, depth: 0.06, glazed: true, color: 0x3c4a52, shadows: !!quality.shadows, id: 'laundromat-door' });
  door.position.set(LAUNDROMAT.x - 0.55, 0, LAUNDROMAT.z + 0.05);
  scene.add(door);
  ud.doors = ud.doors || [];
  ud.doors.push(door);
  const gate = ud.colliders.addHouse({
    id: 'laundromat-doorway',
    minX: LAUNDROMAT.x - 0.6, maxX: LAUNDROMAT.x + 0.6,
    minZ: LAUNDROMAT.z - 0.12, maxZ: LAUNDROMAT.z + 0.12
  });
  Object.defineProperty(gate, 'disabled', { get: () => !!door.userData.open || Math.abs(door.rotation.y) > 0.05, enumerable: true });

  const signMats = [];
  const windowMats = new Set();
  new GLTFLoader().load(URL, (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const glass = m && m.transparent;
      o.castShadow = !!quality.shadows && !glass;
      o.receiveShadow = !!quality.shadows;
      if (!m) return;
      m.shadowSide = THREE.DoubleSide;
      if (/^(BrickSmallPainted|Roof_tiles|RooftilesMetal)/.test(m.name) && m.map) {
        m.map.anisotropy = Math.max(m.map.anisotropy, quality.shadows ? 8 : 4);
        m.map.needsUpdate = true;
      }
      if (/^Glass/.test(m.name) && m.emissive) windowMats.add(m);
      if (/^Emissor/.test(m.name) && !signMats.includes(m)) signMats.push(m);
      if (m.map && !OUTSIDE.test(m.name) && !m.userData.stripLit) {
        m.emissiveMap = m.map;
        m.emissive.setRGB(1, 0.98, 0.94);
        m.emissiveIntensity = STRIP_LIGHT;
        m.userData.stripLit = true;
      }
    });
    group.add(model);
  }, undefined, (err) => console.warn('Laundromat model failed to load', err));

  let spin = 0;
  group.userData.update = (delta, time) => {
    const l = laundry();
    spin += delta;
    for (const d of drums) {
      const s = l ? l.machineState(d.id) : null;
      d.drum.visible = !!(s && (s.running || s.finished));
      if (s && s.running) {
        // Washers slosh back and forth; dryers tumble one way.
        d.drum.rotation.z = d.id.startsWith('washer') ? Math.sin(spin * 2.4) * 2.2 : -spin * 3.2;
      }
      const color = !s || (!s.running && !s.finished) ? 0x3a3a3a
        : s.running ? 0xffa020 : (Math.floor(spin * 2) % 2 ? 0x30ff60 : 0x0c4018);
      d.led.material.color.setHex(color);
    }
    const waiting = l ? Math.min(bags.length, l.waitingCount()) : 0;
    bags.forEach((b, i) => { b.visible = i < waiting; });
    clockScreen.material.color.setHex(l && l.onShift ? 0x40e070 : 0x2a4a2a);
    if (time) {
      const m = time.minutes;
      const dusk = THREE.MathUtils.smoothstep(m, 17.5 * 60, 19.5 * 60);
      const dawn = 1 - THREE.MathUtils.smoothstep(m, 5.5 * 60, 7 * 60);
      const night = Math.min(1, dusk + dawn);
      for (const s of signMats) s.emissiveIntensity = 0.55 + 1.6 * night;
      for (const window of windowMats) {
        window.emissive.setHex(0xffd29a);
        window.emissiveIntensity = 0.24 * night;
      }
      updateEntrance(night);
    }
  };

  return group;
}
