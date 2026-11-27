import * as THREE from 'three';
import { STREET } from './street.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS, SURFACE, shade } from './palette.js';
import { bevelBox } from './shapes.js';
import { Parts } from './parts.js';
import { createVertexMaterial } from './surfaces.js';

/**
 * Where the driver sits, in the car's local frame (+x is the nose, -z is the
 * left-hand side, y is up). The camera goes here while driving.
 */
export const CAR_SEAT = { x: 0.19, y: 1.49, z: -0.40 };
export const CAR_SIZE = { width: 5.35, depth: 2.19 };
const SEDAN_SEAT = { x: -0.1, y: 1.38, z: -0.42 };
export const CAR_SPAWN = { x: 6.8, z: STREET.roadCenterZ + (STREET.roadWidth - STREET.parkingLaneWidth) / 2, rotY: 0 };

const WHEEL_RADIUS = 0.32;

const CAR_TRIM = 0x1c1c1f;
const CAR_CHROME = 0xaeb2b6;

/**
 * The car body in its own space (centred, 4.0 x 0.95 x 1.75): the rounded
 * shell plus bumpers, grille, door seams, handles and side skirts, merged
 * into one vertex-coloured geometry (paint, plastic and chrome each get their
 * own roughness). The shell's foot is darkened by baked AO.
 */
function carBodyGeometry() {
  const p = new Parts(true);
  p.surface('carPaint');
  p.bevelMax = 0.16;
  p.bevelSegments = 2;
  p.box(PROPS.carBody, 4.0, 0.95, 1.75, 0, 0, 0);
  p.bevelMax = 0.03;
  p.bevelSegments = 1;
  p.surface('rubber');
  p.box(CAR_TRIM, 0.14, 0.2, 1.62, 2.0, -0.27, 0);
  p.box(shade(PROPS.carBody, 0.72), 0.17, 0.21, 1.69, -1.95, -0.22, 0);
  p.box(CAR_TRIM, 0.15, 0.075, 1.54, -1.97, -0.33, 0);
  p.box(CAR_TRIM, 0.035, 0.21, 0.39, -2.015, -0.04, 0);
  p.box(0xbbc2bb, 0.012, 0.12, 0.28, -2.037, -0.04, 0);
  p.box(CAR_CHROME, 0.022, 0.028, 0.5, -2.012, 0.13, 0);
  p.bevelMax = 0; // grille, skirts, seams and handles are thin: plain boxes
  p.box(CAR_TRIM, 3.0, 0.08, 0.04, 0, -0.4, 0.875);
  p.box(CAR_TRIM, 3.0, 0.08, 0.04, 0, -0.4, -0.875);
  p.surface('metal');
  p.box(CAR_TRIM, 0.03, 0.14, 0.7, 2.005, 0.0, 0);
  p.box(CAR_CHROME, 0.034, 0.02, 0.72, 2.008, 0.0, 0);
  p.box(CAR_CHROME, 0.04, 0.03, 0.46, 2.06, -0.2, 0);
  p.surface('trim');
  for (const sz of [0.876, -0.876]) {
    for (const sx of [-0.95, 0.15]) p.box(shade(PROPS.carBody, 0.5), 0.012, 0.5, 0.01, sx, 0.1, sz);
    p.surface('metal');
    p.box(CAR_CHROME, 0.14, 0.028, 0.022, -0.1, 0.16, sz * 1.008);
    p.box(CAR_CHROME, 0.14, 0.028, 0.022, 0.5, 0.16, sz * 1.008);
    p.surface('trim');
  }
  return p.merge();
}

/** A wheel: tyre, rim and hub cap, one vertex-coloured geometry (axle along z). */
function carWheelGeometry() {
  const p = new Parts(true);
  p.surface('rubber');
  p.cylinder(PROPS.carWheel, WHEEL_RADIUS, WHEEL_RADIUS, 0.24, 0, 0, 0, 0, 0, 0, 14);
  p.surface('metal');
  p.cylinder(0x9a9ea3, 0.19, 0.19, 0.25, 0, 0, 0, 0, 0, 0, 12);
  p.cylinder(0x5d6165, 0.07, 0.07, 0.262, 0, 0, 0, 0, 0, 0, 8);
  for (let lug = 0; lug < 5; lug++) {
    const angle = lug * 2 * Math.PI / 5;
    for (const side of [-1, 1]) {
      p.cylinder(0x484c51, 0.016, 0.016, 0.008, Math.cos(angle) * 0.106,
        side * 0.127, Math.sin(angle) * 0.106, 0, 0, 0, 6);
    }
  }
  return p.merge().rotateX(Math.PI / 2);
}

