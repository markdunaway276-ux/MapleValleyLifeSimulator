import * as THREE from 'three';
import { loadGltf } from './gltf.js';
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

function drumTexture(soapy = false) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, soapy ? '#6d9cb8' : '#5b7894');
  g.addColorStop(1, soapy ? '#1f3b4d' : '#1d2a38');
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
  if (soapy) {
    // Frothy white & icy-blue soap suds around the tumbling clothes.
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + (i % 2) * 0.14;
      const rr = 14 + (i % 4) * 13;
      const rad = 4 + (i % 3) * 2.5;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(215, 245, 255, 0.78)' : 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.arc(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, rad, 0, Math.PI * 2);
      ctx.fill();
    }
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
  g.userData.mat = mat;
  g.add(sack, knot);
  return g;
}

function signPlate(title, subtitle, width, height, { bg = '#1c4d5c', accent = '#f6d57a' } = {}) {
  let mat;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, c.width / 2, subtitle ? 76 : 96, c.width - 48);
    if (subtitle) {
      ctx.fillStyle = accent;
      ctx.font = 'bold 38px system-ui, sans-serif';
      ctx.fillText(subtitle, c.width / 2, 136, c.width - 48);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshBasicMaterial({ map: tex });
  } else {
    mat = new THREE.MeshBasicMaterial({ color: 0x1c4d5c });
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

/** Wall-mounted indoor Soap & Detergent dispenser facing the center-island washers. */
function buildSoapDispenser() {
  const g = new THREE.Group();
  g.name = 'laundromat-soap-dispenser-mesh';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.62, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xdfecec, roughness: 0.45, metalness: 0.25 })
  );
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.08, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x1e5a6b, roughness: 0.4, metalness: 0.2 })
  );
  trim.position.y = 0.28;
  const chute = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.14, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x2a3136, roughness: 0.6, metalness: 0.5 })
  );
  chute.position.set(0.085, -0.18, 0);
  const coinSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.09, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xbec5ca, roughness: 0.3, metalness: 0.8 })
  );
  coinSlot.position.set(0.092, -0.02, 0.14);
  const plate = signPlate('SOAP & DETERGENT', '$2 · PRESS E', 0.38, 0.16);
  plate.rotation.y = Math.PI / 2;
  plate.position.set(0.094, 0.11, 0);
  g.add(body, trim, chute, coinSlot, plate);
  return g;
}

/** Lavender Fabric Softener dispenser on the west end of the center washer island. */
function buildSoftenerDispenser() {
  const g = new THREE.Group();
  g.name = 'laundromat-softener-dispenser-mesh';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.56, 0.40),
    new THREE.MeshStandardMaterial({ color: 0xe9e4f2, roughness: 0.45, metalness: 0.2 })
  );
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.07, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x6b4f8c, roughness: 0.4, metalness: 0.2 })
  );
  trim.position.y = 0.25;
  const chute = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.12, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x2a3136, roughness: 0.6, metalness: 0.5 })
  );
  chute.position.set(-0.075, -0.16, 0);
  const plate = signPlate('FABRIC SOFTENER', '$2 · +15 ENERGY', 0.35, 0.15, { bg: '#5a3f78', accent: '#f5dcff' });
  plate.rotation.y = -Math.PI / 2;
  plate.position.set(-0.084, 0.09, 0);
  g.add(body, trim, chute, plate);
  return g;
}

/** Cozy magazine rack near the front benches for passing time while machines run. */
function buildMagazineRack() {
  const g = new THREE.Group();
  g.name = 'laundromat-magazine-rack';
  const wood = new THREE.MeshStandardMaterial({ color: 0x7b583a, roughness: 0.85 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.05, 0.28), wood);
  frame.position.y = 0.525;
  g.add(frame);
  const covers = [0xd65b4a, 0x4b8bb8, 0xd9a844, 0x5c9668, 0x9b6db5, 0xc97b4c];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.22, 0.03),
        new THREE.MeshStandardMaterial({ color: covers[(row * 3 + col) % covers.length], roughness: 0.65 })
      );
      mag.position.set(-0.17 + col * 0.17, 0.42 + row * 0.32, -0.145);
      mag.rotation.x = 0.18;
      g.add(mag);
    }
  }
  const header = signPlate('MAGAZINES', 'PASS TIME', 0.50, 0.16, { bg: '#3e523a', accent: '#f7dfa0' });
  header.rotation.y = Math.PI;
  header.position.set(0, 0.96, -0.145);
  g.add(header);
  return g;
}

/** Double-sided overhead sign above the 5 center-island self-serve washers. */
function buildOverheadSign() {
  const g = new THREE.Group();
  g.name = 'laundromat-washers-sign';
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x555c61, metalness: 0.7, roughness: 0.35 });
  for (const x of [-0.75, 0.75]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.65, 8), rodMat);
    rod.position.set(x, 0.45, 0);
    g.add(rod);
  }
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.38, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x163945, roughness: 0.5 })
  );
  const front = signPlate('SELF-SERVE WASHERS', '$3 + SOAP · OR $5 INCL. SOAP', 1.84, 0.34);
  front.position.z = 0.022;
  const back = signPlate('SELF-SERVE WASHERS', '$3 + SOAP · OR $5 INCL. SOAP', 1.84, 0.34);
  back.rotation.y = Math.PI;
  back.position.z = -0.022;
  g.add(backing, front, back);
  return g;
}

