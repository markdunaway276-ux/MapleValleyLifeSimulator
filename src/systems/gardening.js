import { ITEM_DEFS } from '../data/items.js';
import { readInventoryItems, consumeInventorySlot } from '../data/recipes.js';

/**
 * Backyard Gardening system.
 *
 * Players plant seeds in raised garden beds behind their house, water them
 * (rain waters all planted beds automatically!), grow crops overnight across
 * game days, and harvest produce to cook at home or sell to Vince at the Market.
 */

export const GARDEN_PLOT_COUNT = 4;

export const CROP_DEFS = Object.freeze({
  tomato: Object.freeze({
    id: 'tomato',
    seedId: 'tomato-seeds',
    harvestId: 'tomato',
    name: 'Tomatoes',
    icon: '🍅',
    growDays: 1,
    yieldCount: 2,
    sellPrice: 10
  }),
  herbs: Object.freeze({
    id: 'herbs',
    seedId: 'herb-seeds',
    harvestId: 'herbs',
    name: 'Fresh Herbs',
    icon: '🌿',
    growDays: 1,
    yieldCount: 2,
    sellPrice: 8
  }),
  pumpkin: Object.freeze({
    id: 'pumpkin',
    seedId: 'pumpkin-seeds',
    harvestId: 'pumpkin',
    name: 'Autumn Pumpkin',
    icon: '🎃',
    growDays: 2,
    yieldCount: 1,
    sellPrice: 18
  })
});

export const PRODUCE_SELL_PRICES = Object.freeze({
  tomato: CROP_DEFS.tomato.sellPrice,
  herbs: CROP_DEFS.herbs.sellPrice,
  pumpkin: CROP_DEFS.pumpkin.sellPrice
});

const SEED_TO_CROP = Object.freeze({
  'tomato-seeds': 'tomato',
  'herb-seeds': 'herbs',
  'pumpkin-seeds': 'pumpkin'
});

function emptyPlot(index) {
  return {
    id: `plot-${index}`,
    cropId: null,
    plantedDay: 0,
    growthDays: 0,
    wateredToday: false,
    lastEvaluatedDay: 0
  };
}

export function isPlotMature(plot) {
  if (!plot || !plot.cropId) return false;
  const def = CROP_DEFS[plot.cropId];
  return !!def && plot.growthDays >= def.growDays;
}

