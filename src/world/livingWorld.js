import * as THREE from 'three';
import { STREET, SURFACE_Y } from './street.js';
import { TV_CENTER } from './interior.js';

/**
 * Living World & Atmosphere bundle for Maple Lane:
 * 1. Chimney woodsmoke curling from house chimneys in cool mornings/evenings
 * 2. Subtle pickup truck tailpipe exhaust wisps when driving/idling
 * 3. Reflective roadside rain puddles that appear during storms
 * 4. High-altitude soaring birds + perched crows on the north power lines
 * 5. Angled golden interior sunbeams + dynamic living-room TV bounce light
 */

const CHIMNEY_POSITIONS = [
  { x: -1.8, y: 6.1, z: -12.6 },   // Main house chimney
  { x: -17.5, y: 5.9, z: -12.2 },  // West neighbour chimney
  { x: 14.5, y: 5.8, z: -12.4 },   // East neighbour chimney
  { x: -14.2, y: 5.9, z: 16.5 }    // North house chimney
];

function createBirdMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x262a30, roughness: 0.85, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 5), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.08,
    0.42, 0.02, -0.02,
    0, 0, -0.09
  ], 3));
  wingGeo.computeVertexNormals();

  const leftWing = new THREE.Mesh(wingGeo, mat);
  const rightWing = new THREE.Mesh(wingGeo, mat);
  rightWing.scale.x = -1;
  g.add(leftWing, rightWing);
  g.userData.leftWing = leftWing;
  g.userData.rightWing = rightWing;
  return g;
}

function createCrowMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.72, metalness: 0.08 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), mat);
  body.scale.set(0.85, 0.9, 1.35);
  body.position.y = 0.09;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), mat);
  head.position.set(0, 0.19, 0.09);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.075, 5), mat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.185, 0.15);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.14), mat);
  tail.rotation.x = -0.35;
  tail.position.set(0, 0.06, -0.14);
  g.add(body, head, beak, tail);
  g.userData.head = head;
  return g;
}

