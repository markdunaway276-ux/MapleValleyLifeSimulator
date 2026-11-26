/**
 * Low-poly sidewalk vending machine. Sits on the south sidewalk west of
 * the main-house door path, opposite the mailbox, clear of the porch and
 * the parked car. The front panel uses an unlit (emissive) material so it
 * stays visible at night.
 */

import * as THREE from 'three';
import { DEFAULT_SHOP, shopPrompt } from '../data/shops.js';
import { buyFromShop, resolveShop } from '../systems/shop.js';
import { DETAIL, PROPS } from './palette.js';
import { bevelBox } from './shapes.js';
import { Parts } from './parts.js';
import { createVertexMaterial } from './surfaces.js';

/**
 * Same sidewalk as the mailbox (z ≈ -4.4), but west of the front-door path.
 * South face lines up with the mailbox so the porch walking gap stays ≥ 0.9 m.
 */
export const VENDING_SPAWN = { x: -2, z: -4.29 };
export const VENDING_SIZE = { width: 0.7, depth: 0.52, height: 1.82 };

const _tmp = new THREE.Vector3();

function mat(color, shadows, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.7,
    metalness: extras.metalness ?? 0.15,
    ...extras
  });
}

function mesh(geo, material, name, shadows, { cast = shadows, receive = shadows } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = !!cast;
  m.receiveShadow = !!receive;
  return m;
}

/**
 * The vending cabinet shell (centred): the rounded body plus a coin slot with
 * a brass bezel, a row of selection buttons, a delivery flap and a darker top
 * cap, merged into one vertex-coloured geometry. The foot is darkened by baked AO.
 */
function vendingBodyGeometry(w, h, d) {
  const p = new Parts(true);
  // The shell is a hair shallower than the cabinet; the lugs on the front and
  // the vent on the back make up the difference, so the body still measures
  // exactly VENDING_SIZE (its collider) from front to back.
  const lug = 0.012;
  const sd = d - lug * 2;
  const fz = sd / 2;
  const y0 = -h / 2;
  p.bevelMax = 0.05;
  p.bevelSegments = 2;
  p.surface('appliance');
  p.box(PROPS.vendingBody, w, h, sd, 0, 0, 0);
  p.bevelMax = 0;
  p.box(PROPS.vendingDark, w * 0.98, 0.06, sd * 0.98, 0, h / 2 - 0.03, 0);
  p.surface('metal');
  p.box(DETAIL.brass, 0.085, 0.15, lug, -w * 0.22, y0 + 0.47, fz + lug / 2);
  p.box(DETAIL.iron, 0.012, 0.09, lug, -w * 0.22, y0 + 0.47, fz + lug / 2);
  p.box(DETAIL.iron, w * 0.46, 0.15, lug, -w * 0.12, y0 + 0.24, fz + lug / 2);
  p.box(DETAIL.brass, w * 0.46 + 0.02, 0.012, lug, -w * 0.12, y0 + 0.24 + 0.081, fz + lug / 2);
  p.surface('paint');
  [0xe6e0d0, 0xe6e0d0, 0xc23a32].forEach((c, i) => {
    p.box(c, 0.045, 0.045, lug, w * 0.22 + (i - 1) * 0.065, y0 + 0.62, fz + lug / 2);
  });
  // Rear vent plate.
  p.surface('metal');
  p.box(PROPS.vendingDark, w * 0.5, 0.4, lug, 0, y0 + 0.5, -fz - lug / 2);
  return p.merge();
}

/**
 * A simple vending cabinet facing +z (toward the street). Interacting buys
 * the shop's first stock item (a Snack for $5 by default).
 */
export function createVendingMachine({ shadows = false, shop = DEFAULT_SHOP } = {}) {
  const group = new THREE.Group();
  group.name = 'vending';
  const def = resolveShop(shop);
  const w = VENDING_SIZE.width;
  const d = VENDING_SIZE.depth;
  const h = VENDING_SIZE.height;

  const bodyMat = createVertexMaterial({ metalness: 0.3 });
  const darkMat = mat(PROPS.vendingDark, shadows, { roughness: 0.4, metalness: 0.3 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7ee7ff });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x9af3c8 });
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });

  const body = mesh(vendingBodyGeometry(w, h, d), bodyMat, 'vending-body', shadows);
  body.position.y = h / 2;
  group.add(body);

  // Unlit front panel + a warm sign band, set just in front of the body.
  const frontZ = d / 2 + 0.012;
  const panel = mesh(bevelBox(w * 0.72, h * 0.42, 0.02, { max: 0.006 }), glowMat, 'vending-panel', shadows, { cast: false, receive: false });
  panel.position.set(0, h * 0.58, frontZ);
  group.add(panel);

  const winW = w * 0.22, winH = h * 0.14;
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pane = mesh(bevelBox(winW, winH, 0.018, { max: 0.006 }), windowMat, 'vending-window', shadows, { cast: false, receive: false });
    pane.position.set(sx * w * 0.2, h * 0.58 + sy * h * 0.11, frontZ + 0.004);
    group.add(pane);
  }

  const sign = mesh(bevelBox(w * 0.82, 0.12, 0.03, { max: 0.01 }), signMat, 'vending-sign', shadows, { cast: false, receive: false });
  sign.position.set(0, h - 0.14, frontZ);
  group.add(sign);

  const kick = mesh(bevelBox(w * 0.96, 0.16, 0.04, { max: 0.012 }), darkMat, 'vending-kick', shadows);
  kick.position.set(0, 0.08, frontZ);
  group.add(kick);

  // Coin slot / button strip
  const tray = mesh(bevelBox(w * 0.22, 0.18, 0.06, { max: 0.015 }), darkMat, 'vending-tray', shadows);
  tray.position.set(w * 0.22, 0.42, frontZ + 0.01);
  group.add(tray);

  group.userData.kind = 'vending';
  group.userData.id = (def && def.id) || 'vending';
  group.userData.isVending = true;
  group.userData.shop = def;
  group.userData.highlightMesh = body;
  group.userData.interactLocal = new THREE.Vector3(0, 1.05, d / 2 + 0.04);
  group.userData.getPrompt = (isMobile) => shopPrompt(group.userData.shop || def, isMobile);
  group.userData.interact = (ctx = {}) => buyFromShop(group.userData.shop || def, ctx);
  return group;
}

export function vendingCollider(machine) {
  machine.updateMatrixWorld(true);
  machine.getWorldPosition(_tmp);
  return {
    id: 'vending',
    x: _tmp.x,
    z: _tmp.z,
    width: VENDING_SIZE.width,
    depth: VENDING_SIZE.depth,
    rotY: machine.rotation.y
  };
}
