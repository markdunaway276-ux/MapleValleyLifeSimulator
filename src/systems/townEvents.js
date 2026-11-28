import { calendarDate } from '../data/calendar.js';
import { ITEM_DEFS } from '../data/items.js';
import { PRODUCE_SELL_PRICES } from './gardening.js';
import { FISH_SELL_PRICES } from './fishing.js';
import { readInventoryItems, consumeInventorySlot } from '../data/recipes.js';

/**
 * Weekly Town Events system (Live Calendar):
 *  - Saturday (weekday 5, 08:00–18:00): Maple Lane Park Farmers' Market
 *    Pop-up stalls with rotating weekly treats & discounted seeds, plus a +20%
 *    bonus when selling backyard produce or fresh fish at the market stall.
 *  - Sunday (weekday 6, 07:00–19:00): Maple Lane Pond Fishing Derby
 *    Pond catches score Derby points on a friendly town leaderboard; beating
 *    1st place awards $45 and permanently unlocks a 3D Golden Trout Trophy
 *    inside the player's house.
 */

export const MARKET_WEEKDAY = 5; // Saturday (0 = Mon)
export const DERBY_WEEKDAY = 6;  // Sunday

export const DERBY_POINTS = Object.freeze({
  bluegill: 12,
  trout: 24,
  bass: 38
});

export const DERBY_RIVALS = Object.freeze([
  { id: 'walt', name: 'Walt', points: 42 },
  { id: 'sam', name: 'Sam', points: 28 },
  { id: 'hank', name: 'Hank', points: 18 }
]);

export const MARKET_ROTATIONS = Object.freeze([
  {
    produce: { item: 'tomato-seeds', name: 'Market Tomato Seeds', price: 3 },
    treat: { item: 'morning-pancakes', name: 'Market Pancakes', price: 9 }
  },
  {
    produce: { item: 'herb-seeds', name: 'Market Herb Seeds', price: 2 },
    treat: { item: 'warm-cocoa', name: 'Spiced Market Cocoa', price: 6 }
  },
  {
    produce: { item: 'pumpkin-seeds', name: 'Market Pumpkin Seeds', price: 5 },
    treat: { item: 'tomato-soup', name: 'Artisan Tomato Soup', price: 8 }
  }
]);

export function eventForDay(day) {
  const info = calendarDate(day);
  if (info.weekday === MARKET_WEEKDAY) {
    return {
      id: 'farmers-market',
      name: "Park Farmers' Market",
      icon: '🧺',
      hours: '8:00 AM – 6:00 PM',
      location: 'Maple Lane Park Plaza',
      description: 'Pop-up stalls with rotating seeds, homemade treats, and +20% bonus on garden produce!'
    };
  }
  if (info.weekday === DERBY_WEEKDAY) {
    return {
      id: 'fishing-derby',
      name: 'Pond Fishing Derby',
      icon: '🏆',
      hours: '7:00 AM – 7:00 PM',
      location: 'Maple Lane Park Pond',
      description: 'Catch valley fish to top the leaderboard and win $45 + the Golden Trout Trophy!'
    };
  }
  return null;
}

