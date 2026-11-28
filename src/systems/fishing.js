import { ITEM_DEFS } from '../data/items.js';

/**
 * Relaxing Pond Fishing at Maple Lane Park.
 * Players cast from the pond footbridge tackle spot, spend a touch of energy,
 * gain Mood, and reel in valley fish (sellable to Vince at Maple Lane Market)
 * or the rare Tarnished Locket clue for the ongoing Maple Valley mystery.
 */

export const FISH_TABLE = Object.freeze([
  { id: 'bluegill', weight: 0.48, price: 9, label: 'Pond Bluegill' },
  { id: 'trout', weight: 0.30, price: 16, label: 'Maple Trout' },
  { id: 'bass', weight: 0.16, price: 22, label: 'Valley Bass' },
  { id: 'old-locket', weight: 0.06, price: 0, label: 'Tarnished Locket', unique: true }
]);

export const FISH_IDS = Object.freeze(['bluegill', 'trout', 'bass']);
export const FISH_SELL_PRICES = Object.freeze({ bluegill: 9, trout: 16, bass: 22 });

export function createFishing({
  clock = null,
  needs = null,
  inventory = null,
  money = null,
  sfx = null,
  toast = () => {},
  save = () => {},
  onCatch = () => {},
  rng = Math.random
} = {}) {
  let caughtCount = 0;
  let foundLocket = false;

  function hasItem(id) {
    const items = inventory?.getItems?.() ?? [];
    return items.some((it) => it && it.id === id);
  }

  function pickCatch() {
    const r = rng();
    let acc = 0;
    for (const entry of FISH_TABLE) {
      acc += entry.weight;
      if (r <= acc) {
        if (entry.unique && (foundLocket || hasItem(entry.id))) {
          return FISH_TABLE[1]; // Maple Trout if locket already found
        }
        return entry;
      }
    }
    return FISH_TABLE[0];
  }

  function cast() {
    if (needs && needs.get().energy < 6) {
      toast('Too tired to cast — grab a coffee or rest first.');
      sfx?.play?.('click');
      return null;
    }
    const catchDef = pickCatch();
    const itemDef = ITEM_DEFS[catchDef.id];
    if (!itemDef) return null;

    if (inventory && typeof inventory.addItem === 'function') {
      const added = inventory.addItem(catchDef.id, 1);
      if (!added) {
        toast('Your bag is full! Sell or store something first.');
        sfx?.play?.('click');
        return null;
      }
    }

    clock?.advance?.(10);
    needs?.add?.('energy', -4);
    needs?.add?.('mood', 10);
    caughtCount += 1;
    if (catchDef.id === 'old-locket') {
      foundLocket = true;
      toast('You reeled in a Tarnished Locket engraved "K.M. — Route 9"!');
    } else {
      toast(`Caught a ${catchDef.label}! (+10 Mood · Sell at Vince's Market)`);
    }
    sfx?.play?.('pickup');
    onCatch(catchDef);
    save();
    return catchDef;
  }

  function countSellableFish() {
    const items = inventory?.getItems?.() ?? [];
    let count = 0;
    let total = 0;
    for (const it of items) {
      if (it && FISH_SELL_PRICES[it.id]) {
        const qty = it.count || 1;
        count += qty;
        total += qty * FISH_SELL_PRICES[it.id];
      }
    }
    return { count, total };
  }

  function sellAllFish() {
    const items = inventory?.getItems?.() ?? [];
    let total = 0;
    let sold = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it && FISH_SELL_PRICES[it.id]) {
        const qty = it.count || 1;
        total += qty * FISH_SELL_PRICES[it.id];
        sold += qty;
        inventory.consume(i, qty);
      }
    }
    if (sold > 0) {
      money?.add?.(total);
      sfx?.play?.('pickup');
      toast(`Sold ${sold} fresh fish to Vince for $${total}!`);
      save();
    }
    return { sold, total };
  }

  function pageFor(npcId) {
    if (npcId !== 'vince') return null;
    const { count, total } = countSellableFish();
    if (!count) return null;
    return {
      lines: [
        `Fresh out of Maple Lane Pond? I'll take ${count === 1 ? 'that fish' : `all ${count} of those fish`} off your hands for $${total}.`
      ],
      action: {
        label: `Sell ${count} fish (+$${total})`,
        run: () => sellAllFish().sold > 0
      },
      response: [
        'Nothing beats fresh valley catch. Bring more anytime!'
      ]
    };
  }

  return {
    cast,
    sellAllFish,
    countSellableFish,
    pageFor,
    getStats: () => ({ caughtCount, foundLocket }),
    serialize: () => ({ caughtCount, foundLocket }),
    apply(data) {
      const f = data?.fishing;
      if (!f || typeof f !== 'object') return;
      caughtCount = Math.max(0, Number(f.caughtCount) | 0);
      foundLocket = !!f.foundLocket;
    }
  };
}
