import * as THREE from 'three';
import { STREET, SURFACE_Y } from './street.js';

export function buildPark(scene, quality) {
  const layout = STREET.expansion;
  const park = new THREE.Group();
  park.name = 'maple-lane-park';
  scene.add(park);

  function surface(name, rect, y, color) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rect.maxX - rect.minX, rect.maxZ - rect.minZ),
      new THREE.MeshStandardMaterial({ color, roughness: 0.94 })
    );
    mesh.name = name;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
    mesh.receiveShadow = quality.shadows;
    park.add(mesh);
  }

  surface('park-footprint', layout.park, 0.003, 0x647c4b);
  surface('future-pond-footprint', layout.pond, 0.009, 0x829588);
  for (const road of layout.roads) surface('service-road', road, SURFACE_Y.road, 0x464745);
  for (const path of layout.paths) surface('park-path', path, SURFACE_Y.walk, 0xc0ad8e);
  const { minX, maxX, minZ, maxZ } = layout.crossing;
  for (let x = minX + 0.35; x < maxX - 0.35; x += 0.65) {
    surface('service-road-crossing', { minX: x, maxX: x + 0.3, minZ, maxZ }, SURFACE_Y.road + 0.002, 0xd8d6c7);
  }
}
