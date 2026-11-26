import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Where the driver sits, in the car's local frame (+x is the nose, -z is the
 * left-hand side, y is up). The camera goes here while driving.
 */
export const CAR_SEAT = { x: -0.1, y: 1.38, z: -0.42 };
export const CAR_SIZE = { width: 4.0, depth: 1.85 };
export const CAR_SPAWN = { x: 6.8, z: -0.2, rotY: 0 };

function lightGeometry(x, ys, zs, sx, sy, sz) {
  const parts = [];
  for (const z of zs) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, ys, z);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

/**
 * Lightweight car assets (one set of geometries and materials).
 * Safe to reuse if more cars are added later.
 */
export function createCarAssets(quality = {}) {
  const shadows = !!quality.shadows;
  const bodyGeo = new THREE.BoxGeometry(4.0, 0.95, 1.75);
  const cabinGeo = new THREE.BoxGeometry(1.9, 0.72, 1.62);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  const headGeo = lightGeometry(2.0, 0.72, [-0.58, 0.58], 0.06, 0.16, 0.34);
  const tailGeo = lightGeometry(-2.0, 0.76, [-0.62, 0.62], 0.06, 0.14, 0.3);
  const steerGeo = new THREE.TorusGeometry(0.17, 0.025, 6, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a62, roughness: 0.55, metalness: 0.22 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1c2836, roughness: 0.3, metalness: 0.12 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95, metalness: 0 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf2e6b0, emissive: 0x6a5d28, roughness: 0.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xb02a2a, emissive: 0x3a0a0a, roughness: 0.5 });
  const steerMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
  return { bodyGeo, cabinGeo, wheelGeo, headGeo, tailGeo, steerGeo, bodyMat, cabinMat, wheelMat, headMat, tailMat, steerMat, shadows };
}

/**
 * A simple sedan built from boxes and cylinders. Origin is the ground centre (y=0).
 * The car faces +x (length along X) and rotation.y turns it (three.js: +x maps
 * to (cos, -sin)). userData.size is the footprint for collision and the map.
 * The front wheels are in userData.frontWheels so a driver can steer them.
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

  const frontWheels = [];
  const wheelX = 1.25;
  const wheelZ = 0.88;
  for (const [x, z] of [[wheelX, wheelZ], [wheelX, -wheelZ], [-wheelX, wheelZ], [-wheelX, -wheelZ]]) {
    const wheel = new THREE.Mesh(shared.wheelGeo, shared.wheelMat);
    wheel.name = 'car-wheel';
    // Axle along the car's width (z); yaw is applied last so front wheels can steer.
    wheel.rotation.order = 'YXZ';
    wheel.rotation.set(Math.PI / 2, 0, 0);
    wheel.position.set(x, 0.32, z);
    wheel.castShadow = shadows;
    wheel.receiveShadow = shadows;
    group.add(wheel);
    if (x > 0) frontWheels.push(wheel);
  }

  const head = new THREE.Mesh(shared.headGeo, shared.headMat);
  head.name = 'car-headlights';
  group.add(head);
  const tail = new THREE.Mesh(shared.tailGeo, shared.tailMat);
  tail.name = 'car-taillights';
  group.add(tail);

  // Only readable from the driver's seat (the cabin's inside faces are culled).
  const steer = new THREE.Mesh(shared.steerGeo, shared.steerMat);
  steer.name = 'car-steering';
  steer.rotation.order = 'ZYX';
  steer.rotation.set(0, Math.PI / 2, -0.45);
  steer.position.set(CAR_SEAT.x + 0.42, CAR_SEAT.y - 0.3, CAR_SEAT.z);
  group.add(steer);

  // Length along X, width along Z (local).
  group.userData.size = { ...CAR_SIZE };
  group.userData.seat = { ...CAR_SEAT };
  group.userData.frontWheels = frontWheels;
  group.userData.steering = steer;
  return group;
}
