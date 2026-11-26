/**
 * Purchase helper for shops and vending machines. Uses money.spend; on
 * success the item is added to the inventory, a toast is shown, and an
 * optional sfx cue plays. If the player cannot afford it, toasts
 * "Not enough cash." and changes nothing.
 */

import {
  DEFAULT_SHOP,
  getShop,
  NOT_ENOUGH_CASH,
  shopOffer,
  shopToast
} from '../data/shops.js';

export {
  DEFAULT_SHOP,
  getShop,
  NOT_ENOUGH_CASH,
  shopOffer,
  shopPrompt,
  shopToast,
  VENDING_PRICE
} from '../data/shops.js';

export function resolveShop(shopOrId) {
  if (!shopOrId) return DEFAULT_SHOP;
  if (typeof shopOrId === 'string') return getShop(shopOrId) || DEFAULT_SHOP;
  return shopOrId;
}

/**
 * Buy the given stock line (or the shop's first offer). Returns the
 * added inventory item on success, or false.
 */
export function buyFromShop(shopOrId, ctx = {}, offer = null) {
  const shop = resolveShop(shopOrId);
  const item = offer || shopOffer(shop);
  if (!item || !item.item) return false;
  const price = Number(item.price) || 0;
  const count = item.count != null ? item.count : 1;
  const money = ctx.money;
  const inventory = ctx.inventory;
  const toast = typeof ctx.toast === 'function' ? ctx.toast : null;

  if (!money || typeof money.spend !== 'function') return false;
  if (!money.spend(price)) {
    if (toast) toast(NOT_ENOUGH_CASH);
    return false;
  }
  if (!inventory || typeof inventory.addItem !== 'function') {
    money.add(price);
    return false;
  }
  const added = inventory.addItem(item.item, count);
  if (!added) {
    money.add(price);
    return false;
  }
  if (ctx.sfx && item.sfx && typeof ctx.sfx.play === 'function') ctx.sfx.play(item.sfx);
  if (toast) toast(shopToast(item));
  return added;
}
