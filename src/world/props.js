import * as THREE from 'three';

/**
 * Lightweight parked-car assets (one set of geometries and materials).
 * Safe to reuse if more cars are added later.
 */
export function createCarAssets(quality = {}) {
  const shadows = !!quality.shadows;
  const bodyGeo = new THREE.BoxGeometry(4.0, 0.95, 1.75);
  const cabinGeo = new THREE.BoxGeometry(1.9, 0.72, 1.62);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a62, roughness: 0.55, metalness: 0.22 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1c2836, roughness: 0.3, metalness: 0.12 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95, metalness: 0 });
  return { bodyGeo, cabinGeo, wheelGeo, bodyMat, cabinMat, wheelMat, shadows };
}

/**
 * A simple sedan built from boxes and cylinders. Origin is the ground centre (y=0).
 * The car faces +x (length along X). userData.size is the XZ footprint for collision.
 */
export function createParkedCar(options = {}) {
  const shared = options.shared || createCarAssets({ shadows: !!options.shadows });
  const shadows = options.shadows !== undefined ? !!options.shadows : !!shared.shadows;

  const group = new THREE.Group();
  group.name = 'parked-car';

  const body = new THREE.Mesh(shared.bodyGeo, shared.bodyMat);
  body.name = 'car-body';
  body.position.y = 0.62;
  body.castShadow = shadows;
  body.receiveShadow = shadows;
  group.add(body);

  const cabin = new THREE.Mesh(shared.cabinGeo, shared.cabinMat);
  cabin.name = 'car-cabin';
  cabin.position.set(-0.25, 1.38, 0);
  cabin.castShadow = shadows;
  cabin.receiveShadow = shadows;
  group.add(cabin);

  const wheelX = 1.25;
  const wheelZ = 0.88;
  for (const [x, z] of [[wheelX, wheelZ], [wheelX, -wheelZ], [-wheelX, wheelZ], [-wheelX, -wheelZ]]) {
    const wheel = new THREE.Mesh(shared.wheelGeo, shared.wheelMat);
    wheel.name = 'car-wheel';
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.32, z);
    wheel.castShadow = shadows;
    wheel.receiveShadow = shadows;
    group.add(wheel);
  }

  // Length along X, width along Z (local). Used as an AABB when rotY is 0 or π.
  group.userData.size = { width: 4.0, depth: 1.85 };
  return group;
}
