import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { addWheelPivot, CAR_SEAT, createParkedCar } from './props.js';

const BODY_PAINT = 0x3e6651;
const WHEEL_RADIUS = 0.386;
const WHEEL_NAMES = ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr'];

export function createPlayerPickup({ shadows }) {
  const car = createParkedCar({ shadows });
  const fallback = new THREE.Group();
  fallback.add(...car.children.slice());
  car.add(fallback);
  const cargo = new THREE.Group();
  cargo.name = 'pickup-bed-cargo';
  cargo.visible = false;
  car.add(cargo);
  car.userData.pickupCargo = cargo;

  // Hinged dark vinyl tonneau bed cover pivoted at the cab edge (x = -0.96, y = 1.32).
  // Rotating negative around Z lifts the rear edge cleanly open to reveal the moving boxes.
  const bedCover = new THREE.Group();
  bedCover.name = 'pickup-bed-cover';
  bedCover.position.set(-0.96, 1.32, 0);
  bedCover.visible = false;
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.78, metalness: 0.08 });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.82, metalness: 0.1 });
  const latchMat = new THREE.MeshStandardMaterial({ color: 0xbec5cc, roughness: 0.3, metalness: 0.75 });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.045, 1.66), coverMat);
  lid.position.set(-0.78, 0.022, 0);
  lid.castShadow = lid.receiveShadow = !!shadows;
  bedCover.add(lid);
  for (const zOff of [-0.42, 0.42]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.015, 0.05), ribMat);
    rib.position.set(-0.78, 0.048, zOff);
    bedCover.add(rib);
  }
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.22), latchMat);
  latch.position.set(-1.55, 0.025, 0);
  bedCover.add(latch);
  car.add(bedCover);
  car.userData.bedCover = bedCover;
  car.userData.setBedOpen = (ratio) => {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    bedCover.rotation.z = -clamped * 0.92;
  };

  loadGltf('assets/models/vehicles/pickup.glb', ({ scene: pickup }) => {
    const body = pickup.getObjectByName('truck-body');
    const interior = pickup.getObjectByName('truck-interior');
    const wheels = WHEEL_NAMES.map(name => pickup.getObjectByName(name));
    if (!body || !interior || wheels.some(wheel => !wheel)) {
      console.warn('Pickup model is missing required parts');
      return;
    }

    const glass = new Set();
    pickup.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = shadows && !object.material.transparent;
      object.receiveShadow = shadows;
      if (object.material.name === 'body') object.material.color.setHex(BODY_PAINT);
      if (object.material.name === 'interior') object.material.color.setHex(0x303031);
      if (object.material.name === 'd_glass') glass.add(object.material);
    });
    car.userData.wheels = wheels.map(wheel => addWheelPivot(pickup, wheel, WHEEL_RADIUS));
    Object.assign(car.userData.seat, CAR_SEAT);
    car.userData.pickupGlass = glass;
    car.add(pickup);
    car.remove(fallback);
    cargo.visible = true;
    bedCover.visible = true;
  }, error => {
    console.warn('Pickup model unavailable; using the fallback vehicle:', error);
  });
  return car;
}
