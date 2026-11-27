// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const {
  CAR_PHYSICS,
  CAR_ID,
  wrapAngle,
  readDriveInput,
  stepCar,
  resolveCarPose
} = await import('../src/systems/car.js');
const { createColliderWorld } = await import('../src/systems/collision.js');

test('readDriveInput maps keyboard and joystick inputs and zeroes them when blocked', () => {
  const player = {
    keys: { forward: true, back: false, left: false, right: true },
    joystickX: 0,
    joystickY: 0
  };
  assert.deepEqual(readDriveInput(player, false), { throttle: 1, steer: 1 });
  assert.deepEqual(readDriveInput(player, true), { throttle: 0, steer: 0 });

  // Joystick overrides keyboard outside deadzone.
  player.joystickX = -0.5;
  player.joystickY = -0.8;
  assert.deepEqual(readDriveInput(player, false), { throttle: -0.8, steer: -0.5 });
});

test('stepCar accelerates, coasts to zero, brakes when blocked, and only turns while moving', () => {
  const state = { x: 0, z: 0, rotY: 0, speed: 0, steer: 0 };

  // Steering at standstill does not spin the car on the spot.
  stepCar(state, { throttle: 0, steer: 1 }, 0.1);
  assert.equal(state.rotY, 0);
  assert.ok(state.steer > 0);

  // Forward throttle accelerates along +x and turns right (lowering rotY).
  for (let i = 0; i < 20; i++) stepCar(state, { throttle: 1, steer: 0.5 }, 0.05);
  assert.ok(state.speed > 0 && state.speed <= CAR_PHYSICS.MAX_SPEED);
  assert.ok(state.x > 0);
  assert.ok(state.rotY < 0, 'right turn lowers rotY');

  // Braking stops the car promptly.
  for (let i = 0; i < 30; i++) stepCar(state, { throttle: 1, steer: 0 }, 0.05, { braking: true });
  assert.equal(state.speed, 0);

  // Reverse is capped at MAX_REVERSE.
  for (let i = 0; i < 40; i++) stepCar(state, { throttle: -1, steer: 0 }, 0.05);
  assert.ok(state.speed < 0 && state.speed >= -CAR_PHYSICS.MAX_REVERSE - 1e-6);

  // wrapAngle wraps into [-pi, pi].
  assert.ok(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9);
});

test('resolveCarPose and stepCar stop against house AABBs, circle trees, and street bounds', () => {
  const world = createColliderWorld();
  // Car's own collider must be ignored during self-resolution.
  world.addHouse({ id: CAR_ID, x: 0, z: 0, width: 4, depth: 1.85, rotY: 0 });
  // Wall straight ahead at x = 6 (spanning x = 5..7).
  world.addHouse({ id: 'wall', x: 6, z: 0, width: 2, depth: 8 });
  // Tree to the side at (0, 3).
  world.addTree({ id: 'tree', x: 0, z: 3, radius: 0.5 });

  const bounds = { minX: -20, maxX: 20, minZ: -10, maxZ: 10 };
  const clear = resolveCarPose(world, { x: 0, z: 0, rotY: 0 }, { bounds });
  assert.equal(clear.hit, false);

  // Driving straight into the wall stops the car outside x = 5 - halfWidth (3).
  const state = { x: 1, z: 0, rotY: 0, speed: 5, steer: 0 };
  let hit = false;
  for (let i = 0; i < 20; i++) {
    const r = stepCar(state, { throttle: 1, steer: 0 }, 0.05, { world, bounds });
    if (r.hit) hit = true;
  }
  assert.equal(hit, true);
  assert.ok(state.x <= 3.01, `car should stop before wall, got x=${state.x}`);
  assert.equal(state.speed, 0);

  // Pushing into a tree circle pushes the car out cleanly.
  const treeHit = resolveCarPose(world, { x: 0, z: 2.2, rotY: 0 }, { bounds });
  assert.equal(treeHit.hit, true);
  assert.ok(treeHit.z < 2.2);

  // Pushing past street bounds clamps inside bounds.
  const boundHit = resolveCarPose(world, { x: 25, z: 0, rotY: 0 }, { bounds });
  assert.equal(boundHit.hit, true);
  assert.ok(boundHit.x <= bounds.maxX - 2 + 1e-6);
});
