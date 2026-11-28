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
    use: { action: 'eat', label: 'Eat', need: 'hunger', amount: 75, sfx: 'eat' }
  },
  'kyle-parcel': {
    id: 'kyle-parcel',
    name: 'Kyle’s Parcel',
    icon: '📦',
    description: 'Unclaimed registered parcel from PO Box #14 containing a Maple Lane Clinic stamp and cedar key tag.',
    color: '#9c7853',
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
