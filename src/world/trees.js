import * as THREE from 'three';

/**
 * Deterministic neighborhood trees, clear of the east–west road (z ≈ -4.65..0.85,
 * x ≈ -22..22), sidewalks, and the five house lots (Kenney at (0,-10), ~9.7×10.4 m,
 * plus four generated houses on both sides of the street).
 */
export const TREE_PLACEMENTS = [
  { x: -13.0, z: -18.0, seed: 101 }, // behind south-west house
  { x: 0.0, z: -19.5, seed: 202 },   // behind Kenney house
  { x: 13.5, z: -18.3, seed: 303 },  // behind south-east house
  { x: -13.0, z: 15.5, seed: 404 },  // behind north-west house
  { x: 13.2, z: 15.8, seed: 505 },   // behind north-east house
  { x: -21.5, z: -9.5, seed: 606 },  // west end, south yard
  { x: 22.0, z: -9.6, seed: 707 },   // east end, south yard
  { x: -21.5, z: 6.5, seed: 808 },   // west end, north yard
  { x: 21.5, z: 6.8, seed: 909 }     // east end, north yard
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared geometries and a small material palette (cheap on mobile). */
export function createTreeAssets(quality = {}) {
  const shadows = !!quality.shadows;
  const trunkGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const crownGeo = new THREE.IcosahedronGeometry(1, 0);
  const trunkMats = [0x5a3a22, 0x6b4a2e].map((color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })
  );
  const canopyMats = [0x2f6a32, 0x3d7a38, 0x27602c].map((color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 })
  );
  return { trunkGeo, coneGeo, crownGeo, trunkMats, canopyMats, shadows };
}

/**
 * One procedural tree as a Group. Origin is the base centre (y=0).
 * options.shared should come from createTreeAssets() so geometries and
 * materials are reused; a private set is created if it is omitted.
 */
export function createTree(options = {}) {
  const shared = options.shared || createTreeAssets({ shadows: !!options.shadows });
  const rng = mulberry32(options.seed ?? 1);
  const scale = options.scale ?? (0.9 + rng() * 0.35);
  const shadows = options.shadows !== undefined ? !!options.shadows : !!shared.shadows;
  const pine = rng() < 0.55;

  const group = new THREE.Group();
  group.name = 'tree';

  const trunkH = (1.5 + rng() * 0.7) * scale;
  const trunkR = (0.15 + rng() * 0.07) * scale;
  const trunk = new THREE.Mesh(
    shared.trunkGeo,
    shared.trunkMats[Math.floor(rng() * shared.trunkMats.length)]
  );
  trunk.name = 'trunk';
  trunk.scale.set(trunkR, trunkH, trunkR);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = shadows;
  trunk.receiveShadow = shadows;
  group.add(trunk);

  let radius = 0;
  if (pine) {
    const layers = 3;
    let y = trunkH * 0.55;
    for (let i = 0; i < layers; i++) {
      const r = (1.35 - i * 0.28) * scale * (0.9 + rng() * 0.2);
      const h = (1.15 - i * 0.1) * scale;
      const cone = new THREE.Mesh(
        shared.coneGeo,
        shared.canopyMats[Math.floor(rng() * shared.canopyMats.length)]
      );
      cone.name = 'canopy';
      cone.scale.set(r, h, r);
      cone.position.set((rng() - 0.5) * 0.15 * scale, y + h * 0.35, (rng() - 0.5) * 0.15 * scale);
      cone.castShadow = shadows;
      cone.receiveShadow = shadows;
      group.add(cone);
      radius = Math.max(radius, r + 0.15);
      y += h * 0.42;
    }
  } else {
    const layers = 2;
    let y = trunkH * 0.7;
    for (let i = 0; i < layers; i++) {
      const r = (1.15 - i * 0.25) * scale * (0.95 + rng() * 0.2);
      const crown = new THREE.Mesh(
        shared.crownGeo,
        shared.canopyMats[Math.floor(rng() * shared.canopyMats.length)]
      );
      crown.name = 'canopy';
      crown.scale.set(r, r * (0.85 + rng() * 0.2), r);
      crown.position.set((rng() - 0.5) * 0.2 * scale, y + r * 0.15, (rng() - 0.5) * 0.2 * scale);
      crown.castShadow = shadows;
      crown.receiveShadow = shadows;
      group.add(crown);
      radius = Math.max(radius, r + 0.2);
      y += r * 0.45;
    }
  }

  // A slight yaw so a row of trees does not look copied
  group.rotation.y = rng() * Math.PI * 2;
  group.userData.radius = radius;
  group.userData.pine = pine;
  return group;
}

/** Place trees at the given {x,z,seed,scale} list and add them to the scene. */
export function scatterTrees(scene, positions, quality) {
  const shared = createTreeAssets(quality);
  const trees = [];
  for (const p of positions) {
    const tree = createTree({
      seed: p.seed,
      scale: p.scale,
      shadows: !!quality.shadows,
      shared
    });
    tree.position.set(p.x, 0, p.z);
    scene.add(tree);
    trees.push(tree);
  }
  return trees;
}