/** Taper toward the roof to give the windshields and rear pillars a rake. */
function carCabinGeometry() {
  const geometry = bevelBox(1.9, 0.72, 1.62, { segments: 2, max: 0.10 });
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const taper = (positions.getY(i) + 0.36) / 0.72;
    positions.setX(i, positions.getX(i) * (1 - 0.4 * taper));
    positions.setZ(i, positions.getZ(i) * (1 - 0.14 * taper));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function lightGeometry(x, ys, zs, sx, sy, sz) {
  const parts = [];
  for (const z of zs) {
    const g = bevelBox(sx, sy, sz, { max: 0.02 });
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
  const bodyGeo = carBodyGeometry();
  const cabinGeo = carCabinGeometry();
  const rearGlassGeo = bevelBox(0.035, 0.47, 1.17, { radius: 0.013 });
  rearGlassGeo.rotateZ(-Math.atan(0.38 / 0.72));
  rearGlassGeo.translate(-0.98, 1.385, 0);
  const rearGlassMat = new THREE.MeshStandardMaterial({
    color: 0x405861, roughness: 0.32, metalness: 0.08
  });
  const wheelGeo = carWheelGeometry();
  const headGeo = lightGeometry(2.0, 0.72, [-0.58, 0.58], 0.06, 0.16, 0.34);
  const tailGeo = lightGeometry(-1.994, 0.77, [-0.61, 0.61], 0.09, 0.126, 0.35);
  const steerGeo = new THREE.TorusGeometry(0.17, 0.025, 6, 12);
  const bodyMat = createVertexMaterial({ metalness: SURFACE.carPaint.metalness });
  const cabinMat = new THREE.MeshStandardMaterial({ color: PROPS.carCabin, roughness: SURFACE.glass.roughness + 0.1, metalness: 0.18 });
  const wheelMat = createVertexMaterial({ metalness: 0.12 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf2e6b0, emissive: 0x6a5d28, roughness: 0.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xb02a2a, emissive: 0x210403, roughness: 0.5 });
  const steerMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
  return { bodyGeo, cabinGeo, rearGlassGeo, rearGlassMat, wheelGeo, headGeo, tailGeo, steerGeo, bodyMat, cabinMat, wheelMat, headMat, tailMat, steerMat, shadows };
}

/**
 * A simple sedan built from boxes and cylinders. Origin is the ground centre (y=0).
 * The car faces +x (length along X) and rotation.y turns it (three.js: +x maps
 * to (cos, -sin)). userData.size is the footprint for collision and the map.
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

  const rearGlass = new THREE.Mesh(shared.rearGlassGeo, shared.rearGlassMat);
  rearGlass.name = 'car-rear-window';
  group.add(rearGlass);

  const wheels = [];
  const wheelX = 1.25;
  const wheelZ = 0.88;
  for (const [x, z] of [[wheelX, wheelZ], [wheelX, -wheelZ], [-wheelX, wheelZ], [-wheelX, -wheelZ]]) {
    const wheel = new THREE.Mesh(shared.wheelGeo, shared.wheelMat);
    wheel.name = 'car-wheel';
    wheel.position.set(x, WHEEL_RADIUS, z);
    wheel.castShadow = shadows;
    wheel.receiveShadow = shadows;
    wheels.push(addWheelPivot(group, wheel, WHEEL_RADIUS));
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
  steer.position.set(SEDAN_SEAT.x + 0.42, SEDAN_SEAT.y - 0.3, SEDAN_SEAT.z);
  group.add(steer);

  // Length along X, width along Z (local).
  group.userData.size = { ...CAR_SIZE };
  group.userData.seat = { ...SEDAN_SEAT };
  group.userData.wheels = wheels;
  group.userData.steering = steer;
  return group;
}

export function addWheelPivot(parent, wheel, radius) {
  const pivot = new THREE.Group();
  pivot.position.copy(wheel.position);
  wheel.position.set(0, 0, 0);
  wheel.name = 'car-wheel';
  pivot.add(wheel);
  parent.add(pivot);
  return { pivot, wheel, radius };
}

/** Apply steering and signed travel independently in the car's local frame. */
export function poseCarWheels(car, steer, distance) {
  for (const { pivot, wheel, radius } of car.userData.wheels ?? []) {
    if (pivot.position.x > 0) pivot.rotation.y = -steer;
    wheel.rotation.z = (-distance / radius) % (2 * Math.PI);
  }
}
