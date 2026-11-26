// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createColliderWorld, resolveMoveStepped, PLAYER_RADIUS, MAX_MOVE_STEP } from '../src/systems/collision.js';

// A 0.15 m interior wall along z = 0 (like the bathroom / bedroom partitions).
function wallWorld() {
  const w = createColliderWorld();
  w.addHouse({ id: 'wall', minX: -3, maxX: 3, minZ: -0.075, maxZ: 0.075 });
  return w;
}
const r = PLAYER_RADIUS;
const touching = 0.075 + r + 0.001; // standing right against the wall's +z face

test('one big unstepped move (slow frame) can pass through a thin wall', () => {
  // 4.5 m/s * 0.1 s (the longest frame the game allows) = 0.45 m in one go.
  const out = wallWorld().resolveMove(0, touching, 0, -0.45, r);
  assert.ok(out.z < 0, `expected the old behaviour to end up past the wall, got z ${out.z}`);
});

test('the stepped move stops at the wall instead', () => {
  const out = resolveMoveStepped(wallWorld(), 0, touching, 0, -0.45, r);
  assert.ok(out.z > 0.075 + r - 1e-3, `player went into or through the wall: z ${out.z}`);
});

test('even a very long move (a 1 s hitch) cannot tunnel', () => {
  const out = resolveMoveStepped(wallWorld(), 0, 2, 0, -4.5, r);
  assert.ok(out.z > 0.075 + r - 1e-3, `z ${out.z}`);
});

test('free movement goes the full distance and still slides along walls', () => {
  const w = wallWorld();
  const free = resolveMoveStepped(w, 0, 2, 0.3, -0.4, r);
  assert.ok(Math.abs(free.x - 0.3) < 1e-9 && Math.abs(free.z - 1.6) < 1e-9);
  const slide = resolveMoveStepped(w, 0, touching, 0.4, -0.3, r);
  assert.ok(Math.abs(slide.x - 0.4) < 1e-9, `slid ${slide.x}`);
  assert.ok(slide.z > 0.075 + r - 1e-3);
});

test('steps are no longer than MAX_MOVE_STEP, which is under half the thinnest wall plus the player', () => {
  assert.ok(MAX_MOVE_STEP <= 0.1);
  assert.ok(MAX_MOVE_STEP < (0.15 + 2 * r) / 2);
});
