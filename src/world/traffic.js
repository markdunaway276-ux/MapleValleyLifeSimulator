import * as THREE from 'three';
import { STREET, SURFACE_Y } from './street.js';

/**
 * Passing AI town traffic along Maple Lane & Route 9:
 * - 3 stylized vehicles (sedan, wagon, compact) with glossy envMap paint,
 *   tinted glass, spinning wheels, dusk/night headlights, and brake lights.
 * - Drives in the centre travel lanes (well clear of parked curb vehicles).
 * - Smoothly brakes and yields whenever the player or the player's pickup
 *   is ahead in the same lane.
 * - Stays hidden during the opening Route 9 cinematic so it never interferes.
 */

const TRAFFIC_DEFS = [
  { id: 'traffic-sedan', dir: 1, startX: -62, speed: 6.4, color: 0x7c3638, length: 4.1, roofLen: 2.0, roofOff: -0.15 },
  { id: 'traffic-wagon', dir: -1, startX: 46, speed: 5.8, color: 0x3b586e, length: 4.35, roofLen: 2.55, roofOff: -0.35 },
  { id: 'traffic-compact', dir: 1, startX: 16, speed: 6.1, color: 0xb68a3c, length: 3.65, roofLen: 1.85, roofOff: -0.1 }
];

function createTrafficCar(def, shadows) {
  const g = new THREE.Group();
  g.name = def.id;

  const paintMat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.25,
    metalness: 0.42,
    envMapIntensity: 1.35
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x25282c, roughness: 0.72, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1c2832,
    roughness: 0.14,
    metalness: 0.25,
    envMapIntensity: 1.6
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.92 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xbac2c8, roughness: 0.35, metalness: 0.75 });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xf4ecd8,
    roughness: 0.2,
    emissive: 0xffe8b0,
    emissiveIntensity: 0
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x6e1818,
    roughness: 0.3,
    emissive: 0xff2218,
    emissiveIntensity: 0.15
  });

  const w = def.length;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.58, 1.72), paintMat);
  body.position.set(0, 0.60, 0);
  body.castShadow = body.receiveShadow = shadows;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.roofLen, 0.52, 1.48), paintMat);
  cabin.position.set(def.roofOff, 1.12, 0);
  cabin.castShadow = cabin.receiveShadow = shadows;
  g.add(cabin);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(def.roofLen + 0.05, 0.36, 1.52), glassMat);
  glass.position.set(def.roofOff, 1.12, 0);
  g.add(glass);

  // Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 1.76), trimMat);
  frontBumper.position.set(w / 2 + 0.03, 0.42, 0);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 1.76), trimMat);
  rearBumper.position.set(-w / 2 - 0.03, 0.42, 0);
  g.add(frontBumper, rearBumper);

  // Headlights (+X) & Brake lights (-X)
  for (const zOff of [-0.58, 0.58]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.28), headMat);
    hl.position.set(w / 2 + 0.01, 0.64, zOff);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.30), brakeMat);
    bl.position.set(-w / 2 - 0.01, 0.65, zOff);
    g.add(hl, bl);
  }

  // 4 spinning wheels
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 10);
  rimGeo.rotateX(Math.PI / 2);
  const ax = w * 0.31;
  for (const wx of [-ax, ax]) {
    for (const wz of [-0.84, 0.84]) {
      const wg = new THREE.Group();
      wg.position.set(wx, 0.32, wz);
      wg.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, rimMat));
      g.add(wg);
      wheels.push(wg);
    }
  }

  // Soft volumetric headlight cones at dusk/night
  const coneGeo = new THREE.ConeGeometry(0.85, 4.2, 10, 1, true);
  coneGeo.translate(0, -2.1, 0);
  coneGeo.rotateZ(Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffefc4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const cones = new THREE.Group();
  for (const zOff of [-0.56, 0.56]) {
    const c = new THREE.Mesh(coneGeo, coneMat);
    c.position.set(w / 2 + 0.05, 0.62, zOff);
    c.rotation.z = -0.08;
    cones.add(c);
  }
  cones.visible = false;
  g.add(cones);

  return { group: g, wheels, headMat, brakeMat, cones, coneMat };
}

