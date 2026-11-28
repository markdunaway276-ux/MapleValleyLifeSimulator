import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { createItem, ITEM_DEFS } = await import('../src/data/items.js');
const { HOME_DECOR_ITEMS, HOME_THEMES } = await import('../src/data/homeDecor.js');
const { createClock } = await import('../src/systems/time.js');
const { createNeeds } = await import('../src/systems/needs.js');
const { createMoney } = await import('../src/systems/money.js');
const { createPet, PET_ADOPT_BOND } = await import('../src/systems/pet.js');
const { buildPetActor, PET_HOME_SPOT } = await import('../src/world/petActor.js');
const { createHomeDecor } = await import('../src/world/homeDecor.js');

function makeBag(slotCount = 16) {
  const items = Array.from({ length: slotCount }, () => null);
  return {
    getItems: () => items.slice(),
    addItem(id, count = 1) {
      const def = ITEM_DEFS[id];
      if (!def) return null;
      const n = Math.max(1, Number(count) || 1);
      if (def.stackable) {
        const idx = items.findIndex((it) => it && it.id === id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], count: (items[idx].count || 1) + n };
          return items[idx];
        }
      }
      const empty = items.findIndex((it) => !it);
      if (empty < 0) return null;
      items[empty] = createItem(id, { count: n });
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

test('Adoptable Pet (Maple): bond with fish/snacks, adopt at 3/3, toggle Follow / Nap at Home, and animate 3D cat', () => {
  const clock = createClock();
  const needs = createNeeds();
  needs.set('energy', 80);
  const bag = makeBag();
  const pet = createPet({ clock, inventory: bag, needs });

  const scene = new THREE.Scene();
  scene.userData.interactables = [];
  const actor = buildPetActor(scene, { shadows: false }, pet);
  assert.ok(scene.userData.interactables.some((e) => e.id === 'town-pet'));

  // Bond 1/3 with daily pet, Bond 2/3 with snack, Bond 3/3 with pond bluegill -> adopted!
  assert.equal(pet.interact(), true);
  assert.equal(pet.getState().bond, 1);
  assert.equal(pet.getState().adopted, false);

  bag.addItem('snack', 1);
  bag.addItem('bluegill', 1);
  assert.equal(pet.interact(), true);
  assert.equal(pet.getState().bond, 2);
  assert.equal(pet.interact(), true);
  assert.equal(pet.getState().bond, PET_ADOPT_BOND);
  assert.equal(pet.getState().adopted, true);
  assert.equal(pet.getState().mode, 'follow');

  // Toggle to Nap at Home -> actor moves to indoor pet bed spot!
  assert.equal(pet.interact(), true);
  assert.equal(pet.getState().mode, 'home');
  actor.update(0.05, { playerPos: { x: 0, z: 0 }, driving: false });
  assert.ok(Math.abs(actor.group.position.x - PET_HOME_SPOT.x) < 0.01);
  assert.ok(Math.abs(actor.group.position.z - PET_HOME_SPOT.z) < 0.01);

  // Save & restore
  const saved = { pet: pet.serialize() };
  const pet2 = createPet({ clock, inventory: bag, needs });
  pet2.apply(saved);
  assert.equal(pet2.getState().adopted, true);
  assert.equal(pet2.getState().mode, 'home');
});

test('Cozy Home Upgrade: new decor items (pet-bed, string-lights, coffee-bar) and 4 interior wall themes persist', () => {
  const clock = createClock();
  const money = createMoney({ getTime: clock.getTime });
  money.set(200);

  const scene = new THREE.Scene();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });
  const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat);
  const interiorGroup = new THREE.Group();
  interiorGroup.add(wallMesh);
  scene.userData.interior = { group: interiorGroup };

  const decor = createHomeDecor({ scene, shadows: false });
  assert.ok(HOME_DECOR_ITEMS.some((i) => i.id === 'pet-bed'));
  assert.ok(HOME_DECOR_ITEMS.some((i) => i.id === 'string-lights'));
  assert.ok(HOME_DECOR_ITEMS.some((i) => i.id === 'coffee-bar'));
  assert.equal(HOME_THEMES.length, 4);

  // Buy new cozy decor items
  assert.equal(decor.buy('pet-bed', { money }).ok, true);
  assert.equal(decor.buy('string-lights', { money }).ok, true);
  assert.equal(decor.buy('coffee-bar', { money }).ok, true);
  assert.equal(decor.has('pet-bed'), true);

  // Switch theme to Valley Sage and verify interior wall material tints live
  decor.setTheme('sage');
  assert.equal(decor.getTheme(), 'sage');
  assert.equal(wallMat.color.getHex(), 0xe3efe2);

  // Save & restore
  const saved = { homeDecor: decor.serialize(), homeTheme: decor.getTheme() };
  const decor2 = createHomeDecor({ scene, shadows: false });
  decor2.apply(saved);
  assert.equal(decor2.has('pet-bed'), true);
  assert.equal(decor2.getTheme(), 'sage');
});
