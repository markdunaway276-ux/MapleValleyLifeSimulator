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
  }, error => {
    console.warn('Pickup model unavailable; using the fallback vehicle:', error);
  });
  return car;
}
