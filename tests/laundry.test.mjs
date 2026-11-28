import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLaundry, WASH_MINUTES, DRY_MINUTES, ORDER_BASE_PAY, FOLD_JOB } from '../src/systems/laundry.js';

function rig({ cash = 50, detergent = 1, energy = 100 } = {}) {
  const state = { minutes: 600, cash, clean: 30, toasts: [], bag: detergent ? [{ id: 'detergent', count: detergent }] : [] };
  const money = {
    add: (n) => { state.cash += n; },
    spend: (n) => { if (state.cash < n) return false; state.cash -= n; return true; }
  };
  const needs = { get: (id) => (id === 'energy' ? energy : state.clean), refill: (id) => { if (id === 'clean') state.clean = 100; } };
  const inventory = {
    serialize: () => state.bag,
    consume: (i, n) => { state.bag[i].count -= n; if (!state.bag[i].count) state.bag.splice(i, 1); return true; }
  };
  let job = null;
  const laundry = createLaundry({
    getMinutes: () => state.minutes, money, needs, inventory,
    toast: (m) => state.toasts.push(m),
    startWork: (j) => { job = j; return true; }
  });
  return { state, laundry, lastJob: () => job };
}

test('washing and drying your own clothes refills Clean and costs $5 plus detergent', () => {
  const { state, laundry } = rig();
  assert.match(laundry.machineOption('washer-1').prompt, /wash your clothes/);
  assert.equal(laundry.machineOption('washer-1').run(), 'load');
  assert.equal(state.cash, 47);
  assert.equal(state.bag.length, 0);
  assert.match(laundry.machineOption('washer-1').prompt, /min left/);
  state.minutes += WASH_MINUTES;
  assert.deepEqual(laundry.update(), ['washer-1']);
  assert.equal(laundry.machineOption('washer-1').run(), 'unload');
  assert.deepEqual(laundry.carry, { owner: 'you', stage: 'wet' });
  assert.equal(laundry.machineOption('dryer-2').run(), 'load');
  assert.equal(state.cash, 45);
  state.minutes += DRY_MINUTES;
  laundry.update();
  assert.equal(laundry.machineOption('dryer-2').run(), 'pickUp');
  assert.equal(state.clean, 100);
  assert.equal(laundry.carry, null);
});

import { getShop } from '../src/data/shops.js';

test('washing without detergent offers one-step wash + soap ($5) and fails cleanly if short on cash', () => {
  const { state, laundry } = rig({ detergent: 0, cash: 50 });
  const opt = laundry.machineOption('washer-1');
  assert.match(opt.prompt, /\$5 incl\. soap/);
  assert.equal(opt.run(), 'load');
  assert.equal(state.cash, 45);
  assert.match(state.toasts.at(-1), /soap included/);

  // Empty dryer and folding table give helpful guidance while your own clothes wash.
  assert.equal(laundry.machineOption('dryer-1').run(), false);
  assert.match(state.toasts.at(-1), /still washing/);
  assert.equal(laundry.tableOption().run(), false);
  assert.match(state.toasts.at(-1), /no folding needed/);

  // Short on cash ($4) without detergent cannot start the $5 soap-included wash.
  const broke = rig({ detergent: 0, cash: 4 });
  assert.equal(broke.laundry.machineOption('washer-1').run(), false);
  assert.match(broke.state.toasts.at(-1), /Detergent/);
  assert.equal(broke.state.cash, 4);
});

test('detergent is stocked at both laundromat-vending and corner-shop', () => {
  const vend = getShop('laundromat-vending');
  const market = getShop('corner-shop');
  assert.ok(vend.stock.some((o) => o.item === 'detergent' && o.price === 2));
  assert.ok(market.stock.some((o) => o.item === 'detergent' && o.price === 2));
});

test('a shift order goes counter → washer → dryer → table → counter and pays a tip when on time', () => {
  const { state, laundry, lastJob } = rig();
  assert.equal(laundry.counterOption(), null);
  laundry.clockOption().run();
  assert.equal(laundry.onShift, true);
  assert.equal(laundry.waitingCount(), 2);
  assert.equal(laundry.counterOption().run(), 'pickUp');
  const owner = laundry.carry.owner;
  assert.equal(laundry.machineOption('dryer-1').run(), false, 'dirty clothes do not go in a dryer');
  assert.equal(laundry.machineOption('washer-3').run(), 'load');
  assert.equal(state.cash, 50, 'customer loads are free');
  state.minutes += WASH_MINUTES;
  laundry.update();
  laundry.machineOption('washer-3').run();
  laundry.machineOption('dryer-1').run();
  state.minutes += DRY_MINUTES;
  laundry.update();
  laundry.machineOption('dryer-1').run();
  assert.equal(laundry.carry.stage, 'dry');
  assert.equal(laundry.tableOption().run(), true);
  assert.equal(lastJob().action, FOLD_JOB.action);
  laundry.finishFold();
  assert.equal(laundry.carry.stage, 'folded');
  assert.equal(laundry.carry.owner, owner);
  assert.equal(laundry.counterOption().run(), 'handOver');
  assert.ok(state.cash > 50 + ORDER_BASE_PAY, 'base pay plus a tip');
  assert.equal(laundry.orders.length, 1);
  laundry.clockOption().run();
  assert.equal(laundry.onShift, false);
  assert.equal(laundry.orders.length, 0);
});

test('state survives a save and reload', () => {
  const { state, laundry } = rig();
  laundry.machineOption('washer-2').run();
  const saved = JSON.parse(JSON.stringify(laundry.serialize()));
  const again = createLaundry({ getMinutes: () => state.minutes, saved });
  assert.equal(again.machineState('washer-2').running, true);
  assert.equal(again.machineState('washer-2').owner, 'you');
});

test('fast machines (development) finish in a minute, including loads already running', () => {
  const { state, laundry } = rig();
  laundry.machineOption('washer-1').run();
  assert.equal(laundry.machineState('washer-1').running, true);
  laundry.setFast(true);
  state.minutes += 1;
  assert.deepEqual(laundry.update(), ['washer-1']);
  laundry.machineOption('washer-1').run();
  laundry.machineOption('dryer-1').run();
  state.minutes += 1;
  assert.deepEqual(laundry.update(), ['dryer-1']);
});
