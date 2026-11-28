import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { createItem, ITEM_DEFS } = await import('../src/data/items.js');
const { createMoney } = await import('../src/systems/money.js');
const { createNeeds } = await import('../src/systems/needs.js');
const { createFriendship } = await import('../src/systems/friendship.js');
const { createInbox } = await import('../src/data/mail.js');
const { createFlashlight } = await import('../src/systems/flashlight.js');
const { createMysteryChapter3, CHAPTER3_REWARD, CHAPTER3_REWARD_FRIEND } = await import('../src/systems/mysteryChapter3.js');
const { buildMysteryClue } = await import('../src/world/mysteryClue.js');

function makeClock(hour = 14) {
  let mins = hour * 60;
  return {
    getTime: () => ({ day: 3, minutes: mins, totalMinutes: 2 * 1440 + mins }),
    setHour: (h) => { mins = h * 60; }
  };
}

function makeBag(slotCount = 16) {
  const items = Array.from({ length: slotCount }, () => null);
  return {
    getItems: () => items.slice(),
    addItem(id, count = 1) {
      const def = ITEM_DEFS[id];
      if (!def) return null;
      const empty = items.findIndex((it) => !it);
      if (empty < 0) return null;
      items[empty] = createItem(id, { count });
      return items[empty];
    },
    consume(index, count = 1) {
      const it = items[index];
      if (!it) return null;
      const next = (it.count || 1) - Math.max(1, Number(count) || 1);
      if (next <= 0) { items[index] = null; return { id: it.id, count: 0, removed: true }; }
      items[index] = { ...it, count: next };
      return items[index];
    }
  };
}

test('Mystery Chapter 3: flashlight night investigation, friendship-aware Vince finale, and 3D East Creek cairn', () => {
  const clock = makeClock(14); // 2 PM daytime
  const bag = makeBag();
  const money = createMoney({ getTime: clock.getTime });
  money.set(50);
  const needs = createNeeds();
  const inbox = createInbox();
  const friendship = createFriendship();
  friendship.add('walt', 25); // Friendly with Walt -> extra cairn hint
  friendship.add('vince', 50); // Good Friend with Vince -> $100 close-friend finale!

  const camera = new THREE.PerspectiveCamera();
  const flashlight = createFlashlight({ camera, inventory: bag });
  const ch3 = createMysteryChapter3({
    clock,
    money,
    needs,
    inventory: bag,
    inbox,
    friendship,
    flashlight
  });

  const scene = new THREE.Scene();
  scene.userData.interactables = [];
  const clue = buildMysteryClue(scene, { shadows: false }, ch3);
  assert.ok(scene.userData.interactables.some((e) => e.id === 'ch3-east-creek-clue'));

  // 1) Unlock -> Walt texts inbox & offers Field Flashlight
  assert.equal(ch3.stage, 'locked');
  assert.equal(ch3.unlock(), true);
  assert.equal(ch3.stage, 'walt');
  assert.ok(inbox.get().some((m) => m.id === 'ch3-walt-signal'));

  const waltPage = ch3.pageFor('walt');
  assert.ok(waltPage && waltPage.action);
  assert.ok(waltPage.lines[0].includes('stone cairn')); // Friendship-aware hint!
  assert.equal(waltPage.action.run(), true);
  assert.equal(ch3.stage, 'night-clue');
  assert.equal(flashlight.hasFlashlight(), true);

  // 2) Cannot inspect clue in daytime or with flashlight OFF
  assert.equal(ch3.inspectNightClue(), false);
  clock.setHour(21); // 9 PM night
  assert.equal(ch3.inspectNightClue(), false); // flashlight still OFF

  // Turn flashlight ON and inspect at 9 PM -> finds East Creek Time Capsule!
  assert.equal(flashlight.toggle(), true);
  assert.equal(flashlight.isOn(), true);
  clue.update(0.05, 21 * 60);
  assert.equal(ch3.inspectNightClue(), true);
  assert.equal(ch3.stage, 'vince');
  assert.ok(bag.getItems().some((it) => it && it.id === 'creek-capsule'));

  // 3) Bring capsule to Vince (Good Friend branch -> $100 reward & Maya epilogue text)
  const vincePage = ch3.pageFor('vince');
  assert.ok(vincePage && vincePage.action);
  assert.ok(vincePage.action.label.includes(`$${CHAPTER3_REWARD_FRIEND}`));
  assert.equal(vincePage.action.run(), true);
  assert.equal(ch3.stage, 'done');
  assert.equal(money.get(), 50 + CHAPTER3_REWARD_FRIEND);
  assert.equal(bag.getItems().some((it) => it && it.id === 'creek-capsule'), false);
  assert.ok(inbox.get().some((m) => m.id === 'ch3-maya-epilogue'));
  assert.equal(CHAPTER3_REWARD, 75);
});
