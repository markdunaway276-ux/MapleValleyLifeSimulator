import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { createClock } = await import('../src/systems/time.js');
const { createNeeds } = await import('../src/systems/needs.js');
const { createMoney } = await import('../src/systems/money.js');
const { createSkills } = await import('../src/systems/skills.js');
const { createFriendship } = await import('../src/systems/friendship.js');
const { createQuestBoard } = await import('../src/systems/questBoard.js');
const { createFramedPhotos, FRAME_SLOTS } = await import('../src/world/framedPhotos.js');
const { createOddJobs } = await import('../src/systems/oddJobs.js');
const { createPhotoLibrary } = await import('../src/ui/phone/photos.js');

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); }
  };
}

const SAMPLE_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==';

test('Photo Gigs: zoom, golden-hour/warm filter, and Cozy B&W commissions complete cleanly', () => {
  const storage = makeMemoryStorage();
  const lib = createPhotoLibrary(storage);
  const clock = createClock();
  const money = createMoney({ getTime: clock.getTime });
  money.set(20);
  const needs = createNeeds();
  const friendship = createFriendship();

  const board = createQuestBoard({
    money,
    needs,
    friendship,
    getPhotoIds: () => lib.list().map((p) => p.id),
    getPhotos: () => lib.list()
  });

  // Accept all 3 new photo gigs
  assert.equal(board.accept('board-photo-wildlife', { silent: true }), true);
  assert.equal(board.accept('board-photo-golden', { silent: true }), true);
  assert.equal(board.accept('board-photo-bw', { silent: true }), true);

  // Plain 1x natural midday photo should NOT satisfy zoom, golden, or B&W gigs
  lib.add(SAMPLE_JPEG, { zoom: 1, filterId: 'none', hour: 12 });
  assert.equal(board.pageFor('sam'), null);
  assert.equal(board.pageFor('june'), null);
  assert.equal(board.pageFor('dottie'), null);

  // 1) Zoomed photo satisfies Sam's Park Wildlife Snap (+$26)
  lib.add(SAMPLE_JPEG, { zoom: 2, filterId: 'none', hour: 13 });
  const samPage = board.pageFor('sam');
  assert.ok(samPage && samPage.action);
  assert.equal(samPage.action.run(), true);
  assert.equal(board.isCompleted('board-photo-wildlife'), true);
  assert.equal(money.get(), 46);

  // 2) Golden filter photo satisfies June's Golden-Hour Maple Lane (+$30)
  lib.add(SAMPLE_JPEG, { zoom: 1, filterId: 'golden', hour: 14 });
  const junePage = board.pageFor('june');
  assert.ok(junePage && junePage.action);
  assert.equal(junePage.action.run(), true);
  assert.equal(board.isCompleted('board-photo-golden'), true);
  assert.equal(money.get(), 76);

  // 3) Cozy B&W photo satisfies Dottie's Vintage Valley Portrait (+$25)
  lib.add(SAMPLE_JPEG, { zoom: 1, filterId: 'bw', hour: 15 });
  const dottiePage = board.pageFor('dottie');
  assert.ok(dottiePage && dottiePage.action);
  assert.equal(dottiePage.action.run(), true);
  assert.equal(board.isCompleted('board-photo-bw'), true);
  assert.equal(money.get(), 101);
});

test('Framed Gallery Photos: 3 wall frames register in house, hang photos, cycle, and save/restore', () => {
  const storage = makeMemoryStorage();
  const lib = createPhotoLibrary(storage);
  lib.add(SAMPLE_JPEG, { zoom: 1, filterId: 'none' });
  lib.add(SAMPLE_JPEG, { zoom: 2, filterId: 'golden' });
  const [p1, p2] = lib.list();

  const scene = new THREE.Scene();
  scene.userData.interactables = [];
  const frames = createFramedPhotos({
    scene,
    shadows: false,
    getPhotos: () => lib.list()
  });

  assert.equal(scene.userData.interactables.filter((e) => e.kind === 'photo-frame').length, FRAME_SLOTS.length);

  // Hanging without specifying slot fills Living Room first, then Kitchen
  const r1 = frames.hangPhoto(p1.id);
  assert.equal(r1.slotId, 'living');
  const r2 = frames.hangPhoto(p2.id);
  assert.equal(r2.slotId, 'kitchen');
  assert.equal(frames.getAssignments().living, p1.id);
  assert.equal(frames.getAssignments().kitchen, p2.id);

  // Cycling Bedroom frame picks first photo, then second, then clears
  assert.equal(frames.cycleFrame('bedroom'), true);
  assert.equal(frames.getAssignments().bedroom, p1.id);
  assert.equal(frames.cycleFrame('bedroom'), true);
  assert.equal(frames.getAssignments().bedroom, p2.id);
  assert.equal(frames.cycleFrame('bedroom'), true);
  assert.equal(frames.getAssignments().bedroom, null);

  // Save & restore
  const saved = { framedPhotos: frames.serialize() };
  const frames2 = createFramedPhotos({ getPhotos: () => lib.list() });
  frames2.apply(saved);
  assert.equal(frames2.getAssignments().living, p1.id);
  assert.equal(frames2.getAssignments().kitchen, p2.id);
});

test('Seasonal Odd Jobs: snow shoveling appears in snow, yard cleanup in mild weather, haul run anytime, once per day', () => {
  const clock = createClock();
  const needs = createNeeds();
  const money = createMoney({ getTime: clock.getTime });
  money.set(10);
  const skills = createSkills({ clock, needs });
  const friendship = createFriendship();

  let snowy = false;
  const weather = {
    snowCover: () => (snowy ? 0.5 : 0),
    snowAmount: () => (snowy ? 0.4 : 0),
    get: () => ({ temperatureC: snowy ? -2 : 16 })
  };

  const oddJobs = createOddJobs({ clock, weather, needs, money, skills, friendship });

  // Mild weather: snow-shovel unavailable, yard-cleanup & haul-run available
  assert.equal(oddJobs.isAvailable('snow-shovel'), false);
  assert.equal(oddJobs.isAvailable('yard-cleanup'), true);
  assert.equal(oddJobs.isAvailable('haul-run'), true);

  const waltPage = oddJobs.pageFor('walt');
  assert.ok(waltPage && waltPage.action);
  assert.equal(waltPage.action.run(), true);
  assert.equal(money.get(), 32); // +$22
  assert.equal(oddJobs.isAvailable('yard-cleanup'), false); // already done today

  // Switch to snowy weather: Sam offers Snow Shoveling (+$28)
  snowy = true;
  assert.equal(oddJobs.isAvailable('snow-shovel'), true);
  const samPage = oddJobs.pageFor('sam');
  assert.ok(samPage && samPage.action);
  assert.equal(samPage.action.run(), true);
  assert.equal(money.get(), 60); // +$28
  assert.equal(oddJobs.isAvailable('snow-shovel'), false);

  // Next day resets daily availability
  clock.advance(24 * 60);
  assert.equal(oddJobs.isAvailable('snow-shovel'), true);

  // Save & restore
  const saved = { oddJobs: oddJobs.serialize() };
  const oddJobs2 = createOddJobs({ clock, weather, needs, money, skills, friendship });
  oddJobs2.apply(saved);
  assert.equal(oddJobs2.getStats().completedCount, 2);
});
