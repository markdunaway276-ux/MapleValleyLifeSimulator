// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNeeds, NEED_MAX, NEED_MIN, LOW_THRESHOLD, HUNGER_FULL_MINUTES, ENERGY_IDLE_FULL_MINUTES } from '../src/systems/needs.js';
import { createMoney, STARTING_CASH, extractCashFromItems, queueDailyMail, collectPendingMail } from '../src/systems/money.js';
import { createClock, MINUTES_PER_DAY, wrapMinutes, periodAt, formatClock } from '../src/systems/time.js';

test('needs decays hunger, energy (faster while moving), and clean; supports sleep, dev mode, and save round-trip', () => {
  const needs = createNeeds();
  assert.equal(needs.get('hunger'), NEED_MAX);
  assert.equal(needs.get('energy'), NEED_MAX);
  assert.equal(needs.get('clean'), NEED_MAX);

  // Idle decay over 120 game minutes.
  needs.update(120, { moving: false });
  const idleEnergy = needs.get('energy');
  assert.ok(Math.abs(needs.get('hunger') - (100 - 120 * (100 / HUNGER_FULL_MINUTES))) < 1e-6);
  assert.ok(Math.abs(idleEnergy - (100 - 120 * (100 / ENERGY_IDLE_FULL_MINUTES))) < 1e-6);

  // Moving drains energy 50% faster than idle.
  const movingNeeds = createNeeds();
  movingNeeds.update(120, { moving: true });
  assert.ok(movingNeeds.get('energy') < idleEnergy);

  // hungerOnly leaves energy untouched (used while sitting).
  const beforeSitEnergy = needs.get('energy');
  needs.update(60, { hungerOnly: true });
  assert.equal(needs.get('energy'), beforeSitEnergy);

  // applySleep restores energy to full while draining hunger for slept time.
  needs.set('energy', 20);
  const hungerBeforeSleep = needs.get('hunger');
  needs.applySleep({ minutes: 360 });
  assert.equal(needs.get('energy'), NEED_MAX);
  assert.ok(needs.get('hunger') < hungerBeforeSleep);

  // Development mode reports full needs and ignores drain/update.
  needs.drain();
  assert.equal(needs.get('hunger'), NEED_MIN);
  assert.equal(needs.get().items.every((it) => it.low === (it.value <= LOW_THRESHOLD)), true);
  needs.setDevelopmentMode(true);
  assert.equal(needs.get('hunger'), NEED_MAX);
  needs.setDevelopmentMode(false);
  assert.equal(needs.get('hunger'), NEED_MIN);

  // Serialize / apply round-trip.
  needs.set('hunger', 62);
  needs.set('energy', 44);
  needs.set('clean', 81);
  const copy = createNeeds();
  copy.apply({ needs: needs.serialize() });
  assert.deepEqual(copy.serialize(), { hunger: 62, energy: 44, clean: 81 });
});

test('money tracks balance, rejects overdrafts, records statements, and handles mail/bag extraction', () => {
  const money = createMoney({ getTime: () => ({ label: 'Day 1  09:00' }) });
  assert.equal(money.get(), STARTING_CASH);
  assert.equal(money.canAfford(50), true);
  assert.equal(money.canAfford(51), false);
  assert.equal(money.spend(51), false);
  assert.equal(money.spend(-5), false);
  assert.equal(money.get(), 50);

  assert.equal(money.spend(15, { label: 'Groceries' }), true);
  assert.equal(money.get(), 35);
  money.add(20, { category: 'Work', label: 'Shift pay' });
  assert.equal(money.get(), 55);

  const stmt = money.statement();
  assert.equal(stmt.balance, 55);
  assert.equal(stmt.income, 20);
  assert.equal(stmt.spending, 15);
  assert.equal(stmt.transactions.length, 2);

  // purchase() only debits if grant() succeeds.
  assert.equal(money.purchase(10, { label: 'Snack' }, () => null), false);
  assert.equal(money.get(), 55);
  assert.deepEqual(money.purchase(10, { label: 'Snack' }, () => ({ id: 'snack' })), { id: 'snack' });
  assert.equal(money.get(), 45);

  // Save round-trip preserves balance and transactions.
  const restored = createMoney();
  restored.apply({ money: money.serialize() });
  assert.equal(restored.get(), 45);
  assert.equal(restored.statement().transactions.length, 3);

  // extractCashFromItems removes cash stacks from bag.
  const extracted = extractCashFromItems([{ id: 'cash', count: 25 }, { id: 'phone', count: 1 }]);
  assert.equal(extracted.cash, 25);
  assert.deepEqual(extracted.items, [{ id: 'phone', count: 1 }]);

  // Daily mail queues once per day and collects cleanly.
  const mail = { pending: [] };
  const amt = queueDailyMail(mail, 2);
  assert.ok(amt >= 5 && amt <= 15);
  assert.equal(queueDailyMail(mail, 2), null);
  const items = collectPendingMail(mail);
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, amt);
  assert.deepEqual(mail.pending, []);
});

test('time clock wraps minutes, identifies periods, advances across midnight with newDay, and round-trips saves', () => {
  assert.equal(wrapMinutes(-60), MINUTES_PER_DAY - 60);
  assert.equal(wrapMinutes(MINUTES_PER_DAY + 30), 30);
  assert.equal(periodAt(6 * 60), 'dawn');
  assert.equal(periodAt(12 * 60), 'day');
  assert.equal(periodAt(19 * 60), 'dusk');
  assert.equal(periodAt(23 * 60), 'night');
  assert.equal(formatClock(8 * 60 + 5, 3), 'Day 3  08:05');

  const clock = createClock({ minutes: 23 * 60 + 30, day: 1 });
  const newDays = [];
  let changes = 0;
  clock.on('newDay', (e) => newDays.push(e.day));
  clock.on('change', () => { changes += 1; });

  // Advance 45 minutes -> rolls to Day 2 00:15.
  const after = clock.advance(45);
  assert.equal(after.day, 2);
  assert.equal(after.minutes, 15);
  assert.deepEqual(newDays, [2]);
  assert.equal(changes, 1);

  // Paused clock ignores tick().
  clock.setPaused(true);
  clock.tick(10);
  assert.equal(clock.getTime().minutes, 15);

  // Unpaused at scale 120 (2x) advances 2 game minutes per real second.
  clock.setPaused(false);
  clock.setScale(120);
  clock.tick(3);
  assert.equal(clock.getTime().minutes, 21);

  // Serialize / apply round-trip.
  const copy = createClock();
  copy.apply({ time: clock.serialize() });
  assert.deepEqual(copy.serialize(), clock.serialize());
});

test('mood rewards turn into half as much energy instead of doing nothing', () => {
  const needs = createNeeds();
  needs.set('energy', 50);
  needs.add('mood', 20);
  assert.equal(needs.get('energy'), 60);
});
