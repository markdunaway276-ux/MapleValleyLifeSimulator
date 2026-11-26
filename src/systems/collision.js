/**
 * Lightweight 2D XZ collision for the neighborhood.
 * Houses are axis-aligned boxes from authored footprints (not Box3 of a
 * pyramid roof). Tree trunks are circles. No physics engine.
 * A collider with a truthy `disabled` property (a getter is fine) is skipped,
 * which is how the main house's doorway is open only while its door is open.
 * A moving, rotated box (the drivable car) is an 'obb' collider; when its
 * heading is axis-aligned it is stored as a plain 'aabb' again, so a parked
 * car looks like any other box.
 */

export const PLAYER_RADIUS = 0.32;

/**
 * Longest single collision step for a walker. The thinnest walls are 0.15 m and
 * a box pushes you out on whichever side of its middle you are, so a move longer
 * than half of (wall + player width) can come out on the far side. 0.1 m is well
 * under that; a frame's move (up to 0.45 m on a slow frame) is split into steps.
 */
export const MAX_MOVE_STEP = 0.1;

/** world.resolveMove in steps of at most maxStep, so big frame moves cannot tunnel. */
export function resolveMoveStepped(world, x, z, dx, dz, radius = PLAYER_RADIUS, opts, maxStep = MAX_MOVE_STEP) {
  const dist = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(dist / maxStep));
  const sx = dx / n;
  const sz = dz / n;
  let px = x;
  let pz = z;
  for (let i = 0; i < n; i++) {
    const r = world.resolveMove(px, pz, sx, sz, radius, opts);
    px = r.x;
    pz = r.z;
  }
  return { x: px, z: pz };
}

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
  // 'obb' colliders are pushed out as a whole after the axis passes.
  return axis === 'x' ? x : z;
}

/**
 * Push a circle out of an oriented box (centre c.x/c.z, half-sizes hw along the
 * heading and hd across it, heading rotY as in three.js: local +x maps to
 * (cos, -sin)). Returns the new { x, z }, or null when there is no overlap.
 */
export function pushOutOBB(x, z, r, c) {
  const cos = Math.cos(c.rotY || 0);
  const sin = Math.sin(c.rotY || 0);
  const dx = x - c.x;
  const dz = z - c.z;
  let lx = dx * cos - dz * sin;
  let lz = dx * sin + dz * cos;
  const nx = clamp(lx, -c.hw, c.hw);
  const nz = clamp(lz, -c.hd, c.hd);
  const ox = lx - nx;
  const oz = lz - nz;
  const d2 = ox * ox + oz * oz;
  if (d2 >= r * r) return null;
  const skin = 1e-6;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const k = (r + skin) / d;
    lx = nx + ox * k;
    lz = nz + oz * k;
  } else {
    // Centre is inside the box: leave through the nearest face.
    const px = c.hw - Math.abs(lx);
    const pz = c.hd - Math.abs(lz);
    if (px < pz) lx = (lx < 0 ? -1 : 1) * (c.hw + r + skin);
    else lz = (lz < 0 ? -1 : 1) * (c.hd + r + skin);
  }
  return { x: c.x + lx * cos + lz * sin, z: c.z - lx * sin + lz * cos };
}

/**
 * Update a collider in place to a box at (x, z) with the given footprint and
 * heading. Axis-aligned headings become a plain 'aabb'; anything else is an
 * 'obb' that also carries its enclosing AABB (minX..maxZ) for map/debug use.
 */
export function syncBoxCollider(collider, { x, z, width, depth, rotY = 0 }) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const hw = width / 2;
  const hd = depth / 2;
  const ex = Math.abs(cos) * hw + Math.abs(sin) * hd;
  const ez = Math.abs(sin) * hw + Math.abs(cos) * hd;
  collider.x = x;
  collider.z = z;
  collider.hw = hw;
  collider.hd = hd;
  collider.rotY = rotY;
  collider.minX = x - ex;
  collider.maxX = x + ex;
  collider.minZ = z - ez;
  collider.maxZ = z + ez;
  collider.type = Math.abs(sin * cos) < 1e-4 ? 'aabb' : 'obb';
  return collider;
}

export function createColliderWorld() {
  const colliders = [];
  // Last position handed to resolveMove/resolvePosition; used by gated
  // colliders (e.g. the front doorway) to know whether someone is standing in them.
  const lastPoint = { x: 0, z: 0 };
  let hasLast = false;

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

  function skipped(c, skipId) {
    return !c || c.disabled || (skipId && c.id === skipId);
  }

  function overlaps(x, z, radius = PLAYER_RADIUS, skipId) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (skipped(c, skipId)) continue;
      if (c.type === 'aabb' && circleOverlapsAABB(x, z, radius, c)) return c;
      if (c.type === 'circle' && circleOverlapsCircle(x, z, radius, c)) return c;
      if (c.type === 'obb' && pushOutOBB(x, z, radius, c)) return c;
    }
    return null;
  }

  function pushOutOBBs(x, z, radius, skipId) {
    let hit = false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.type !== 'obb' || skipped(c, skipId)) continue;
      const p = pushOutOBB(x, z, radius, c);
      if (p) { x = p.x; z = p.z; hit = true; }
    }
    return hit ? { x, z } : null;
  }

  function resolveAxis(x, z, radius, axis, skipId) {
    for (let iter = 0; iter < 3; iter++) {
      let changed = false;
      for (let i = 0; i < colliders.length; i++) {
        if (skipped(colliders[i], skipId)) continue;
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

  function moveOpts(opts) {
    if (opts == null) return { skipId: null, record: true };
    if (typeof opts === 'string') return { skipId: opts, record: true };
    return { skipId: opts.skipId || null, record: opts.record !== false };
  }

  function resolveMove(x, z, dx, dz, radius = PLAYER_RADIUS, opts) {
    const { skipId, record } = moveOpts(opts);
    let nx = resolveAxis(x + dx, z, radius, 'x', skipId);
    let nz = resolveAxis(nx, z + dz, radius, 'z', skipId);
    for (let iter = 0; iter < 3; iter++) {
      const pushed = pushOutOBBs(nx, nz, radius, skipId);
      if (!pushed) break;
      nx = resolveAxis(pushed.x, pushed.z, radius, 'x', skipId);
      nz = resolveAxis(nx, pushed.z, radius, 'z', skipId);
    }
    if (record) {
      lastPoint.x = nx;
      lastPoint.z = nz;
      hasLast = true;
    }
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
    get lastPoint() { return hasLast ? lastPoint : null; },
    addHouse,
    addTree,
    addCircle: addTree,
    remove,
    overlaps,
    resolveMove,
    resolvePosition,
    unstick
  };
}
