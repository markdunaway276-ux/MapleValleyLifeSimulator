import * as THREE from 'three';

/**
 * Deterministic placements, clear of:
 *   Kenney / fallback house around (0, 0, -10) (~6.5 x 7 m)
 *   neighbor generated house at (12, 0, -10)
 *   interactable door near (0, 0.67, -7.28)
 *   player spawn at (0, 1.6, 5)
 *   the walking line between spawn and the door (and the optional path)
 */
export const TREE_PLACEMENTS = [
  { x: -8.5, z: -8.0, seed: 101 },
  { x: -7.0, z: -16.5, seed: 202 },
  { x: 4.5, z: -18.0, seed: 303 },
  { x: 20.0, z: -12.0, seed: 404 },
  { x: -6.5, z: 3.5, seed: 505 },
  { x: 7.5, z: 2.5, seed: 606 }
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
