// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFuelTank, quoteFill, FUEL } from '../src/systems/fuel.js';
import { carBoundsClamp } from '../src/systems/carBounds.js';

test('driving burns fuel by distance, and stops at empty', () => {
  const tank = createFuelTank(1);
  const used = tank.burn(100, 0);
  assert.ok(Math.abs(used - 100 * FUEL.PER_METRE) < 1e-9);
  tank.burn(10000, 0);
  assert.equal(tank.get(), 0);
  assert.ok(tank.isEmpty());
  assert.equal(tank.burn(50, 5), 0);
});

test('a full tank lasts several kilometres', () => {
  const km = FUEL.TANK / FUEL.PER_METRE / 1000;
  assert.ok(km >= 4 && km <= 6, `tank range ${km} km`);
});

test('tank never goes past full or below empty, and bad saves fall back', () => {
  assert.equal(createFuelTank(999).get(), FUEL.TANK);
  assert.equal(createFuelTank(-3).get(), 0);
  assert.equal(createFuelTank(NaN).get(), FUEL.START);
  const tank = createFuelTank(FUEL.TANK - 1);
  tank.add(10);
  assert.equal(tank.get(), FUEL.TANK);
});

test('filling up: full tank when you can afford it, otherwise what your cash buys', () => {
  const full = quoteFill(20, 100);
  assert.equal(full.litres, 20);
  assert.equal(full.cost, Math.ceil(20 * FUEL.PRICE_PER_LITRE));
  const part = quoteFill(20, 10.7);
  assert.equal(part.cost, 10);
  assert.ok(Math.abs(part.litres - 10 / FUEL.PRICE_PER_LITRE) < 1e-9);
  assert.deepEqual(quoteFill(0, 100), { litres: 0, cost: 0 });
  assert.deepEqual(quoteFill(20, 0.5), { litres: 0, cost: 0 });
});

test('car bounds: the street and the gas station forecourt both count', () => {
  const street = { minX: -43.5, maxX: 43.5, minZ: -3, maxZ: 13.9 };
  const lot = { minX: -8.45, maxX: 8.45, minZ: -3, maxZ: 30.4 };
  const rects = [street, lot];
  // On the street: untouched.
  assert.deepEqual(carBoundsClamp(20, 5, 2, 1, rects), { x: 20, z: 5 });
  // At the pumps: untouched.
  assert.deepEqual(carBoundsClamp(-3, 22, 1, 2, rects), { x: -3, z: 22 });
  // Past the north sidewalk away from the station: pushed back onto the street.
  const out = carBoundsClamp(25, 16, 2, 1, rects);
  assert.equal(out.x, 25);
  assert.equal(out.z, 13.9 - 1);
  // Into the store wall line: held at the lot's back edge.
  assert.equal(carBoundsClamp(0, 40, 1, 2, rects).z, 30.4 - 2);
});
