// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { NPC_DEFS, getNpc } = await import('../src/data/npcs.js');
const { getDialogue } = await import('../src/data/dialogue.js');
const { createCutscene, computeIntroShot } = await import('../src/systems/cutscene.js');
const { ACTIONS, actionForTarget } = await import('../src/systems/playerActions.js');
const { createStoryQuest, STORY_QUEST_REWARD } = await import('../src/systems/storyQuest.js');

test('new Maple Lane characters (Vince, Walt, Dr. Maya, Marcus) are registered with taglines and dialogue', () => {
  for (const id of ['vince', 'walt', 'maya', 'marcus']) {
    const def = getNpc(id);
    assert.ok(def, `expected NPC ${id}`);
    assert.ok(def.tagline && def.tagline.length > 0, `expected tagline for ${id}`);
    const dlg = getDialogue(id);
    assert.ok(dlg.pages.length >= 2, `expected multi-page dialogue for ${id}`);
  }
  assert.ok(NPC_DEFS.length >= 8);
});

test('computeIntroShot frames the NPC from the player side without clipping behind them', () => {
  const npcPos = { x: 10, y: 0, z: 20 };
  const playerPos = { x: 10, y: 1.6, z: 17.5 };
  const shot = computeIntroShot(npcPos, playerPos);
  // Player is at -Z relative to NPC, so the framed camera must stay on the -Z side.
  assert.ok(shot.pos.z < npcPos.z);
  assert.ok(shot.pos.y > 1.3 && shot.pos.y < 1.8);
  assert.equal(shot.lookAt.x, npcPos.x);
});

test('createCutscene plays intro once on first talk, holds through dialogue, then glides back to idle', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  const player = { position: new THREE.Vector3(0, 1.6, 0) };
  const npc = { id: 'walt', position: new THREE.Vector3(0, 0, -2.5), wave() {} };
  let dialogueOpen = false;
  let openedIds = [];
  const dialogue = {
    open(id) { dialogueOpen = true; openedIds.push(id); return true; },
    isOpen: () => dialogueOpen
  };
  const seen = new Set();
  const cs = createCutscene({
    camera,
    player,
    npcs: { list: [npc] },
    dialogue,
    hasSeenIntro: (id) => seen.has(id),
    onIntroSeen: (id) => seen.add(id)
  });

  // First talk starts intro cutscene.
  assert.equal(cs.talkWithIntro('walt'), true);
  assert.equal(cs.state, 'intro');
  assert.equal(seen.has('walt'), true);

  // Advance past intro duration -> hands off to dialogue.
  cs.update(1.9);
  assert.equal(cs.state, 'dialogue');
  assert.deepEqual(openedIds, ['walt']);

  // Close dialogue -> transitions to exit glide -> returns to idle.
  dialogueOpen = false;
  cs.update(0.05);
  assert.equal(cs.state, 'exit');
  cs.update(0.6);
  assert.equal(cs.state, 'idle');
  assert.equal(cs.isActive(), false);

  // Repeat talk skips intro and opens dialogue directly.
  assert.equal(cs.talkWithIntro('walt'), true);
  assert.equal(cs.state, 'idle');
  assert.deepEqual(openedIds, ['walt', 'walt']);
});

test('action animations include unlockDoor, cook, drink, wave, and visible held props', () => {
  assert.equal(ACTIONS.unlockDoor.prop.name, 'keys');
  assert.equal(ACTIONS.eat.prop.name, 'snack');
  assert.equal(ACTIONS.drink.prop.name, 'cup');
  assert.equal(ACTIONS.cook.prop.name, 'spatula');
  assert.ok(ACTIONS.wave);
  assert.equal(actionForTarget({ userData: { kind: 'cook' } }), 'cook');
});

test('storyQuest (The Last Tenant) advances hidden -> walt -> vince -> done and pays welcome credit once', () => {
  let balance = 50;
  let saves = 0;
  const money = { add(n) { balance += n; } };
  const q = createStoryQuest({ money, save: () => { saves += 1; } });

  assert.equal(q.stage, 'hidden');
  assert.equal(q.task(), null);

  assert.equal(q.onNoteFound(), true);
  assert.equal(q.stage, 'walt');
  assert.equal(q.task().npcId, 'walt');

  const waltPage = q.pageFor('walt');
  assert.ok(waltPage && waltPage.action);
  assert.equal(waltPage.action.run(), true);
  assert.equal(q.stage, 'vince');
  assert.equal(q.task().npcId, 'vince');

  const vincePage = q.pageFor('vince');
  assert.ok(vincePage && vincePage.action);
  assert.equal(vincePage.action.run(), true);
  assert.equal(q.stage, 'done');
  assert.equal(q.task().complete, true);
  assert.equal(balance, 50 + STORY_QUEST_REWARD);
  assert.equal(q.pageFor('vince'), null);
  assert.equal(saves, 3);
});
