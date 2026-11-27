import * as THREE from 'three';
import { loadGltf } from './gltf.js';

// Grab-and-go deli case from "Food pack 2" by Pasha (CC BY 4.0), relabelled for
// Maple Lane. See assets/models/CREDITS.md.
const URL = './assets/models/market/deli-case.glb';

/** Along the west wall, facing into the store (Market-local coordinates). */
export const DELI_CASE = { x: -9.52, z: 7.0, rotY: Math.PI / 2, length: 2.74, depth: 0.68 };

export function addDeliCase(shop, solid, quality) {
  const group = new THREE.Group();
  group.name = 'market-deli-case';
  group.position.set(DELI_CASE.x, 0.02, DELI_CASE.z);
  group.rotation.y = DELI_CASE.rotY;
  shop.add(group);
  // Turned a quarter, so its length runs along z.
  solid('deli-case', DELI_CASE.x, DELI_CASE.z, DELI_CASE.depth, DELI_CASE.length);
  // Cases like this are lit inside; the store's ceiling lights run down the middle.
  const pool = shop.parent && shop.parent.userData && shop.parent.userData.lightPool;
  const lamp = { x: shop.position.x + DELI_CASE.x + 0.55, y: 1.2, z: shop.position.z + DELI_CASE.z, color: 0xfff1dc, intensity: 4, distance: 2.4, decay: 2 };
  if (pool) pool.addPoint(lamp);
  else {
    const light = new THREE.PointLight(lamp.color, lamp.intensity, lamp.distance, lamp.decay);
    light.position.set(DELI_CASE.x + 0.55, lamp.y, DELI_CASE.z);
    shop.add(light);
  }
  loadGltf(URL, (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const glass = o.material && o.material.transparent;
      o.castShadow = !!quality.shadows && !glass;
      o.receiveShadow = !!quality.shadows;
    });
    group.add(gltf.scene);
  }, (err) => console.warn('Deli case failed to load', err));
  return group;
}
