/**
 * Laundromat gameplay, free of three.js so it can be tested in node.
 *
 * Machines: 5 washers and 4 dryers. A load is yours ('you') or a customer
 * order id. Washing takes WASH_MINUTES of game time, drying DRY_MINUTES.
 *
 * Your own clothes: wash ($3 + one Detergent), dry ($2), take them out and
 * your Clean need is full again.
 *
 * Shift: clock in at the time clock (or ask Dottie). Customer bags appear on
 * the counter. Pick one up, wash it, dry it, fold it at the folding table and
 * hand it back at the counter. Pay is $8 an order, plus a tip of up to $8 if
 * it is back before it is due (less the closer to the deadline); late orders
 * pay $5 and no tip.
 *
 * Every step returns the hand animation to play (see playerActions.js).
 */

export const WASH_MINUTES = 20;
export const DRY_MINUTES = 15;
export const WASH_PRICE = 3;
export const DRY_PRICE = 2;
export const ORDER_BASE_PAY = 8;
export const ORDER_LATE_PAY = 5;
export const ORDER_MAX_TIP = 8;
export const ORDER_DUE_MINUTES = 150;
export const ORDER_EVERY_MINUTES = 45;
export const MAX_OPEN_ORDERS = 3;
export const SHIFT_MIN_ENERGY = 10;

export const WASHER_IDS = ['washer-1', 'washer-2', 'washer-3', 'washer-4', 'washer-5'];
export const DRYER_IDS = ['dryer-1', 'dryer-2', 'dryer-3', 'dryer-4'];

export const FOLD_JOB = {
  id: 'laundry-fold',
  name: 'Folding',
  verb: 'fold laundry',
  label: 'Folding laundry…',
  duration: 4,
  gameMinutes: 10,
  pay: 0,
  energy: 3,
  minEnergy: 3,
  tiredMessage: 'Too tired to fold.',
  action: 'fold'
};

const CUSTOMERS = ['Mrs. Patel', 'Mr. Okafor', 'Linda', 'Coach Reyes', 'Dr. Kim', 'the Hendersons', 'Marco', 'Aunt Bea', 'Priya', 'Old Mr. Duval'];

const possessive = (name) => (name === 'you' ? 'your' : name.endsWith('s') ? name + "'" : name + "'s");

