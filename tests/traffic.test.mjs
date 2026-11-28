import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { createColliderWorld } = await import('../src/systems/collision.js');
const { buildTownTraffic } = await import('../src/world/traffic.js');

test('traffic cars have moving colliders and never pop in or out near the player', () => {
  const scene = new THREE.Scene();
  const world = createColliderWorld();
  scene.userData.colliders = world;
  const traffic = buildTownTraffic(scene, {});
  const car = traffic.cars[0];
  assert.ok(car.collider, 'each car gets a collider');

  traffic.update(0.1, { playerPos: { x: 0, z: -40 } });
  assert.ok(Math.abs((car.collider.minX + car.collider.maxX) / 2 - car.x) < 0.01, 'collider follows the car');

  traffic.update(0.1, { opening: true });
  assert.equal(car.collider.disabled, true, 'no collision during the opening');

  // Watching the east end: the car holds there instead of vanishing.
  const end = traffic.cars.find((c) => c.dir > 0);
  end.x = 200;
  traffic.update(0.1, { playerPos: { x: 108, z: end.z } });
  assert.equal(end.group.visible, true);
  assert.ok(end.x <= 115);
  // Walk away: it leaves and comes back from the far west end.
  traffic.update(0.1, { playerPos: { x: 0, z: -40 } });
  traffic.update(0.1, { playerPos: { x: 0, z: -40 } });
  assert.equal(end.waiting, false);
  assert.ok(end.x < -200);
});
