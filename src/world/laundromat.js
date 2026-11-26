import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getJob } from '../data/jobs.js';

/**
 * Maple Lane Laundromat — Elbolilloduro's "Laundry" scene (CC0), cut down to
 * the one building and baked so the shop front faces the street (+z) with
 * the front doorway at the model origin. It is a walk-in shop: the walls,
 * machines and counter have colliders, and a folding table inside offers a
 * paid shift.
 */
export const LAUNDROMAT = { x: 29.5, z: -6.3 };
const URL = './assets/models/laundromat.glb';
/** Outside surfaces keep normal lighting; everything else glows a little, like strip lights left on. */
const OUTSIDE = /^(BrickSmallPainted$|Roof_tiles|RooftilesMetal|Glass|Emissor|Vending_machine|Board|trash_can|Garbage_bag)/;
const STRIP_LIGHT = 0.42;

/** Solid parts in model space (x across the front, z back from the doorway). */
const SOLIDS = [
  ['front-w', -6.2, -0.6, -0.15, 0.15],
  ['front-e', 0.6, 8.2, -0.15, 0.15],
  ['back', -6.2, 8.2, -10.35, -10.05],
  ['side-e', 8.0, 8.3, -10.35, 0.15],
  ['side-w', -6.3, -6.0, -10.35, 0.15],
  ['partition-back', -1.5, -1.25, -10.05, -5.2],
  ['partition-front', -1.5, -1.25, -4.05, -0.15],
  ['dryers', 0.1, 8.0, -7.75, -6.75],
  ['washers-wall', 7.1, 8.0, -5.35, -0.25],
  ['washers-island', 1.1, 5.3, -4.65, -2.85],
  ['shelves', 1.4, 7.8, -9.75, -9.15],
  ['benches', 1.3, 5.9, -0.85, -0.25],
  ['folding-table', -1.3, -0.4, -6.85, -5.25],
  ['staff-shelf-1', -4.1, -3.3, -4.75, -1.65],
  ['staff-shelf-2', -6.0, -5.2, -4.75, -1.65],
  ['vending', -6.2, -4.9, 0.05, 0.85],
  ['bench-out', -2.8, -1.0, 0.05, 0.65]
];

/** Floor of the shop, for "am I indoors" checks (rain, rain sound). */
const INSIDE = { minX: -6.0, maxX: 8.0, minZ: -10.05, maxZ: -0.1 };
/** Where you stand to fold laundry, in front of the folding table. */
const JOB_SPOT = { x: -0.05, z: -6.1 };

export function buildLaundromat(scene, quality) {
  const ud = scene.userData;
  const at = (x, z) => ({ x: LAUNDROMAT.x + x, z: LAUNDROMAT.z + z });

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

  // Folding shift at the table inside.
  const shift = getJob('laundry');
  const spot = new THREE.Group();
  spot.name = 'laundromat-fold';
  spot.position.set(JOB_SPOT.x, 1.1, JOB_SPOT.z);
  spot.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + 'fold laundry ($' + shift.pay + ')';
  spot.userData.interact = (ctx) => ctx.work?.(shift.id) ?? false;
  group.add(spot);
  const p = at(JOB_SPOT.x, JOB_SPOT.z);
  ud.interactables.push({ id: 'laundromat-fold', object: spot, range: 1.2, getPoint: () => ({ x: p.x, y: 1.1, z: p.z }) });

  new GLTFLoader().load(URL, (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const glass = o.material && o.material.transparent;
      o.castShadow = !!quality.shadows && !glass;
      o.receiveShadow = !!quality.shadows;
      const m = o.material;
      if (!m) return;
      m.shadowSide = THREE.DoubleSide;
      if (m.map && !OUTSIDE.test(m.name) && !m.userData.stripLit) {
        m.emissiveMap = m.map;
        m.emissive.setRGB(1, 0.98, 0.94);
        m.emissiveIntensity = STRIP_LIGHT;
        m.userData.stripLit = true;
      }
    });
    group.add(model);
  }, undefined, (err) => console.warn('Laundromat model failed to load', err));

  return group;
}
