// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const {
  INTERACT_RANGE,
  segmentHitsBox,
  hasLineOfReach,
  nearestActionTarget
} = await import('../src/systems/interactables.js');
const { createColliderWorld } = await import('../src/systems/collision.js');

test('segmentHitsBox detects crossing, parallel, and missed XZ segments accurately', () => {
  const box = { minX: 2, maxX: 4, minZ: -1, maxZ: 1 };
  assert.equal(segmentHitsBox(0, 0, 6, 0, box), true);
  assert.equal(segmentHitsBox(3, -3, 3, 3, box), true);
  assert.equal(segmentHitsBox(0, 2, 6, 2, box), false);
  assert.equal(segmentHitsBox(0, 0, 1.5, 0, box), false);
  assert.equal(segmentHitsBox(1, -2, 5, 2, box), true);
  assert.equal(segmentHitsBox(1, -2, 2, -2, box), false);
});

test('hasLineOfReach blocks through thin walls and big boxes, ignores small furniture and disabled gates', () => {
  const world = createColliderWorld();
  // Thin interior partition wall along x = 2 (thickness 0.16 <= WALL_MAX_THICKNESS).
  world.addHouse({ id: 'partition', minX: 1.92, maxX: 2.08, minZ: -3, maxZ: 3 });
  // Small chair collider (0.6 x 0.6) should NOT block reach.
  world.addHouse({ id: 'chair', minX: -0.3, maxX: 0.3, minZ: 4.7, maxZ: 5.3 });
  // Disabled doorway gate should NOT block reach.
  const gate = world.addHouse({ id: 'door-gate', minX: -1, maxX: 1, minZ: -5.05, maxZ: -4.95 });
  gate.disabled = true;

  // Across partition wall: blocked.
  assert.equal(hasLineOfReach(world, { x: 0, z: 0 }, { x: 4, z: 0 }), false);
  // Target mounted right on the wall (within TARGET_CLEARANCE = 0.35): reachable.
  assert.equal(hasLineOfReach(world, { x: 0, z: 0 }, { x: 1.85, z: 0 }), true);
  // Across small chair: reachable.
  assert.equal(hasLineOfReach(world, { x: 0, z: 3 }, { x: 0, z: 7 }), true);
  // Across open doorway gate: reachable.
  assert.equal(hasLineOfReach(world, { x: 0, z: -3 }, { x: 0, z: -7 }), true);
  // Closing doorway gate blocks reach.
  gate.disabled = false;
  assert.equal(hasLineOfReach(world, { x: 0, z: -3 }, { x: 0, z: -7 }), false);
});

test('nearestActionTarget skips blocked targets, enforces custom reach, and supports development reach', () => {
  const world = createColliderWorld();
  world.addHouse({ id: 'wall', minX: 0.9, maxX: 1.1, minZ: -4, maxZ: 4 });

  const behindWall = { isObject3D: true, name: 'bed', visible: true, userData: {}, position: { x: 2.0, y: 1.6, z: 0 } };
  const closeSeat = { isObject3D: true, name: 'sofa', visible: true, userData: {}, position: { x: -2.2, y: 1.6, z: 0 } };
  const farMailbox = { isObject3D: true, name: 'mailbox', visible: true, userData: {}, position: { x: -2.6, y: 1.6, z: 0 } };
  const scene = {
    userData: {
      colliders: world,
      doors: [],
      interactables: [
        { id: 'bed', object: behindWall },
        { id: 'sofa', object: closeSeat, range: 1.7 },
        { id: 'mailbox', object: farMailbox }
      ]
    }
  };

  // At origin: bed (2.0 m) is behind wall, sofa (2.2 m) exceeds its 1.7 m range -> picks mailbox (2.6 m).
  assert.equal(nearestActionTarget(scene, { x: 0, y: 1.6, z: 0 }, INTERACT_RANGE), farMailbox);

  // Move within 1.7 m of sofa: picks sofa.
  assert.equal(nearestActionTarget(scene, { x: -1.0, y: 1.6, z: 0 }, INTERACT_RANGE), closeSeat);

  // Development mode bypasses shorter per-entry range (sofa at 2.2 m wins over mailbox at 2.6 m),
  // while still respecting walls (bed at 2.0 m stays blocked).
  assert.equal(nearestActionTarget(scene, { x: 0, y: 1.6, z: 0 }, 12, { development: true }), closeSeat);
});

test('INTERACT_RANGE is owned by systems/interactables.js with no inverted ui/ imports', () => {
  assert.equal(INTERACT_RANGE, 3);
  for (const rel of ['src/systems/interactables.js', 'src/systems/teleports.js', 'src/systems/interactableHighlight.js']) {
    const src = readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
    assert.equal(src.includes('../ui/interactPrompt.js'), false, `${rel} should not import from ui/interactPrompt.js`);
  }
});
