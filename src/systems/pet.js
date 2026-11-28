import { readInventoryItems, consumeInventorySlot } from '../data/recipes.js';

/**
 * Adoptable Town Pet system ("Maple" the friendly ginger tabby cat).
 *
 * Players befriend Maple by offering treats (fish or snacks) or daily pets.
 * At Bond 3/3, Maple is adopted and moves into your house — press E / tap
 * anytime to have her follow you on walks or nap peacefully indoors!
 */

export const PET_NAME = 'Maple';
export const PET_ADOPT_BOND = 3;
export const PET_TREAT_IDS = Object.freeze(['bluegill', 'trout', 'bass', 'snack', 'home-meal', 'seared-trout']);

export function createPet({
  clock = null,
  inventory = null,
  needs = null,
  sfx = null,
  toast = () => {},
  save = () => {},
  onChange = null
} = {}) {
  let bond = 0;
  let adopted = false;
  let mode = 'wander'; // 'wander' | 'follow' | 'home'
  let lastPetDay = 0;
  let treatsGiven = 0;
  const listeners = [];
  if (typeof onChange === 'function') listeners.push(onChange);

  function currentDay() {
    const t = clock?.getTime?.();
    return Math.max(1, Number(t?.day) | 0 || 1);
  }

  function emit() {
    const snap = getState();
    for (let i = 0; i < listeners.length; i++) listeners[i](snap);
  }

  function findTreatSlot() {
    const items = readInventoryItems(inventory);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && PET_TREAT_IDS.includes(it.id)) return { index: i, item: it };
    }
    return null;
  }

  function getState() {
    return {
      name: PET_NAME,
      bond,
      adopted,
      mode,
      treatsGiven
    };
  }

  function getPrompt(isMobile = false) {
    const prefix = isMobile ? 'Tap to ' : 'Press E to ';
    if (!adopted) {
      const treat = findTreatSlot();
      if (treat) return `${prefix}give ${PET_NAME} a treat (${bond}/${PET_ADOPT_BOND})`;
      return `${prefix}pet ${PET_NAME} (${bond}/${PET_ADOPT_BOND})`;
    }
    return mode === 'follow'
      ? `${prefix}let ${PET_NAME} nap at home`
      : `${prefix}have ${PET_NAME} follow you`;
  }

  function interact() {
    const day = currentDay();

    if (!adopted) {
      const treat = findTreatSlot();
      if (treat) {
        consumeInventorySlot(inventory, treat.index, 1);
        treatsGiven += 1;
        bond = Math.min(PET_ADOPT_BOND, bond + 1);
        needs?.add?.('mood', 10);
        sfx?.play?.('pickup');
        if (bond >= PET_ADOPT_BOND) {
          adopted = true;
          mode = 'follow';
          toast(`${PET_NAME} adopted you! She'll follow you on walks or nap at home whenever you ask.`);
        } else {
          toast(`${PET_NAME} happily munched your ${treat.item.name}! (Bond ${bond}/${PET_ADOPT_BOND})`);
        }
        emit();
        save?.();
        return true;
      }

      if (lastPetDay !== day) {
        lastPetDay = day;
        bond = Math.min(PET_ADOPT_BOND, bond + 1);
        needs?.add?.('mood', 8);
        sfx?.play?.('pickup');
        if (bond >= PET_ADOPT_BOND) {
          adopted = true;
          mode = 'follow';
          toast(`${PET_NAME} loves you and moved in! Press E anytime to toggle Follow / Nap at home.`);
        } else {
          toast(`${PET_NAME} purred softly! (Bond ${bond}/${PET_ADOPT_BOND} · Bring a fish or snack to bond faster)`);
        }
        emit();
        save?.();
        return true;
      }

      toast(`${PET_NAME} purrs! Bring a fresh fish or snack to bond faster (${bond}/${PET_ADOPT_BOND}).`);
      sfx?.play?.('click');
      return true;
    }

    // Adopted: toggle between Follow and Nap at Home, plus a cozy daily pet boost!
    mode = mode === 'follow' ? 'home' : 'follow';
    if (lastPetDay !== day) {
      lastPetDay = day;
      needs?.add?.('energy', 6);
      needs?.add?.('mood', 12);
    }
    sfx?.play?.('pickup');
    toast(
      mode === 'follow'
        ? `${PET_NAME} perks up and trots along beside you!`
        : `${PET_NAME} heads inside to curl up and nap at home.`
    );
    emit();
    save?.();
    return true;
  }

  function setMode(nextMode) {
    if (!adopted) return false;
    if (nextMode !== 'follow' && nextMode !== 'home') return false;
    mode = nextMode;
    emit();
    save?.();
    return true;
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
    return { bond, adopted, mode, lastPetDay, treatsGiven };
  }

  function apply(data) {
    const p = data?.pet;
    if (!p || typeof p !== 'object') return;
    bond = Math.max(0, Math.min(PET_ADOPT_BOND, Number(p.bond) | 0));
    adopted = !!p.adopted || bond >= PET_ADOPT_BOND;
    mode = adopted ? (p.mode === 'home' ? 'home' : 'follow') : 'wander';
    lastPetDay = Math.max(0, Number(p.lastPetDay) | 0);
    treatsGiven = Math.max(0, Number(p.treatsGiven) | 0);
    emit();
  }

  return {
    getState,
    getPrompt,
    interact,
    setMode,
    onChange: subscribe,
    serialize,
    apply
  };
}
