/**
 * Data-driven shop / stock definitions. Later shops (a counter, more
 * machines, NPC traders) can be added here and looked up by id; the
 * vending interactable only needs a shop object with a stock list.
 */

export const VENDING_PRICE = 5;
export const NOT_ENOUGH_CASH = 'Not enough cash.';

export const SHOP_DEFS = [
  {
    id: 'vending',
    name: 'Vending machine',
    stock: [
      { item: 'snack', name: 'Snack', price: VENDING_PRICE, count: 1, sfx: 'vending' }
    ]
  },
  {
    id: 'laundromat-vending',
    name: 'Laundromat vending machine',
    stock: [
      { item: 'detergent', name: 'Detergent', price: 2, sfx: 'vending' },
      { item: 'snack', name: 'Snack', price: 5, sfx: 'vending' }
    ]
  },
  {
    id: 'gas-station',
    name: 'Maple Lane Fuel & Go',
    stock: [
      { item: 'coffee', name: 'Coffee', price: 3, sfx: 'cash' },
      { item: 'slushie', name: 'Slushie', price: 2, sfx: 'cash' },
      { item: 'snack', name: 'Snack', price: 4, sfx: 'cash' },
      { item: 'sandwich', name: 'Sandwich', price: 7, sfx: 'cash' },
      { item: 'gas-can', name: 'Gas can (8 L)', price: 12, sfx: 'cash' }
    ]
  },
  {
    id: 'corner-shop',
    name: 'Maple Lane Market',
    stock: [
      { item: 'groceries', name: 'Groceries', price: 8, sfx: 'cash' },
      { item: 'apple', name: 'Apple', price: 3, sfx: 'cash' },
      { item: 'snack', name: 'Snack', price: 5, sfx: 'cash' },
      { item: 'sandwich', name: 'Sandwich', price: 7, sfx: 'cash' },
      { item: 'tomato-seeds', name: 'Tomato Seeds', price: 4, sfx: 'cash' },
      { item: 'herb-seeds', name: 'Herb Seeds', price: 3, sfx: 'cash' },
      { item: 'pumpkin-seeds', name: 'Pumpkin Seeds', price: 6, sfx: 'cash' },
      { item: 'detergent', name: 'Detergent', price: 2, sfx: 'cash' }
    ]
  }
];

export const DEFAULT_SHOP_ID = 'vending';

export function getShop(id = DEFAULT_SHOP_ID) {
  const key = id || DEFAULT_SHOP_ID;
  for (let i = 0; i < SHOP_DEFS.length; i++) {
    if (SHOP_DEFS[i].id === key) return SHOP_DEFS[i];
  }
  return null;
}

export const DEFAULT_SHOP = getShop(DEFAULT_SHOP_ID);

/** First in-stock line, or null if the shop is empty. */
export function shopOffer(shop) {
  if (!shop || !Array.isArray(shop.stock)) return null;
  for (let i = 0; i < shop.stock.length; i++) {
    if (shop.stock[i]) return shop.stock[i];
  }
  return null;
}

/** "Press E to buy Snack ($5)" / "Tap to buy Snack ($5)". */
export function shopPrompt(shop, isMobile) {
  const offer = shopOffer(shop);
  const name = (offer && (offer.name || offer.item)) || 'item';
  const price = offer && offer.price != null ? offer.price : 0;
  const verb = `buy ${name} ($${price})`;
  return isMobile ? `Tap to ${verb}` : `Press E to ${verb}`;
}

export function shopToast(offer) {
  if (!offer) return '';
  const name = offer.name || offer.item || 'item';
  return `-$${offer.price} · ${name}`;
}