export function createTownEvents({
  clock = null,
  inventory = null,
  money = null,
  friendship = null,
  sfx = null,
  toast = () => {},
  save = () => {},
  onChange = null
} = {}) {
  let hasTrophy = false;
  let derbyWins = 0;
  let lastNotifiedDay = -1;
  let derbyDay = 0;
  let derbyPoints = 0;
  let derbyCatches = 0;
  let derbyClaimedDay = 0;
  const listeners = [];
  if (typeof onChange === 'function') listeners.push(onChange);

  function emit() {
    for (let i = 0; i < listeners.length; i++) listeners[i](getStatus());
  }

  function currentTime() {
    const t = clock?.getTime?.();
    const day = Math.max(1, Number(t?.day) | 0 || 1);
    const mins = Number(t?.minutes);
    const hour = Number.isFinite(mins) ? ((mins / 60) % 24 + 24) % 24 : 10;
    return { day, hour, info: calendarDate(day) };
  }

  function isMarketOpen() {
    const { info, hour } = currentTime();
    return info.weekday === MARKET_WEEKDAY && hour >= 8 && hour < 18;
  }

  function isDerbyOpen() {
    const { info, hour } = currentTime();
    return info.weekday === DERBY_WEEKDAY && hour >= 7 && hour < 19;
  }

  function currentMarketOffers() {
    const { day } = currentTime();
    const weekIdx = Math.floor((day - 1) / 7) % MARKET_ROTATIONS.length;
    return MARKET_ROTATIONS[weekIdx];
  }

  function buyMarketOffer(kind = 'treat') {
    if (!isMarketOpen()) {
      toast("The Park Farmers' Market runs Saturdays from 8 AM to 6 PM.");
      return false;
    }
    const offers = currentMarketOffers();
    const offer = kind === 'produce' ? offers.produce : offers.treat;
    if (!offer || !ITEM_DEFS[offer.item]) return false;
    if (money && money.get() < offer.price) {
      toast(`Not enough cash ($${offer.price} needed).`);
      sfx?.play?.('click');
      return false;
    }
    if (inventory && typeof inventory.addItem === 'function') {
      const added = inventory.addItem(offer.item, 1);
      if (!added) {
        toast('Your bag is full!');
        sfx?.play?.('click');
        return false;
      }
    }
    money?.spend?.(offer.price, { category: 'Farmers Market', label: offer.name });
    sfx?.play?.('cash');
    toast(`Bought ${offer.name} (-$${offer.price})`);
    save?.();
    return true;
  }

  function sellAtMarket() {
    if (!isMarketOpen()) return { sold: 0, total: 0 };
    const items = readInventoryItems(inventory);
    let sold = 0;
    let total = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!it) continue;
      const base = PRODUCE_SELL_PRICES[it.id] || FISH_SELL_PRICES[it.id] || 0;
      if (base > 0) {
        const qty = Math.max(1, Number(it.count) || 1);
        const bonusPrice = Math.round(base * 1.2);
        sold += qty;
        total += qty * bonusPrice;
        consumeInventorySlot(inventory, i, qty);
      }
    }
    if (sold > 0) {
      money?.add?.(total, { category: 'Farmers Market', label: 'Market stall sales (+20%)' });
      sfx?.play?.('pickup');
      toast(`Sold ${sold} fresh goods at the Farmers' Market for $${total} (+20% bonus)!`);
      save?.();
    } else {
      toast('Bring backyard produce or pond fish to sell here for +20% bonus!');
      sfx?.play?.('click');
    }
    return { sold, total };
  }

  function resetDerbyIfNewDay(day) {
    if (derbyDay !== day) {
      derbyDay = day;
      derbyPoints = 0;
      derbyCatches = 0;
    }
  }

  function recordDerbyCatch(catchDef) {
    if (!isDerbyOpen() || !catchDef) return 0;
    const pts = DERBY_POINTS[catchDef.id] || 0;
    if (!pts) return 0;
    const { day } = currentTime();
    resetDerbyIfNewDay(day);
    derbyPoints += pts;
    derbyCatches += 1;
    const lb = getLeaderboard();
    const myRank = lb.findIndex((e) => e.id === 'player') + 1;
    toast(`Fishing Derby +${pts} pts! Total: ${derbyPoints} pts (#${myRank} on leaderboard)`);
    emit();
    save?.();
    return pts;
  }

  function getLeaderboard() {
    const { day } = currentTime();
    const pts = derbyDay === day ? derbyPoints : 0;
    const entries = [
      ...DERBY_RIVALS.map((r) => ({ ...r })),
      { id: 'player', name: 'You', points: pts }
    ];
    entries.sort((a, b) => b.points - a.points || (a.id === 'player' ? -1 : 1));
    return entries;
  }

  function interactDerbyStand() {
    const { day } = currentTime();
    if (!isDerbyOpen()) {
      toast('Pond Fishing Derby runs Sundays from 7 AM to 7 PM!');
      return false;
    }
    resetDerbyIfNewDay(day);
    const lb = getLeaderboard();
    const rank = lb.findIndex((e) => e.id === 'player') + 1;
    const leader = lb[0];

    if (derbyClaimedDay === day) {
      toast(`Derby Prize claimed! Your score: ${derbyPoints} pts (#${rank}).`);
      return true;
    }

    if (derbyPoints > DERBY_RIVALS[0].points) {
      derbyClaimedDay = day;
      derbyWins += 1;
      const firstTrophy = !hasTrophy;
      hasTrophy = true;
      money?.add?.(45, { category: 'Town Event', label: 'Fishing Derby 1st Place' });
      friendship?.add?.('sam', 12, 'Sam');
      friendship?.add?.('walt', 12, 'Walt');
      sfx?.play?.('pickup');
      toast(
        firstTrophy
          ? `1st Place in the Fishing Derby (${derbyPoints} pts)! Won $45 + Golden Trout Trophy for your house!`
          : `1st Place in the Fishing Derby (${derbyPoints} pts)! Won $45!`
      );
      emit();
      save?.();
      return true;
    }

    if (derbyPoints >= DERBY_RIVALS[2].points) {
      derbyClaimedDay = day;
      money?.add?.(20, { category: 'Town Event', label: 'Fishing Derby Top 3' });
      friendship?.add?.('sam', 6, 'Sam');
      sfx?.play?.('pickup');
      toast(`Finished #${rank} in the Fishing Derby (${derbyPoints} pts)! Won $20! (Beat ${DERBY_RIVALS[0].points} pts for 1st & Trophy)`);
      emit();
      save?.();
      return true;
    }

    toast(`Fishing Derby: You ${derbyPoints} pts (#${rank}) · Leader: ${leader.name} (${leader.points} pts). Cast from the footbridge!`);
    sfx?.play?.('click');
    return true;
  }

  function syncWithClock() {
    const { day, info, hour } = currentTime();
    if (lastNotifiedDay !== day && hour >= 7) {
      const ev = eventForDay(day);
      if (ev) {
        lastNotifiedDay = day;
        toast(`${ev.icon} Today: ${ev.name} at ${ev.location} (${ev.hours})!`);
      }
    }
    return { day, weekday: info.weekday, marketOpen: isMarketOpen(), derbyOpen: isDerbyOpen() };
  }

  function getStatus() {
    const { day } = currentTime();
    const todayEvent = eventForDay(day);
    return {
      day,
      todayEvent,
      marketOpen: isMarketOpen(),
      derbyOpen: isDerbyOpen(),
      offers: currentMarketOffers(),
      derbyPoints: derbyDay === day ? derbyPoints : 0,
      derbyCatches: derbyDay === day ? derbyCatches : 0,
      derbyClaimed: derbyClaimedDay === day,
      leaderboard: getLeaderboard(),
      hasTrophy,
      derbyWins
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
      hasTrophy,
      derbyWins,
      derbyDay,
      derbyPoints,
      derbyCatches,
      derbyClaimedDay,
      lastNotifiedDay
    };
  }

  function apply(data) {
    const e = data?.townEvents;
    if (!e || typeof e !== 'object') return;
    hasTrophy = !!e.hasTrophy;
    derbyWins = Math.max(0, Number(e.derbyWins) | 0);
    derbyDay = Math.max(0, Number(e.derbyDay) | 0);
    derbyPoints = Math.max(0, Number(e.derbyPoints) | 0);
    derbyCatches = Math.max(0, Number(e.derbyCatches) | 0);
    derbyClaimedDay = Math.max(0, Number(e.derbyClaimedDay) | 0);
    if (Number.isFinite(Number(e.lastNotifiedDay))) lastNotifiedDay = Number(e.lastNotifiedDay) | 0;
    emit();
  }

  return {
    isMarketOpen,
    isDerbyOpen,
    currentMarketOffers,
    buyMarketOffer,
    sellAtMarket,
    recordDerbyCatch,
    getLeaderboard,
    interactDerbyStand,
    syncWithClock,
    getStatus,
    hasTrophy: () => hasTrophy,
    onChange: subscribe,
    serialize,
    apply
  };
}
