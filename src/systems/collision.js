/**
 * Lightweight 2D XZ collision for the neighborhood.
 * Houses are axis-aligned boxes from authored footprints (not Box3 of a
 * pyramid roof). Tree trunks are circles. No physics engine.
 */

export const PLAYER_RADIUS = 0.32;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * World-space XZ AABB for a house centred at (x, z).
 * rotY of 0 or π keeps width along X and depth along Z; ±π/2 swaps them.
 */
export function houseBounds(x, z, width, depth, rotY = 0) {
  const swap = Math.abs(Math.sin(rotY)) > 0.5;
  const hw = (swap ? depth : width) / 2;
  const hd = (swap ? width : depth) / 2;
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
}

function circleOverlapsAABB(x, z, r, b) {
  const dx = x - clamp(x, b.minX, b.maxX);
  const dz = z - clamp(z, b.minZ, b.maxZ);
  return dx * dx + dz * dz < r * r;
}

function circleOverlapsCircle(x, z, r, c) {
  const dx = x - c.x;
  const dz = z - c.z;
  const min = r + c.radius;
  return dx * dx + dz * dz < min * min;
}

function resolveCircleAABB(x, z, r, b, axis) {
  const skin = 1e-6;
  if (axis === 'x') {
    const dz = z - clamp(z, b.minZ, b.maxZ);
    if (dz * dz >= r * r) return x;
    const room = Math.sqrt(Math.max(0, r * r - dz * dz)) + skin;
    if (x > b.minX - room && x < b.maxX + room) {
      const mid = (b.minX + b.maxX) / 2;
      return x < mid ? b.minX - room : b.maxX + room;
    }
    return x;
  }
  const dx = x - clamp(x, b.minX, b.maxX);
  if (dx * dx >= r * r) return z;
  const room = Math.sqrt(Math.max(0, r * r - dx * dx)) + skin;
  if (z > b.minZ - room && z < b.maxZ + room) {
    const mid = (b.minZ + b.maxZ) / 2;
    return z < mid ? b.minZ - room : b.maxZ + room;
  }
  return z;
}

function resolveCircleCircle(x, z, r, c, axis) {
  const skin = 1e-6;
  const min = r + c.radius;
  if (axis === 'x') {
    const dz = z - c.z;
    if (dz * dz >= min * min) return x;
    const room = Math.sqrt(Math.max(0, min * min - dz * dz)) + skin;
    if (x > c.x - room && x < c.x + room) {
      return x < c.x ? c.x - room : c.x + room;
    }
    return x;
  }
  const dx = x - c.x;
  if (dx * dx >= min * min) return z;
  const room = Math.sqrt(Math.max(0, min * min - dx * dx)) + skin;
  if (z > c.z - room && z < c.z + room) {
    return z < c.z ? c.z - room : c.z + room;
  }
  return z;
}

function resolveOne(x, z, r, collider, axis) {
  if (collider.type === 'aabb') return resolveCircleAABB(x, z, r, collider, axis);
  if (collider.type === 'circle') return resolveCircleCircle(x, z, r, collider, axis);
  return axis === 'x' ? x : z;
}

export function createColliderWorld() {
  const colliders = [];

  function remove(id) {
    const i = colliders.findIndex((c) => c.id === id);
    if (i >= 0) colliders.splice(i, 1);
  }

  function addHouse(opts) {
    const id = opts.id;
    remove(id);
    let box;
    if (opts.minX !== undefined) {
      box = { minX: opts.minX, maxX: opts.maxX, minZ: opts.minZ, maxZ: opts.maxZ };
    } else {
      box = houseBounds(opts.x, opts.z, opts.width, opts.depth, opts.rotY || 0);
    }
    const collider = { type: 'aabb', id, ...box };
    colliders.push(collider);
    return collider;
  }

  function addTree(opts) {
    const id = opts.id;
    remove(id);
    const collider = { type: 'circle', id, x: opts.x, z: opts.z, radius: opts.radius };
    colliders.push(collider);
    return collider;
  }

  function overlaps(x, z, radius = PLAYER_RADIUS) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.type === 'aabb' && circleOverlapsAABB(x, z, radius, c)) return c;
      if (c.type === 'circle' && circleOverlapsCircle(x, z, radius, c)) return c;
    }
    return null;
  }

  function resolveAxis(x, z, radius, axis) {
    for (let iter = 0; iter < 3; iter++) {
      let changed = false;
      for (let i = 0; i < colliders.length; i++) {
        if (axis === 'x') {
          const nx = resolveOne(x, z, radius, colliders[i], 'x');
          if (nx !== x) { x = nx; changed = true; }
        } else {
          const nz = resolveOne(x, z, radius, colliders[i], 'z');
          if (nz !== z) { z = nz; changed = true; }
        }
      }
      if (!changed) break;
    }
    return axis === 'x' ? x : z;
  }

  function resolveMove(x, z, dx, dz, radius = PLAYER_RADIUS) {
    const nx = resolveAxis(x + dx, z, radius, 'x');
    const nz = resolveAxis(nx, z + dz, radius, 'z');
    return { x: nx, z: nz };
  }

  function resolvePosition(x, z, radius = PLAYER_RADIUS) {
    return resolveMove(x, z, 0, 0, radius);
  }

  function unstick(x, z, radius, spawn) {
    const p = resolvePosition(x, z, radius);
    if (!overlaps(p.x, p.z, radius * 0.99)) {
      return { x: p.x, z: p.z, reset: false };
    }
    if (spawn) {
      const s = resolvePosition(spawn.x, spawn.z, radius);
      return { x: s.x, z: s.z, reset: true };
    }
    return { x: p.x, z: p.z, reset: false };
  }

  return {
    colliders,
    addHouse,
    addTree,
    remove,
    overlaps,
    resolveMove,
    resolvePosition,
    unstick
  };
}
