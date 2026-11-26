// Run from the repo root with: node --test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage stand-in for Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const { loadSave, saveGame, clearSave, migrateSave, SAVE_VERSION, SAVE_KEY } = await import('../src/systems/save.js');

beforeEach(() => store.clear());

test('no save loads as an empty object', () => {
  assert.deepEqual(loadSave(), {});
});

test('saveGame stamps the current version and merges with the previous save', () => {
  saveGame({ money: 50, needs: { hunger: 80 } });
  saveGame({ position: { x: 1, y: 1.6, z: 2 } });
  const s = loadSave();
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.money, 50);
  assert.deepEqual(s.position, { x: 1, y: 1.6, z: 2 });
});

test('an old unversioned save is upgraded, backed up and written back once', () => {
  const old = { money: 75, inventory: [{ id: 'snack', count: 2 }], time: { day: 3, minutes: 600 } };
  store.set(SAVE_KEY, JSON.stringify(old));
  const s = loadSave();
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.money, 75);
  assert.deepEqual(s.inventory, [{ id: 'snack', count: 2 }]);
  assert.deepEqual(s.time, old.time);
  assert.deepEqual(JSON.parse(store.get(SAVE_KEY + '_backup_v0')), old);
  assert.equal(JSON.parse(store.get(SAVE_KEY)).version, SAVE_VERSION);
});

test('version 0 -> 1 moves a bag "cash" item into money', () => {
  const { data, from, ok } = migrateSave({ inventory: [{ id: 'cash', count: 30 }, { id: 'phone', count: 1 }] });
  assert.equal(from, 0);
  assert.ok(ok);
  assert.equal(data.money, 30);
  assert.deepEqual(data.inventory, [{ id: 'phone', count: 1 }]);
});

test('an existing money balance wins over a leftover cash item', () => {
  const { data } = migrateSave({ money: 120, inventory: [{ id: 'cash', count: 30 }] });
  assert.equal(data.money, 120);
  assert.deepEqual(data.inventory, []);
});

test('a save from a newer build is loaded as-is and keeps its version when saved', () => {
  store.set(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 5, money: 9 }));
  assert.equal(loadSave().version, SAVE_VERSION + 5);
  saveGame({ money: 10 });
  assert.equal(loadSave().version, SAVE_VERSION + 5);
});

test('an unreadable save is kept under _corrupt instead of being lost', () => {
  store.set(SAVE_KEY, '{not json');
  assert.deepEqual(loadSave(), {});
  assert.equal(store.get(SAVE_KEY + '_corrupt'), '{not json');
});

test('clearSave removes the save', () => {
  saveGame({ money: 5 });
  clearSave();
  assert.deepEqual(loadSave(), {});
});

test('a running tab keeps saving to the slot it loaded after another tab changes the selection', async () => {
  const tabOne = await import('../src/systems/save.js?tab=one');
  const tabTwo = await import('../src/systems/save.js?tab=two');

  tabOne.saveGame({ money: 50 });
  tabTwo.setActiveSlot(2);
  tabTwo.saveGame({ money: 100 });
  tabOne.saveGame({ money: 60 });

  assert.equal(tabOne.loadSave().money, 60);
  assert.equal(tabTwo.loadSave().money, 100);
  tabOne.clearSave();
  assert.equal(tabOne.readSlot(1), null);
  assert.equal(tabTwo.readSlot(2).money, 100);
});
