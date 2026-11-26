import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNpc } from '../src/data/npcs.js';
import { routineAt, routineStop } from '../src/systems/neighbourRoutine.js';

const sam = getNpc('sam');
const june = getNpc('june');

test('neighbours keep different walking hours and head home in rain or at night', () => {
  assert.equal(routineAt(sam, 8 * 60, false), 'walk');
  assert.equal(routineAt(june, 8 * 60, false), 'rest');
  assert.equal(routineAt(sam, 12 * 60, false), 'rest');
  assert.equal(routineAt(june, 12 * 60, false), 'walk');
  for (const npc of [sam, june]) {
    assert.equal(routineAt(npc, 10 * 60, true), 'home');
    assert.equal(routineAt(npc, 22 * 60, false), 'home');
  }
});

test('neighbours use the sidewalk before turning home and rejoin it when leaving', () => {
  for (const npc of [sam, june]) {
    const { home } = npc.routine;
    const corner = { x: home.x, z: npc.patrol.z };
    const spawn = { x: npc.patrol.startX, z: npc.patrol.z };
    assert.deepEqual(routineStop(npc, 'home', spawn), corner);
    assert.deepEqual(routineStop(npc, 'home', corner), home);
    assert.deepEqual(routineStop(npc, 'walk', home), corner);
    assert.deepEqual(routineStop(npc, 'walk', corner), { x: npc.patrol.x0, z: npc.patrol.z });
    assert.equal(routineStop(npc, 'walk', { x: npc.patrol.x0 - 0.02, z: npc.patrol.z }), null);
  }
});
