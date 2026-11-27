import * as THREE from 'three';
import { AISLE_STOCK, buildMarketStock } from './marketStock.js';
import { Parts } from './parts.js';
import { contactMaterial, createContactShadows } from './contact.js';
import { getShop } from '../data/shops.js';
import { getJob } from '../data/jobs.js';
import { buyFromShop } from '../systems/shop.js';

import { NORTH_FRONTAGE_OFFSET } from './street.js';

const SHOP_X = 33;
const FRONT_Z = 2.8 + NORTH_FRONTAGE_OFFSET;
const WIDTH = 20;
const DEPTH = 16;
const HEIGHT = 4.2;

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
    new THREE.PlaneGeometry(7.0, 1.02),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  mesh.position.set(0, 3.57, -0.19);
  mesh.rotation.y = Math.PI;
  return mesh;
}

export function buildCornerShop(scene, quality) {
  const data = scene.userData;
  const shop = new THREE.Group();
  shop.name = 'corner-shop';
  shop.position.set(SHOP_X, 0, FRONT_Z);
  scene.add(shop);
  data.cornerShop = shop;
  const half = WIDTH / 2;
  const backRoom = 12.8;
  const opening = 1.65;
  const wallColor = 0xb8ab96;
  const trim = 0x34433d;
  const shell = new Parts(true);
  const stockDisplay = [];
  function solid(id, x, z, w, d) {
    data.colliders.addHouse({ id: 'market-' + id, x: SHOP_X + x, z: FRONT_Z + z, width: w, depth: d });
  }
  function box(id, color, x, z, w, h, d, y = h / 2) {
    shell.box(color, w, h, d, x, y, z);
    if (id) solid(id, x, z, w, d);
  }
  (data.mapBuildings ??= []).push({
    id: 'corner-market', minX: SHOP_X - half, maxX: SHOP_X + half,
    minZ: FRONT_Z - 0.16, maxZ: FRONT_Z + DEPTH
  });
  (data.indoorZones ??= []).push({
    id: 'corner-market', minX: SHOP_X - half + 0.15, maxX: SHOP_X + half - 0.15,
    minZ: FRONT_Z + 0.05, maxZ: FRONT_Z + DEPTH - 0.15
  });

  for (const side of [-1, 1]) box('side-' + side, wallColor, side * half, DEPTH / 2, 0.20, HEIGHT, DEPTH);
  box('back', wallColor, 0, DEPTH, WIDTH, HEIGHT, 0.20);
  box(null, 0xc9c1af, 0, DEPTH / 2, WIDTH, 0.036, DEPTH);
  box(null, 0x49554c, 0, DEPTH / 2, WIDTH + 0.35, 0.25, DEPTH + 0.33, HEIGHT);
  box(null, trim, 0, 0, WIDTH, 1.23, 0.20, HEIGHT - 0.615);
  box(null, 0x667b68, 0, -0.48, 6.2, 0.14, 1.02, 3.03);
  box(null, 0xa49d90, 0, -0.23, 3.28, 0.05, 0.52);

  const windowWidth = half - opening;
  for (const side of [-1, 1]) {
    const x = side * (opening + windowWidth / 2);
    box('front-' + side, 0x706357, x, 0, windowWidth, 0.75, 0.19);
    box(null, trim, x, 0, windowWidth, 0.09, 0.24, 2.93);
    for (let bay = 0; bay <= 4; bay++) {
      box(null, trim, side * (opening + windowWidth * bay / 4), 0, 0.10, 2.25, 0.20, 1.83);
    }
    shell.bevelMax = 0;
    for (let row = 0; row < 5; row++) {
      const left = x - windowWidth / 2;
      const right = x + windowWidth / 2;
      const shades = [0xa06c58, 0x8f594b, 0x96604e];
      for (let i = 0, start = left - (row % 2) * 0.17; start < right; i++, start += 0.34) {
        const a = Math.max(left, start);
        const b = Math.min(right, start + 0.326);
        if (b - a > 0.002) box(null, shades[(i * 2 + row) % 3], (a + b) / 2, -0.104, b - a, 0.133, 0.028, 0.078 + row * 0.15);
      }
    }
    shell.bevelMax = null;
  }

  shell.bevelMax = 0;
  // Checkout fixtures are beside the entrance, with a clear central entrance lane.
  for (const [i, x] of [5.6, 8.0].entries()) {
    box('checkout-' + i, 0x78817b, x, 2.0, 0.76, 0.91, 2.25);
    box(null, 0x303732, x, 2.10, 0.72, 0.057, 1.38, 0.95);
    box(null, 0x252d2b, x + 0.07, 2.79, 0.33, 0.26, 0.15, 1.10);
  }
  for (const [i, x] of [-7.25, -4.75].entries()) {
    box('produce-' + i, 0x654b33, x, 2.3, 1.65, 0.77, 1.1);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        stockDisplay.push({sku: ['apples','pears','oranges'][(i + row) % 3],
          x: x - 0.66 + col*0.184, y: 0.78, z: 1.99 + 0.29*row});
      }
    }
  }

  // Four double-sided shelf rows with cross-aisles at both ends.
  const aisleXs = [-6.6, -2.9, 0.9, 4.7];

  for (const [aisle, x] of aisleXs.entries()) {
    box('aisle-' + aisle, 0x74786e, x, 7.0, 0.12, 1.64, 5.8);
    box(null, 0x50574f, x, 7.0, 1.04, 0.15, 5.8);
    for (const z of [4.14, 5.56, 7.0, 8.44, 9.86]) {
      box(null, 0x555e58, x, z, 0.20, 1.66, 0.055);
    }
    // Extend collision to the edges of the shelf decks.
    solid('aisle-decks-' + aisle, x, 7.0, 1.04, 5.8);
    for (const [level,y] of [0.30, 0.72, 1.14, 1.56].entries()) {
      shell.bevelMax = 0.008;
      box(null, 0xc2c4ba, x, 7.0, 1.04, 0.064, 5.8, y);
      shell.bevelMax = 0;
      for (const side of [-1, 1]) {
        box(null, 0x54645b, x + side * 0.509, 7.0, 0.022, 0.041, 5.77, y - 0.011);
        for (const z of [4.50, 6.37, 8.24]) {
          box(null, 0xe8e1ca, x + side * 0.522, z, 0.004, 0.024, 0.12, y - 0.01);
        }
        for (let j = 0; j < 21; j++) {
          if ((j + 3*level + aisle) % 19 === 0) continue;
          const sku = AISLE_STOCK[aisle][(Math.floor(j/7)+level+(side>0?1:0))%3];
          for (const depth of [0.30,0.47]) stockDisplay.push({
            sku, x:x+side*depth, y:y+0.033, z:4.31+j*0.267, yaw:side*Math.PI/2
          });
        }
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const z = 4.9 + i * 1.48;
    solid('cooler-' + i, 9.42, z, 0.92, 1.4);
    box(null, 0x637271, 9.85, z, 0.10, 2.17, 1.4);
    box(null, 0x50605f, 9.40, z, 0.91, 0.26, 1.40);
    box(null, 0x81918d, 9.39, z, 0.91, 0.12, 1.40, 2.12);
    for (const side of [-1,1]) box(null, 0x70807a, 9.42, z+side*0.67, 0.92, 1.95, 0.067, 1.16);
    for (const [tier,y] of [0.31,0.70,1.10,1.50].entries()) {
      box(null, 0xd6d7cc, 9.38, z, 0.83, 0.038, 1.29,y);
      for(let j=0;j<5;j++) stockDisplay.push({
        sku:['milk','yogurt','sandwich','juice'][(i+tier)%4],
        x:9.10,y:y+0.021,z:z-0.47+j*0.234,yaw:-Math.PI/2
      });
    }
    box(null, 0xc1cbc7, 8.895, z - 0.4, 0.09, 0.35, 0.04, 1.18);
  }

  // Leave an open service passage into the rear stockroom.
  box('stock-wall-west', 0xb1aa9c, -3.9, backRoom, 12.2, 3.1, 0.18);
  box('stock-wall-east', 0xb1aa9c, 7.0, backRoom, 6.0, 3.1, 0.18);
  for (const [i, x] of [-5.5, -3.2, 6.6].entries()) {
    box('stock-pallet-' + i, 0x72543a, x, 15.0, 1.15, 0.14, 1.0);
    box(null, 0xaa8460, x, 15.0, 0.95, 0.87, 0.91, 0.57);
  }

  // Existing offers, prices and restock job use their normal interactions.
  getShop('corner-shop').stock.forEach((offer, i) => {
    const stand = [{ x: -7.25, z: 3.24 }, { x: -1.95, z: 6.85 }, { x: 8.58, z: 7.86 }][i]
      ?? { x: 6.0, z: 10.4 + i * 0.1 };
    registerSpot(scene, shop, {
      id: 'market-' + offer.item, ...stand,
      prompt: 'buy ' + offer.name + ' ($' + offer.price + ')', action: 'grab',
      interact: ctx => !!buyFromShop('corner-shop', ctx, offer)
    });
  });
  const shift = getJob('restock');
  registerSpot(scene, shop, {
    id: 'market-restock', x: 3.15, z: 14.25,
    prompt: 'restock shelves ($' + shift.pay + ')',
    interact: ctx => ctx.work?.(shift.id) ?? false
  });

  const mesh = new THREE.Mesh(shell.merge(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.89 }));
  mesh.castShadow = mesh.receiveShadow = !!quality.shadows;
  shop.add(mesh, sign());
  buildMarketStock(shop, stockDisplay, quality);
  const glazing = new THREE.MeshStandardMaterial({
    color: 0x91adae, transparent: true, opacity: 0.29, depthWrite: false,
    side: THREE.DoubleSide, roughness: 0.43, emissive: 0xffcd95, emissiveIntensity: 0
  });
  const pane = new THREE.PlaneGeometry(windowWidth, 2.16);
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(pane, glazing);
    window.position.set(side * (opening + windowWidth / 2), 1.84, -0.021);
    shop.add(window);
  }
  const lights = [];
  const lightPool = data && data.lightPool;
  const fittings = new Parts(true);
  const fixtureMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  for (const z of [2.5, 7.4, 11.1, 14.2]) {
    fittings.box(0xeae7d3, 11.8, 0.038, 0.18, 0, 3.86, z);
    if (lightPool) {
      lights.push(lightPool.addPoint({ x: SHOP_X, y: 3.48, z: FRONT_Z + z, color: 0xffe7c4, intensity: 20, distance: 10, decay: 2 }));
    } else {
      const lamp = new THREE.PointLight(0xffe7c4, 20, 10, 2);
      lamp.position.set(0, 3.48, z);
      lights.push(lamp);
      shop.add(lamp);
    }
  }
  shop.add(new THREE.Mesh(fittings.merge(), fixtureMaterial));
  shop.add(createContactShadows([
    { kind: 'rect', x: -5.8, z: -0.09, w: 7.8, d: 0.17, margin: 0.26, strength: 0.58 },
    { kind: 'rect', x: 5.8, z: -0.09, w: 7.8, d: 0.17, margin: 0.26, strength: 0.58 }
  ], quality));
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: 0xe9a971, alphaMap: contactMaterial().alphaMap, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.65), poolMaterial);
  pool.position.set(0, 0.118, -0.92);
  pool.rotation.x = -Math.PI / 2;
  pool.visible = false;
  shop.add(pool);
  shop.userData.updateFrontage = minutes => {
    const evening = THREE.MathUtils.smoothstep(minutes, 18 * 60, 19.5 * 60);
    const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 5.5 * 60, 7 * 60);
    const night = Math.min(1, evening + dawn);
    glazing.emissiveIntensity = 0.32 * night;
    for (const lamp of lights) lamp.intensity = 20 + 6 * night;
    poolMaterial.opacity = 0.23 * night;
    pool.visible = night > 0;
  };
}
