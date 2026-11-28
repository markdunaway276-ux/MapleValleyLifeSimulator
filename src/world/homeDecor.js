/**
 * 3D Home Decor manager for the player's main house + rising stove steam
 * visual feedback when cooking a meal in the kitchen.
 */

import * as THREE from 'three';
import { HOME_DECOR_ITEMS, getHomeDecorItem, getHomeTheme } from '../data/homeDecor.js';
import { COOK_CENTER, FLOOR_Y, KENNEY_INNER } from './interior.js';
import { placeGltfProp } from './modelProps.js';

function makePaintingTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const sky = ctx.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, '#4f7ea8');
  sky.addColorStop(0.65, '#d8b48b');
  sky.addColorStop(1, '#e8c493');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 160);
  // Distant misty hills
  ctx.fillStyle = '#4e6b58';
  ctx.beginPath();
  ctx.moveTo(0, 102);
  ctx.quadraticCurveTo(64, 58, 128, 88);
  ctx.quadraticCurveTo(192, 54, 256, 94);
  ctx.lineTo(256, 160);
  ctx.lineTo(0, 160);
  ctx.closePath();
  ctx.fill();
  // Foreground pines & autumn maple
  ctx.fillStyle = '#2d4b37';
  ctx.beginPath();
  ctx.moveTo(0, 125);
  ctx.quadraticCurveTo(90, 96, 175, 118);
  ctx.quadraticCurveTo(220, 104, 256, 120);
  ctx.lineTo(256, 160);
  ctx.lineTo(0, 160);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c46339';
  ctx.beginPath();
  ctx.arc(192, 104, 18, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildDecorMeshes(shadows) {
  const map = new Map();
  const cast = !!shadows;

  // 1. Woven Living Rug (centered in the open living room between sofa and TV)
  const rug = new THREE.Group();
  rug.name = 'decor-living-rug';
  const rugBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.016, 1.85),
    new THREE.MeshStandardMaterial({ color: 0x9b4d3a, roughness: 0.94 })
  );
  rugBase.position.set(-1.65, FLOOR_Y + 0.008, -7.80);
  rugBase.receiveShadow = cast;
  const rugInner = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 0.018, 1.44),
    new THREE.MeshStandardMaterial({ color: 0xdfd3be, roughness: 0.94 })
  );
  rugInner.position.set(-1.65, FLOOR_Y + 0.009, -7.80);
  const rugCenter = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.020, 0.78),
    new THREE.MeshStandardMaterial({ color: 0xb56445, roughness: 0.92 })
  );
  rugCenter.position.set(-1.65, FLOOR_Y + 0.010, -7.80);
  rug.add(rugBase, rugInner, rugCenter);
  map.set('living-rug', rug);

  // 2. Potted Fiddle-Leaf Fig (bright southwest corner near front wall)
  const plant = new THREE.Group();
  plant.name = 'decor-fiddle-plant';
  plant.position.set(KENNEY_INNER.west + 0.52, FLOOR_Y, KENNEY_INNER.front - 0.55);
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.14, 0.36, 12),
    new THREE.MeshStandardMaterial({ color: 0xb66847, roughness: 0.82 })
  );
  pot.position.y = 0.18;
  pot.castShadow = pot.receiveShadow = cast;
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 0.95 })
  );
  soil.position.y = 0.35;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.03, 0.85, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c4430, roughness: 0.9 })
  );
  stem.position.y = 0.72;
  plant.add(pot, soil, stem);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3b6e3f, roughness: 0.76 });
  const brightLeafMat = new THREE.MeshStandardMaterial({ color: 0x4f894d, roughness: 0.74 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 2) * 0.04, 8, 6), i % 2 ? brightLeafMat : leafMat);
    leaf.scale.set(1.2, 0.45, 0.9);
    leaf.position.set(Math.cos(a) * 0.18, 0.88 + (i % 3) * 0.14, Math.sin(a) * 0.18);
    leaf.rotation.set(0.25, a, 0.2);
    leaf.castShadow = cast;
    plant.add(leaf);
  }
  placeGltfProp(plant, './assets/models/interior/potted-plant.glb', {
    name: 'decor-fiddle-plant-glb',
    targetHeight: 1.05,
    shadows: cast,
    hideOnLoad: [...plant.children]
  });
  map.set('fiddle-plant', plant);

  // 3. Brass Floor Lamp (beside the living-room sofa)
  const lamp = new THREE.Group();
  lamp.name = 'decor-brass-lamp';
  lamp.position.set(KENNEY_INNER.west + 0.48, FLOOR_Y, -6.72);
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a455, roughness: 0.32, metalness: 0.78 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.035, 14), brass);
  base.position.y = 0.018;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.56, 10), brass);
  pole.position.y = 0.80;
  pole.castShadow = cast;
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.23, 0.28, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf6e6c2, emissive: 0xffd28a, emissiveIntensity: 0.45, roughness: 0.85, side: THREE.DoubleSide })
  );
  shade.position.y = 1.62;
  lamp.add(base, pole, shade);
  map.set('brass-lamp', lamp);

  // 4. Framed Valley Landscape Art (on west wall above the sofa)
  const art = new THREE.Group();
  art.name = 'decor-valley-art';
  art.position.set(KENNEY_INNER.west + 0.035, 1.62, -7.80);
  art.rotation.y = Math.PI / 2;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.74, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x4b3523, roughness: 0.72 })
  );
  const canvasTex = makePaintingTexture();
  const canvasMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.60),
    new THREE.MeshStandardMaterial({ map: canvasTex, color: canvasTex ? 0xffffff : 0x7b9a7d, roughness: 0.82 })
  );
  canvasMesh.position.z = 0.025;
  art.add(frame, canvasMesh);
  map.set('valley-art', art);

  // 5. Walnut Bookshelf (against the front wall west of the door, clear of move-in boxes)
  const shelf = new THREE.Group();
  shelf.name = 'decor-walnut-bookshelf';
  shelf.position.set(-4.10, FLOOR_Y, KENNEY_INNER.front - 0.24);
  const walnut = new THREE.MeshStandardMaterial({ color: 0x5c3e28, roughness: 0.78 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.48, 0.04), walnut);
  back.position.set(0, 0.74, 0.14);
  back.castShadow = back.receiveShadow = cast;
  shelf.add(back);
  for (const sx of [-0.45, 0.45]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.48, 0.30), walnut);
    side.position.set(sx, 0.74, 0);
    shelf.add(side);
  }
  const bookColors = [0x8c3a32, 0x355c7d, 0x4f7a53, 0xc7923e, 0x6b4c7a, 0x3b424c];
  for (let row = 0; row < 4; row++) {
    const sy = 0.06 + row * 0.44;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.035, 0.28), walnut);
    plank.position.set(0, sy, 0);
    shelf.add(plank);
    if (row < 3) {
      for (let b = 0; b < 6; b++) {
        const bh = 0.22 + ((row + b) % 3) * 0.04;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, bh, 0.20),
          new THREE.MeshStandardMaterial({ color: bookColors[(row * 3 + b) % bookColors.length], roughness: 0.84 })
        );
        book.position.set(-0.32 + b * 0.115, sy + 0.02 + bh / 2, -0.01);
        shelf.add(book);
      }
    }
  }
  placeGltfProp(shelf, './assets/models/interior/bookshelf.glb', {
    name: 'decor-walnut-bookshelf-glb',
    rotY: Math.PI,
    fitSize: [1.05, 1.62, 0.38],
    shadows: cast,
    hideOnLoad: [...shelf.children]
  });
  map.set('walnut-bookshelf', shelf);

  // 6. Bedside Lamp & Fern (in the bedroom beside the bed)
  const bedDecor = new THREE.Group();
  bedDecor.name = 'decor-bedroom-lamp';
  bedDecor.position.set(-4.35, FLOOR_Y, -13.95);
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.56, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x63452d, roughness: 0.8 })
  );
  stand.position.y = 0.28;
  stand.castShadow = stand.receiveShadow = cast;
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.085, 0.18, 10),
    new THREE.MeshStandardMaterial({ color: 0xd9cbb6, roughness: 0.65 })
  );
  lampBase.position.set(-0.08, 0.65, 0);
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.13, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0xf7e9ca, emissive: 0xffd58f, emissiveIntensity: 0.42, roughness: 0.85 })
  );
  lampShade.position.set(-0.08, 0.82, 0);
  const miniPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.055, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xbd7351, roughness: 0.82 })
  );
  miniPot.position.set(0.11, 0.62, 0.04);
  const fern = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: 0x457d46, roughness: 0.82 })
  );
  fern.position.set(0.11, 0.74, 0.04);
  bedDecor.add(stand, lampBase, lampShade, miniPot, fern);
  map.set('bedroom-lamp', bedDecor);

  // 7. Cozy Pet Bed (plush living-room cushion where Maple naps)
  const petBed = new THREE.Group();
  petBed.name = 'decor-pet-bed';
  petBed.position.set(-0.62, FLOOR_Y, -8.35);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x6f8b73, roughness: 0.94 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xefe5d4, roughness: 0.96 });
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.085, 8, 18), rimMat);
  outerRim.rotation.x = Math.PI / 2;
  outerRim.position.y = 0.08;
  outerRim.castShadow = outerRim.receiveShadow = cast;
  const pillow = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.30, 0.075, 16), cushionMat);
  pillow.position.y = 0.04;
  pillow.receiveShadow = cast;
  petBed.add(outerRim, pillow);
  map.set('pet-bed', petBed);

  // 8. Warm String Lights (golden fairy bulbs along the living-room west wall)
  const lights = new THREE.Group();
  lights.name = 'decor-string-lights';
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x3b352e });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a3 });
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const z = -6.55 - t * 2.55;
    const sag = Math.sin(t * Math.PI) * 0.16;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), bulbMat);
    bulb.position.set(KENNEY_INNER.west + 0.055, 2.38 - sag, z);
    lights.add(bulb);
    if (i < 8) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.32), cordMat);
      seg.position.set(KENNEY_INNER.west + 0.045, 2.39 - sag, z - 0.16);
      lights.add(seg);
    }
  }
  map.set('string-lights', lights);

  // 9. Kitchen Espresso Corner (sleek espresso machine + 2 ceramic mugs on kitchen counter)
  const coffeeBar = new THREE.Group();
  coffeeBar.name = 'decor-coffee-bar';
  coffeeBar.position.set(COOK_CENTER.x + 0.95, 0.92, COOK_CENTER.z + 0.04);
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xb7c0c9, roughness: 0.34, metalness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x262a30, roughness: 0.55 });
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xd96b43, roughness: 0.65 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.24), steelMat);
  body.position.y = 0.16;
  body.castShadow = cast;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.12), darkMat);
  tray.position.set(0, 0.015, 0.14);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.10), darkMat);
  head.position.set(0, 0.28, 0.12);
  const mug1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.085, 10), mugMat);
  mug1.position.set(-0.04, 0.072, 0.14);
  const mug2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.085, 10), new THREE.MeshStandardMaterial({ color: 0xefe7da, roughness: 0.65 }));
  mug2.position.set(0.22, 0.042, 0.08);
  coffeeBar.add(body, tray, head, mug1, mug2);
  map.set('coffee-bar', coffeeBar);

  return map;
}

