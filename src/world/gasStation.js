import { worldAssets } from './assetLoading.js';
import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { createHingedDoor } from '../systems/doors.js';
import { getShop } from '../data/shops.js';
import { getJob } from '../data/jobs.js';
import { buyFromShop } from '../systems/shop.js';
import { FUEL, quoteFill } from '../systems/fuel.js';
import { contactMaterial } from './contact.js';

/**
 * Maple Lane Fuel & Go: a canopy with two pump islands by the street and a
 * convenience store behind it, on the north side across from the player's
 * house. The model is Elbolilloduro's CC0 "Gas station" pack, rebranded.
 *
 * Local coordinates: x across the lot (0 = middle), z away from the street
 * (0 = the lot's front edge, just behind the north sidewalk).
 */
export const GAS_STATION = { x: 0, z: 13.9 };
const URL = './assets/models/gas-station.glb';

// Store shell (inside faces of the walls).
const STORE = { minX: -5.17, maxX: 6.17, front: 17.3, back: 31.4, partition: 27.5 };
const DOOR = { left: -1.6, right: -0.55, z: 17.25, height: 2.55 };

// Solid things, as [id, minX, maxX, minZ, maxZ] in local coordinates.
const SOLIDS = [
  // walls
  ['front-west', -5.9, DOOR.left, 16.6, 17.3],
  ['front-east', DOOR.right, 7.72, 16.6, 17.3],
  ['west', -5.9, STORE.minX, 16.6, 32.2],
  ['east', STORE.maxX, 7.72, 16.6, 32.2],
  ['back', -5.9, 7.72, STORE.back, 32.2],
  ['stockroom', STORE.minX, STORE.maxX, 27.45, 27.6],
  // store fittings
  ['display-case', -5.45, -1.92, 17.3, 18.84],
  ['counter', -3.38, -2.47, 17.36, 21.77],
  ['coffee-counter', -5.2, -4.1, 24.48, 27.45],
  ['freezer', -2.02, -0.33, 26.42, 27.45],
  ['shelves-1', -0.13, 4.78, 17.44, 18.07],
  ['shelves-2', -0.13, 4.66, 19.97, 21.24],
  ['shelves-3', -0.13, 4.66, 23.18, 24.45],
  ['shelves-4', -0.13, 4.75, 26.81, 27.44],
  // forecourt
  ['ice-chest', 5.19, 7.16, 16.24, 17.05],
  ['pump-1', -6.15, -5.32, 3.84, 5.12],
  ['pump-2', -6.15, -5.32, 8.18, 9.47],
  ['pump-3', 3.95, 4.77, 3.84, 5.12],
  ['pump-4', 3.95, 4.77, 8.18, 9.47],
  ['pillar-1', -6.24, -5.53, 2.24, 2.95],
  ['pillar-2', -6.24, -5.53, 10.43, 11.14],
  ['pillar-3', 3.85, 4.56, 2.24, 2.95],
  ['pillar-4', 3.85, 4.56, 10.43, 11.14],
  ['sign-post-1', 7.4, 7.67, 0.15, 0.36],
  ['sign-post-2', 7.4, 7.67, 2.04, 2.25]
];

/** Materials that glow: night strength, day strength. */
const GLOW = {
  Light: [1.25, 0.55],
  Sign: [0.55, 0.06],
  '6twelve_Sign': [1.1, 0.12],
  '6twelve.001': [0.9, 0.1],
  spotlight: [1.2, 0.2],
  Emissor_Verde: [1.15, 0.35]
};

function asphaltMaterial() {
  const map = new THREE.TextureLoader(worldAssets).load('./assets/models/gas-asphalt.webp');
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(17 / 3, 17 / 3);
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, color: 0xc9c9c4, roughness: 0.96 });
}

function canvasSign(width, height, drawFn, { emissiveIntensity = 0.7 } = {}) {
  let mat;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round(512 * (height / width));
    const ctx = c.getContext('2d');
    drawFn(ctx, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity,
      roughness: 0.22
    });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: 0x16242c, emissive: 0xffffff, emissiveIntensity });
  }
  return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat), mat };
}

