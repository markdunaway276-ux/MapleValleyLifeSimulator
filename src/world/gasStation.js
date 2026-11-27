import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHingedDoor } from '../systems/doors.js';
import { getShop } from '../data/shops.js';
import { getJob } from '../data/jobs.js';
import { buyFromShop } from '../systems/shop.js';
import { FUEL, quoteFill } from '../systems/fuel.js';

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
  spotlight: [1.2, 0.2]
};

function asphaltMaterial() {
  const map = new THREE.TextureLoader().load('./assets/models/gas-asphalt.webp');
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(17 / 3, 17 / 3);
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, color: 0xc9c9c4, roughness: 0.96 });
}

/** A couple of red jerry cans on the floor at the end of the front shelves. */
function gasCans(quality) {
  const group = new THREE.Group();
  group.name = 'gas-cans';
  const red = new THREE.MeshStandardMaterial({ color: 0xb8261c, roughness: 0.45, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.7 });
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
      if (!car) return 'Park your car beside the pump to fill up ($' + FUEL.PRICE_PER_LITRE.toFixed(2) + '/L)';
      const space = car.fuel.space();
      if (space < 0.05) return 'The tank is full';
      return lead + 'fill up (' + Math.ceil(space) + ' L, about $' + Math.ceil(space * FUEL.PRICE_PER_LITRE) + ')';
    };
    object.userData.interact = (ctx) => {
      const car = carHere();
      const toast = typeof ctx.toast === 'function' ? ctx.toast : () => {};
      if (!car) { toast('Park your car beside the pump first.'); return false; }
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
  const canopyLights = [];
  for (const z of [3.6, 9.6]) {
    const light = new THREE.SpotLight(0xfff3dc, 0, 13, Math.PI / 3.2, 0.7, 1.6);
    light.position.set(-0.8, 6.3, z);
    light.target.position.set(-0.8, 0, z);
    station.add(light, light.target);
    canopyLights.push(light);
  }
  const storeLight = new THREE.PointLight(0xfff1dc, 20, 14, 2);
  storeLight.position.set(0.5, 3.5, 23);
  station.add(storeLight);

  const glowing = [];
  const panes = [];
  let lastMinutes = 600;
  station.userData.updateLighting = (minutes) => {
    if (Number.isFinite(minutes)) lastMinutes = minutes;
    const dusk = THREE.MathUtils.smoothstep(lastMinutes, 1080, 1200);
    const dawn = 1 - THREE.MathUtils.smoothstep(lastMinutes, 330, 450);
    const night = Math.max(dusk, dawn);
    for (const light of canopyLights) light.intensity = night * 150;
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

  new GLTFLoader().load(URL, ({ scene: model }) => {
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
  }, undefined, (error) => console.warn('Gas station failed to load', error));
}