export function createHomeDecor({ scene = null, shadows = false, saved = null, savedTheme = 'classic' } = {}) {
  const owned = new Set(Array.isArray(saved) ? saved.filter((id) => !!getHomeDecorItem(id)) : []);
  let themeId = getHomeTheme(savedTheme).id;
  const listeners = [];
  const root = new THREE.Group();
  root.name = 'home-decor';
  const meshes = buildDecorMeshes(shadows);
  for (const [id, obj] of meshes.entries()) {
    obj.visible = owned.has(id);
    root.add(obj);
  }
  if (scene) scene.add(root);

  // Subtle rising steam puffs above the kitchen stove when cooking a meal.
  const steamGroup = new THREE.Group();
  steamGroup.name = 'kitchen-cook-steam';
  steamGroup.position.set(COOK_CENTER.x, 0.96, COOK_CENTER.z + 0.1);
  steamGroup.visible = false;
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xf4f7fb, transparent: true, opacity: 0.48, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.075 + i * 0.015, 7, 6), steamMat);
    steamGroup.add(p);
    puffs.push(p);
  }
  if (scene) scene.add(steamGroup);
  let steamLeft = 0;
  let steamTime = 0;

  if (typeof window !== 'undefined') {
    window.addEventListener('maple-cooked', () => {
      steamLeft = 3.2;
      steamTime = 0;
      steamGroup.visible = true;
    });
  }

  function applyThemeToInterior() {
    const interiorGroup = scene?.userData?.interior?.group;
    if (!interiorGroup) return;
    const theme = getHomeTheme(themeId);
    interiorGroup.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.material.vertexColors && obj.material.color) {
        obj.material.color.setHex(theme.tint);
        obj.material.needsUpdate = true;
      }
    });
  }

  function sync() {
    for (const [id, obj] of meshes.entries()) obj.visible = owned.has(id);
    applyThemeToInterior();
  }

  function emit() {
    const snap = getOwned();
    for (let i = 0; i < listeners.length; i++) listeners[i](snap);
  }

  function getOwned() {
    return [...owned];
  }

  function has(id) {
    return owned.has(id);
  }

  function getTheme() {
    return themeId;
  }

  function setTheme(id, { save, toast } = {}) {
    const theme = getHomeTheme(id);
    themeId = theme.id;
    applyThemeToInterior();
    toast?.(`Home theme set to ${theme.name}!`);
    save?.();
    emit();
    return theme;
  }

  function buy(id, { money, sfx, toast, save } = {}) {
    const item = getHomeDecorItem(id);
    if (!item) return { ok: false, reason: 'Unknown item.' };
    if (owned.has(id)) return { ok: false, reason: 'Already placed in your home.' };
    if (money && typeof money.spend === 'function') {
      if (!money.spend(item.price, { label: item.name })) {
        toast?.(`Need $${item.price} for ${item.name}.`);
        return { ok: false, reason: 'Not enough cash.' };
      }
    }
    owned.add(id);
    sync();
    sfx?.play?.('cash');
    toast?.(`Delivered ${item.name} to your ${item.room}!`);
    save?.();
    emit();
    return { ok: true, item };
  }

  function apply(data) {
    const raw = Array.isArray(data) ? data : (Array.isArray(data?.homeDecor) ? data.homeDecor : null);
    if (raw) {
      owned.clear();
      for (const id of raw) if (getHomeDecorItem(id)) owned.add(id);
    }
    if (data && typeof data.homeTheme === 'string') {
      themeId = getHomeTheme(data.homeTheme).id;
    }
    sync();
    emit();
    return getOwned();
  }

  function update(dt) {
    if (steamLeft <= 0) return;
    const step = Math.max(0, Math.min(0.1, Number(dt) || 0));
    steamLeft = Math.max(0, steamLeft - step);
    steamTime += step;
    const fade = Math.min(1, steamLeft / 0.8);
    steamMat.opacity = 0.45 * fade;
    for (let i = 0; i < puffs.length; i++) {
      const phase = (steamTime * 0.95 + i * 0.25) % 1;
      puffs[i].position.set(
        Math.sin(steamTime * 2.8 + i * 1.7) * 0.08,
        phase * 0.52,
        Math.cos(steamTime * 2.2 + i) * 0.06
      );
      puffs[i].scale.setScalar(0.65 + phase * 0.85);
    }
    if (steamLeft <= 0) steamGroup.visible = false;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  return {
    items: HOME_DECOR_ITEMS,
    getOwned,
    has,
    getTheme,
    setTheme,
    applyThemeToInterior,
    buy,
    apply,
    serialize: getOwned,
    update,
    onChange,
    group: root
  };
}