export function buildTownTraffic(scene, quality = {}) {
  const shadows = !!quality.shadows;
  const root = new THREE.Group();
  root.name = 'town-traffic';
  scene.add(root);

  const laneEastZ = STREET.roadCenterZ - 2.2;
  const laneWestZ = STREET.roadCenterZ + 2.2;
  // Full length of the through road: far west on Route 9 to where the park road
  // turns north (x 115). Cars only vanish / reappear at an end while you are far
  // from it, so you never see one pop in or out.
  const minX = -280;
  const maxX = (STREET.expansion?.roads?.[0]?.maxX ?? 115) - 5;
  const HIDE_DIST = 38;
  const world = scene.userData && scene.userData.colliders;

  const cars = TRAFFIC_DEFS.map((def) => {
    const built = createTrafficCar(def, shadows);
    const z = def.dir > 0 ? laneEastZ : laneWestZ;
    built.group.position.set(def.startX, SURFACE_Y.road, z);
    built.group.rotation.y = def.dir > 0 ? 0 : Math.PI;
    root.add(built.group);
    // Moving box collider so the player (on foot or in the pickup) can't pass through.
    let collider = null;
    if (world && typeof world.addHouse === 'function') {
      collider = world.addHouse({ id: def.id, ...carBox(def.startX, z, def.length) });
    }
    return {
      ...def,
      ...built,
      x: def.startX,
      z,
      curSpeed: def.speed,
      braking: false,
      collider,
      waiting: false
    };
  });

  function carBox(x, z, length) {
    return { minX: x - length / 2 - 0.1, maxX: x + length / 2 + 0.1, minZ: z - 0.92, maxZ: z + 0.92 };
  }

  function farFrom(playerPos, x, z) {
    return !playerPos || Math.hypot(playerPos.x - x, playerPos.z - z) > HIDE_DIST;
  }

  function obstacleAhead(car, obstacles) {
    for (const ob of obstacles) {
      if (!ob) continue;
      const dz = Math.abs(ob.z - car.z);
      if (dz > (ob.halfZ || 1.5) + 1.15) continue;
      const ahead = (ob.x - car.x) * car.dir;
      const minGap = car.length / 2 + (ob.halfX || 1.2) + 5.2;
      if (ahead > -1.0 && ahead < minGap) return true;
    }
    return false;
  }

  return {
    root,
    cars,
    update(delta, { minutes = 600, rain = 0, playerPos = null, playerCar = null, opening = false } = {}) {
      root.visible = !opening;
      for (const c of cars) if (c.collider) c.collider.disabled = opening || c.waiting;
      if (opening) return;

      const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
      const evening = THREE.MathUtils.smoothstep(minutes, 18 * 60 + 15, 19 * 60 + 20);
      const morning = 1 - THREE.MathUtils.smoothstep(minutes, 5 * 60 + 30, 6 * 60 + 30);
      const dark = Math.min(1, evening + morning);
      const headStrength = Math.max(dark, rain > 0.3 ? 0.5 : 0);

      const baseObstacles = [];
      if (playerPos) baseObstacles.push({ x: playerPos.x, z: playerPos.z, halfX: 1.2, halfZ: 1.2 });
      if (playerCar?.position) baseObstacles.push({ x: playerCar.position.x, z: playerCar.position.z, halfX: 2.6, halfZ: 1.3 });

      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        const obs = baseObstacles.slice();
        for (let j = 0; j < cars.length; j++) {
          if (i !== j && cars[j].dir === c.dir) {
            obs.push({ x: cars[j].x, z: cars[j].z, halfX: cars[j].length / 2, halfZ: 1.0 });
          }
        }
        const blocked = obstacleAhead(c, obs);
        const targetSpeed = blocked ? 0 : c.speed;
        const accel = blocked ? 11.5 : 4.2;
        c.curSpeed += Math.sign(targetSpeed - c.curSpeed) * Math.min(Math.abs(targetSpeed - c.curSpeed), accel * dt);
        c.braking = blocked || c.curSpeed < 0.25;

        const startX = c.dir > 0 ? minX : maxX;
        if (c.waiting) {
          // Off the end of the road: come back only while nobody is watching the start.
          if (farFrom(playerPos, startX, c.z)) {
            c.waiting = false;
            c.x = startX;
            c.group.visible = true;
            c.curSpeed = c.speed;
          } else {
            continue;
          }
        }

        c.x += c.dir * c.curSpeed * dt;
        const pastEnd = (c.dir > 0 && c.x > maxX) || (c.dir < 0 && c.x < minX);
        if (pastEnd) {
          const endX = c.dir > 0 ? maxX : minX;
          if (farFrom(playerPos, endX, c.z)) {
            c.waiting = true;
            c.group.visible = false;
            if (c.collider) c.collider.disabled = true;
            continue;
          }
          // You're watching the end of the road: hold there until you look away / leave.
          c.x = endX;
          c.curSpeed = 0;
        }

        c.group.position.set(c.x, SURFACE_Y.road, c.z);
        if (c.collider) {
          Object.assign(c.collider, carBox(c.x, c.z, c.length));
          c.collider.disabled = false;
        }

        const spin = (c.curSpeed * dt) / 0.32;
        for (const w of c.wheels) w.rotation.z -= spin;

        c.headMat.emissiveIntensity = headStrength * 1.1;
        c.cones.visible = headStrength > 0.05;
        if (c.cones.visible) c.coneMat.opacity = headStrength * 0.12;
        c.brakeMat.emissiveIntensity = c.braking ? 1.45 : (0.18 + headStrength * 0.35);
      }
    }
  };
}
