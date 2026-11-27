import * as THREE from 'three';
import { Parts } from './parts.js';
import { contactMaterial, createContactShadows } from './contact.js';
import { getShop } from '../data/shops.js';
import { getJob } from '../data/jobs.js';
import { buyFromShop } from '../systems/shop.js';

import { NORTH_FRONTAGE_OFFSET } from './street.js';

const SHOP_X = 20.2;
const FRONT_Z = 2.8 + NORTH_FRONTAGE_OFFSET;
const WIDTH = 5.2;
const DEPTH = 3.5;
const HEIGHT = 2.9;

function registerSpot(scene, shop, { id, x, z, prompt, interact, action = null }) {
  const object = new THREE.Group();
  object.name = id;
  if (action) object.userData.action = action;
  object.position.set(x, 1.3, z);
  object.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + prompt;
  object.userData.interact = interact;
  shop.add(object);
  scene.userData.interactables.push({
    id,
    object,
    range: 1.05,
    getPoint: () => ({ x: SHOP_X + x, y: 1.3, z: FRONT_Z + z })
  });
}

function sign() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#26382f';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#eed6a6';
  ctx.fillRect(8, 8, 496, 3);
  ctx.fillRect(8, 85, 496, 3);
  ctx.font = 'bold 43px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAPLE LANE MARKET', 256, 48, 474);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 0.71),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  mesh.position.set(0, 2.78, -0.24);
  mesh.rotation.y = Math.PI;
  return mesh;
}