export function buildLivingWorld(scene, quality = {}) {
  const hi = !!quality.shadows;
  const group = new THREE.Group();
  group.name = 'living-world';
  scene.add(group);

  // --- 1. Chimney Woodsmoke ---
  const puffsPerChimney = hi ? 7 : 4;
  const totalSmoke = CHIMNEY_POSITIONS.length * puffsPerChimney;
  const smokeGeo = new THREE.DodecahedronGeometry(0.24, 0);
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xd8dce0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false
  });
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, totalSmoke);
  smokeMesh.name = 'chimney-smoke';
  smokeMesh.frustumCulled = false;
  group.add(smokeMesh);

  // --- 2. Pickup Tailpipe Exhaust ---
  const exhaustCount = hi ? 10 : 6;
  const exhaustMat = new THREE.MeshBasicMaterial({
    color: 0xc8ccd0,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const exhaustMesh = new THREE.InstancedMesh(smokeGeo, exhaustMat, exhaustCount);
  exhaustMesh.name = 'pickup-exhaust';
  exhaustMesh.frustumCulled = false;
  group.add(exhaustMesh);
  const exhaustPuffs = Array.from({ length: exhaustCount }, (_, i) => ({
    age: i / exhaustCount,
    x: 0, y: -10, z: 0,
    vx: 0, vy: 0.4, vz: 0
  }));

  // --- 3. Reflective Roadside Rain Puddles ---
  const puddleGroup = new THREE.Group();
  puddleGroup.name = 'rain-puddles';
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x26313a,
    roughness: 0.06,
    metalness: 0.28,
    envMapIntensity: 2.1,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const southGutter = STREET.roadCenterZ - STREET.roadWidth / 2 + 0.85;
  const northGutter = STREET.roadCenterZ + STREET.roadWidth / 2 - 0.85;
  const puddleDefs = [
    { x: -24, z: southGutter, rx: 1.9, rz: 0.85, rot: 0.08 },
    { x: -9.5, z: southGutter, rx: 2.3, rz: 0.95, rot: -0.05 },
    { x: 4.5, z: southGutter, rx: 1.7, rz: 0.78, rot: 0.12 },
    { x: 19.5, z: southGutter, rx: 2.1, rz: 0.88, rot: -0.08 },
    { x: -16, z: northGutter, rx: 2.2, rz: 0.90, rot: 0.04 },
    { x: 1.5, z: northGutter, rx: 1.8, rz: 0.80, rot: -0.10 },
    { x: 14.0, z: northGutter, rx: 2.4, rz: 0.92, rot: 0.06 },
    { x: 31.0, z: northGutter, rx: 2.0, rz: 0.84, rot: -0.04 },
    { x: 64.5, z: 4.2, rx: 1.6, rz: 1.05, rot: 0.45 },
    { x: 75.5, z: 12.2, rx: 1.8, rz: 1.10, rot: -0.35 }
  ];
  const puddleGeo = new THREE.CircleGeometry(1, 18);
  for (const p of puddleDefs) {
    const m = new THREE.Mesh(puddleGeo, puddleMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = p.rot;
    m.scale.set(p.rx, p.rz, 1);
    m.position.set(p.x, SURFACE_Y.road + 0.011, p.z);
    puddleGroup.add(m);
  }
  puddleGroup.visible = false;
  group.add(puddleGroup);

  // --- 4. Soaring Sky Birds & Perched Power-Line Crows ---
  const birdGroup = new THREE.Group();
  birdGroup.name = 'sky-birds';
  const birdCount = hi ? 6 : 3;
  const birds = [];
  for (let i = 0; i < birdCount; i++) {
    const mesh = createBirdMesh();
    birdGroup.add(mesh);
    birds.push({
      mesh,
      cx: 8 + (i % 3) * 22,
      cz: -4 + (i % 2) * 14,
      rx: 18 + i * 3.8,
      rz: 12 + i * 2.5,
      y: 16.5 + (i % 3) * 3.2,
      speed: 0.22 + (i % 4) * 0.04,
      phase: i * 1.15
    });
  }
  group.add(birdGroup);

  const crowGroup = new THREE.Group();
  crowGroup.name = 'powerline-crows';
  const northWalkOuter = STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth + 0.35;
  const wireY = 7.4 - 0.55 + 0.14 - 0.35; // Sits naturally near the sag of the overhead power line
  const crowSpots = [
    { x: -13.5, z: northWalkOuter - 0.62, yaw: Math.PI },
    { x: 7.2, z: northWalkOuter + 0.62, yaw: Math.PI * 0.85 },
    { x: 31.4, z: northWalkOuter, yaw: Math.PI * 1.1 }
  ];
  const crows = crowSpots.map((s, idx) => {
    const mesh = createCrowMesh();
    mesh.position.set(s.x, wireY, s.z);
    mesh.rotation.y = s.yaw;
    crowGroup.add(mesh);
    return { mesh, baseYaw: s.yaw, phase: idx * 2.1 };
  });
  group.add(crowGroup);

  // --- 5. Interior Golden Sunbeams & Dynamic TV Wall Bounce Light ---
  const sunbeamGroup = new THREE.Group();
  sunbeamGroup.name = 'interior-sunbeams';
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe4a8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const beamGeo = new THREE.PlaneGeometry(1.45, 3.6);
  const beamSpots = [
    { x: -1.65, y: 1.35, z: -6.75, rx: 0.42, ry: 0.22 },
    { x: 1.65, y: 1.35, z: -6.75, rx: 0.42, ry: -0.18 }
  ];
  for (const b of beamSpots) {
    const shaft = new THREE.Mesh(beamGeo, beamMat);
    shaft.position.set(b.x, b.y, b.z);
    shaft.rotation.set(b.rx, b.ry, 0);
    sunbeamGroup.add(shaft);
  }
  sunbeamGroup.visible = false;
  group.add(sunbeamGroup);

  const tvGlow = new THREE.PointLight(0x88b4ff, 0, 6.2, 2);
  tvGlow.name = 'tv-wall-glow';
  tvGlow.position.set(TV_CENTER.x, TV_CENTER.y + 0.25, TV_CENTER.z + 0.45);
  group.add(tvGlow);

  const dummy = new THREE.Object3D();
  const exhaustWorld = new THREE.Vector3();
  const tvPalette = [0x6e9eff, 0xd4c47a, 0x7ac6a8, 0xd48e7a];
  const tvColA = new THREE.Color();
  const tvColB = new THREE.Color();
  let clock = 0;

  return {
    group,
    update(delta, { minutes = 600, rain = 0, car = null, driving = false, tvOn = false } = {}) {
      const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
      clock += dt;

      // 1) Chimney smoke: active in cool mornings (5:00-10:30) and evenings (17:00-23:30).
      const mornSmoke = THREE.MathUtils.smoothstep(minutes, 5 * 60, 6 * 60) * (1 - THREE.MathUtils.smoothstep(minutes, 9 * 60 + 30, 11 * 60));
      const eveSmoke = THREE.MathUtils.smoothstep(minutes, 17 * 60, 18 * 60 + 15) * (1 - THREE.MathUtils.smoothstep(minutes, 23 * 60, 23 * 60 + 55));
      const smokeStrength = Math.max(mornSmoke, eveSmoke) * Math.max(0.25, 1 - rain * 0.75);
      smokeMesh.visible = smokeStrength > 0.03;
      if (smokeMesh.visible) {
        smokeMat.opacity = 0.22 * smokeStrength;
        let idx = 0;
        for (let c = 0; c < CHIMNEY_POSITIONS.length; c++) {
          const ch = CHIMNEY_POSITIONS[c];
          for (let p = 0; p < puffsPerChimney; p++) {
            const life = (clock * 0.18 + p / puffsPerChimney + c * 0.23) % 1;
            const sway = Math.sin(clock * 0.9 + c * 1.7 + life * 4.0) * 0.35 * life;
            dummy.position.set(ch.x + life * 1.6 + sway, ch.y + life * 4.2, ch.z + life * 0.55);
            dummy.rotation.set(life * 2.1, clock * 0.4 + p, life * 1.4);
            const s = (0.45 + life * 1.85) * (1 - life * 0.25);
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            smokeMesh.setMatrixAt(idx++, dummy.matrix);
          }
        }
        smokeMesh.instanceMatrix.needsUpdate = true;
      }

      // 2) Pickup tailpipe exhaust wisps when driving.
      exhaustMesh.visible = !!car && driving;
      if (exhaustMesh.visible) {
        exhaustMat.opacity = 0.18;
        // Rear-left tailpipe in pickup local space (-2.38, 0.36, -0.58)
        exhaustWorld.set(-2.38, 0.36, -0.58);
        car.localToWorld(exhaustWorld);
        for (let i = 0; i < exhaustCount; i++) {
          const ep = exhaustPuffs[i];
          ep.age += dt * 1.35;
          if (ep.age >= 1) {
            ep.age = ep.age % 1;
            ep.x = exhaustWorld.x;
            ep.y = exhaustWorld.y;
            ep.z = exhaustWorld.z;
            ep.vx = (Math.random() - 0.5) * 0.4;
            ep.vy = 0.45 + Math.random() * 0.35;
            ep.vz = (Math.random() - 0.5) * 0.4;
          }
          const t = ep.age;
          dummy.position.set(ep.x + ep.vx * t, ep.y + ep.vy * t, ep.z + ep.vz * t);
          dummy.rotation.set(t * 2, t * 1.5, 0);
          dummy.scale.setScalar(0.28 + t * 0.72);
          dummy.updateMatrix();
          exhaustMesh.setMatrixAt(i, dummy.matrix);
        }
        exhaustMesh.instanceMatrix.needsUpdate = true;
      }

      // 3) Reflective roadside puddles during rain.
      const wet = Math.max(0, Math.min(1, Number(rain) || 0));
      puddleGroup.visible = wet > 0.05;
      if (puddleGroup.visible) {
        puddleMat.opacity = THREE.MathUtils.smoothstep(wet, 0.05, 0.65) * 0.62;
      }

      // 4) Soaring daytime birds & idle perched crows.
      const daytime = THREE.MathUtils.smoothstep(minutes, 6 * 60 + 15, 7 * 60 + 15) *
        (1 - THREE.MathUtils.smoothstep(minutes, 18 * 60 + 30, 19 * 60 + 30));
      birdGroup.visible = daytime > 0.1 && wet < 0.65;
      if (birdGroup.visible) {
        for (let i = 0; i < birds.length; i++) {
          const b = birds[i];
          const a = clock * b.speed + b.phase;
          const x = b.cx + Math.cos(a) * b.rx;
          const z = b.cz + Math.sin(a) * b.rz;
          const dx = -Math.sin(a) * b.rx * b.speed;
          const dz = Math.cos(a) * b.rz * b.speed;
          b.mesh.position.set(x, b.y + Math.sin(clock * 1.1 + b.phase) * 0.65, z);
          b.mesh.rotation.y = Math.atan2(dx, dz);
          const flap = Math.sin(clock * 6.5 + b.phase * 3.0) * 0.48;
          b.mesh.userData.leftWing.rotation.z = flap;
          b.mesh.userData.rightWing.rotation.z = -flap;
        }
      }
      for (let i = 0; i < crows.length; i++) {
        const c = crows[i];
        c.mesh.rotation.y = c.baseYaw + Math.sin(clock * 0.8 + c.phase) * 0.25;
      }

      // 5) Interior sunbeams & TV bounce light.
      const mornBeam = Math.exp(-(((minutes - (8 * 60 + 30)) / 75) ** 2));
      const aftBeam = Math.exp(-(((minutes - (17 * 60)) / 75) ** 2));
      const beamVis = Math.max(mornBeam, aftBeam) * Math.max(0, 1 - wet * 1.6);
      sunbeamGroup.visible = beamVis > 0.04;
      if (sunbeamGroup.visible) {
        beamMat.opacity = beamVis * 0.085;
      }

      if (tvOn) {
        const nightBoost = 0.55 + 0.85 * THREE.MathUtils.smoothstep(minutes, 18 * 60, 20 * 60);
        const flicker = 0.82 + 0.18 * Math.sin(clock * 7.5) + 0.08 * Math.sin(clock * 19.3);
        const ci = Math.floor(clock * 0.7) % tvPalette.length;
        const ni = (ci + 1) % tvPalette.length;
        const f = (clock * 0.7) % 1;
        tvGlow.color.copy(tvColA.setHex(tvPalette[ci])).lerp(tvColB.setHex(tvPalette[ni]), f);
        tvGlow.intensity = 6.5 * nightBoost * flicker;
      } else {
        tvGlow.intensity = 0;
      }
    }
  };
}
