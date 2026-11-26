/**
 * Low-poly sidewalk vending machine. Sits on the south sidewalk west of
 * the main-house door path, opposite the mailbox, clear of the porch and
 * the parked car. The front panel uses an unlit (emissive) material so it
 * stays visible at night.
 */

import * as THREE from 'three';
import { DEFAULT_SHOP, shopPrompt } from '../data/shops.js';
import { buyFromShop, resolveShop } from '../systems/shop.js';

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

  const bodyMat = mat(0x9a2430, shadows, { roughness: 0.55, metalness: 0.2 });
  const darkMat = mat(0x1a1a1e, shadows, { roughness: 0.45, metalness: 0.3 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7ee7ff });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x9af3c8 });
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });

  const body = mesh(new THREE.BoxGeometry(w, h, d), bodyMat, 'vending-body', shadows);
  body.position.y = h / 2;
  group.add(body);

  // Unlit front panel + a warm sign band, set just in front of the body.
  const frontZ = d / 2 + 0.012;
  const panel = mesh(new THREE.BoxGeometry(w * 0.72, h * 0.42, 0.02), glowMat, 'vending-panel', shadows, { cast: false, receive: false });
  panel.position.set(0, h * 0.58, frontZ);
  group.add(panel);

  const winW = w * 0.22, winH = h * 0.14;
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pane = mesh(new THREE.BoxGeometry(winW, winH, 0.018), windowMat, 'vending-window', shadows, { cast: false, receive: false });
    pane.position.set(sx * w * 0.2, h * 0.58 + sy * h * 0.11, frontZ + 0.004);
    group.add(pane);
  }

  const sign = mesh(new THREE.BoxGeometry(w * 0.82, 0.12, 0.03), signMat, 'vending-sign', shadows, { cast: false, receive: false });
  sign.position.set(0, h - 0.14, frontZ);
  group.add(sign);

  const kick = mesh(new THREE.BoxGeometry(w * 0.96, 0.16, 0.04), darkMat, 'vending-kick', shadows);
  kick.position.set(0, 0.08, frontZ);
  group.add(kick);

  // Coin slot / button strip
  const tray = mesh(new THREE.BoxGeometry(w * 0.22, 0.18, 0.06), darkMat, 'vending-tray', shadows);
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
