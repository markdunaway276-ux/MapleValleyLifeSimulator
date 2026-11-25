/**
 * Item definitions and starter loadout for the inventory.
 * Inventory slots store instances: a def plus a count (and later, unique state).
 */
export const ITEM_DEFS = {
  cash: {
    id: 'cash',
    name: 'Cash',
    icon: '💵',
    description: 'Spending money for the shops around Maple Valley.',
    color: '#3d8b5f',
    stackable: true
  },
  phone: {
    id: 'phone',
    name: 'Phone',
    icon: '📱',
    description: 'Your cell phone. Keep it handy for calls and messages.',
    color: '#4a5568',
    stackable: false
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
    stackable: true
  }
};

/** Build a slot item from a definition id, with optional overrides (e.g. count). */
export function createItem(id, extras = {}) {
  const def = ITEM_DEFS[id];
  if (!def) return null;
  return { ...def, count: 1, ...extras, id: def.id };
}

export const STARTER_ITEMS = [
  createItem('cash', { count: 50 }),
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
