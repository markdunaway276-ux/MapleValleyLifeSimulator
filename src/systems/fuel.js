/**
 * The car's fuel tank. No Three.js, so it is unit tested (tests/fuel.test.mjs).
 *
 * Fuel is in litres. Driving burns it by distance, and the engine burns a
 * little while you sit in the car. A full tank is roughly 5 km, about
 * 12 minutes of flat-out driving up and down Maple Lane. With an empty tank
 * the engine stalls: the car coasts to a stop and the throttle does nothing.
 *
 * Fill up at the Maple Lane Fuel & Go pumps, or carry a gas can from the
 * store and get in the car to pour it in.
 */
export const FUEL = {
  TANK: 40,              // litres
  START: 24,             // new game / old saves
  PER_METRE: 0.008,      // litres per metre driven
  IDLE_PER_SECOND: 0.002,
  PRICE_PER_LITRE: 1.25, // dollars at the pump
  LOW: 6,                // litres: "running low" warning
  CAN_LITRES: 8          // a gas can from the store
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createFuelTank(litres = FUEL.START) {
  let fuel = clamp(Number.isFinite(litres) ? litres : FUEL.START, 0, FUEL.TANK);
  const listeners = [];
  const emit = () => { for (const fn of listeners) fn(fuel); };

  const tank = {
    get: () => fuel,
    fraction: () => fuel / FUEL.TANK,
    isEmpty: () => fuel <= 0,
    isLow: () => fuel <= FUEL.LOW,
    space: () => FUEL.TANK - fuel,
    set(v) {
      const next = clamp(Number(v) || 0, 0, FUEL.TANK);
      if (next !== fuel) { fuel = next; emit(); }
      return fuel;
    },
    add(litres) { return tank.set(fuel + Math.max(0, litres)); },
    /** Burn fuel for `metres` driven over `seconds` with the engine on. Returns litres used. */
    burn(metres, seconds) {
      if (fuel <= 0) return 0;
      const used = Math.max(0, metres) * FUEL.PER_METRE + Math.max(0, seconds) * FUEL.IDLE_PER_SECOND;
      const before = fuel;
      tank.set(fuel - used);
      return before - fuel;
    },
    onChange(fn) { listeners.push(fn); }
  };
  return tank;
}

/**
 * What filling up costs with `cash` to spend: fills the tank, or as much as
 * the cash covers, in whole dollars like every other price in the game.
 * Returns { litres, cost } (both 0 when the tank is full or you can't afford $1).
 */
export function quoteFill(space, cash, price = FUEL.PRICE_PER_LITRE) {
  const want = Math.max(0, space);
  if (want < 0.05 || !(cash >= 1)) return { litres: 0, cost: 0 };
  const full = Math.max(1, Math.ceil(want * price - 1e-9));
  if (cash >= full) return { litres: want, cost: full };
  const cost = Math.floor(cash);
  return { litres: Math.min(want, cost / price), cost };
}
