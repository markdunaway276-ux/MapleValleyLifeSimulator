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
export const DETERGENT_PRICE = 2;
export const DRY_PRICE = 2;
export const ORDER_BASE_PAY = 8;
export const ORDER_LATE_PAY = 5;
export const ORDER_MAX_TIP = 8;
export const ORDER_DUE_MINUTES = 150;
export const ORDER_EVERY_MINUTES = 45;
export const MAX_OPEN_ORDERS = 3;
export const SHIFT_MIN_ENERGY = 10;
export const STREAK_STEP = 3;
export const STREAK_BONUS = 5;
export const COIN_FIND_CHANCE = 0.25;
export const WARM_ENERGY_BOOST = 8;
export const SOFTENER_ENERGY_BOOST = 15;
export const MAGAZINE_ENERGY_BOOST = 5;
export const BAG_COLORS = [0xc95b4e, 0x4b7fa8, 0xd4a441, 0x5c8f66, 0x8e6bb5, 0xc47b52];

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
  advanceMinutes = null,
  money = null,
  needs = null,
  inventory = null,
  toast = () => {},
  save = () => {},
  sfx = null,
  startWork = null,
  onOrderComplete = null,
  random = Math.random,
  saved = null
} = {}) {
  const machines = [
    ...WASHER_IDS.map((id) => ({ id, kind: 'washer', load: null, doneAt: 0 })),
    ...DRYER_IDS.map((id) => ({ id, kind: 'dryer', load: null, doneAt: 0 }))
  ];
  let carry = null;   // { owner: 'you' | orderId, stage: 'dirty' | 'wet' | 'dry' | 'folded' }
  let orders = [];    // { id, name, due, taken, color }
  let shift = { on: false, done: 0, earned: 0, streak: 0, nextOrderAt: 0 };
  let totalOrders = 0;
  let nextId = 1;
  let folding = null; // order id while the fold job runs
  let fast = false;   // development: machines take 1 game minute, bags every 5
  const washMinutes = () => (fast ? 1 : WASH_MINUTES);
  const dryMinutes = () => (fast ? 1 : DRY_MINUTES);
  const orderEvery = () => (fast ? 5 : ORDER_EVERY_MINUTES);
  const listeners = [];

  if (saved && typeof saved === 'object') {
    for (const m of machines) {
      const s = (saved.machines || []).find((x) => x && x.id === m.id);
      if (s && s.load) { m.load = { ...s.load }; m.doneAt = Number(s.doneAt) || 0; }
    }
    if (saved.carry && saved.carry.owner) carry = { ...saved.carry };
    if (Array.isArray(saved.orders)) orders = saved.orders.map((o) => ({ ...o }));
    if (saved.shift) shift = { ...shift, ...saved.shift };
    totalOrders = Number(saved.totalOrders) || 0;
    nextId = Number(saved.nextId) || 1;
  }

  const now = () => Number(getMinutes()) || 0;
  const machine = (id) => machines.find((m) => m.id === id) || null;
  const order = (id) => orders.find((o) => o.id === id) || null;
  const ownerName = (owner) => (owner === 'you' ? 'you' : (order(owner) || {}).name || 'a customer');
  const running = (m) => !!(m && m.load && now() < m.doneAt);
  const finished = (m) => !!(m && m.load && now() >= m.doneAt);
  const minutesLeft = (m) => Math.max(1, Math.ceil(m.doneAt - now()));
  const dueLeft = (o) => (o ? Math.max(0, Math.ceil(o.due - now())) : 0);
  const changed = () => { for (const fn of listeners) fn(); save(); };

  function itemIndex(itemId) {
    const list = inventory && typeof inventory.serialize === 'function' ? inventory.serialize() : [];
    return list.findIndex((item) => item && item.id === itemId);
  }
  const detergentIndex = () => itemIndex('detergent');
  const softenerIndex = () => itemIndex('softener');

  function maybeFindCoins(noun) {
    if (typeof random !== 'function' || random() >= COIN_FIND_CHANCE) return 0;
    const found = 1 + Math.floor(Math.min(0.9999, Math.max(0, random())) * 3);
    if (money && typeof money.add === 'function') {
      money.add(found, { category: 'Found', label: 'Stray quarters in laundromat' });
    }
    if (sfx && typeof sfx.play === 'function') sfx.play('cash');
    toast(`Lucky find! Found $${found} in stray quarters in the ${noun}.`);
    return found;
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
      const o = m.load.owner !== 'you' ? order(m.load.owner) : null;
      const dueNote = o ? (dueLeft(o) > 0 ? ` · due in ${dueLeft(o)} min` : ' · LATE') : '';
      return {
        prompt: `check the ${noun} (${minutesLeft(m)} min left${dueNote})`,
        action: 'press',
        run: () => {
          toast(`${isWasher ? 'Washing' : 'Drying'} ${possessive(ownerName(m.load.owner))} laundry — ${minutesLeft(m)} min left${dueNote}.`);
          return true;
        }
      };
    }
    if (finished(m)) {
      if (carry) return { prompt: `take out the laundry (hands full)`, action: null, run: () => { toast('Your hands are full.'); return false; } };
      const whose = possessive(ownerName(m.load.owner));
      if (!isWasher && m.load.owner === 'you') {
        const softened = !!m.load.softened;
        return {
          prompt: 'take out your clean clothes', action: 'unload',
          run: () => {
            m.load = null;
            if (needs && typeof needs.refill === 'function') needs.refill('clean');
            const boost = softened ? SOFTENER_ENERGY_BOOST : WARM_ENERGY_BOOST;
            if (needs && typeof needs.add === 'function') {
              needs.add('energy', boost);
              needs.add('mood', softened ? 18 : 10);
            }
            toast(softened
              ? `Warm, lavender-fresh clothes! (+${boost} Energy)`
              : `Fresh, warm clothes straight from the dryer! (+${boost} Energy)`);
            maybeFindCoins(noun);
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
          maybeFindCoins(noun);
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
      const useSoftener = own && !isWasher && softenerIndex() >= 0;
      return {
        prompt: `load ${possessive(ownerName(carry.owner))} laundry${price ? ` ($${price}${useSoftener ? ' + softener' : ''})` : ''}`, action: 'load',
        run: () => {
          if (price && !spend(price, 'Laundromat ' + noun)) return false;
          let softened = false;
          if (own && !isWasher) {
            const sIdx = softenerIndex();
            if (sIdx >= 0 && inventory && typeof inventory.consume === 'function') {
              inventory.consume(sIdx, 1);
              softened = true;
            }
          }
          m.load = softened ? { owner: carry.owner, softened: true } : { owner: carry.owner };
          m.doneAt = now() + (isWasher ? washMinutes() : dryMinutes());
          carry = null;
          if (sfx && typeof sfx.play === 'function') sfx.play('washer-start');
          changed();
          return 'load';
        }
      };
    }
    if (isWasher) {
      const hasSoap = detergentIndex() >= 0;
      const total = hasSoap ? WASH_PRICE : WASH_PRICE + DETERGENT_PRICE;
      return {
        prompt: hasSoap
          ? `wash your clothes ($${WASH_PRICE} + detergent)`
          : `wash your clothes ($${total} incl. soap)`,
        action: 'load',
        run: () => {
          const idx = detergentIndex();
          if (idx >= 0) {
            if (!spend(WASH_PRICE, 'Laundromat washer')) return false;
            inventory.consume(idx, 1);
            m.load = { owner: 'you' };
            m.doneAt = now() + washMinutes();
            if (sfx && typeof sfx.play === 'function') sfx.play('washer-start');
            toast(`Washing your clothes — ${washMinutes()} min.`);
            changed();
            return 'load';
          }
          const combo = WASH_PRICE + DETERGENT_PRICE;
          if (!money || typeof money.spend !== 'function' || !money.spend(combo, { category: 'Purchase', label: 'Laundromat washer + soap' })) {
            toast(`Not enough cash — need $${combo} with soap, or grab $${DETERGENT_PRICE} Detergent from the soap dispenser.`);
            return false;
          }
          m.load = { owner: 'you' };
          m.doneAt = now() + washMinutes();
          if (sfx && typeof sfx.play === 'function') sfx.play('washer-start');
          toast(`Washing your clothes (soap included) — ${washMinutes()} min.`);
          changed();
          return 'load';
        }
      };
    }
    const ownWash = machines.find((x) => x.kind === 'washer' && x.load && x.load.owner === 'you');
    return {
      prompt: 'use the dryer',
      action: null,
      run: () => {
        if (ownWash && running(ownWash)) {
          toast(`Your clothes are still washing — ${minutesLeft(ownWash)} min left.`);
        } else if (ownWash && finished(ownWash)) {
          toast('Your wash is done! Grab your wet clothes from the washer first.');
        } else {
          toast('Wash your clothes at a center-island washer first, then dry them here.');
        }
        return false;
      }
    };
  }

  // -------------------------------------------------------------- shift work

  function spawnOrder() {
    const idx = nextId - 1;
    const name = CUSTOMERS[idx % CUSTOMERS.length];
    const color = BAG_COLORS[idx % BAG_COLORS.length];
    const o = { id: 'order-' + nextId++, name, due: now() + ORDER_DUE_MINUTES, taken: false, color };
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
        shift = { on: true, done: 0, earned: 0, streak: 0, nextOrderAt: now() + orderEvery() };
        spawnOrder();
        spawnOrder();
        toast('Clocked in. Customer bags are on the counter.');
        changed();
        return 'press';
      }
    };
  }

  function endShift() {
    shift = { ...shift, on: false, streak: 0 };
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
          totalOrders += 1;
          shift.streak = late ? 0 : (shift.streak || 0) + 1;
          let bonus = 0;
          if (!late && shift.streak > 0 && shift.streak % STREAK_STEP === 0) {
            bonus = STREAK_BONUS;
            if (money && typeof money.add === 'function') {
              money.add(bonus, { category: 'Bonus', label: 'Laundromat on-time streak bonus' });
            }
          }
          shift.earned += base + tip + bonus;
          if (sfx && typeof sfx.play === 'function') sfx.play('cash');
          const baseMsg = late
            ? `+$${base} — ${o ? o.name : 'They'} wanted it sooner.`
            : `+$${base} and a $${tip} tip from ${o.name}!`;
          toast(bonus ? `${baseMsg} ${shift.streak}-in-a-row streak bonus (+$${bonus})!` : baseMsg);
          orders = orders.filter((x) => x !== o);
          carry = null;
          if (typeof onOrderComplete === 'function') {
            onOrderComplete({ onTime: !late, streak: shift.streak, totalOrders, customer: o?.name || '' });
          }
          changed();
          return 'handOver';
        }
      };
    }
    if (!shift.on) return null;
    const o = waitingOrder();
    if (!o) return { prompt: 'check the counter', action: null, run: () => { toast('No bags waiting right now.'); return false; } };
    const left = dueLeft(o);
    const dueLabel = left > 0 ? `${left} min left` : 'LATE';
    if (carry) return { prompt: `pick up ${possessive(o.name)} bag (hands full)`, action: null, run: () => { toast('Your hands are full.'); return false; } };
    return {
      prompt: `pick up ${possessive(o.name)} bag (${dueLabel})`, action: 'pickUp',
      run: () => {
        o.taken = true;
        carry = { owner: o.id, stage: 'dirty' };
        changed();
        return 'pickUp';
      }
    };
  }

  /** Magazine rack: pass time smoothly until the soonest running machine finishes. */
  function waitOption() {
    const busy = machines.filter(running);
    if (!busy.length) {
      return {
        prompt: 'browse the magazine rack',
        action: 'press',
        run: () => {
          toast('Maple Valley Monthly — start a wash or dry cycle to pass the time here.');
          return false;
        }
      };
    }
    busy.sort((a, b) => a.doneAt - b.doneAt);
    const soonest = busy[0];
    const waitMins = minutesLeft(soonest);
    return {
      prompt: `read a magazine while waiting (${waitMins} min)`,
      action: 'press',
      run: () => {
        if (typeof advanceMinutes !== 'function') {
          toast(`${soonest.kind === 'washer' ? 'Washer' : 'Dryer'} has ${waitMins} min left.`);
          return false;
        }
        advanceMinutes(waitMins);
        if (needs && typeof needs.add === 'function') {
          needs.add('energy', MAGAZINE_ENERGY_BOOST);
          needs.add('mood', 6);
        }
        update();
        toast(`Flipped through Maple Valley Monthly (${waitMins} min) — ${soonest.kind} is ready!`);
        changed();
        return 'press';
      }
    };
  }

  function tableOption() {
    if (folding) return null;
    if (!carry) {
      const ownBusy = machines.some((m) => m.load && m.load.owner === 'you');
      return {
        prompt: 'use the folding table',
        action: null,
        run: () => {
          toast(
            shift.on ? 'Bring dry customer laundry here to fold it.'
              : ownBusy ? 'Your own clothes are ready to wear straight out of the dryer — no folding needed!'
                : 'Clock in at the back (or ask Dottie) to work a shift.'
          );
          return false;
        }
      };
    }
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
      shift.nextOrderAt = now() + orderEvery();
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
      totalOrders,
      nextId
    };
  }

  function waitingOrders() {
    return orders.filter((o) => !o.taken).map((o) => ({
      id: o.id,
      name: o.name,
      color: o.color ?? BAG_COLORS[0],
      dueLeft: dueLeft(o)
    }));
  }

  function boardSummary() {
    return {
      onShift: shift.on,
      streak: shift.streak || 0,
      done: shift.done || 0,
      earned: shift.earned || 0,
      totalOrders,
      orders: orders.map((o) => ({
        id: o.id,
        name: o.name,
        taken: !!o.taken,
        color: o.color ?? BAG_COLORS[0],
        dueLeft: dueLeft(o)
      }))
    };
  }

  return {
    machineOption,
    clockOption,
    counterOption,
    tableOption,
    waitOption,
    finishFold,
    update,
    nextStep,
    tasks,
    runningCount,
    serialize,
    waitingOrders,
    boardSummary,
    onChange: (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
    machineState: (id) => {
      const m = machine(id);
      if (!m) return null;
      return { running: running(m), finished: finished(m), owner: m.load ? m.load.owner : null };
    },
    waitingCount: () => orders.filter((o) => !o.taken).length,
    get carry() { return carry; },
    get onShift() { return shift.on; },
    get streak() { return shift.streak || 0; },
    get totalOrders() { return totalOrders; },
    get orders() { return orders.slice(); },
    get folding() { return folding; },
    get fast() { return fast; },
    /** Development: finish machines in a minute and bring bags every few minutes. */
    setFast(on) {
      fast = !!on;
      if (fast) {
        const soon = now() + 1;
        for (const m of machines) if (m.load && m.doneAt > soon) m.doneAt = soon;
        if (shift.on && shift.nextOrderAt > now() + orderEvery()) shift.nextOrderAt = now() + orderEvery();
      }
      changed();
    }
  };
}