/** Glowing digital screen + Regular/Plus/Premium octane buttons on both sides of a fuel pump. */
function buildPumpDetail(priceStr, glowList) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 0.25, metalness: 0.55 });
  const btnColors = [0xf5c542, 0x3b82f6, 0xe63946];
  const { mesh: screenProto, mat: screenMat } = canvasSign(0.42, 0.22, (ctx, w, h) => {
    ctx.fillStyle = '#091418';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 74px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${priceStr}/L`, w / 2, h * 0.42);
    ctx.fillStyle = '#e2f1f8';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('READY · PAY AT PUMP', w / 2, h * 0.78);
  }, { emissiveIntensity: 0.75 });
  glowList.push({ material: screenMat, nightGlow: 1.25, dayGlow: 0.55 });

  for (const side of [-1, 1]) {
    const x = side * 0.43;
    const rotY = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.26, 0.46), frameMat);
    bezel.position.set(x, 1.50, 0);
    const screen = screenProto.clone();
    screen.position.set(x + side * 0.015, 1.50, 0);
    screen.rotation.y = rotY;
    g.add(bezel, screen);

    // 3 illuminated octane grade buttons (Regular / Plus / Premium).
    btnColors.forEach((col, i) => {
      const btn = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.085, 0.11),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.3 })
      );
      btn.position.set(x + side * 0.008, 1.18, (i - 1) * 0.14);
      g.add(btn);
    });

    // Smooth curved rubber fuel hose & chrome nozzle resting in its holster.
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x181b1f, roughness: 0.72, metalness: 0.1 });
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xd4dde6, roughness: 0.22, metalness: 0.85 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.6 });
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.095), frameMat);
    holster.position.set(x + side * 0.012, 1.32, 0.36);
    const nozzleBody = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.12, 0.065), gripMat);
    nozzleBody.position.set(x + side * 0.035, 1.29, 0.36);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.14, 10), nozzleMat);
    spout.position.set(x + side * 0.035, 1.39, 0.36);
    spout.rotation.x = -0.25;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + side * 0.015, 1.82, 0.44),
      new THREE.Vector3(x + side * 0.095, 1.32, 0.49),
      new THREE.Vector3(x + side * 0.115, 0.72, 0.44),
      new THREE.Vector3(x + side * 0.075, 0.92, 0.38),
      new THREE.Vector3(x + side * 0.035, 1.23, 0.36)
    ]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.015, 8, false), hoseMat);
    g.add(holster, nozzleBody, spout, hose);
  }
  return g;
}

/** Illuminated Pump #1-#4 plaque mounted on canopy pillars. */
function buildPumpNumberPlaque(num, glowList) {
  const g = new THREE.Group();
  const { mesh: faceProto, mat } = canvasSign(0.38, 0.38, (ctx, w, h) => {
    ctx.fillStyle = '#143347';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 18;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 260px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), w / 2, h / 2 + 12);
  }, { emissiveIntensity: 0.5 });
  glowList.push({ material: mat, nightGlow: 1.05, dayGlow: 0.35 });
  for (const side of [-1, 1]) {
    const p = faceProto.clone();
    p.position.x = side * 0.37;
    p.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(p);
  }
  return g;
}

/** Glossy yellow safety bollard with reflective silver band. */
function buildBollard() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.28, metalness: 0.25 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.65 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.92, 16), yellow);
  post.position.y = 0.46;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), yellow);
  cap.position.y = 0.92;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.08, 16), stripe);
  band.position.y = 0.76;
  g.add(post, cap, band);
  return g;
}

/** Classic forecourt windshield squeegee & trash bin station. */
function buildSqueegeeBin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.86, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x2a323b, roughness: 0.42, metalness: 0.35 })
  );
  body.position.y = 0.43;
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.24, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x1d4e6b, roughness: 0.35, metalness: 0.3 })
  );
  hood.position.y = 0.98;
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.08, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 })
  );
  bucket.position.set(0, 0.72, 0.26);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8dee4, metalness: 0.7, roughness: 0.3 })
  );
  handle.position.set(0, 0.92, 0.26);
  handle.rotation.x = 0.12;
  g.add(body, hood, bucket, handle);
  return g;
}

/** Blue coin-op Air & Water unit for the side of the forecourt. */
function buildAirWaterStation(glowList) {
  const g = new THREE.Group();
  g.name = 'gas-air-water';
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d5b96, roughness: 0.3, metalness: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd2dce6, roughness: 0.24, metalness: 0.8 });
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.28, 0.36), blue);
  cabinet.position.y = 0.64;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.42), steel);
  base.position.y = 0.04;
  const { mesh: plate, mat } = canvasSign(0.38, 0.24, (ctx, w, h) => {
    ctx.fillStyle = '#0f3052';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AIR & WATER', w / 2, h * 0.40);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText('FREE TIRE AIR', w / 2, h * 0.75);
  }, { emissiveIntensity: 0.45 });
  glowList.push({ material: mat, nightGlow: 0.95, dayGlow: 0.35 });
  plate.position.set(0, 0.96, -0.185);
  plate.rotation.y = Math.PI;
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 10, 24), new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.75 }));
  hose.position.set(0.24, 0.72, 0);
  hose.rotation.y = Math.PI / 2;
  g.add(cabinet, base, plate, hose);
  return g;
}

/** Painted forecourt parking stalls and yellow pump-island guide lanes. */
function buildForecourtMarkings() {
  const g = new THREE.Group();
  g.name = 'gas-forecourt-markings';
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.82 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe5b832, roughness: 0.82 });
  const stripe = (mat, w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.018, z);
    g.add(m);
  };
  // Yellow guide lines framing both pump islands.
  for (const x of [-6.75, -4.75, 3.35, 5.35]) {
    stripe(yellow, 0.12, 9.8, x, 6.7);
  }
  // White parking stall lines in front of the convenience store.
  for (const x of [-4.2, -1.9, 0.6, 2.9]) {
    stripe(white, 0.11, 2.7, x, 14.9);
  }
  stripe(white, 7.2, 0.11, -0.65, 16.25);
  return g;
}

/** Glowing double-sided roadside LED fuel price sign. */
function buildPriceTotem(regPrice, premPrice, glowList) {
  const g = new THREE.Group();
  g.name = 'gas-led-price-sign';
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.55, 1.75),
    new THREE.MeshStandardMaterial({ color: 0x16222c, roughness: 0.35, metalness: 0.45 })
  );
  const { mesh: faceProto, mat } = canvasSign(1.66, 1.46, (ctx, w, h) => {
    ctx.fillStyle = '#0f1b24';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAPLE LANE FUEL & GO', w / 2, 62);
    ctx.fillStyle = '#182b38';
    ctx.fillRect(28, 105, w - 56, 115);
    ctx.fillRect(28, 240, w - 56, 115);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2f1f8';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText('REGULAR', 48, 164);
    ctx.fillText('PREMIUM', 48, 298);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 64px monospace';
    ctx.fillText(`$${regPrice}`, w - 48, 164);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`$${premPrice}`, w - 48, 298);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('OPEN 24 HOURS · FRESH COFFEE', w / 2, h - 46);
  }, { emissiveIntensity: 0.65 });
  glowList.push({ material: mat, nightGlow: 1.35, dayGlow: 0.45 });
  for (const side of [-1, 1]) {
    const f = faceProto.clone();
    f.position.x = side * 0.085;
    f.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(f);
  }
  g.add(backing);
  return g;
}

/** Subtle glowing accent trim around the canopy fascia. */
function buildCanopyTrim(glowList) {
  const g = new THREE.Group();
  g.name = 'gas-canopy-trim';
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, emissive: 0xffb732, emissiveIntensity: 0.4, roughness: 0.25
  });
  glowList.push({ material: trimMat, nightGlow: 1.35, dayGlow: 0.28 });
  const cx = -0.65;
  const cz = 6.7;
  const w = 14.3;
  const d = 12.2;
  const y = 4.92;
  const front = new THREE.Mesh(new THREE.BoxGeometry(w, 0.075, 0.06), trimMat);
  front.position.set(cx, y, cz - d / 2);
  const back = front.clone();
  back.position.z = cz + d / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, d), trimMat);
  left.position.set(cx - w / 2, y, cz);
  const right = left.clone();
  right.position.x = cx + w / 2;
  g.add(front, back, left, right);
  return g;
}

/** 8 recessed glowing canopy LED fixtures + soft warm asphalt light pools beneath each island. */
function buildCanopyDownlights(glowList) {
  const g = new THREE.Group();
  g.name = 'gas-canopy-downlights';
  const housingMat = new THREE.MeshStandardMaterial({ color: 0xcbd5df, roughness: 0.35, metalness: 0.6 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xfff0cc, emissiveIntensity: 0.5, roughness: 0.2 });
  glowList.push({ material: lensMat, nightGlow: 1.5, dayGlow: 0.35 });
  for (const x of [-5.74, 4.36]) {
    for (const z of [2.6, 5.4, 8.0, 10.8]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.56), housingMat);
      h.position.set(x, 4.68, z);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.025, 0.48), lensMat);
      l.position.set(x, 4.655, z);
      g.add(h, l);
    }
  }
  const pools = [];
  const poolGeo = new THREE.PlaneGeometry(7.2, 11.4);
  for (const x of [-5.74, 4.36]) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd599, alphaMap: contactMaterial().alphaMap, transparent: true,
      opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const pool = new THREE.Mesh(poolGeo, mat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.022, 6.7);
    pool.visible = false;
    g.add(pool);
    pools.push({ mesh: pool, mat });
  }
  return { group: g, pools };
}

/** Animated cherry & blue-raspberry slushie barrels + rising warm coffee steam wisps. */
function buildSlushieAndSteam() {
  const g = new THREE.Group();
  g.name = 'gas-slushie-and-steam';
  const paddles = [];
  const bowlGeo = new THREE.CylinderGeometry(0.115, 0.11, 0.32, 18);
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.3, metalness: 0.5 });
  const paddleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const flavors = [
    { z: 26.32, color: 0xef4444, emissive: 0x7f1d1d },
    { z: 26.64, color: 0x38bdf8, emissive: 0x0c4a6e }
  ];
  for (const f of flavors) {
    const bowl = new THREE.Mesh(
      bowlGeo,
      new THREE.MeshStandardMaterial({
        color: f.color, emissive: f.emissive, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.84, roughness: 0.14
      })
    );
    bowl.position.set(-4.52, 1.56, f.z);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.03, 18), lidMat);
    lid.position.set(-4.52, 1.73, f.z);
    const paddle = new THREE.Group();
    paddle.position.set(-4.52, 1.56, f.z);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.018), paddleMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.16), paddleMat);
    paddle.add(blade, blade2);
    g.add(bowl, lid, paddle);
    paddles.push(paddle);
  }

  const puffs = [];
  const puffGeo = new THREE.SphereGeometry(0.042, 8, 6);
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf7f9fc, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(puffGeo, mat);
    const baseZ = 24.82 + (i % 2) * 0.22;
    mesh.position.set(-4.52, 1.62, baseZ);
    g.add(mesh);
    puffs.push({ mesh, mat, phase: i * 1.65, baseZ });
  }
  return { group: g, paddles, puffs };
}

/** Curbside Bagged Ice sign, Propane Tank Exchange Cage, and entrance planter boxes. */
function buildStorefrontProps(glowList) {
  const g = new THREE.Group();
  g.name = 'gas-storefront-props';

  // Crisp "BAGGED ICE" emblem on the front face of the ice chest.
  const { mesh: iceSign, mat: iceMat } = canvasSign(1.25, 0.42, (ctx, w, h) => {
    ctx.fillStyle = '#0e4c8a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 94px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BAGGED ICE', w / 2, h * 0.48);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('FRESH · CRYSTAL CLEAR', w / 2, h * 0.82);
  }, { emissiveIntensity: 0.4 });
  glowList.push({ material: iceMat, nightGlow: 0.9, dayGlow: 0.3 });
  iceSign.position.set(6.18, 1.15, 16.22);
  iceSign.rotation.y = Math.PI;
  g.add(iceSign);

  // Wire-mesh Propane Tank Exchange Cage stocked with 6 white steel cylinders.
  const cage = new THREE.Group();
  cage.position.set(3.55, 0, 16.52);
  const cageMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.35, metalness: 0.55 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.3 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.38, 0.56), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, wireframe: true }));
  frame.position.y = 0.69;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 0.62), cageMat);
  roof.position.y = 1.41;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 0.60), cageMat);
  base.position.y = 0.03;
  const { mesh: propSign, mat: propMat } = canvasSign(1.08, 0.22, (ctx, w, h) => {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PROPANE EXCHANGE', w / 2, h / 2);
  }, { emissiveIntensity: 0.35 });
  glowList.push({ material: propMat, nightGlow: 0.85, dayGlow: 0.25 });
  propSign.position.set(0, 1.54, -0.29);
  propSign.rotation.y = Math.PI;
  cage.add(frame, roof, base, propSign);
  const cylGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.44, 14);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const tank = new THREE.Mesh(cylGeo, tankMat);
      tank.position.set(-0.34 + col * 0.34, 0.28 + row * 0.56, 0);
      cage.add(tank);
    }
  }
  g.add(cage);

  // Two cozy wooden planter boxes flanking the glass front entrance.
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4c32, roughness: 0.86 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.78 });
  for (const px of [-2.05, -0.08]) {
    const planter = new THREE.Group();
    planter.position.set(px, 0, 16.52);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.42), woodMat);
    box.position.y = 0.22;
    const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), bushMat);
    shrub.scale.set(1.05, 0.9, 0.95);
    shrub.position.y = 0.54;
    planter.add(box, shrub);
    g.add(planter);
  }
  return g;
}

/** Convenience store overhead aisle signs, convex chrome security mirror, and glowing register screen. */
function buildStoreInteriorDetails(glowList) {
  const g = new THREE.Group();
  g.name = 'gas-store-interior-details';
  const aisleDefs = [
    { x: 2.25, z: 20.6, text: 'SNACKS & TREATS' },
    { x: 2.25, z: 23.8, text: 'SANDWICHES & DRINKS' },
    { x: 5.35, z: 18.2, text: 'AUTO & FUEL CANS' }
  ];
  for (const a of aisleDefs) {
    const { mesh: faceProto, mat } = canvasSign(1.25, 0.26, (ctx, w, h) => {
      ctx.fillStyle = '#183344';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.text, w / 2, h / 2);
    }, { emissiveIntensity: 0.45 });
    glowList.push({ material: mat, nightGlow: 0.85, dayGlow: 0.4 });
    const front = faceProto.clone();
    front.position.set(a.x, 2.85, a.z - 0.012);
    front.rotation.y = Math.PI;
    const back = faceProto.clone();
    back.position.set(a.x, 2.85, a.z + 0.012);
    g.add(front, back);
  }

  // Convex chrome security mirror in the upper corner.
  const mirror = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.96, roughness: 0.05 })
  );
  mirror.position.set(-4.85, 3.05, 17.65);
  mirror.rotation.set(Math.PI * 0.65, Math.PI * 0.25, 0);
  g.add(mirror);

  // Glowing green LED total readout on the checkout register.
  const { mesh: regScreen, mat: regMat } = canvasSign(0.26, 0.11, (ctx, w, h) => {
    ctx.fillStyle = '#07140d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 78px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$0.00', w / 2, h * 0.44);
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('THANK YOU', w / 2, h * 0.80);
  }, { emissiveIntensity: 0.85 });
  glowList.push({ material: regMat, nightGlow: 1.2, dayGlow: 0.7 });
  regScreen.position.set(-2.92, 1.48, 20.42);
  regScreen.rotation.y = Math.PI / 2;
  g.add(regScreen);

  return g;
}

/** A couple of red jerry cans on the floor at the end of the front shelves. */
function gasCans(quality) {
  const group = new THREE.Group();
  group.name = 'gas-cans';
  const red = new THREE.MeshStandardMaterial({ color: 0xb8261c, roughness: 0.32, metalness: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.65 });
  const body = new THREE.BoxGeometry(0.34, 0.4, 0.17);
  const handle = new THREE.BoxGeometry(0.22, 0.04, 0.05);
  const spout = new THREE.CylinderGeometry(0.022, 0.03, 0.16, 10);
  for (const [x, z, r] of [[5.25, 17.9, 0.1], [5.62, 18.05, -0.25], [5.42, 18.45, 1.45]]) {
    const can = new THREE.Group();
    const b = new THREE.Mesh(body, red);
    b.position.y = 0.2;
    const h = new THREE.Mesh(handle, red);
    h.position.set(-0.03, 0.43, 0);
    const s = new THREE.Mesh(spout, black);
    s.position.set(0.13, 0.45, 0);
    s.rotation.z = -0.5;
    can.add(b, h, s);
    can.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = !!quality.shadows; });
    can.position.set(x, 0.13, z);
    can.rotation.y = r;
    group.add(can);
  }
  return group;
}

export function buildGasStation(scene, quality) {
  const data = scene.userData;
  const { x: X, z: FRONT } = GAS_STATION;
  const station = new THREE.Group();
  station.name = 'gas-station';
  station.position.set(X, 0, FRONT);
  scene.add(station);
  data.gasStation = station;

  // Forecourt paving, from the sidewalk to the store's own slab.
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(16.9, 17), asphaltMaterial());
  lot.name = 'gas-station-forecourt';
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(0, 0.012, 8.35);
  lot.receiveShadow = !!quality.shadows;
  station.add(lot);

  for (const [id, minX, maxX, minZ, maxZ] of SOLIDS) {
    data.colliders.addHouse({
      id: 'gas-' + id,
      x: X + (minX + maxX) / 2,
      z: FRONT + (minZ + maxZ) / 2,
      width: maxX - minX,
      depth: maxZ - minZ
    });
  }

  // Glass front door (the model's own door is a fixed mesh).
  const doorWidth = DOOR.right - DOOR.left;
  const pivot = new THREE.Group();
  pivot.position.set(DOOR.right, 0.125, DOOR.z);
  pivot.rotation.y = Math.PI;
  const door = createHingedDoor({
    width: doorWidth, height: DOOR.height, glazed: true, color: 0x8c9594,
    shadows: quality.shadows, id: 'gas-station-entrance'
  });
  pivot.add(door);
  station.add(pivot);
  data.doors.push(door);
  const gate = data.colliders.addHouse({
    id: 'gas-doorway', x: X + (DOOR.left + DOOR.right) / 2, z: FRONT + DOOR.z, width: doorWidth, depth: 0.2
  });
  Object.defineProperty(gate, 'disabled', {
    get: () => door.userData.open || Math.abs(door.rotation.y) > 0.05
  });

  // Things to buy and the clerk job.
  const shop = getShop('gas-station');
  const spot = (id, x, y, z, prompt, interact, action = null, range = 1.6) => {
    const object = new THREE.Group();
    object.name = id;
    if (action) object.userData.action = action;
    object.position.set(x, y, z);
    object.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + prompt;
    object.userData.interact = interact;
    station.add(object);
    data.interactables.push({
      id, object, range,
      getPoint: () => ({ x: X + x, y, z: FRONT + z })
    });
  };
  const offer = (item) => shop.stock.find((o) => o.item === item);
  const buy = (id, item, x, y, z, action = 'grab') => {
    const o = offer(item);
    if (!o) return;
    spot(id, x, y, z, 'buy ' + o.name + ' ($' + o.price + ')', (ctx) => !!buyFromShop('gas-station', ctx, o), action);
  };
  buy('gas-coffee', 'coffee', -4.72, 1.55, 24.92, 'press');
  buy('gas-slushie', 'slushie', -4.68, 1.6, 26.48, 'press');
  buy('gas-snack', 'snack', 2.3, 1.05, 19.75);
  buy('gas-sandwich', 'sandwich', 2.3, 1.05, 22.95);
  buy('gas-can', 'gas-can', 5.35, 0.45, 18.1);
  station.add(gasCans(quality));

  // The pumps: park the car beside one, get out and press E to fill up.
  const PUMP_REACH = 4.4; // car centre to pump, metres
  const pumpSpot = (id, x, z) => {
    const object = new THREE.Group();
    object.name = id;
    object.userData.action = 'press';
    object.position.set(x, 1.2, z);
    const wx = X + x;
    const wz = FRONT + z;
    const carHere = () => {
      const car = data.car;
      return car && !car.isDriving() && car.isNear(wx, wz, PUMP_REACH) ? car : null;
    };
    object.userData.getPrompt = (mobile) => {
      const car = carHere();
      const lead = mobile ? 'Tap to ' : 'Press E to ';
      if (!car) return 'Park your pickup beside the pump to fill up ($' + FUEL.PRICE_PER_LITRE.toFixed(2) + '/L)';
      const space = car.fuel.space();
      if (space < 0.05) return 'The tank is full';
      return lead + 'fill up (' + Math.ceil(space) + ' L, about $' + Math.ceil(space * FUEL.PRICE_PER_LITRE) + ')';
    };
    object.userData.interact = (ctx) => {
      const car = carHere();
      const toast = typeof ctx.toast === 'function' ? ctx.toast : () => {};
      if (!car) { toast('Park your pickup beside the pump first.'); return false; }
      const money = ctx.money;
      if (!money) return false;
      const { litres, cost } = quoteFill(car.fuel.space(), money.get());
      if (car.fuel.space() < 0.05) { toast('The tank is already full.'); return false; }
      if (!cost) { toast('Not enough cash.'); return false; }
      if (!money.spend(cost, { category: 'Purchase', label: 'Gas · ' + shop.name })) return false;
      car.fuel.add(litres);
      ctx.sfx?.play?.('cash');
      const full = car.fuel.space() < 0.05;
      toast((full ? 'Filled up: ' : 'Put in ') + litres.toFixed(1) + ' L for $' + cost + (full ? '.' : ' (all your cash covers).'));
      return true;
    };
    station.add(object);
    data.interactables.push({ id, object, range: 1.6, getPoint: () => ({ x: wx, y: 1.2, z: wz }) });
  };
  pumpSpot('gas-pump-1', -5.73, 4.48);
  pumpSpot('gas-pump-2', -5.73, 8.82);
  pumpSpot('gas-pump-3', 4.36, 4.48);
  pumpSpot('gas-pump-4', 4.36, 8.82);
  const shift = getJob('station-clerk');
  spot('gas-register', -2.92, 1.25, 20.6, shift.verb + ' ($' + shift.pay + ')', (ctx) => ctx.work?.(shift.id) ?? false, 'press', 1.7);

  // Night lighting: canopy downlights and a store light.
  const lightPool = data && data.lightPool;
  const canopyLights = [];
  for (const z of [3.6, 9.6]) {
    if (lightPool) {
      canopyLights.push(lightPool.addSpot({
        x: X - 0.8, y: 6.3, z: FRONT + z,
        tx: X - 0.8, ty: 0, tz: FRONT + z,
        color: 0xfff3dc, intensity: 0, distance: 13, angle: Math.PI / 3.2, penumbra: 0.7, decay: 1.6
      }));
    } else {
      const light = new THREE.SpotLight(0xfff3dc, 0, 13, Math.PI / 3.2, 0.7, 1.6);
      light.position.set(-0.8, 6.3, z);
      light.target.position.set(-0.8, 0, z);
      station.add(light, light.target);
      canopyLights.push(light);
    }
  }
  let storeLight;
  if (lightPool) {
    storeLight = lightPool.addPoint({ x: X + 0.5, y: 3.5, z: FRONT + 23, color: 0xfff1dc, intensity: 20, distance: 14, decay: 2 });
  } else {
    storeLight = new THREE.PointLight(0xfff1dc, 20, 14, 2);
    storeLight.position.set(0.5, 3.5, 23);
    station.add(storeLight);
  }

  const glowing = [];
  const panes = [];

  // Forecourt realism: painted stalls/lanes, safety bollards, squeegee bins, and Air & Water unit.
  station.add(buildForecourtMarkings());
  for (const [bx, bz] of [[-5.88, 1.85], [-5.88, 11.55], [4.20, 1.85], [4.20, 11.55]]) {
    const b = buildBollard();
    b.position.set(bx, 0, bz);
    station.add(b);
  }
  for (const sx of [-5.74, 4.36]) {
    const bin = buildSqueegeeBin();
    bin.position.set(sx, 0, 6.65);
    station.add(bin);
  }
  const airWater = buildAirWaterStation(glowing);
  airWater.position.set(-6.45, 0, 15.85);
  station.add(airWater);
  spot('gas-air-water', -6.45, 1.15, 15.35, 'top off tire air (Free)', (ctx) => {
    ctx?.sfx?.play?.('vending');
    ctx?.toast?.('Tires topped off and ready for Maple Lane!');
    return 'press';
  }, 'press', 1.75);

  // Digital screens & grade buttons on all 4 fuel pumps + overhead Pump #1-#4 plaques on pillars.
  const regPrice = FUEL.PRICE_PER_LITRE.toFixed(2);
  const premPrice = (FUEL.PRICE_PER_LITRE + 0.35).toFixed(2);
  for (const [px, pz] of [[-5.735, 4.48], [-5.735, 8.825], [4.36, 4.48], [4.36, 8.825]]) {
    const detail = buildPumpDetail(regPrice, glowing);
    detail.position.set(px, 0, pz);
    station.add(detail);
  }
  for (const [num, px, pz] of [[1, -5.88, 2.60], [2, -5.88, 10.78], [3, 4.20, 2.60], [4, 4.20, 10.78]]) {
    const plaque = buildPumpNumberPlaque(num, glowing);
    plaque.position.set(px, 2.65, pz);
    station.add(plaque);
  }

  // Glowing roadside LED price totem, warm canopy accent trim, recessed downlights & asphalt pools.
  const priceTotem = buildPriceTotem(regPrice, premPrice, glowing);
  priceTotem.position.set(7.53, 2.9, 1.2);
  const canopyDown = buildCanopyDownlights(glowing);
  const slushieSteam = buildSlushieAndSteam();
  station.add(
    priceTotem,
    buildCanopyTrim(glowing),
    canopyDown.group,
    slushieSteam.group,
    buildStorefrontProps(glowing),
    buildStoreInteriorDetails(glowing)
  );

  // Cozy store interior details: coffee bar header sign, entrance welcome mat, and neon OPEN window sign.
  const { mesh: coffeeSign, mat: coffeeSignMat } = canvasSign(1.45, 0.34, (ctx, w, h) => {
    ctx.fillStyle = '#2d1c12';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#fff5e0';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRESH COFFEE & SLUSHIES', w / 2, h / 2);
  }, { emissiveIntensity: 0.55 });
  glowing.push({ material: coffeeSignMat, nightGlow: 0.95, dayGlow: 0.45 });
  coffeeSign.position.set(-4.52, 2.55, 25.8);
  coffeeSign.rotation.y = Math.PI / 2;
  station.add(coffeeSign);

  const welcomeMat = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.018, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.95 })
  );
  welcomeMat.position.set(-1.08, 0.135, 17.68);
  station.add(welcomeMat);

  const { mesh: openNeon, mat: openNeonMat } = canvasSign(0.74, 0.32, (ctx, w, h) => {
    ctx.fillStyle = '#11151c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#ff4d5a';
    ctx.font = 'bold 110px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPEN', w / 2, h / 2 + 4);
  }, { emissiveIntensity: 0.75 });
  glowing.push({ material: openNeonMat, nightGlow: 1.5, dayGlow: 0.55 });
  openNeon.position.set(1.55, 2.05, 16.56);
  openNeon.rotation.y = Math.PI;
  station.add(openNeon);

  let animTime = 0;
  station.userData.update = (delta) => {
    animTime += delta;
    for (let i = 0; i < slushieSteam.paddles.length; i++) {
      slushieSteam.paddles[i].rotation.y = animTime * (i % 2 === 0 ? 1.4 : -1.2);
    }
    for (const p of slushieSteam.puffs) {
      const t = (animTime * 0.48 + p.phase) % 1;
      p.mesh.position.set(-4.52 + Math.sin(animTime * 1.6 + p.phase) * 0.03, 1.62 + t * 0.32, p.baseZ);
      p.mesh.scale.setScalar(0.6 + t * 0.9);
      p.mat.opacity = Math.sin(t * Math.PI) * 0.22;
    }
  };

  let lastMinutes = 600;
  station.userData.updateLighting = (minutes) => {
    if (Number.isFinite(minutes)) lastMinutes = minutes;
    const dusk = THREE.MathUtils.smoothstep(lastMinutes, 1080, 1200);
    const dawn = 1 - THREE.MathUtils.smoothstep(lastMinutes, 330, 450);
    const night = Math.max(dusk, dawn);
    for (const light of canopyLights) light.intensity = night * 150;
    for (const p of canopyDown.pools) {
      p.mat.opacity = night * 0.28;
      p.mesh.visible = night > 0.01;
    }
    storeLight.intensity = 20 + night * 12;
    for (const pane of panes) pane.emissiveIntensity = night * 0.45;
    for (const { material, nightGlow, dayGlow } of glowing) {
      material.emissiveIntensity = THREE.MathUtils.lerp(dayGlow, nightGlow, night);
    }
  };

  // The car may leave the street onto the forecourt (up to the store front).
  // The area reaches down over the road so turning in and out is smooth.
  (data.driveAreas ??= []).push({ id: 'gas-forecourt', minX: X - 8.45, maxX: X + 8.45, minZ: FRONT - 9, maxZ: FRONT + 16.55 });

  const footprint = { id: 'gas-station', minX: X - 5.9, maxX: X + 7.72, minZ: FRONT + 16.6, maxZ: FRONT + 32.2 };
  (data.mapBuildings ??= []).push(footprint);
  (data.indoorZones ??= []).push({
    id: 'gas-station', minX: X + STORE.minX, maxX: X + STORE.maxX, minZ: FRONT + STORE.front, maxZ: FRONT + STORE.back
  });
  // Rain stays off the pumps under the canopy too.
  data.indoorZones.push({ id: 'gas-canopy', minX: X - 8.4, maxX: X + 7.2, minZ: FRONT, maxZ: FRONT + 13.4 });

  loadGltf(URL, ({ scene: model }) => {
    model.rotation.y = Math.PI;
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = !!quality.shadows;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (material.map) material.map.anisotropy = 8;
        if (material.name === 'Glass') {
          material.transparent = true;
          material.opacity = 0.22;
          material.color.set(0xa9c7cb);
          material.roughness = 0.08;
          material.metalness = 0.1;
          material.depthWrite = false;
          material.emissive.set(0xffdcaa);
          if (!panes.includes(material)) panes.push(material);
          mesh.castShadow = false;
        } else if (material.name === 'Fuel_pump') {
          material.roughness = 0.25;
          material.metalness = 0.55;
          if ('envMapIntensity' in material) material.envMapIntensity = 1.15;
        } else if (/^Metal($|_01|_02|_03|Plates$)/.test(material.name)) {
          material.roughness = 0.26;
          material.metalness = 0.72;
          if ('envMapIntensity' in material) material.envMapIntensity = 1.15;
        } else if (/^(Coffee_machine|ice_slush_machine|ICE)$/.test(material.name)) {
          material.roughness = 0.22;
          material.metalness = 0.45;
        } else if (/^(Refrigerador|Fridge)/.test(material.name)) {
          material.roughness = 0.22;
          material.metalness = 0.42;
          if (material.map) material.emissiveMap = material.map;
          material.emissive.set(0xd8f0ff);
          material.emissiveIntensity = 0.32;
        } else if (/^(Tiles|Marble)$/.test(material.name)) {
          material.roughness = 0.30;
          material.metalness = 0.06;
        }
        const glow = GLOW[material.name];
        if (glow && !glowing.some((g) => g.material === material)) {
          if (!material.emissiveMap && material.map) material.emissiveMap = material.map;
          material.emissive.set(0xffffff);
          glowing.push({ material, nightGlow: glow[0], dayGlow: glow[1] });
        }
      }
    });
    station.add(model);
    station.userData.updateLighting(lastMinutes);
  }, (error) => console.warn('Gas station failed to load', error));
}
