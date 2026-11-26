import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREE } from './palette.js';
import { bakeFootAo, createPropMaterial } from './surfaces.js';

/**
 * Deterministic neighborhood trees, clear of the east–west road (z ≈ -4.65..0.85,
 * x ≈ -22..22), sidewalks, and the five house lots (Kenney at (0,-10), ~9.7×10.4 m,
 * plus four generated houses on both sides of the street).
 */
import { NORTH_FRONTAGE_OFFSET } from './street.js';

export const TREE_PLACEMENTS = [
  { x: -13.0, z: -18.0, seed: 101 }, // behind south-west house
  { x: 0.0, z: -19.5, seed: 202 },   // behind Kenney house
  { x: 13.5, z: -18.3, seed: 303 },  // behind south-east house
  { x: -13.0, z: 15.5 + NORTH_FRONTAGE_OFFSET, seed: 404 },  // behind north-west house
  { x: 13.2, z: 15.8 + NORTH_FRONTAGE_OFFSET, seed: 505 },   // behind north-east house
  { x: -21.5, z: -9.5, seed: 606 },  // west end, south yard
  { x: 41.5, z: -9.6, seed: 707 },   // east end, past the laundromat
  { x: -24.0, z: 6.5 + NORTH_FRONTAGE_OFFSET, seed: 808 },   // west end, north yard (clear of the NW wing)
  { x: 21.5, z: 6.8 + NORTH_FRONTAGE_OFFSET, seed: 909 }     // east end, north yard
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

/** Hash of a quantised position, so coincident vertices of a faceted mesh move together. */
function posHash(x, y, z) {
  let n = Math.imul(Math.round(x * 997), 374761393) ^ Math.imul(Math.round(y * 991), 668265263) ^ Math.imul(Math.round(z * 983), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Nudges every vertex along its radius by up to +-`amount`, identically for shared positions. */
function lump(geometry, amount) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + (posHash(x, y, z) - 0.5) * 2 * amount;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Shared geometries and a small material palette (cheap on mobile).
 * The geometries carry baked vertex colour (foliage darkens towards the
 * bottom of every cone and crown, with a per-vertex speckle; the trunk
 * darkens at the root), so a tree gets form and ambient occlusion with no
 * extra lights, textures or draw calls. Canopies are flat-shaded and lumpy.
 */
export function createTreeAssets(quality = {}) {
  const shadows = !!quality.shadows;
  // Tapered, 8-sided trunk with the foot darkened.
  const trunkGeo = bakeFootAo(new THREE.CylinderGeometry(0.72, 1, 1, 8), { strength: TREE.trunkFoot, height: 0.3, seed: 3 });
  const coneGeo = bakeFootAo(lump(new THREE.ConeGeometry(1, 1, 8, 1), 0.06), { strength: TREE.canopyFoot, height: 1, jitter: TREE.canopyJitter, top: 0.12, seed: 5 });
  const crownGeo = bakeFootAo(lump(new THREE.IcosahedronGeometry(1, 1), 0.1), { strength: TREE.canopyFoot, height: 2, jitter: TREE.canopyJitter, top: 0.1, seed: 9 });
  const trunkMats = TREE.trunks.map((color) => createPropMaterial({ color, roughness: 0.95, metalness: 0 }));
  const canopyMats = TREE.canopies.map((color) => createPropMaterial({ color, roughness: 0.88, metalness: 0, flatShading: true }));
  // Trees are merged into one mesh each; the piece colours are baked into the
  // vertices (palette colour x baked AO), so they all share this one material.
  const treeMat = createPropMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  return { trunkGeo, coneGeo, crownGeo, trunkMats, canopyMats, treeMat, shadows };
}

const _pieceColor = new THREE.Color();

/**
 * One tree piece as a non-indexed, transformed clone with its palette colour
 * multiplied into the baked vertex colours. `flat` gives crisp faceted shading
 * (the canopies); the trunk keeps its smooth normals.
 */
function treePiece(geo, material, position, scale, flat) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (flat) g.computeVertexNormals();
  g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(position, new THREE.Quaternion(), scale));
  const col = g.attributes.color;
  _pieceColor.copy(material.color);
  for (let i = 0; i < col.count; i++) {
    col.setXYZ(i, col.getX(i) * _pieceColor.r, col.getY(i) * _pieceColor.g, col.getZ(i) * _pieceColor.b);
  }
  return g;
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
  const pieces = [];

  const trunkH = (1.5 + rng() * 0.7) * scale;
  const trunkR = (0.15 + rng() * 0.07) * scale;
  const trunkMat = shared.trunkMats[Math.floor(rng() * shared.trunkMats.length)];
  pieces.push(treePiece(shared.trunkGeo, trunkMat,
    new THREE.Vector3(0, trunkH / 2, 0), new THREE.Vector3(trunkR, trunkH, trunkR), false));

  let radius = 0;
  if (pine) {
    const layers = 3;
    let y = trunkH * 0.55;
    for (let i = 0; i < layers; i++) {
      const r = (1.35 - i * 0.28) * scale * (0.9 + rng() * 0.2);
      const h = (1.15 - i * 0.1) * scale;
      const mat = shared.canopyMats[Math.floor(rng() * shared.canopyMats.length)];
      pieces.push(treePiece(shared.coneGeo, mat,
        new THREE.Vector3((rng() - 0.5) * 0.15 * scale, y + h * 0.35, (rng() - 0.5) * 0.15 * scale),
        new THREE.Vector3(r, h, r), true));
      radius = Math.max(radius, r + 0.15);
      y += h * 0.42;
    }
  } else {
    const layers = 2;
    let y = trunkH * 0.7;
    for (let i = 0; i < layers; i++) {
      const r = (1.15 - i * 0.25) * scale * (0.95 + rng() * 0.2);
      const mat = shared.canopyMats[Math.floor(rng() * shared.canopyMats.length)];
      pieces.push(treePiece(shared.crownGeo, mat,
        new THREE.Vector3((rng() - 0.5) * 0.2 * scale, y + r * 0.15, (rng() - 0.5) * 0.2 * scale),
        new THREE.Vector3(r, r * (0.85 + rng() * 0.2), r), true));
      radius = Math.max(radius, r + 0.2);
      y += r * 0.45;
    }
  }

  // One mesh (one draw call) per tree: trunk and every canopy layer merged.
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  const tree = new THREE.Mesh(merged, shared.treeMat);
  tree.name = 'tree-mesh';
  tree.castShadow = shadows;
  tree.receiveShadow = shadows;
  group.add(tree);

  // A slight yaw so a row of trees does not look copied
  group.rotation.y = rng() * Math.PI * 2;
  group.userData.radius = radius;
  group.userData.trunkRadius = trunkR;
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
