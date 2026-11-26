import * as THREE from 'three';
import { Parts } from './parts.js';
import { getShop } from '../data/shops.js';
import { getJob } from '../data/jobs.js';
import { buyFromShop } from '../systems/shop.js';

import { NORTH_FRONTAGE_OFFSET } from './street.js';

const SHOP_X = 20.2;
const FRONT_Z = 2.8 + NORTH_FRONTAGE_OFFSET;
const WIDTH = 5.2;
const DEPTH = 3.5;
const HEIGHT = 2.9;

function registerSpot(scene, shop, { id, x, z, prompt, interact }) {
  const object = new THREE.Group();
  object.name = id;
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
    shell.box(trim, 1.28, 1.21, 0.06, side * 1.7, 1.48, -0.11);
    shell.box(0x606b64, 1.13, 1.05, 0.02, side * 1.7, 1.48, -0.15);
    shell.box(trim, 1.35, 0.08, 0.17, side * 1.7, 0.90, -0.14);
  }
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
}
