import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { createItem, ITEM_DEFS } = await import('../src/data/items.js');
const { createMoney } = await import('../src/systems/money.js');
const { createFriendship } = await import('../src/systems/friendship.js');
const { createTownEvents, eventForDay } = await import('../src/systems/townEvents.js');
const { buildTownEventsProps } = await import('../src/world/townEventsProps.js');

function makeClock(day = 1, hour = 10) {
  let d = day;
  let m = hour * 60;
  return {
    getTime: () => ({ day: d, minutes: m, totalMinutes: (d - 1) * 1440 + m }),
    setDayHour: (nextDay, nextHour) => { d = nextDay; m = nextHour * 60; }
  };
}

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

test("Weekly Town Events: Saturday Park Farmers' Market opens stalls, sells rotating treats, and pays +20% produce bonus", () => {
  const clock = makeClock(1, 10); // Day 1 = Monday
  const bag = makeBag();
  const money = createMoney({ getTime: clock.getTime });
  money.set(50);
  const friendship = createFriendship();
  const events = createTownEvents({ clock, inventory: bag, money, friendship });

  const scene = new THREE.Scene();
  scene.userData.interactables = [];
  const props = buildTownEventsProps(scene, { shadows: false }, events);

  // Monday: neither event is open
  assert.equal(events.isMarketOpen(), false);
  assert.equal(events.isDerbyOpen(), false);
  assert.equal(props.marketGroup.visible, false);
  assert.equal(props.derbyStand.visible, false);
  assert.equal(props.trophy.visible, false);

  // Day 6 = Saturday 10 AM: Farmers' Market is live!
  clock.setDayHour(6, 10);
  assert.equal(eventForDay(6).id, 'farmers-market');
  assert.equal(events.isMarketOpen(), true);
  props.sync();
  assert.equal(props.marketGroup.visible, true);

  // Buy weekly rotating treat & produce seeds
  const offers = events.currentMarketOffers();
  assert.equal(events.buyMarketOffer('treat'), true);
  assert.ok(bag.getItems().some((it) => it && it.id === offers.treat.item));

  // Sell 2 backyard tomatoes ($10 base -> $12 each with +20% bonus -> +$24)
  const beforeSell = money.get();
  bag.addItem('tomato', 2);
  const sold = events.sellAtMarket();
  assert.equal(sold.sold, 2);
  assert.equal(sold.total, 24);
  assert.equal(money.get(), beforeSell + 24);
});

test('Weekly Town Events: Sunday Pond Fishing Derby tracks leaderboard, awards $45 + House Trophy, and persists', () => {
  const clock = makeClock(7, 11); // Day 7 = Sunday 11 AM
  const bag = makeBag();
  const money = createMoney({ getTime: clock.getTime });
  money.set(30);
  const friendship = createFriendship();
  const events = createTownEvents({ clock, inventory: bag, money, friendship });

  const scene = new THREE.Scene();
  scene.userData.interactables = [];
  const props = buildTownEventsProps(scene, { shadows: false }, events);

  assert.equal(eventForDay(7).id, 'fishing-derby');
  assert.equal(events.isDerbyOpen(), true);
  assert.equal(props.derbyStand.visible, true);
  assert.equal(props.trophy.visible, false);

  // Catch 1 Maple Trout (24 pts) + 1 Valley Bass (38 pts) = 62 pts (beats Walt's 42 pts!)
  assert.equal(events.recordDerbyCatch({ id: 'trout' }), 24);
  assert.equal(events.recordDerbyCatch({ id: 'bass' }), 38);
  const lb = events.getLeaderboard();
  assert.equal(lb[0].id, 'player');
  assert.equal(lb[0].points, 62);

  // Claim 1st Place prize at the Derby Stand -> +$45 + Golden Trout Trophy visible in house!
  assert.equal(events.interactDerbyStand(), true);
  assert.equal(money.get(), 75);
  assert.equal(events.hasTrophy(), true);
  assert.equal(props.trophy.visible, true);

  // Save & restore preserves Trophy
  const saved = { townEvents: events.serialize() };
  const events2 = createTownEvents({ clock, inventory: bag, money, friendship });
  events2.apply(saved);
  assert.equal(events2.hasTrophy(), true);
  assert.equal(events2.getStatus().derbyWins, 1);
});

test('the "Today: …" toast is remembered across saves', async () => {
  const { createTownEvents } = await import('../src/systems/townEvents.js');
  const toasts = [];
  const clock = { getTime: () => ({ day: 6, minutes: 9 * 60 }) };
  const a = createTownEvents({ clock, toast: (m) => toasts.push(m) });
  a.syncWithClock();
  assert.equal(toasts.length, 1);
  const b = createTownEvents({ clock, toast: (m) => toasts.push(m) });
  b.apply({ townEvents: a.serialize() });
  b.syncWithClock();
  assert.equal(toasts.length, 1, 'reloading the same day does not toast again');
});
