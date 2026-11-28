import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { createItem, ITEM_DEFS } = await import('../src/data/items.js');
const { getShop } = await import('../src/data/shops.js');
const { RECIPES, canCookRecipe } = await import('../src/data/recipes.js');
const { createNeeds } = await import('../src/systems/needs.js');
const { createClock } = await import('../src/systems/time.js');
const { createMoney } = await import('../src/systems/money.js');
const { createSkills } = await import('../src/systems/skills.js');
const { createFriendship } = await import('../src/systems/friendship.js');
const { createCooking } = await import('../src/systems/cooking.js');
const { createGardening, GARDEN_PLOT_COUNT } = await import('../src/systems/gardening.js');
const { buildBackyardGarden } = await import('../src/world/garden.js');

/** Real-API inventory stand-in matching src/ui/inventory.js exported methods. */
function makeBag(slotCount = 16) {
  const items = Array.from({ length: slotCount }, () => null);
  let selected = -1;
  return {
    getItems: () => items.slice(),
    getSelected: () => (selected < 0 ? null : { index: selected, item: items[selected] }),
    selectSlot: (i) => { selected = i; },
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
      if (next <= 0) {
        items[index] = null;
        return { id: it.id, count: 0, removed: true };
      }
      items[index] = { ...it, count: next };
      return items[index];
    }
  };
}

test('Home Cooking: cook Pan-Seared Trout & Hearty Stew, apply buffs, and gift cooked meal to neighbour', () => {
  const clock = createClock();
  const needs = createNeeds();
  needs.set('hunger', 20);
  needs.set('energy', 40);
  const bag = makeBag();
  const skills = createSkills({ clock, needs });
  const friendship = createFriendship();
  const cooking = createCooking({ clock, needs, inventory: bag, skills, friendship });

  // Market stocks garden seeds alongside groceries.
  const market = getShop('corner-shop');
  assert.ok(market.stock.some((s) => s.item === 'tomato-seeds'));
  assert.ok(market.stock.some((s) => s.item === 'herb-seeds'));
  assert.ok(market.stock.some((s) => s.item === 'pumpkin-seeds'));
  assert.ok(RECIPES.length >= 7);

  // Cannot cook Pan-Seared Trout without fish + herbs.
  assert.equal(canCookRecipe(RECIPES.find((r) => r.id === 'seared-trout'), bag), false);

  // Add pond trout + backyard herbs and cook into bag.
  bag.addItem('trout', 1);
  bag.addItem('herbs', 1);
  const res = cooking.cookRecipe('seared-trout', { eatNow: false });
  assert.equal(res.ok, true);
  assert.equal(res.eaten, false);
  assert.ok(bag.getItems().some((it) => it && it.id === 'seared-trout'));
  assert.ok(skills.get('cooking').xp > 0);

  // Neighbour dialogue offers meal gifting and boosts friendship.
  const page = cooking.pageFor('sam', 'Sam');
  assert.ok(page && page.action);
  const gifted = page.action.run();
  assert.equal(gifted, true);
  assert.equal(bag.getItems().some((it) => it && it.id === 'seared-trout'), false);
  assert.ok(friendship.get('sam').score >= 18);

  // Cook & Eat Hearty Harvest Stew restores both Hunger and Energy.
  bag.addItem('groceries', 1);
  bag.addItem('pumpkin', 1);
  const stew = cooking.cookRecipe('hearty-stew', { eatNow: true });
  assert.equal(stew.ok, true);
  assert.equal(stew.eaten, true);
  assert.equal(needs.get('hunger'), 100);
  assert.equal(needs.get('energy'), 75);

  // Serialize & restore cooking stats.
  const saved = { cooking: cooking.serialize() };
  const cooking2 = createCooking({ clock, needs, inventory: bag, skills, friendship });
  cooking2.apply(saved);
  assert.deepEqual(cooking2.getStats(), { mealsCooked: 2, mealsGifted: 1 });
});

test('Backyard Gardening: plant, water, rain auto-water, grow overnight, harvest, sell to Vince, and sync 3D beds', () => {
  const clock = createClock();
  const needs = createNeeds();
  const money = createMoney({ initial: 50, getTime: clock.getTime });
  const skills = createSkills({ clock, needs });
  const bag = makeBag();
  const gardening = createGardening({ clock, needs, inventory: bag, money, skills });

  // Build 3D backyard garden in a Three.js scene and verify 4 raised bed interactables.
  const scene = new THREE.Scene();
  scene.userData.interactables = [];
  scene.userData.colliders = { list: [], addHouse(c) { this.list.push(c); } };
  const view = buildBackyardGarden(scene, { shadows: false }, gardening);
  assert.equal(scene.userData.interactables.filter((e) => e.kind === 'garden').length, GARDEN_PLOT_COUNT);
  assert.equal(scene.userData.colliders.list.length, GARDEN_PLOT_COUNT);
  assert.ok(view.group);

  // Plant tomatoes in bed 0 and pumpkins in bed 1.
  bag.addItem('tomato-seeds', 1);
  bag.addItem('pumpkin-seeds', 1);
  assert.equal(gardening.interactPlot(0), true);
  assert.equal(gardening.getPlot(0).cropId, 'tomato');
  assert.equal(gardening.interactPlot(1), true);
  assert.equal(gardening.getPlot(1).cropId, 'pumpkin');

  // Water bed 0 manually; let rain auto-water bed 1!
  assert.equal(gardening.interactPlot(0), true);
  assert.equal(gardening.getPlot(0).wateredToday, true);
  assert.equal(gardening.getPlot(1).wateredToday, false);
  gardening.syncWithWorld({ day: 1, rain: 0.5 });
  assert.equal(gardening.getPlot(1).wateredToday, true);

  // Next morning (day 2): tomatoes (1-day crop) are mature, pumpkin (2-day crop) needs 1 more day.
  gardening.syncWithWorld({ day: 2, rain: 0 });
  assert.equal(gardening.getPlot(0).mature, true);
  assert.equal(gardening.getPlot(1).mature, false);
  assert.equal(gardening.getPlot(1).growthDays, 1);

  // Harvest tomatoes -> 2x Garden Tomato in bag, bed 0 resets to empty.
  assert.equal(gardening.interactPlot(0), true);
  assert.equal(gardening.getPlot(0).cropId, null);
  const tomatoSlot = bag.getItems().find((it) => it && it.id === 'tomato');
  assert.equal(tomatoSlot.count, 2);

  // Vince buys homegrown produce for cash ($10 each -> $20).
  const vincePage = gardening.pageFor('vince');
  assert.ok(vincePage && vincePage.action);
  assert.equal(vincePage.action.run(), true);
  assert.equal(money.get(), 70);
  assert.equal(bag.getItems().some((it) => it && it.id === 'tomato'), false);

  // Save & restore garden plots cleanly.
  const saved = { garden: gardening.serialize() };
  const gardening2 = createGardening({ clock, needs, inventory: bag, money, skills });
  gardening2.apply(saved);
  assert.equal(gardening2.getPlot(1).cropId, 'pumpkin');
  assert.equal(gardening2.getPlot(1).growthDays, 1);
  assert.equal(gardening2.getStats().harvestedCount, 2);
});