/** Live Order Board mounted beside the folding table showing active shift orders & streaks. */
function buildOrderBoard() {
  const g = new THREE.Group();
  g.name = 'laundromat-order-board';
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.78, 1.12),
    new THREE.MeshStandardMaterial({ color: 0x5c432c, roughness: 0.85 })
  );
  g.add(frame);
  if (typeof document === 'undefined') {
    const fallback = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.70), new THREE.MeshBasicMaterial({ color: 0x1e2c26 }));
    fallback.rotation.y = Math.PI / 2;
    fallback.position.x = 0.028;
    g.add(fallback);
    return { group: g, draw: () => {} };
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.70), new THREE.MeshBasicMaterial({ map: tex }));
  face.rotation.y = Math.PI / 2;
  face.position.x = 0.028;
  g.add(face);

  let lastSig = '';
  function draw(summary) {
    const sig = summary
      ? `${summary.onShift}|${summary.streak}|${summary.done}|${summary.orders.map((o) => `${o.id}:${o.taken}:${Math.floor(o.dueLeft / 5)}`).join(',')}`
      : 'idle';
    if (sig === lastSig) return;
    lastSig = sig;
    ctx.fillStyle = '#1b2b25';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d9c08a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = '#f6d57a';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DROP-OFF ORDER BOARD', 28, 44);
    if (!summary || !summary.onShift) {
      ctx.fillStyle = '#dce8e1';
      ctx.font = '26px system-ui, sans-serif';
      ctx.fillText('Off Shift — Ask Dottie or', 28, 128);
      ctx.fillText('clock in at the back wall!', 28, 168);
      ctx.fillStyle = '#9fd3b3';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('$8+/order + tips · 3-streak +$5', 28, 240);
      if (summary && summary.totalOrders > 0) {
        ctx.fillStyle = '#b9c9c2';
        ctx.font = '22px system-ui, sans-serif';
        ctx.fillText(`Lifetime orders completed: ${summary.totalOrders}`, 28, 290);
      }
    } else {
      ctx.fillStyle = '#9fd3b3';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(`Done: ${summary.done}  ·  Streak: ${summary.streak}  ·  $${summary.earned}`, 28, 88);
      if (!summary.orders.length) {
        ctx.fillStyle = '#dce8e1';
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillText('Waiting for next drop-off bag…', 28, 165);
      } else {
        summary.orders.slice(0, 3).forEach((o, i) => {
          const y = 148 + i * 58;
          ctx.fillStyle = '#' + (o.color ?? 0x8a6d52).toString(16).padStart(6, '0');
          ctx.beginPath();
          ctx.arc(42, y, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 26px system-ui, sans-serif';
          ctx.fillText(o.name, 68, y);
          ctx.fillStyle = o.dueLeft <= 0 ? '#ff6b6b' : o.dueLeft <= 35 ? '#fbbf24' : '#a7f3d0';
          ctx.font = 'bold 24px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(o.dueLeft <= 0 ? 'LATE' : `${o.dueLeft} min`, canvas.width - 28, y);
          ctx.textAlign = 'left';
        });
      }
    }
    tex.needsUpdate = true;
  }
  draw(null);
  return { group: g, draw };
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

  // Washers and dryers: an animated drum over the model's door plus a status light (and steam for dryers).
  const washerDrumTex = drumTexture(true);
  const dryerDrumTex = drumTexture(false);
  const steamGeo = new THREE.SphereGeometry(0.085, 8, 6);
  const drums = [];
  for (const m of [...WASHERS, ...DRYERS]) {
    const isWasher = m.id.startsWith('washer');
    const drum = new THREE.Mesh(
      new THREE.CircleGeometry(m.r, 20),
      new THREE.MeshBasicMaterial({ map: isWasher ? washerDrumTex : dryerDrumTex, transparent: true, opacity: 0.92 })
    );
    drum.position.set(m.x, m.y, m.z + 0.012);
    drum.visible = false;
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.03, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    led.position.set(m.x + m.r * 0.9, m.y + m.r + 0.12, m.z + 0.012);
    group.add(drum, led);
    const puffs = [];
    if (!isWasher) {
      for (let k = 0; k < 3; k++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xf4f7fa, transparent: true, opacity: 0, depthWrite: false });
        const puff = new THREE.Mesh(steamGeo, mat);
        puff.position.set(m.x + (k - 1) * 0.14, 1.95, m.z - 0.15);
        puff.visible = false;
        group.add(puff);
        puffs.push({ mesh: puff, mat, phase: k * 2.1, baseX: m.x + (k - 1) * 0.14, baseZ: m.z - 0.15 });
      }
    }
    drums.push({ ...m, drum, led, puffs });
    spot('laundromat-' + m.id, m.x, 1.25, m.z + (isWasher ? 0.28 : 0.32), isWasher ? 1.65 : 1.8, () => laundry()?.machineOption(m.id) || null);
  }

  // Overhead sign above the 5 center-island self-serve washers.
  const overheadSign = buildOverheadSign();
  overheadSign.position.set(3.2, 2.38, -3.75);
  group.add(overheadSign);

  // East-wall washers are decorative commercial units — point players to the 5 center-island washers.
  spot('laundromat-wall-washers', 6.85, 1.25, -2.8, 1.4, () => ({
    prompt: 'check wall washers',
    run: (ctx) => {
      ctx?.toast?.('Staff-only machines — use the 5 self-serve washers on the center island!');
      return false;
    }
  }));

  spot('laundromat-table', TABLE_SPOT.x, 1.1, TABLE_SPOT.z, 1.5, () => laundry()?.tableOption() || null);
  spot('laundromat-counter', COUNTER_SPOT.x, 1.1, COUNTER_SPOT.z, 1.55, () => laundry()?.counterOption() || null);

  // Live Order Board mounted on partition-back beside the folding table.
  const orderBoard = buildOrderBoard();
  orderBoard.group.position.set(-1.21, 1.72, -5.85);
  group.add(orderBoard.group);

  // Magazine rack near the indoor benches to pass time while machines run.
  const magRack = buildMagazineRack();
  magRack.position.set(0.85, 0, -0.52);
  group.add(magRack);
  spot('laundromat-magazines', 0.85, 1.1, -0.82, 1.75, () => laundry()?.waitOption() || null);

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
  spot('laundromat-timeclock', CLOCK.x + 0.15, CLOCK.y, CLOCK.z, 1.65, () => laundry()?.clockOption() || null);

  // Indoor Soap & Detergent dispenser mounted right beside the washers.
  const vend = getShop('laundromat-vending');
  const soapOffer = vend?.stock?.find((o) => o.item === 'detergent') || vend?.stock?.[0];
  const soapDispenser = buildSoapDispenser();
  soapDispenser.position.set(-1.16, 1.35, -3.75);
  group.add(soapDispenser);
  if (soapOffer) {
    spot('laundromat-soap-dispenser', -0.95, 1.35, -3.75, 1.85, () => ({
      prompt: `buy ${soapOffer.name} ($${soapOffer.price})`,
      run: (ctx) => (buyFromShop(vend, ctx, soapOffer) ? 'press' : false)
    }));
  }

  // Indoor Fabric Softener dispenser on the west end of the center washer island.
  const softenerOffer = vend?.stock?.find((o) => o.item === 'softener');
  if (softenerOffer) {
    const softenerDispenser = buildSoftenerDispenser();
    softenerDispenser.position.set(1.04, 1.28, -3.75);
    group.add(softenerDispenser);
    spot('laundromat-softener-dispenser', 0.82, 1.28, -3.75, 1.8, () => ({
      prompt: `buy ${softenerOffer.name} ($${softenerOffer.price})`,
      run: (ctx) => (buyFromShop(vend, ctx, softenerOffer) ? 'press' : false)
    }));
  }

  // Vending machine out front: detergent, snacks, and fabric softener.
  const vendSign = signPlate('SOAP $2 · SNACKS $5', 'LAUNDRY VENDING', 1.05, 0.34);
  vendSign.position.set(-5.55, 1.92, 0.87);
  group.add(vendSign);
  const vendSpacing = vend.stock.length > 2 ? 0.45 : 0.6;
  const vendStart = -5.55 - ((vend.stock.length - 1) * vendSpacing) / 2;
  vend.stock.forEach((offer, i) => {
    spot('laundromat-vend-' + offer.item, vendStart + i * vendSpacing, 1.35, 1.15, 1.8, () => ({
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
  loadGltf(URL, (gltf) => {
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
  }, (err) => console.warn('Laundromat model failed to load', err));

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
      if (d.puffs && d.puffs.length) {
        const steaming = !!(s && s.running);
        for (const p of d.puffs) {
          p.mesh.visible = steaming;
          if (steaming) {
            const t = (spin * 0.55 + p.phase) % 1;
            p.mesh.position.set(p.baseX + Math.sin(spin * 1.4 + p.phase) * 0.06, 1.88 + t * 0.52, p.baseZ);
            const scale = 0.65 + t * 1.1;
            p.mesh.scale.setScalar(scale);
            p.mat.opacity = Math.sin(t * Math.PI) * 0.24;
          }
        }
      }
      const color = !s || (!s.running && !s.finished) ? 0x38bdf8
        : s.running ? 0xffa020 : (Math.floor(spin * 2) % 2 ? 0x30ff60 : 0x0c4018);
      d.led.material.color.setHex(color);
    }
    const waitingList = l && typeof l.waitingOrders === 'function' ? l.waitingOrders() : [];
    bags.forEach((b, i) => {
      const o = waitingList[i];
      b.visible = !!o;
      if (o && b.userData.mat) b.userData.mat.color.setHex(o.color);
    });
    if (l && typeof l.boardSummary === 'function') orderBoard.draw(l.boardSummary());
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
