import { ITEM_DEFS } from '../data/items.js';
import {
  RECIPES,
  COOKED_MEAL_IDS,
  getRecipe,
  getRecipeByOutputItem,
  canCookRecipe,
  consumeRecipeIngredients,
  readInventoryItems,
  consumeInventorySlot
} from '../data/recipes.js';

/**
 * Home Cooking & Neighbour Meal Gifting system.
 *
 * Players cook real recipes at their kitchen stove using Market groceries,
 * backyard garden produce, and pond-caught fish. Cooked meals can be eaten
 * from the Bag for strong Hunger + Energy buffs or gifted to neighbours
 * during dialogue for a warm friendship boost.
 */
export function createCooking({
  clock = null,
  needs = null,
  inventory = null,
  skills = null,
  friendship = null,
  sfx = null,
  toast = () => {},
  save = () => {}
} = {}) {
  let mealsCooked = 0;
  let mealsGifted = 0;

  function applyMealBuffs(itemDef) {
    if (!needs || typeof needs.add !== 'function' || !itemDef || !itemDef.use) return;
    const effects = itemDef.use.effects;
    if (effects && typeof effects === 'object') {
      for (const [needId, amount] of Object.entries(effects)) {
        needs.add(needId, amount);
      }
    } else if (itemDef.use.need) {
      needs.add(itemDef.use.need, itemDef.use.amount || 0);
    }
  }

  function cookRecipe(recipeId, { eatNow = false } = {}) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, reason: 'unknown-recipe' };
    if (!canCookRecipe(recipe, inventory)) {
      toast(`Missing ingredients for ${recipe.name}.`);
      sfx?.play?.('click');
      return { ok: false, reason: 'missing-ingredients' };
    }

    consumeRecipeIngredients(recipe, inventory);
    clock?.advance?.(recipe.cookMinutes);
    skills?.addXp?.('cooking', recipe.xp);
    mealsCooked += 1;

    const itemDef = ITEM_DEFS[recipe.outputItem];
    let eaten = !!eatNow;
    if (!eaten && inventory && typeof inventory.addItem === 'function') {
      const added = inventory.addItem(recipe.outputItem, 1);
      if (!added) eaten = true; // Bag full — enjoy it hot off the stove!
    }

    if (eaten) {
      applyMealBuffs(itemDef);
      toast(`Cooked & enjoyed ${recipe.name}! (${recipe.buffText})`);
    } else {
      toast(`Cooked ${recipe.name}! Eat from Bag or share with a neighbour.`);
    }

    sfx?.play?.('eat');
    save?.();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('maple-cooked', {
        detail: {
          recipeId: recipe.id,
          itemId: recipe.outputItem,
          minutes: recipe.cookMinutes,
          meal: true,
          eaten,
          xp: recipe.xp
        }
      }));
    }
    return { ok: true, recipe, eaten };
  }

  function findGiftableMeal() {
    const items = readInventoryItems(inventory);
    // Prefer higher-tier home-cooked meals first (best gift bonus).
    let best = null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || !COOKED_MEAL_IDS.includes(it.id)) continue;
      const recipe = getRecipeByOutputItem(it.id);
      const bonus = (recipe && recipe.giftBonus) || 12;
      if (!best || bonus > best.bonus) {
        best = { index: i, item: it, recipe, bonus };
      }
    }
    return best;
  }

  function giftMealTo(npcId, displayName = null) {
    const found = findGiftableMeal();
    if (!found) return null;
    consumeInventorySlot(inventory, found.index, 1);
    mealsGifted += 1;
    const label = displayName || (npcId ? npcId.charAt(0).toUpperCase() + npcId.slice(1) : 'Neighbour');
    friendship?.add?.(npcId, found.bonus, label);
    sfx?.play?.('pickup');
    toast(`Shared ${found.item.name} with ${label}! (+${found.bonus} Friendship)`);
    save?.();
    return { item: found.item, bonus: found.bonus };
  }

  function pageFor(npcId, displayName = null) {
    if (!npcId) return null;
    const found = findGiftableMeal();
    if (!found) return null;
    const mealName = found.item.name || 'Home Meal';
    return {
      lines: [
        `Something smells amazing! Did you make ${mealName} yourself?`
      ],
      action: {
        label: `Share ${mealName} (+${found.bonus} Friendship)`,
        run: () => !!giftMealTo(npcId, displayName)
      },
      response: [
        `Oh, that's homemade! Thank you so much — this is the best meal I've had all week!`
      ]
    };
  }

  function serialize() {
    return { mealsCooked, mealsGifted };
  }

  function apply(data) {
    const c = data?.cooking;
    if (!c || typeof c !== 'object') return;
    mealsCooked = Math.max(0, Number(c.mealsCooked) | 0);
    mealsGifted = Math.max(0, Number(c.mealsGifted) | 0);
  }

  return {
    recipes: RECIPES,
    cookRecipe,
    canCook: (recipeId) => canCookRecipe(getRecipe(recipeId), inventory),
    findGiftableMeal,
    giftMealTo,
    pageFor,
    getStats: () => ({ mealsCooked, mealsGifted }),
    serialize,
    apply
  };
}
