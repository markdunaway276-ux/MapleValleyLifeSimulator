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

  // Hinged 3D tailgate pivoted along the lower rear sill (x = -2.51, y = 0.86).
  // Sized cleanly between the rear taillights (|z| < 0.71) so rotating +90° around Z
  // folds the real tailgate down flat with zero static tailgate ghost left behind.
  const tailgate = new THREE.Group();
  tailgate.name = 'pickup-tailgate';
  tailgate.position.set(-2.51, 0.86, 0);
  tailgate.visible = false;
  const gatePaintMat = new THREE.MeshStandardMaterial({ color: BODY_PAINT, roughness: 0.46, metalness: 0.22 });
  const gateLinerMat = new THREE.MeshStandardMaterial({ color: 0x242629, roughness: 0.86, metalness: 0.08 });
  const gateOuter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 1.43), gatePaintMat);
  gateOuter.position.set(-0.02, 0.24, 0);
  gateOuter.castShadow = gateOuter.receiveShadow = !!shadows;
  const gateInner = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 1.38), gateLinerMat);
  gateInner.position.set(0.02, 0.24, 0);
  gateInner.receiveShadow = !!shadows;
  const gateHandle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.24), latchMat);
  gateHandle.position.set(-0.06, 0.40, 0);
  tailgate.add(gateOuter, gateInner, gateHandle);
  car.add(tailgate);
  car.userData.tailgate = tailgate;
  car.userData.setTailgateOpen = (ratio) => {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    tailgate.rotation.z = clamped * (Math.PI * 0.5);
  };

  // Hinged 3D driver-side cab door pivoted at the front A-pillar (x = 0.86, y = 0.86, z = -0.88).
  // Rotating positive around Y swings the rear edge (-X) smoothly outward toward -Z.
  const driverDoor = new THREE.Group();
  driverDoor.name = 'pickup-driver-door';
  driverDoor.position.set(0.86, 0.86, -0.88);
  driverDoor.visible = false;
  const doorOuter = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.62, 0.055), gatePaintMat);
  doorOuter.position.set(-0.51, 0, 0);
  doorOuter.castShadow = doorOuter.receiveShadow = !!shadows;
  const doorCard = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.56, 0.03), gateLinerMat);
  doorCard.position.set(-0.51, 0, 0.035);
  const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.036, 0.035), latchMat);
  doorHandle.position.set(-0.84, 0.16, -0.04);
  const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), gateLinerMat);
  mirrorArm.position.set(-0.14, 0.30, -0.09);
  const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.16), gatePaintMat);
  mirrorHead.position.set(-0.14, 0.34, -0.18);
  const winGlassMat = new THREE.MeshStandardMaterial({
    color: 0x9ec0d4, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.42
  });
  const doorWindow = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.42, 0.018), winGlassMat);
  doorWindow.position.set(-0.52, 0.50, 0.01);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.04, 0.045), gatePaintMat);
  frameTop.position.set(-0.52, 0.72, 0);
  const frameRear = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.46, 0.045), gatePaintMat);
  frameRear.position.set(-0.98, 0.51, 0);
  driverDoor.add(doorOuter, doorCard, doorHandle, mirrorArm, mirrorHead, doorWindow, frameTop, frameRear);
  car.add(driverDoor);
  car.userData.driverDoor = driverDoor;
  car.userData.setDriverDoorOpen = (ratio) => {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    driverDoor.rotation.y = clamped * 1.05;
  };

  let doorAnim = null;
  car.userData.animateDriverDoor = (to, delayMs = 0, duration = 480) => {
    const cur = driverDoor.rotation.y / 1.05;
    doorAnim = { from: cur, to: Math.max(0, Math.min(1, to)), start: performance.now() + delayMs, duration };
  };
  car.userData.updateDoorAnim = () => {
    if (!doorAnim) return;
    const raw = (performance.now() - doorAnim.start) / doorAnim.duration;
    if (raw < 0) return;
    const t = Math.min(1, raw);
    const ease = t * t * (3 - 2 * t);
    car.userData.setDriverDoorOpen(THREE.MathUtils.lerp(doorAnim.from, doorAnim.to, ease));
    if (t >= 1) doorAnim = null;
  };

  function stripStaticTailgate(mesh) {
    const geom = mesh.geometry;
    const pos = geom?.attributes?.position;
    if (!pos) return;
    const idx = geom.index;
    const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
    const keep = [];
    let removed = 0;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
      const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
      const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
      // 1. Static tailgate panel between the taillights (|z| < 0.705) above the rear bumper (y > 0.85).
      const isStaticTailgate = cx < -2.37 && cy > 0.85 && Math.abs(cz) < 0.705;
      // 2. Static outer driver cab door skin (z < -0.82) replaced by the hinged 3D pickup-driver-door.
      const isStaticDriverDoor = cz < -0.82 && cx > -0.14 && cx < 0.86 && cy > 0.55 && cy < 1.24;
      if (isStaticTailgate || isStaticDriverDoor) {
        removed++;
        continue;
      }
      keep.push(i0, i1, i2);
    }
    if (removed > 0) {
      geom.setIndex(keep);
    }
  }

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
      if (object.material.name === 'body') {
        object.material.color.setHex(BODY_PAINT);
        stripStaticTailgate(object);
      }
      if (object.material.name === 'black_m' || object.material.name === 'material') {
        stripStaticTailgate(object);
      }
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
    tailgate.visible = true;
    driverDoor.visible = true;
  }, error => {
    console.warn('Pickup model unavailable; using the fallback vehicle:', error);
  });
  return car;
}