export function createLaundry({
  getMinutes = () => 0,
  money = null,
  needs = null,
  inventory = null,
  toast = () => {},
  save = () => {},
  sfx = null,
  startWork = null,
  saved = null
} = {}) {
  const machines = [
    ...WASHER_IDS.map((id) => ({ id, kind: 'washer', load: null, doneAt: 0 })),
    ...DRYER_IDS.map((id) => ({ id, kind: 'dryer', load: null, doneAt: 0 }))
  ];
  let carry = null;   // { owner: 'you' | orderId, stage: 'dirty' | 'wet' | 'dry' | 'folded' }
  let orders = [];    // { id, name, due, taken }
  let shift = { on: false, done: 0, earned: 0, nextOrderAt: 0 };
  let nextId = 1;
  let folding = null; // order id while the fold job runs
  const listeners = [];

  if (saved && typeof saved === 'object') {
    for (const m of machines) {
      const s = (saved.machines || []).find((x) => x && x.id === m.id);
      if (s && s.load) { m.load = { ...s.load }; m.doneAt = Number(s.doneAt) || 0; }
    }
    if (saved.carry && saved.carry.owner) carry = { ...saved.carry };
    if (Array.isArray(saved.orders)) orders = saved.orders.map((o) => ({ ...o }));
    if (saved.shift) shift = { ...shift, ...saved.shift };
    nextId = Number(saved.nextId) || 1;
  }

  const now = () => Number(getMinutes()) || 0;
  const machine = (id) => machines.find((m) => m.id === id) || null;
  const order = (id) => orders.find((o) => o.id === id) || null;
  const ownerName = (owner) => (owner === 'you' ? 'you' : (order(owner) || {}).name || 'a customer');
  const running = (m) => !!(m && m.load && now() < m.doneAt);
  const finished = (m) => !!(m && m.load && now() >= m.doneAt);
  const minutesLeft = (m) => Math.max(1, Math.ceil(m.doneAt - now()));
  const changed = () => { for (const fn of listeners) fn(); save(); };

  function detergentIndex() {
    const list = inventory && typeof inventory.serialize === 'function' ? inventory.serialize() : [];
    return list.findIndex((item) => item && item.id === 'detergent');
  }

  function pay(amount) {
    if (amount > 0 && money && typeof money.add === 'function') money.add(amount, { category: 'Pay', label: 'Laundromat order pay and tip' });
  }

  function spend(amount, label) {
    if (!money || typeof money.spend !== 'function') return true;
    if (money.spend(amount, { category: 'Purchase', label })) return true;
    toast('Not enough cash.');
    return false;
  }

  // ---------------------------------------------------------------- machines

  /** { prompt, action, run } for a washer or dryer, or null if there is nothing to do. */
  function machineOption(id) {
    const m = machine(id);
    if (!m) return null;
    const isWasher = m.kind === 'washer';
    const noun = isWasher ? 'washer' : 'dryer';
    if (running(m)) {
      return { prompt: `check the ${noun} (${minutesLeft(m)} min left)`, action: 'press', run: () => { toast(`${isWasher ? 'Washing' : 'Drying'} ${possessive(ownerName(m.load.owner))} laundry — ${minutesLeft(m)} min left.`); return true; } };
    }
    if (finished(m)) {
      if (carry) return { prompt: `take out the laundry (hands full)`, action: null, run: () => { toast('Your hands are full.'); return false; } };
      const whose = possessive(ownerName(m.load.owner));
      if (!isWasher && m.load.owner === 'you') {
        return {
          prompt: 'take out your clean clothes', action: 'unload',
          run: () => {
            m.load = null;
            if (needs && typeof needs.refill === 'function') needs.refill('clean');
            toast('Fresh, clean clothes!');
            changed();
            return 'pickUp';
          }
        };
      }
      return {
        prompt: `take out ${whose} laundry`, action: 'unload',
        run: () => {
          carry = { owner: m.load.owner, stage: isWasher ? 'wet' : 'dry' };
          m.load = null;
          changed();
          return 'unload';
        }
      };
    }
    // Empty machine.
    if (carry) {
      const want = isWasher ? 'dirty' : 'wet';
      if (carry.stage !== want) {
        const hint = carry.stage === 'dirty' ? 'Dirty clothes go in a washer.'
          : carry.stage === 'wet' ? 'Wet clothes go in a dryer.'
            : carry.stage === 'dry' ? 'Dry clothes get folded at the folding table.'
              : 'Hand the folded laundry back at the counter.';
        return { prompt: `use the ${noun}`, action: null, run: () => { toast(hint); return false; } };
      }
      const own = carry.owner === 'you';
      const price = own ? (isWasher ? WASH_PRICE : DRY_PRICE) : 0;
      return {
        prompt: `load ${possessive(ownerName(carry.owner))} laundry${price ? ` ($${price})` : ''}`, action: 'load',
        run: () => {
          if (price && !spend(price, 'Laundromat ' + noun)) return false;
          m.load = { owner: carry.owner };
          m.doneAt = now() + (isWasher ? WASH_MINUTES : DRY_MINUTES);
          carry = null;
          if (sfx && typeof sfx.play === 'function') sfx.play('washer-start');
          changed();
          return 'load';
        }
      };
    }
    if (isWasher) {
      return {
        prompt: `wash your clothes ($${WASH_PRICE} + detergent)`, action: 'load',
        run: () => {
          const idx = detergentIndex();
          if (idx < 0) { toast('You need Detergent — the vending machine out front sells it.'); return false; }
          if (!spend(WASH_PRICE, 'Laundromat washer')) return false;
          inventory.consume(idx, 1);
          m.load = { owner: 'you' };
          m.doneAt = now() + WASH_MINUTES;
          if (sfx && typeof sfx.play === 'function') sfx.play('washer-start');
          toast(`Washing your clothes — ${WASH_MINUTES} min.`);
          changed();
          return 'load';
        }
      };
    }
    return { prompt: 'use the dryer', action: null, run: () => { toast('Wash something first, then dry it here.'); return false; } };
  }

  // -------------------------------------------------------------- shift work

  function spawnOrder() {
    const name = CUSTOMERS[(nextId - 1) % CUSTOMERS.length];
    const o = { id: 'order-' + nextId++, name, due: now() + ORDER_DUE_MINUTES, taken: false };
    orders.push(o);
    return o;
  }

  function clockOption() {
    if (shift.on) {
      return {
        prompt: 'clock out', action: 'press',
        run: () => {
          const msg = `Shift over: ${shift.done} order${shift.done === 1 ? '' : 's'}, $${shift.earned} earned.`;
          endShift();
          toast(msg);
          return 'press';
        }
      };
    }
    return {
      prompt: 'clock in for a shift', action: 'press',
      run: () => {
        const energy = needs && typeof needs.get === 'function' ? Number(needs.get('energy')) : 100;
        if (energy < SHIFT_MIN_ENERGY) { toast('Too tired for a shift.'); return false; }
        shift = { on: true, done: 0, earned: 0, nextOrderAt: now() + ORDER_EVERY_MINUTES };
        spawnOrder();
        spawnOrder();
        toast('Clocked in. Customer bags are on the counter.');
        changed();
        return 'press';
      }
    };
  }

  function endShift() {
    shift = { ...shift, on: false };
    const open = new Set(orders.map((o) => o.id));
    for (const m of machines) if (m.load && open.has(m.load.owner)) m.load = null;
    if (carry && open.has(carry.owner)) carry = null;
    orders = [];
    changed();
  }

  /** The next bag waiting on the counter, if any. */
  const waitingOrder = () => orders.find((o) => !o.taken) || null;

  function counterOption() {
    if (carry && carry.owner !== 'you' && carry.stage === 'folded') {
      const o = order(carry.owner);
      return {
        prompt: `hand back ${possessive(o ? o.name : 'the')} laundry`, action: 'handOver',
        run: () => {
          const late = !o || now() > o.due;
          const tip = late ? 0 : Math.max(2, Math.round(ORDER_MAX_TIP * Math.min(1, (o.due - now()) / ORDER_DUE_MINUTES)));
          const base = late ? ORDER_LATE_PAY : ORDER_BASE_PAY;
          pay(base + tip);
          shift.done += 1;
          shift.earned += base + tip;
          if (sfx && typeof sfx.play === 'function') sfx.play('cash');
          toast(late ? `+$${base} — ${o ? o.name : 'They'} wanted it sooner.` : `+$${base} and a $${tip} tip from ${o.name}!`);
          orders = orders.filter((x) => x !== o);
          carry = null;
          changed();
          return 'handOver';
        }
      };
    }
    if (!shift.on) return null;
    const o = waitingOrder();
    if (!o) return { prompt: 'check the counter', action: null, run: () => { toast('No bags waiting right now.'); return false; } };
    if (carry) return { prompt: `pick up ${possessive(o.name)} bag (hands full)`, action: null, run: () => { toast('Your hands are full.'); return false; } };
    return {
      prompt: `pick up ${possessive(o.name)} bag`, action: 'pickUp',
      run: () => {
        o.taken = true;
        carry = { owner: o.id, stage: 'dirty' };
        changed();
        return 'pickUp';
      }
    };
  }

  function tableOption() {
    if (folding) return null;
    if (!carry) return { prompt: 'use the folding table', action: null, run: () => { toast(shift.on ? 'Bring dry laundry here to fold it.' : 'Clock in at the back to work a shift.'); return false; } };
    if (carry.stage !== 'dry') return { prompt: 'use the folding table', action: null, run: () => { toast('Only dry laundry gets folded.'); return false; } };
    return {
      prompt: `fold ${possessive(ownerName(carry.owner))} laundry`, action: null,
      run: () => {
        if (typeof startWork !== 'function') return finishFold(carry.owner);
        const job = { ...FOLD_JOB, label: `Folding ${possessive(ownerName(carry.owner))} laundry…` };
        folding = carry.owner;
        if (!startWork(job)) { folding = null; return false; }
        return true;
      }
    };
  }

  /** Called when the fold job finishes. */
  function finishFold(owner = folding) {
    folding = null;
    if (!carry || carry.owner !== owner) return false;
    if (owner === 'you') {
      carry = null;
      if (needs && typeof needs.refill === 'function') needs.refill('clean');
    } else {
      carry = { ...carry, stage: 'folded' };
    }
    changed();
    return true;
  }

  // ----------------------------------------------------------------- update

  /** Advance timers; returns ids of machines that just finished. */
  let lastFinished = new Set(machines.filter(finished).map((m) => m.id));
  function update() {
    const done = [];
    for (const m of machines) {
      const f = finished(m);
      if (f && !lastFinished.has(m.id)) done.push(m.id);
      if (f) lastFinished.add(m.id); else lastFinished.delete(m.id);
    }
    if (shift.on && now() >= shift.nextOrderAt) {
      shift.nextOrderAt = now() + ORDER_EVERY_MINUTES;
      if (orders.length < MAX_OPEN_ORDERS) {
        const o = spawnOrder();
        toast(`New bag on the counter from ${o.name}.`);
        changed();
      }
    }
    if (done.length) {
      if (sfx && typeof sfx.play === 'function') sfx.play('washer-done');
      for (const id of done) {
        const m = machine(id);
        toast(`${m.kind === 'washer' ? 'Washer' : 'Dryer'} done: ${possessive(ownerName(m.load.owner))} laundry.`);
      }
      for (const fn of listeners) fn();
    }
    return done;
  }

  /** One line for the phone's Tasks app / HUD pin about what to do next. */
  function nextStep() {
    if (carry) {
      const whose = possessive(ownerName(carry.owner));
      if (carry.stage === 'dirty') return `Load ${whose} laundry into a washer.`;
      if (carry.stage === 'wet') return `Put ${whose} laundry in a dryer.`;
      if (carry.stage === 'dry') return `Fold ${whose} laundry at the folding table.`;
      return `Hand ${whose} laundry back at the counter.`;
    }
    const ready = machines.find(finished);
    if (ready) return `Take ${possessive(ownerName(ready.load.owner))} laundry out of the ${ready.kind}.`;
    const busy = machines.find(running);
    if (shift.on && waitingOrder()) return `Pick up ${possessive(waitingOrder().name)} bag from the counter.`;
    if (busy) return `${busy.kind === 'washer' ? 'Washer' : 'Dryer'} running — ${minutesLeft(busy)} min left.`;
    if (shift.on) return 'Wait for the next bag, or clock out in the back room.';
    return '';
  }

  function tasks() {
    const out = [];
    const ownBusy = machines.some((m) => m.load && m.load.owner === 'you') || (carry && carry.owner === 'you');
    if (shift.on) {
      out.push({ id: 'laundry-shift', title: `Laundromat shift (${shift.done} done, $${shift.earned})`, complete: false, npcId: 'dottie', step: nextStep() });
    } else if (ownBusy) {
      out.push({ id: 'laundry-own', title: 'Your laundry', complete: false, npcId: 'dottie', step: nextStep() });
    }
    return out;
  }

  /** Number of machines running (for the hum). */
  const runningCount = () => machines.filter(running).length;

  function serialize() {
    return {
      machines: machines.filter((m) => m.load).map((m) => ({ id: m.id, load: m.load, doneAt: m.doneAt })),
      carry,
      orders,
      shift,
      nextId
    };
  }

  return {
    machineOption,
    clockOption,
    counterOption,
    tableOption,
    finishFold,
    update,
    nextStep,
    tasks,
    runningCount,
    serialize,
    onChange: (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
    machineState: (id) => {
      const m = machine(id);
      if (!m) return null;
      return { running: running(m), finished: finished(m), owner: m.load ? m.load.owner : null };
    },
    waitingCount: () => orders.filter((o) => !o.taken).length,
    get carry() { return carry; },
    get onShift() { return shift.on; },
    get orders() { return orders.slice(); },
    get folding() { return folding; }
  };
}
