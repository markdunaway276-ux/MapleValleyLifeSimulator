import { ITEM_DEFS } from './items.js';

/**
 * Home Cooking recipe definitions for the player's kitchen stove.
 * Uses Market groceries, backyard garden produce, and pond-caught fish.
 */
export const RECIPES = Object.freeze([
  {
    id: 'home-meal',
    outputItem: 'home-meal',
    name: 'Home Meal',
    icon: '🍲',
    description: 'Classic hot stovetop dinner made from Market groceries.',
    ingredients: [
      { item: 'groceries', count: 1 }
    ],
    cookMinutes: 20,
    xp: 24,
    giftBonus: 12,
    buffText: '+75 Hunger · +10 Energy'
  },
  {
    id: 'morning-pancakes',
    outputItem: 'morning-pancakes',
    name: 'Morning Pancakes',
    icon: '🥞',
    description: 'Fluffy apple pancakes that keep your energy up all morning.',
    ingredients: [
      { item: 'groceries', count: 1 },
      { item: 'apple', count: 1 }
    ],
    cookMinutes: 15,
    xp: 28,
    giftBonus: 14,
    buffText: '+70 Hunger · +25 Energy'
  },
  {
    id: 'garden-salad',
    outputItem: 'garden-salad',
    name: 'Garden Salad',
    icon: '🥗',
    description: 'Crisp backyard tomatoes tossed with fresh garden herbs.',
    ingredients: [
      { item: 'tomato', count: 1 },
      { item: 'herbs', count: 1 }
    ],
    cookMinutes: 10,
    xp: 22,
    giftBonus: 12,
    buffText: '+55 Hunger · +20 Energy'
  },
  {
    id: 'tomato-soup',
    outputItem: 'tomato-soup',
    name: 'Fresh Tomato Soup',
    icon: '🥣',
    description: 'Warm, velvety soup simmered from ripe backyard tomatoes.',
    ingredients: [
      { item: 'tomato', count: 2 }
    ],
    cookMinutes: 20,
    xp: 26,
    giftBonus: 14,
    buffText: '+65 Hunger · +18 Energy'
  },
  {
    id: 'seared-trout',
    outputItem: 'seared-trout',
    name: 'Pan-Seared Trout',
    icon: '🍽️',
    description: 'Fresh valley fish pan-seared with backyard herbs. A Maple Lane favourite!',
    ingredients: [
      { anyOf: ['trout', 'bluegill', 'bass'], label: 'Fresh Fish', icon: '🐟', count: 1 },
      { item: 'herbs', count: 1 }
    ],
    cookMinutes: 25,
    xp: 36,
    giftBonus: 18,
    buffText: '+90 Hunger · +30 Energy'
  },
  {
    id: 'hearty-stew',
    outputItem: 'hearty-stew',
    name: 'Hearty Harvest Stew',
    icon: '🥘',
    description: 'Slow-simmered autumn stew with Market groceries and backyard pumpkin.',
    ingredients: [
      { item: 'groceries', count: 1 },
      { item: 'pumpkin', count: 1 }
    ],
    cookMinutes: 30,
    xp: 40,
    giftBonus: 20,
    buffText: '+100 Hunger · +35 Energy'
  },
  {
    id: 'warm-cocoa',
    outputItem: 'warm-cocoa',
    name: 'Warm Cocoa',
    icon: '🍫',
    description: 'Rich hot cocoa for a cozy energy boost anytime.',
    ingredients: [
      { item: 'coffee', count: 1 },
      { item: 'snack', count: 1 }
    ],
    cookMinutes: 10,
    xp: 18,
    giftBonus: 10,
    buffText: '+25 Hunger · +40 Energy'
  }
]);

export const COOKED_MEAL_IDS = Object.freeze(RECIPES.map((r) => r.outputItem));

export function getRecipe(id) {
  for (let i = 0; i < RECIPES.length; i++) {
    if (RECIPES[i].id === id) return RECIPES[i];
  }
  return null;
}

export function getRecipeByOutputItem(itemId) {
  for (let i = 0; i < RECIPES.length; i++) {
    if (RECIPES[i].outputItem === itemId) return RECIPES[i];
  }
  return null;
}

/** Read slots from the real inventory (getItems) or a test mock (getSlots). */
export function readInventoryItems(inventory) {
  if (!inventory) return [];
  if (typeof inventory.getItems === 'function') return inventory.getItems() || [];
  if (typeof inventory.getSlots === 'function') return inventory.getSlots() || [];
  return [];
}

/** Consume `count` from a slot on real inventory (consume) or a test mock (removeAt). */
export function consumeInventorySlot(inventory, index, count = 1) {
  if (!inventory) return null;
  if (typeof inventory.consume === 'function') return inventory.consume(index, count);
  if (typeof inventory.removeAt === 'function') return inventory.removeAt(index, count);
  return null;
}

/** Count how many of an ingredient requirement the player holds. */
export function countIngredient(inventory, req) {
  const items = readInventoryItems(inventory);
  const ids = Array.isArray(req.anyOf) ? req.anyOf : [req.item];
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it && ids.includes(it.id)) total += Math.max(1, Number(it.count) || 1);
  }
  return total;
}

export function ingredientLabel(req) {
  if (req.label) return req.label;
  const def = ITEM_DEFS[req.item];
  return (def && def.name) || req.item || 'Ingredient';
}

export function ingredientIcon(req) {
  if (req.icon) return req.icon;
  const def = ITEM_DEFS[req.item];
  return (def && def.icon) || '•';
}

export function canCookRecipe(recipe, inventory) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return false;
  for (let i = 0; i < recipe.ingredients.length; i++) {
    const req = recipe.ingredients[i];
    if (countIngredient(inventory, req) < (req.count || 1)) return false;
  }
  return true;
}

export function consumeRecipeIngredients(recipe, inventory) {
  if (!canCookRecipe(recipe, inventory)) return false;
  for (let r = 0; r < recipe.ingredients.length; r++) {
    const req = recipe.ingredients[r];
    const ids = Array.isArray(req.anyOf) ? req.anyOf : [req.item];
    let remaining = req.count || 1;
    // Prefer consuming from the end so earlier stacks stay stable.
    const items = readInventoryItems(inventory);
    for (let i = items.length - 1; i >= 0 && remaining > 0; i--) {
      const it = items[i];
      if (!it || !ids.includes(it.id)) continue;
      const have = Math.max(1, Number(it.count) || 1);
      const take = Math.min(have, remaining);
      consumeInventorySlot(inventory, i, take);
      remaining -= take;
    }
  }
  return true;
}
