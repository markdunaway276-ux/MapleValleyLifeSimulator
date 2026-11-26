import * as THREE from 'three';

/**
 * Optional collision visualizer. Draws every collider (house/car boxes in red,
 * tree trunks in cyan) as wireframe outlines plus a green ring at the player's
 * feet. Built lazily when enabled, rebuilt if the collider set changes, and
 * fully disposed when disabled. Zero cost while off.
 */

const BOX_TOP = 2.2;
const CIRCLE_TOP = 2.0;
const FLOOR = 0.05;
const RING_SEGMENTS = 24;
const RED = new THREE.Color(0xff3b30);
const CYAN = new THREE.Color(0x30d5ff);
const GREEN = new THREE.Color(0x4cd964);

export function colliderSignature(list) {
  return list
    .map((c) => (c.type === 'aabb'
      ? `${c.id}|b|${c.minX}|${c.maxX}|${c.minZ}|${c.maxZ}${c.disabled ? '|off' : ''}`
      : `${c.id}|c|${c.x}|${c.z}|${c.radius}`))
    .join(';');
}

function pushSeg(pos, col, color, ax, ay, az, bx, by, bz) {
  pos.push(ax, ay, az, bx, by, bz);
  col.push(color.r, color.g, color.b, color.r, color.g, color.b);
}

function addBox(pos, col, c) {
  const { minX, maxX, minZ, maxZ } = c;
  const corners = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i];
    const [x1, z1] = corners[(i + 1) % 4];
    pushSeg(pos, col, RED, x0, FLOOR, z0, x1, FLOOR, z1);
    pushSeg(pos, col, RED, x0, BOX_TOP, z0, x1, BOX_TOP, z1);
    pushSeg(pos, col, RED, x0, FLOOR, z0, x0, BOX_TOP, z0);
  }
}

function addRing(pos, col, color, cx, cz, r, y) {
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a0 = (i / RING_SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
    pushSeg(pos, col, color,
      cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r,
      cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r);
  }
}

function addCylinder(pos, col, c) {
  addRing(pos, col, CYAN, c.x, c.z, c.radius, FLOOR);
  addRing(pos, col, CYAN, c.x, c.z, c.radius, CIRCLE_TOP);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = c.x + Math.cos(a) * c.radius;
    const z = c.z + Math.sin(a) * c.radius;
    pushSeg(pos, col, CYAN, x, FLOOR, z, x, CIRCLE_TOP, z);
  }
}

function makeLines(pos, col) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true });
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 999;
  lines.frustumCulled = false;
  return lines;
}

export function createCollisionViz({ scene, getWorld, getPlayerRadius = () => 0.32 }) {
  let group = null;
  let colliderLines = null;
  let playerRing = null;
  let signature = '';
  let colliderCount = 0;

  function disposeLines() {
    if (colliderLines) {
      group.remove(colliderLines);
      colliderLines.geometry.dispose();
      colliderLines.material.dispose();
      colliderLines = null;
    }
  }

  function build() {
    const world = getWorld();
    const list = (world && world.colliders) || [];
    const pos = [];
    const col = [];
    for (const c of list) {
      if (c.disabled) continue; // e.g. the doorway while the front door is open
      if (c.type === 'aabb') addBox(pos, col, c);
      else if (c.type === 'circle') addCylinder(pos, col, c);
    }
    disposeLines();
    colliderCount = list.length;
    signature = colliderSignature(list);
    if (pos.length) {
      colliderLines = makeLines(pos, col);
      colliderLines.name = 'collision-viz-colliders';
      group.add(colliderLines);
    }
    group.userData.count = colliderCount;
  }

  function enable() {
    if (group) return;
    group = new THREE.Group();
    group.name = 'collision-viz';
    group.userData.debug = true;
    const pos = [];
    const col = [];
    addRing(pos, col, GREEN, 0, 0, getPlayerRadius(), FLOOR + 0.02);
    playerRing = makeLines(pos, col);
    playerRing.name = 'collision-viz-player';
    group.add(playerRing);
    scene.add(group);
    build();
  }

  function disable() {
    if (!group) return;
    disposeLines();
    if (playerRing) {
      group.remove(playerRing);
      playerRing.geometry.dispose();
      playerRing.material.dispose();
      playerRing = null;
    }
    scene.remove(group);
    group = null;
    signature = '';
    colliderCount = 0;
  }

  /** Rebuild if the collider set changed (e.g. Kenney model swap). Returns true if rebuilt. */
  function sync() {
    if (!group) return false;
    const world = getWorld();
    const list = (world && world.colliders) || [];
    if (colliderSignature(list) === signature) return false;
    build();
    return true;
  }

  function updatePlayer(position) {
    if (playerRing && position) playerRing.position.set(position.x, 0, position.z);
  }

  return {
    enable,
    disable,
    sync,
    updatePlayer,
    isEnabled: () => !!group,
    count: () => colliderCount,
    get group() { return group; }
  };
}