export function createGardening({
  clock = null,
  needs = null,
  inventory = null,
  money = null,
  skills = null,
  sfx = null,
  toast = () => {},
  save = () => {},
  onChange = null
} = {}) {
  const plots = Array.from({ length: GARDEN_PLOT_COUNT }, (_, i) => emptyPlot(i));
  const listeners = [];
  if (typeof onChange === 'function') listeners.push(onChange);

  let harvestedCount = 0;
  let lastRainWaterDay = -1;

  function currentDay() {
    const t = clock?.getTime?.();
    return Math.max(1, Number(t?.day) | 0 || 1);
  }

  function emit() {
    const snap = getPlots();
    for (let i = 0; i < listeners.length; i++) listeners[i](snap);
  }

  function getPlots() {
    return plots.map((p) => ({
      ...p,
      crop: p.cropId ? CROP_DEFS[p.cropId] : null,
      mature: isPlotMature(p)
    }));
  }

  function getPlot(index) {
    const p = plots[index];
    if (!p) return null;
    return {
      ...p,
      crop: p.cropId ? CROP_DEFS[p.cropId] : null,
      mature: isPlotMature(p)
    };
  }

  /** Pick selected seed slot first, else first seed packet in the player's bag. */
  function findSeedInBag() {
    const items = readInventoryItems(inventory);
    const sel = inventory?.getSelected?.();
    if (sel && sel.item && SEED_TO_CROP[sel.item.id] && items[sel.index]) {
      return { index: sel.index, seedId: sel.item.id, cropId: SEED_TO_CROP[sel.item.id] };
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && SEED_TO_CROP[it.id]) {
        return { index: i, seedId: it.id, cropId: SEED_TO_CROP[it.id] };
      }
    }
    return null;
  }

  function plant(index) {
    const plot = plots[index];
    if (!plot || plot.cropId) return false;
    const found = findSeedInBag();
    if (!found) {
      toast("No seeds in bag! Buy Tomato, Herb, or Pumpkin Seeds at Vince's Market.");
      sfx?.play?.('click');
      return false;
    }
    consumeInventorySlot(inventory, found.index, 1);
    const day = currentDay();
    plot.cropId = found.cropId;
    plot.plantedDay = day;
    plot.growthDays = 0;
    plot.wateredToday = false;
    plot.lastEvaluatedDay = day;
    const crop = CROP_DEFS[found.cropId];
    clock?.advance?.(5);
    needs?.add?.('energy', -2);
    sfx?.play?.('pickup');
    toast(`Planted ${crop.name}! Water the bed (or let rain water it) to grow.`);
    emit();
    save?.();
    return true;
  }

  function water(index) {
    const plot = plots[index];
    if (!plot || !plot.cropId) return false;
    const crop = CROP_DEFS[plot.cropId];
    if (isPlotMature(plot)) return harvest(index);
    if (plot.wateredToday) {
      toast(`${crop.name} already watered today — check back tomorrow!`);
      return false;
    }
    plot.wateredToday = true;
    plot.lastEvaluatedDay = currentDay();
    clock?.advance?.(5);
    needs?.add?.('energy', -2);
    sfx?.play?.('pickup');
    toast(`Watered ${crop.name}! They'll grow overnight.`);
    emit();
    save?.();
    return true;
  }

  function harvest(index) {
    const plot = plots[index];
    if (!plot || !plot.cropId || !isPlotMature(plot)) return false;
    const crop = CROP_DEFS[plot.cropId];
    if (inventory && typeof inventory.addItem === 'function') {
      const added = inventory.addItem(crop.harvestId, crop.yieldCount);
      if (!added) {
        toast('Your bag is full! Make space before harvesting.');
        sfx?.play?.('click');
        return false;
      }
    }
    const harvestDef = ITEM_DEFS[crop.harvestId];
    const label = (harvestDef && harvestDef.name) || crop.name;
    plots[index] = emptyPlot(index);
    harvestedCount += crop.yieldCount;
    clock?.advance?.(5);
    skills?.addXp?.('cooking', 12);
    sfx?.play?.('pickup');
    toast(`Harvested ${crop.yieldCount}× ${label}! Cook at home or sell to Vince.`);
    emit();
    save?.();
    return true;
  }

  /** Single-button interaction for a raised garden bed. */
  function interactPlot(index) {
    const plot = plots[index];
    if (!plot) return false;
    if (!plot.cropId) return plant(index);
    if (isPlotMature(plot)) return harvest(index);
    return water(index);
  }

  function promptForPlot(index, isMobile = false) {
    const plot = plots[index];
    const prefix = isMobile ? 'Tap to ' : 'Press E to ';
    if (!plot) return '';
    if (!plot.cropId) {
      const seed = findSeedInBag();
      if (seed) {
        const seedDef = ITEM_DEFS[seed.seedId];
        return `${prefix}plant ${(seedDef && seedDef.name) || 'Seeds'}`;
      }
      return 'Empty garden bed (buy seeds at Market)';
    }
    const crop = CROP_DEFS[plot.cropId];
    if (isPlotMature(plot)) return `${prefix}harvest ${crop.name}!`;
    if (plot.wateredToday) return `${crop.name} watered — growing overnight`;
    return `${prefix}water ${crop.name}`;
  }

  /**
   * Advance growth when a new game day arrives, and auto-water planted beds
   * whenever it rains.
   */
  function syncWithWorld({ day = currentDay(), rain = 0 } = {}) {
    const d = Math.max(1, Number(day) | 0 || 1);
    let changed = false;

    for (let i = 0; i < plots.length; i++) {
      const plot = plots[i];
      if (!plot.cropId) continue;
      if (plot.lastEvaluatedDay <= 0) plot.lastEvaluatedDay = d;
      if (d > plot.lastEvaluatedDay) {
        const crop = CROP_DEFS[plot.cropId];
        if (plot.wateredToday && plot.growthDays < crop.growDays) {
          plot.growthDays = Math.min(crop.growDays, plot.growthDays + 1);
        }
        plot.wateredToday = false;
        plot.lastEvaluatedDay = d;
        changed = true;
      }
    }

    if (rain >= 0.25) {
      let wateredAny = false;
      for (let i = 0; i < plots.length; i++) {
        const plot = plots[i];
        if (plot.cropId && !isPlotMature(plot) && !plot.wateredToday) {
          plot.wateredToday = true;
          plot.lastEvaluatedDay = d;
          wateredAny = true;
          changed = true;
        }
      }
      if (wateredAny && lastRainWaterDay !== d) {
        lastRainWaterDay = d;
        toast('Rain is watering your backyard garden!');
      }
    }

    if (changed) {
      emit();
      save?.();
    }
    return changed;
  }

  function countSellableProduce() {
    const items = readInventoryItems(inventory);
    let count = 0;
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && PRODUCE_SELL_PRICES[it.id]) {
        const qty = Math.max(1, Number(it.count) || 1);
        count += qty;
        total += qty * PRODUCE_SELL_PRICES[it.id];
      }
    }
    return { count, total };
  }

  function sellAllProduce() {
    const items = readInventoryItems(inventory);
    let sold = 0;
    let total = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it && PRODUCE_SELL_PRICES[it.id]) {
        const qty = Math.max(1, Number(it.count) || 1);
        sold += qty;
        total += qty * PRODUCE_SELL_PRICES[it.id];
        consumeInventorySlot(inventory, i, qty);
      }
    }
    if (sold > 0) {
      money?.add?.(total, { category: 'Garden', label: 'Backyard produce' });
      sfx?.play?.('pickup');
      toast(`Sold ${sold} homegrown produce to Vince for $${total}!`);
      save?.();
    }
    return { sold, total };
  }

  function pageFor(npcId) {
    if (npcId !== 'vince') return null;
    const { count, total } = countSellableProduce();
    if (!count) return null;
    return {
      lines: [
        `Homegrown from your backyard? Those look fresh! I'll buy ${count === 1 ? 'that' : `all ${count} items`} for $${total}.`
      ],
      action: {
        label: `Sell ${count} produce (+$${total})`,
        run: () => sellAllProduce().sold > 0
      },
      response: [
        'Folks on Maple Lane love local produce. Keep those garden beds growing!'
      ]
    };
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function serialize() {
    return {
      harvestedCount,
      plots: plots.map((p) => ({
        id: p.id,
        cropId: p.cropId,
        plantedDay: p.plantedDay,
        growthDays: p.growthDays,
        wateredToday: p.wateredToday,
        lastEvaluatedDay: p.lastEvaluatedDay
      }))
    };
  }

  function apply(data) {
    const g = data?.garden;
    if (!g || typeof g !== 'object') return;
    harvestedCount = Math.max(0, Number(g.harvestedCount) | 0);
    if (Array.isArray(g.plots)) {
      for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
        const src = g.plots[i];
        if (!src || typeof src !== 'object' || !CROP_DEFS[src.cropId]) {
          plots[i] = emptyPlot(i);
        } else {
          plots[i] = {
            id: `plot-${i}`,
            cropId: src.cropId,
            plantedDay: Number(src.plantedDay) | 0,
            growthDays: Math.max(0, Number(src.growthDays) | 0),
            wateredToday: !!src.wateredToday,
            lastEvaluatedDay: Number(src.lastEvaluatedDay) | 0
          };
        }
      }
    }
    emit();
  }

  return {
    getPlots,
    getPlot,
    plant,
    water,
    harvest,
    interactPlot,
    promptForPlot,
    syncWithWorld,
    countSellableProduce,
    sellAllProduce,
    pageFor,
    onChange: subscribe,
    getStats: () => ({ harvestedCount }),
    serialize,
    apply
  };
}