export function buildCornerShop(scene, quality) {
  const shop = new THREE.Group();
  shop.name = 'corner-shop';
  shop.position.set(SHOP_X, 0, FRONT_Z);
  scene.add(shop);
  scene.userData.cornerShop = shop;

  const shell = new Parts(true);
  const walls = 0xa18b70;
  const trim = 0x343e36;
  const wall = (id, color, x, y, z, w, h, d) => {
    shell.box(color, w, h, d, x, y, z);
    scene.userData.colliders.addHouse({
      id: 'market-' + id,
      x: SHOP_X + x,
      z: FRONT_Z + z,
      width: w,
      depth: d
    });
  };
  wall('left', walls, -WIDTH / 2, HEIGHT / 2, DEPTH / 2, 0.18, HEIGHT, DEPTH);
  wall('right', walls, WIDTH / 2, HEIGHT / 2, DEPTH / 2, 0.18, HEIGHT, DEPTH);
  wall('back', walls, 0, HEIGHT / 2, DEPTH, WIDTH, HEIGHT, 0.18);
  // Two solid front piers leave an opening a metre and a half wide.
  for (const side of [-1, 1]) {
    wall('front-' + side, walls, side * 1.68, HEIGHT / 2, 0, 1.86, HEIGHT, 0.18);
    const x = side * 1.68;
    for (const edge of [-1, 1]) {
      shell.box(trim, 0.075, 1.10, 0.14, x + edge * 0.58, 1.48, -0.16);
      shell.box(trim, 1.23, 0.073, 0.14, x, 1.48 + edge * 0.56, -0.16);
    }
    shell.box(trim, 0.034, 1.07, 0.085, x, 1.48, -0.17);
    shell.box(0x737468, 1.35, 0.08, 0.22, x, 0.88, -0.16);
    shell.box(0x58544d, 1.86, 0.56, 0.035, x, 0.28, -0.107);
    for (let row = 0; row < 5; row++) {
      const left = x - 0.91;
      const right = x + 0.91;
      for (let offset = left - (row % 2) * 0.155; offset < right; offset += 0.31) {
        const start = Math.max(left, offset);
        const end = Math.min(right, offset + 0.30);
        if (end <= start) continue;
        const shades = [0x815249, 0x956459, 0x8c5b50, 0x9c7165];
        const color = shades[(row + Math.floor((offset - left + 0.16) / 0.31) * 3) % shades.length];
        shell.box(color, end - start, 0.096, 0.036, (start + end) / 2, 0.056 + row * 0.108, -0.135);
      }
    }
  }
  for (const side of [-1, 1]) shell.box(trim, 0.075, 2.20, 0.13, side * 0.77, 1.10, -0.14);
  shell.box(0x817d71, 1.49, 0.027, 0.22, 0, 0.038, -0.12);
  shell.box(trim, 1.5, 0.61, 0.16, 0, 2.595, 0);
  shell.box(trim, WIDTH + 0.3, 0.18, DEPTH + 0.35, 0, 2.98, DEPTH / 2);
  shell.box(0x51765d, WIDTH + 0.03, 0.15, 0.46, 0, 2.33, -0.24);
  shell.box(0xc6bda9, WIDTH, 0.035, DEPTH, 0, 0.0175, DEPTH / 2);
  shell.box(0xa9a398, 1.56, 0.028, 0.62, 0, 0.014, -0.31);

  const shelfColors = [0xa74b44, 0xc58b45, 0xd1b989];
  const market = getShop('corner-shop');
  market.stock.forEach((offer, i) => {
    const x = (i - 1) * 1.27;
    wall('shelf-' + i, 0x594839, x, 0.6, 3.11, 1.08, 1.2, 0.57);
    shell.box(0xb19a7e, 1.12, 0.06, 0.62, x, 1.22, 3.08);
    for (const offset of [-0.28, 0, 0.28]) {
      shell.box(shelfColors[i], 0.19, 0.20, 0.22, x + offset, 1.35, 3.01);
    }
    registerSpot(scene, shop, {
      id: 'market-' + offer.item, x, z: 2.57,
      prompt: 'buy ' + offer.name + ' ($' + offer.price + ')',
      action: 'grab',
      interact: (ctx) => !!buyFromShop(market, ctx, offer)
    });
  });

  wall('stock-crate', 0x977448, 1.93, 0.36, 1.15, 0.75, 0.72, 0.83);
  shell.box(0xbe9c6f, 0.79, 0.05, 0.86, 1.93, 0.74, 1.15);
  const shift = getJob('restock');
  registerSpot(scene, shop, {
    id: 'market-restock', x: 1.39, z: 1.15,
    prompt: 'restock shelves ($' + shift.pay + ')',
    interact: (ctx) => ctx.work?.(shift.id) ?? false
  });

  const mesh = new THREE.Mesh(
    shell.merge(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })
  );
  mesh.receiveShadow = !!quality.shadows;
  shop.add(mesh, sign());
  const light = new THREE.PointLight(0xffddae, 11, 7);
  light.position.set(0, 2.25, DEPTH / 2);
  shop.add(light);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x536e71, roughness: 0.43, emissive: 0xffce8b, emissiveIntensity: 0
  });
  const pane = new THREE.PlaneGeometry(1.15, 1.06);
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(pane, windowMaterial);
    window.position.set(side * 1.68, 1.48, -0.106);
    window.rotation.y = Math.PI;
    shop.add(window);
  }
  shop.add(createContactShadows([
    { kind: 'rect', x: -1.68, z: -0.12, w: 1.83, d: 0.17, margin: 0.20, strength: 0.58 },
    { kind: 'rect', x: 1.68, z: -0.12, w: 1.83, d: 0.17, margin: 0.20, strength: 0.58 }
  ], quality));
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: 0xe9a971, alphaMap: contactMaterial().alphaMap, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.8), poolMaterial);
  pool.position.set(0, 0.118, -0.78);
  pool.rotation.x = -Math.PI / 2;
  pool.visible = false;
  shop.add(pool);
  shop.userData.updateFrontage = minutes => {
    const evening = THREE.MathUtils.smoothstep(minutes, 18 * 60, 19.5 * 60);
    const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 5.5 * 60, 7 * 60);
    const night = Math.min(1, evening + dawn);
    windowMaterial.emissiveIntensity = 0.37 * night;
    light.intensity = 11 + 2 * night;
    poolMaterial.opacity = 0.23 * night;
    pool.visible = night > 0;
  };
}
