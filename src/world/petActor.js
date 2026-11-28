import * as THREE from 'three';
import { FLOOR_Y } from './interior.js';
import { surfaceHeightAt } from './street.js';

/**
 * 3D Animated Town Cat ("Maple"): sculpted ginger tabby with animated legs,
 * swaying tail, and curled-up indoor nap pose on the Cozy Pet Bed.
 */

export const PET_HOME_SPOT = Object.freeze({ x: -0.62, y: FLOOR_Y, z: -8.35 });
const WANDER_SPOTS = Object.freeze([
  { x: -3.2, z: -3.8 },
  { x: 2.8, z: -3.6 },
  { x: 5.5, z: -4.2 },
  { x: -1.4, z: -4.5 }
]);

export function buildPetActor(scene, quality, pet) {
  const shadows = !!(quality && quality.shadows);
  const root = new THREE.Group();
  root.name = 'town-pet-maple';

  const ginger = new THREE.MeshStandardMaterial({ color: 0xd9863b, roughness: 0.85 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xa85a1e, roughness: 0.88 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf4e8d3, roughness: 0.86 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe69ca2, roughness: 0.72 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b2416, roughness: 0.25 });

  const bodyRig = new THREE.Group();
  root.add(bodyRig);

  // Torso
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), ginger);
  torso.position.set(0, 0.24, 0);
  torso.scale.set(0.88, 0.85, 1.65);
  torso.castShadow = shadows;
  bodyRig.add(torso);

  // Cream chest bib
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), cream);
  chest.position.set(0, 0.22, 0.17);
  chest.scale.set(0.82, 0.9, 0.75);
  bodyRig.add(chest);

  // Tabby back stripes
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.045), stripe);
    band.position.set(0, 0.34, -0.09 + i * 0.09);
    bodyRig.add(band);
  }

  // Head + ears + face
  const head = new THREE.Group();
  head.position.set(0, 0.34, 0.23);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), ginger);
  skull.scale.set(1.04, 0.95, 1.0);
  skull.castShadow = shadows;
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), cream);
  muzzle.position.set(0, -0.025, 0.092);
  muzzle.scale.set(1.15, 0.82, 0.85);
  head.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), pink);
  nose.position.set(0, -0.01, 0.132);
  head.add(nose);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.085, 4), ginger);
    ear.position.set(s * 0.068, 0.10, -0.01);
    ear.rotation.z = -s * 0.18;
    ear.rotation.y = Math.PI / 4;
    head.add(ear);

    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.055, 4), pink);
    inner.position.set(s * 0.068, 0.095, 0.008);
    inner.rotation.z = -s * 0.18;
    inner.rotation.y = Math.PI / 4;
    head.add(inner);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 5), eyeMat);
    eye.position.set(s * 0.045, 0.018, 0.096);
    head.add(eye);
  }
  bodyRig.add(head);

  // 4 Legs
  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.19, 6);
  const pawGeo = new THREE.SphereGeometry(0.028, 6, 5);
  const legPos = [
    [-0.075, 0.12, 0.13],
    [0.075, 0.12, 0.13],
    [-0.075, 0.12, -0.13],
    [0.075, 0.12, -0.13]
  ];
  for (let i = 0; i < legPos.length; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(legPos[i][0], 0.19, legPos[i][2]);
    const leg = new THREE.Mesh(legGeo, ginger);
    leg.position.y = -0.09;
    leg.castShadow = shadows;
    const paw = new THREE.Mesh(pawGeo, cream);
    paw.position.set(0, -0.175, 0.012);
    pivot.add(leg, paw);
    bodyRig.add(pivot);
    legs.push(pivot);
  }

  // Upright swaying tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.27, -0.22);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.28, 6), stripe);
  tail.position.set(0, 0.12, -0.05);
  tail.rotation.x = -0.35;
  tailPivot.add(tail);
  bodyRig.add(tailPivot);

  // Initial placement based on current pet mode
  const initState = pet.getState();
  if (initState.adopted && initState.mode === 'home') {
    root.position.set(PET_HOME_SPOT.x, PET_HOME_SPOT.y, PET_HOME_SPOT.z);
  } else {
    root.position.set(WANDER_SPOTS[0].x, surfaceHeightAt(WANDER_SPOTS[0].x, WANDER_SPOTS[0].z), WANDER_SPOTS[0].z);
  }

  root.userData.kind = 'pet';
  root.userData.id = 'town-pet';
  root.userData.interactLocal = new THREE.Vector3(0, 0.34, 0.08);
  root.userData.getPrompt = (isMobile) => pet.getPrompt(isMobile);
  root.userData.interact = () => pet.interact();

  if (!scene.userData.interactables) scene.userData.interactables = [];
  scene.userData.interactables = scene.userData.interactables.filter((e) => e.id !== 'town-pet');
  scene.userData.interactables.push({
    id: 'town-pet',
    kind: 'pet',
    object: root,
    range: 2.5
  });

  scene.add(root);

  let animTime = 0;
  let wanderIdx = 0;
  let wanderPause = 1.5;

  function update(delta, { playerPos = null, driving = false } = {}) {
    const dt = Math.min(0.1, Math.max(0.001, Number(delta) || 0.016));
    animTime += dt;
    const st = pet.getState();

    // Home nap mode: curl up peacefully inside the living room
    if (st.adopted && st.mode === 'home') {
      root.position.set(PET_HOME_SPOT.x, PET_HOME_SPOT.y + 0.05, PET_HOME_SPOT.z);
      root.rotation.y = 0.65;
      bodyRig.position.y = -0.11;
      bodyRig.scale.set(1.06, 0.78 + Math.sin(animTime * 2.2) * 0.03, 0.88);
      head.position.set(0.05, 0.25, 0.16);
      head.rotation.set(0.35, -0.45, 0);
      tailPivot.rotation.set(0.95, 0.6, 0);
      for (const leg of legs) leg.rotation.x = 0.9;
      return;
    }

    // Upright standing/walking posture
    bodyRig.position.y = 0;
    bodyRig.scale.set(1, 1, 1);
    head.position.set(0, 0.34, 0.23);
    head.rotation.set(0, Math.sin(animTime * 1.4) * 0.12, 0);

    let targetX = root.position.x;
    let targetZ = root.position.z;
    let speed = 1.55;
    let shouldMove = false;

    if (st.adopted && st.mode === 'follow' && playerPos) {
      const dx = playerPos.x - root.position.x;
      const dz = playerPos.z - root.position.z;
      const dist = Math.hypot(dx, dz);
      if (!driving && dist > 26) {
        // Rejoin player gently after a long drive
        root.position.set(playerPos.x + 1.8, surfaceHeightAt(playerPos.x + 1.8, playerPos.z), playerPos.z);
      } else if (!driving && dist > 2.2) {
        targetX = playerPos.x;
        targetZ = playerPos.z;
        speed = dist > 6 ? 3.8 : 2.3;
        shouldMove = true;
      }
    } else {
      // Gentle front-yard / sidewalk wander before adoption
      const wp = WANDER_SPOTS[wanderIdx];
      const dist = Math.hypot(wp.x - root.position.x, wp.z - root.position.z);
      if (dist < 0.35) {
        wanderPause -= dt;
        if (wanderPause <= 0) {
          wanderIdx = (wanderIdx + 1) % WANDER_SPOTS.length;
          wanderPause = 2.5 + (wanderIdx % 3);
        }
      } else {
        targetX = wp.x;
        targetZ = wp.z;
        speed = 1.15;
        shouldMove = true;
      }
    }

    if (shouldMove) {
      const dx = targetX - root.position.x;
      const dz = targetZ - root.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const step = Math.min(dist, speed * dt);
      root.position.x += (dx / dist) * step;
      root.position.z += (dz / dist) * step;
      root.position.y = surfaceHeightAt(root.position.x, root.position.z);
      const desiredYaw = Math.atan2(dx, dz);
      let diff = desiredYaw - root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.rotation.y += diff * Math.min(1, dt * 8);

      const gait = Math.sin(animTime * speed * 4.6) * 0.52;
      legs[0].rotation.x = gait;
      legs[3].rotation.x = gait;
      legs[1].rotation.x = -gait;
      legs[2].rotation.x = -gait;
    } else {
      for (const leg of legs) leg.rotation.x *= 0.85;
    }

    tailPivot.rotation.set(0, 0, Math.sin(animTime * 3.4) * 0.28);
  }

  scene.userData.petActor = { group: root, update };
  return { group: root, update };
}
