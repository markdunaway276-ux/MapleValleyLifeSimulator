import * as THREE from 'three';
import { PRODUCT_TYPES } from './market/product-list.js';
import { createShelfPackaging } from './market/shelf-packaging.js';
import { createDairyPackaging } from './market/dairy-visuals.js';
import { createVegetables, VEGETABLES } from './market/produce-visuals.js';
import { createRetailBox } from './market/retail-packaging.js';

// Night Stock products (the user's grocery game) stocked on Maple Lane Market's
// shelves. Each placement names a shelf section; the section picks one of its
// products for every run of three facings, so shelves read as real product blocks.
const SECTIONS = {
  cereal: ['Oat cereal', 'Honey cereal', 'Granola', 'Baby cereal'],
  baking: ['Flour', 'Sugar', 'Cake mix', 'Olive oil'],
  pasta: ['Penne pasta', 'Mac & cheese', 'Long grain rice', 'Jasmine rice'],
  cans: ['Sweet corn', 'Green peas', 'Tomato soup', 'Black beans'],
  sauces: ['Pasta sauce', 'Curry sauce', 'Tomato ketchup', 'Mustard'],
  snacks: ['Potato chips', 'Tortillas', 'Pet treats'],
  crackers: ['Crackers', 'Cookies'],
  drinks: ['Orange juice', 'Apple juice', 'Spring water', 'Sparkling water'],
  household: ['Dish soap', 'All purpose cleaner', 'Laundry detergent', 'Fabric softener', 'Paper towels', 'Tissues'],
  care: ['Shampoo', 'Body wash', 'Toothpaste', 'Baby wipes'],
  pet: ['Cat food', 'Dog food', 'Pet treats'],
  // Cooler and produce SKUs used by cornerShop.js.
  milk: ['Milk'],
  yogurt: ['Yogurt', 'Butter'],
  sandwich: ['Cheddar', 'Butter'],
  juice: ['Orange juice', 'Apple juice'],
  apples: ['Apples'],
  pears: ['Tomatoes', 'Red peppers', 'Yellow peppers'],
  oranges: ['Lettuce', 'Broccoli', 'Cucumbers', 'Carrots', 'Eggplant']
};

/** Three sections per aisle (indexed by cornerShop.js). */
export const AISLE_STOCK = [
  ['cereal', 'baking', 'pasta'],
  ['cans', 'sauces', 'pasta'],
  ['snacks', 'crackers', 'drinks'],
  ['household', 'care', 'pet']
];

const CARTONS = new Set(['Penne pasta', 'Mac & cheese', 'Oat cereal', 'Honey cereal', 'Cake mix', 'Crackers', 'Cookies', 'Baby cereal']);
const COOLER = new Set(['milk', 'yogurt', 'sandwich', 'juice']);
const PRODUCE = new Set(['apples', 'pears', 'oranges']);
/** Largest footprint per slot: width along the shelf, height, depth into the shelf. */
const FIT = {
  aisle: { w: 0.235, h: 0.33, d: 0.165 },
  cooler: { w: 0.215, h: 0.33, d: 0.26 },
  produce: { w: 0.175, h: 0.2, d: 0.27 }
};

/**
 * Night Stock draws labels on 512 px canvases with fixed font sizes, so draw at
 * that size and keep a half-size copy: the same look at a quarter of the memory.
 */
function labelTextures(renderer) {
  const anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  return function texture(draw, w = 512, h = 512) {
    const big = document.createElement('canvas');
    big.width = w; big.height = h;
    draw(big.getContext('2d'), w, h);
    const small = document.createElement('canvas');
    small.width = Math.max(1, w >> 1); small.height = Math.max(1, h >> 1);
    const ctx = small.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, 0, 0, small.width, small.height);
    const t = new THREE.CanvasTexture(small);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, anisotropy);
    return t;
  };
}

function hash(a, b, c) {
  let h = Math.imul(Math.round(a * 97) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(b * 53) + 7, 0xc2b2ae35) ^ Math.imul(c + 11, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Pick the product for a placement: same product for each run of three facings. */
export function productFor(placement) {
  const names = SECTIONS[placement.sku];
  if (!names) return null;
  if (names.length === 1) return names[0];
  const along = Math.abs(Math.cos(placement.yaw ?? 0)) > 0.5 ? placement.x : placement.z;
  const run = Math.floor((along + 50) / (PRODUCE.has(placement.sku) ? 0.37 : 0.8));
  const across = Math.abs(Math.cos(placement.yaw ?? 0)) > 0.5 ? placement.z : placement.x;
  return names[Math.floor(hash(across, placement.y, run) * names.length)];
}

function fitFor(sku) {
  return PRODUCE.has(sku) ? FIT.produce : COOLER.has(sku) ? FIT.cooler : FIT.aisle;
}

function makeBuilders(renderer) {
  const texture = labelTextures(renderer);
  let shelf = null, dairy = null, veg = null;
  const types = new Map(PRODUCT_TYPES.map(t => [t.name, t]));
  return function build(name, usedNames) {
    if (VEGETABLES.includes(name)) return (veg ??= createVegetables(texture)).build(name, 2);
    if (['Milk', 'Yogurt', 'Butter', 'Cheddar'].includes(name)) return (dairy ??= createDairyPackaging(texture)).build(name);
    if (CARTONS.has(name)) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.075), createRetailBox(texture, types.get(name))));
      return group;
    }
    shelf ??= createShelfPackaging(texture, PRODUCT_TYPES.filter(t => usedNames.has(t.name)));
    return shelf.has(name) ? shelf.build(name) : null;
  };
}

/**
 * Flattens one product into its meshes (geometry + material + matrix relative to
 * the product's floor-centre), scaled to fit the slot.
 */
function productParts(object, fit) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(1, fit.w / size.x, fit.h / size.y, fit.d / size.z);
  const centre = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Matrix4().makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
  const parts = [];
  object.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    parts.push({ geometry: o.geometry, material: o.material, matrix: offset.clone().multiply(o.matrixWorld) });
  });
  return parts;
}

export function buildMarketStock(parent, placements, quality, renderer) {
  const byProduct = new Map();
  for (const placement of placements) {
    const name = productFor(placement);
    if (!name) continue;
    const key = name + '|' + (PRODUCE.has(placement.sku) ? 'produce' : COOLER.has(placement.sku) ? 'cooler' : 'aisle');
    if (!byProduct.has(key)) byProduct.set(key, { name, fit: fitFor(placement.sku), rows: [] });
    byProduct.get(key).rows.push(placement);
  }
  const usedNames = new Set([...byProduct.values()].map(v => v.name));
  const build = makeBuilders(renderer);
  const place = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const at = new THREE.Vector3();
  const stock = new THREE.Group();
  stock.name = 'market-stock';
  for (const { name, fit, rows } of byProduct.values()) {
    const product = build(name, usedNames);
    if (!product) continue;
    for (const part of productParts(product, fit)) {
      const items = new THREE.InstancedMesh(part.geometry, part.material, rows.length);
      items.name = 'market-stock-' + name;
      items.receiveShadow = !!quality.shadows;
      rows.forEach(({ x, y, z, yaw = 0 }, i) => {
        // Small per-item turn and nudge so facings don't look stamped.
        const jitter = hash(x, z, i) - 0.5;
        quat.setFromAxisAngle(up, yaw + jitter * 0.12);
        place.compose(at.set(x, y, z + 0), quat, one).multiply(part.matrix);
        items.setMatrixAt(i, place);
      });
      items.computeBoundingSphere();
      stock.add(items);
    }
  }
  parent.add(stock);
  return stock;
}
