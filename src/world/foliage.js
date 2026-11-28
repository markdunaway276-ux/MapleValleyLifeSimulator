import * as THREE from 'three';
import { STREET, DRIVEWAY, GARAGE_LOT, SURFACE_Y } from './street.js';

/**
 * 3D instanced ground detail for Maple Lane:
 * - Wind-swaying 3D grass tufts across lawns & Maple Lane Park
 * - Scattered fallen autumn maple leaves in crimson, amber, and gold
 * - Sunlit clover & wildflower clusters along lawn edges and the pond bank
 * - Gently drifting wind-blown maple leaves floating through the breeze
 *
 * Uses only 4 draw calls total, scales counts cleanly for mobile, and avoids
 * roads, sidewalks, driveways, building footprints, paths, and pond water.
 */

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function inRect(x, z, r, pad = 0) {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

function isBlockedGround(x, z, colliders) {
  // Keep clear of main road + both sidewalks.
  const roadHalf = STREET.roadWidth / 2 + STREET.sidewalkWidth + 0.55;
  if (Math.abs(z - STREET.roadCenterZ) < roadHalf) return true;

  // Keep clear of main house driveway and garage lot.
  if (DRIVEWAY && Math.abs(x - DRIVEWAY.x) < DRIVEWAY.width / 2 + 0.65 && z < DRIVEWAY.maxZ + 0.4 && z > DRIVEWAY.minZ - 0.5) return true;
  if (GARAGE_LOT && inRect(x, z, GARAGE_LOT, 0.5)) return true;

  // Keep clear of Maple Lane Park roads, paved paths, pond water, and playground mulch.
  const exp = STREET.expansion;
  if (exp) {
    for (const r of exp.roads || []) if (inRect(x, z, r, 0.55)) return true;
    for (const p of exp.paths || []) if (inRect(x, z, p, 0.45)) return true;
    if (exp.plaza && inRect(x, z, exp.plaza, 0.4)) return true;
    if (exp.playground && inRect(x, z, exp.playground, 0.5)) return true;
    if (exp.pond) {
      const cx = (exp.pond.minX + exp.pond.maxX) / 2;
      const cz = (exp.pond.minZ + exp.pond.maxZ) / 2;
      const rx = (exp.pond.maxX - exp.pond.minX) / 2 + 0.6;
      const rz = (exp.pond.maxZ - exp.pond.minZ) / 2 + 0.6;
      const dx = (x - cx) / rx;
      const dz = (z - cz) / rz;
      if (dx * dx + dz * dz < 1.0) return true;
    }
  }

  // Keep clear of building colliders (houses, shops, sheds, trailers, dumpsters).
  if (colliders?.houses) {
    for (const h of colliders.houses) {
      const hw = (h.width || 2) / 2 + 0.55;
      const hd = (h.depth || 2) / 2 + 0.55;
      if (Math.abs(x - h.x) < hw && Math.abs(z - h.z) < hd) return true;
    }
  }
  return false;
}

/** Builds a lightweight 3-blade crossed grass tuft geometry (18 tris). */
function createGrassTuftGeometry() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
  for (let b = 0; b < angles.length; b++) {
    const a = angles[b];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w = 0.055;
    const h = 0.22 + (b === 1 ? 0.05 : 0);
    const lean = (b - 1) * 0.035;
    // Two triangles per tapered blade.
    const x0 = -w * ca, z0 = -w * sa;
    const x1 = w * ca, z1 = w * sa;
    const xt = lean * sa, zt = -lean * ca;
    const nx = -sa, nz = ca;
    positions.push(
      x0, 0, z0,
      x1, 0, z1,
      xt, h, zt
    );
    normals.push(
      nx, 0.5, nz,
      nx, 0.5, nz,
      nx, 0.8, nz
    );
    uvs.push(0, 0, 1, 0, 0.5, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/** Builds a crisp 5-point maple-leaf silhouette quad (4 tris). */
function createLeafGeometry(scale = 0.085) {
  const s = scale;
  const positions = [
    0, 0, -s,
    -s * 0.85, 0.008, -s * 0.1,
    0, 0.005, 0,

    0, 0, -s,
    0, 0.005, 0,
    s * 0.85, 0.008, -s * 0.1,

    -s * 0.72, 0.006, s * 0.35,
    0, 0, s,
    0, 0.005, 0,

    0, 0, s,
    s * 0.72, 0.006, s * 0.35,
    0, 0.005, 0
  ];
  const normals = new Array(positions.length).fill(0);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

/** Builds a tiny 3-bloom wildflower/clover cluster (6 tris). */
function createFlowerGeometry() {
  const positions = [];
  const normals = [];
  const offsets = [
    [0, 0.12, 0, 0.036],
    [0.06, 0.09, 0.04, 0.028],
    [-0.05, 0.10, -0.05, 0.030]
  ];
  for (const [ox, oy, oz, r] of offsets) {
    // Tilted diamond petal cap.
    positions.push(
      ox - r, oy, oz,
      ox, oy + r * 0.45, oz + r,
      ox + r, oy, oz,

      ox + r, oy, oz,
      ox, oy + r * 0.45, oz - r,
      ox - r, oy, oz
    );
    for (let k = 0; k < 6; k++) normals.push(0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export function buildGroundFoliage(scene, quality = {}) {
  const hi = !!quality.shadows;
  const group = new THREE.Group();
  group.name = 'ground-foliage';

  const colliders = scene?.userData?.colliders;
  const rand = makeRng(20261127);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Sampling zones: main Maple Lane lawns + Maple Lane Park grounds.
  const zones = [
    { minX: -48, maxX: 50, minZ: -26, maxZ: -6.5, weight: 0.40 },
    { minX: -48, maxX: 50, minZ: 10.5, maxZ: 28, weight: 0.30 },
    { minX: 54, maxX: 98, minZ: -12, maxZ: 34, weight: 0.30 }
  ];

  function pickSpot() {
    for (let tries = 0; tries < 24; tries++) {
      let r = rand();
      let zDef = zones[0];
      for (const z of zones) {
        if (r <= z.weight) { zDef = z; break; }
        r -= z.weight;
      }
      const x = zDef.minX + rand() * (zDef.maxX - zDef.minX);
      const z = zDef.minZ + rand() * (zDef.maxZ - zDef.minZ);
      if (!isBlockedGround(x, z, colliders)) return { x, z };
    }
    return null;
  }

  // --- 1. Wind-swaying 3D Grass Tufts ---
  const grassCount = hi ? 850 : 300;
  const grassGeo = createGrassTuftGeometry();
  const windUniform = { value: 0 };
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.90,
    metalness: 0,
    side: THREE.DoubleSide
  });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float sway = sin(uWindTime * 1.65 + instPos.x * 0.35 + instPos.z * 0.28) * 0.045;
        transformed.x += sway * uv.y * uv.y;
        transformed.z += sway * 0.55 * uv.y * uv.y;`);
  };
  grassMat.customProgramCacheKey = () => 'grass-wind-v1';

  const grassPalette = [0x4c6e3c, 0x597c43, 0x3f6034, 0x6b7f44, 0x5c723d];
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassMesh.name = 'foliage-grass-tufts';
  grassMesh.receiveShadow = hi;
  let placedGrass = 0;
  for (let i = 0; i < grassCount; i++) {
    const pt = pickSpot();
    if (!pt) continue;
    const s = 0.72 + rand() * 0.78;
    dummy.position.set(pt.x, SURFACE_Y.ground + 0.002, pt.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(s, 0.75 + rand() * 0.65, s);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(placedGrass, dummy.matrix);
    color.setHex(grassPalette[Math.floor(rand() * grassPalette.length)]);
    grassMesh.setColorAt(placedGrass, color);
    placedGrass++;
  }
  grassMesh.count = placedGrass;
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  group.add(grassMesh);

  // --- 2. Fallen Autumn Maple Leaves ---
  const leafCount = hi ? 420 : 150;
  const leafGeo = createLeafGeometry(0.088);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const leafPalette = [0xb84824, 0xd47824, 0xc9962c, 0x9c3820, 0x8f5628, 0xde9e36];
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leafMesh.name = 'foliage-fallen-leaves';
  leafMesh.receiveShadow = hi;
  let placedLeaves = 0;
  for (let i = 0; i < leafCount; i++) {
    const pt = pickSpot();
    if (!pt) continue;
    const s = 0.7 + rand() * 0.9;
    dummy.position.set(pt.x, SURFACE_Y.ground + 0.009 + rand() * 0.004, pt.z);
    dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
    dummy.scale.set(s, 1, s);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(placedLeaves, dummy.matrix);
    color.setHex(leafPalette[Math.floor(rand() * leafPalette.length)]);
    leafMesh.setColorAt(placedLeaves, color);
    placedLeaves++;
  }
  leafMesh.count = placedLeaves;
  leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
  group.add(leafMesh);

  // --- 3. Wildflowers & Clover Clusters ---
  const flowerCount = hi ? 130 : 50;
  const flowerGeo = createFlowerGeometry();
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const flowerPalette = [0xf4eedc, 0xf2cf58, 0xd6c2eb, 0xf6c688, 0xeef2d8];
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  flowerMesh.name = 'foliage-wildflowers';
  let placedFlowers = 0;
  for (let i = 0; i < flowerCount; i++) {
    const pt = pickSpot();
    if (!pt) continue;
    const s = 0.8 + rand() * 0.65;
    dummy.position.set(pt.x, SURFACE_Y.ground + 0.005, pt.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(placedFlowers, dummy.matrix);
    color.setHex(flowerPalette[Math.floor(rand() * flowerPalette.length)]);
    flowerMesh.setColorAt(placedFlowers, color);
    placedFlowers++;
  }
  flowerMesh.count = placedFlowers;
  flowerMesh.instanceMatrix.needsUpdate = true;
  if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
  group.add(flowerMesh);

  // --- 4. Gently Drifting Wind-Blown Maple Leaves ---
  const driftCount = hi ? 32 : 14;
  const driftGeo = createLeafGeometry(0.095);
  const driftMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const driftMesh = new THREE.InstancedMesh(driftGeo, driftMat, driftCount);
  driftMesh.name = 'foliage-drifting-leaves';
  driftMesh.frustumCulled = false;
  const driftSeeds = [];
  for (let i = 0; i < driftCount; i++) {
    driftSeeds.push({
      ox: (rand() - 0.5) * 32,
      oy: 0.5 + rand() * 5.2,
      oz: (rand() - 0.5) * 32,
      phase: rand() * Math.PI * 2,
      speed: 0.35 + rand() * 0.45,
      scale: 0.8 + rand() * 0.6
    });
    color.setHex(leafPalette[Math.floor(rand() * leafPalette.length)]);
    driftMesh.setColorAt(i, color);
  }
  if (driftMesh.instanceColor) driftMesh.instanceColor.needsUpdate = true;
  group.add(driftMesh);

  scene.add(group);

  let clock = 0;
  return {
    group,
    update(delta, { playerPos, rain = 0 } = {}) {
      const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
      clock += dt;
      windUniform.value = clock;

      // Suppress drifting leaves in heavy rain.
      const showDrift = rain < 0.65;
      driftMesh.visible = showDrift;
      if (!showDrift) return;

      const px = playerPos ? playerPos.x : 0;
      const pz = playerPos ? playerPos.z : 0;
      const span = 32;
      for (let i = 0; i < driftCount; i++) {
        const d = driftSeeds[i];
        const fall = ((d.oy - clock * d.speed * 0.65) % 5.5 + 5.5) % 5.5 + 0.15;
        const wx = px + ((((d.ox + clock * 0.95 + Math.sin(clock * 1.4 + d.phase) * 0.9) + span / 2) % span + span) % span) - span / 2;
        const wz = pz + ((((d.oz + clock * 0.35 + Math.cos(clock * 1.1 + d.phase) * 0.8) + span / 2) % span + span) % span) - span / 2;
        dummy.position.set(wx, fall, wz);
        dummy.rotation.set(
          Math.sin(clock * 2.1 + d.phase) * 0.85,
          clock * 1.3 + d.phase,
          Math.cos(clock * 1.8 + d.phase) * 0.75
        );
        dummy.scale.setScalar(d.scale);
        dummy.updateMatrix();
        driftMesh.setMatrixAt(i, dummy.matrix);
      }
      driftMesh.instanceMatrix.needsUpdate = true;
    }
  };
}
