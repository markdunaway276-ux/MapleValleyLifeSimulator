import { HUNGER_SNACK } from '../systems/needs.js';

/**
 * Item definitions and starter loadout for the inventory.
 * Inventory slots store instances: a def plus a count (and later, unique state).
 */
export const ITEM_DEFS = {
  cash: {
    id: 'cash',
    name: 'Cash',
    icon: '💵',
    description: 'Spending money. Your balance is shown on the HUD.',
    color: '#3d8b5f',
    stackable: true
  },
  phone: {
    id: 'phone',
    name: 'Phone',
    icon: '📱',
    description: 'Your cell phone. Keep it handy for calls and messages.',
    color: '#4a5568',
    stackable: false,
    use: { action: 'open', label: 'Open', consume: false }
  },
  keys: {
    id: 'keys',
    name: 'Keys',
    icon: '🔑',
    description: 'House keys for your front door',
    color: '#c9a227',
    stackable: false
  },
  snack: {
    id: 'snack',
    name: 'Snack',
    icon: '🍫',
    description: 'A couple of packed snacks for the road.',
    color: '#c47a3a',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: HUNGER_SNACK, sfx: 'eat' }
  },
  detergent: {
    id: 'detergent',
    name: 'Detergent',
    icon: '🧴',
    description: 'One load of laundry detergent. Use it at a washer in the laundromat.',
    color: '#3f7fb8',
    stackable: true
  },
  softener: {
    id: 'softener',
    name: 'Fabric Softener',
    icon: '🌸',
    description: 'Lavender-scented fabric softener. Automatically used in a dryer for an extra cozy refresh.',
    color: '#a6a0c7',
    stackable: true
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    icon: '🍎',
    description: 'A fresh apple from the corner shop.',
    color: '#9f4037',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 20, sfx: 'eat' }
  },
  sandwich: {
    id: 'sandwich',
    name: 'Sandwich',
    icon: '🥪',
    description: 'A wrapped sandwich from the corner shop.',
    color: '#ae8652',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 55, sfx: 'eat' }
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee',
    icon: '☕',
    description: 'A hot cup of coffee from the gas station. Gives you a little energy.',
    color: '#6b4a32',
    stackable: true,
    use: { action: 'eat', label: 'Drink', need: 'energy', amount: 20, sfx: 'eat' }
  },
  slushie: {
    id: 'slushie',
    name: 'Slushie',
    icon: '🥤',
    description: 'An icy cherry slushie from the gas station.',
    color: '#b23a48',
    stackable: true,
    use: { action: 'eat', label: 'Drink', need: 'hunger', amount: 10, sfx: 'eat' }
  },
  'gas-can': {
    id: 'gas-can',
    name: 'Gas can',
    icon: '⛽',
    description: 'Eight litres of gas. Get in the car with an empty tank and it pours in by itself.',
    color: '#c0392b',
    stackable: true
  },
  letter: {
    id: 'letter',
    name: 'Letter',
    icon: '✉️',
    description: 'A letter from your mailbox.',
    color: '#e8e0c8',
    stackable: true
  },
  groceries: {
    id: 'groceries',
    name: 'Groceries',
    icon: '🥕',
    description: 'Fresh ingredients from Maple Lane Market. Cook at your kitchen stove for a hearty meal.',
    color: '#4f8f4b',
    stackable: true
  },
  'home-meal': {
    id: 'home-meal',
    name: 'Home Meal',
    icon: '🍲',
    description: 'A hot home-cooked meal straight off your stove. Restores lots of hunger.',
    color: '#c97b36',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 75, effects: { hunger: 75, energy: 10 }, sfx: 'eat' }
  },
  'morning-pancakes': {
    id: 'morning-pancakes',
    name: 'Morning Pancakes',
    icon: '🥞',
    description: 'Warm apple-cinnamon pancakes cooked on your stove. Great way to start the day.',
    color: '#d99a4e',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 70, effects: { hunger: 70, energy: 25 }, sfx: 'eat' }
  },
  'garden-salad': {
    id: 'garden-salad',
    name: 'Garden Salad',
    icon: '🥗',
    description: 'Crisp backyard tomatoes tossed with fresh garden herbs. Light and energizing.',
    color: '#5a9e52',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 55, effects: { hunger: 55, energy: 20 }, sfx: 'eat' }
  },
  'tomato-soup': {
    id: 'tomato-soup',
    name: 'Fresh Tomato Soup',
    icon: '🥣',
    description: 'Velvety homemade soup simmered from backyard tomatoes.',
    color: '#c84b31',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 65, effects: { hunger: 65, energy: 18 }, sfx: 'eat' }
  },
  'seared-trout': {
    id: 'seared-trout',
    name: 'Pan-Seared Trout',
    icon: '🍽️',
    description: 'Fresh valley fish pan-seared with backyard herbs. Huge hunger and energy boost — neighbours love it!',
    color: '#b86b42',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 90, effects: { hunger: 90, energy: 30 }, sfx: 'eat' }
  },
  'hearty-stew': {
    id: 'hearty-stew',
    name: 'Hearty Harvest Stew',
    icon: '🥘',
    description: 'Rich autumn stew made with market groceries and backyard pumpkin. Fills you right up.',
    color: '#b85c2b',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 100, effects: { hunger: 100, energy: 35 }, sfx: 'eat' }
  },
  'warm-cocoa': {
    id: 'warm-cocoa',
    name: 'Warm Cocoa',
    icon: '🍫',
    description: 'Cozy homemade hot cocoa. Great pick-me-up on chilly Maple Lane mornings.',
    color: '#6b4226',
    stackable: true,
    use: { action: 'eat', label: 'Drink', need: 'energy', amount: 40, effects: { hunger: 25, energy: 40 }, sfx: 'eat' }
  },
  'tomato-seeds': {
    id: 'tomato-seeds',
    name: 'Tomato Seeds',
    icon: '🌱',
    description: 'Plant in a backyard garden bed and water to grow Garden Tomatoes (1 day).',
    color: '#b94134',
    stackable: true
  },
  'herb-seeds': {
    id: 'herb-seeds',
    name: 'Herb Seeds',
    icon: '🌱',
    description: 'Plant in a backyard garden bed and water to grow Fresh Herbs (1 day).',
    color: '#4c8b4f',
    stackable: true
  },
  'pumpkin-seeds': {
    id: 'pumpkin-seeds',
    name: 'Pumpkin Seeds',
    icon: '🌱',
    description: 'Plant in a backyard garden bed and water to grow an Autumn Pumpkin (2 days).',
    color: '#c97324',
    stackable: true
  },
  tomato: {
    id: 'tomato',
    name: 'Garden Tomato',
    icon: '🍅',
    description: 'Sun-ripened tomato from your backyard garden. Eat fresh, cook at home, or sell to Vince ($10).',
    color: '#c93c2e',
    stackable: true,
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 18, sfx: 'eat' }
  },
  herbs: {
    id: 'herbs',
    name: 'Fresh Herbs',
    icon: '🌿',
    description: 'Fragrant basil & thyme from your backyard garden. Cook with fish or tomatoes, or sell to Vince ($8).',
    color: '#4a8c4e',
    stackable: true,
    use: { action: 'eat', label: 'Snack', need: 'hunger', amount: 8, sfx: 'eat' }
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Autumn Pumpkin',
    icon: '🎃',
    description: 'A hefty backyard-grown pumpkin. Cook into Hearty Harvest Stew or sell to Vince ($18).',
    color: '#d47422',
    stackable: true
  },
  'kyle-parcel': {
    id: 'kyle-parcel',
    name: 'Kyle’s Parcel',
    icon: '📦',
    description: 'Unclaimed registered parcel from PO Box #14 containing a Maple Lane Clinic stamp and cedar key tag.',
    color: '#9c7853',
    stackable: false
  },
  bluegill: {
    id: 'bluegill',
    name: 'Pond Bluegill',
    icon: '🐟',
    description: 'A fresh bluegill caught in Maple Lane Pond. Vince at the Market buys fresh fish.',
    color: '#4e8ca8',
    stackable: true
  },
  trout: {
    id: 'trout',
    name: 'Maple Trout',
    icon: '🐠',
    description: 'A speckled valley trout from Maple Lane Pond. Worth a good price at Vince’s Market.',
    color: '#c97b54',
    stackable: true
  },
  bass: {
    id: 'bass',
    name: 'Valley Bass',
    icon: '🐡',
    description: 'A hefty largemouth bass from the deep middle of Maple Lane Pond.',
    color: '#4f7a52',
    stackable: true
  },
  'old-locket': {
    id: 'old-locket',
    name: 'Tarnished Locket',
    icon: '📿',
    description: 'Engraved "K.M. — Route 9" on the back. Walt at the Trailer Park might know who it belongs to.',
    color: '#b89448',
    stackable: false
  },
  flashlight: {
    id: 'flashlight',
    name: 'Field Flashlight',
    icon: '🔦',
    description: 'Walt’s heavy-duty flashlight. Press F or click Toggle Light to illuminate Maple Lane at night.',
    color: '#d9a441',
    stackable: false,
    use: { action: 'flashlight', label: 'Toggle Light', consume: false }
  },
  'creek-capsule': {
    id: 'creek-capsule',
    name: 'East Creek Capsule',
    icon: '🧭',
    description: 'Brass-capped cylinder found by Maple Lane Pond at night, containing a spring-headwaters map and a note for Vince.',
    color: '#8f6f3e',
    stackable: false
  }
};

/** Build a slot item from a definition id, with optional overrides (e.g. count). */
export function createItem(id, extras = {}) {
  const def = ITEM_DEFS[id];
  if (!def) return null;
  return { ...def, count: 1, ...extras, id: def.id };
}

export const STARTER_ITEMS = [
  createItem('phone'),
  createItem('keys'),
  createItem('snack', { count: 2 })
];

/** Format a count for display. Cash is shown as a dollar amount. */
export function formatItemCount(item) {
  if (!item || item.count == null) return '';
  if (item.id === 'cash') return '$' + item.count;
  return String(item.count);
}
