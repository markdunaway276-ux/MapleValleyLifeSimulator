import { widenSavedSidewalkZ, widenSavedStreetZ } from '../world/street.js';

const BASE_KEY = 'mapleValleyLife_save';

/**
 * Save slots. Slot 1 is the original key, so saves from before slots load as
 * slot 1. The active slot is remembered on the device; the game reads only the
 * active slot, and switching slots reloads the page (titleScreen.js) so every
 * system starts cleanly from the chosen save.
 */
export const SLOT_COUNT = 3;
export const ACTIVE_SLOT_KEY = 'mapleValleyLife_activeSlot';

export function keyForSlot(slot) {
  const n = Math.min(SLOT_COUNT, Math.max(1, Math.floor(Number(slot)) || 1));
  return n === 1 ? BASE_KEY : BASE_KEY + '_slot' + n;
}

export function getActiveSlot() {
  const ls = storage();
  const n = ls ? Number(ls.getItem(ACTIVE_SLOT_KEY)) : 1;
  return n >= 1 && n <= SLOT_COUNT ? Math.floor(n) : 1;
}

export function setActiveSlot(slot) {
  const ls = storage();
  const n = Math.min(SLOT_COUNT, Math.max(1, Math.floor(Number(slot)) || 1));
  try {
    if (!ls) return null;
    ls.setItem(ACTIVE_SLOT_KEY, String(n));
    return n;
  } catch {
    return null;
  }
}

/** The raw save in a slot (no migration), or null if it is empty / unreadable. */
export function readSlot(slot) {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(keyForSlot(slot));
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length ? data : null;
  } catch {
    return null;
  }
}

export function clearSlot(slot) {
  const ls = storage();
  try { if (!ls) return false; ls.removeItem(keyForSlot(slot)); return true; } catch { return false; }
}

// Set while the page is about to reload into another slot, so a late autosave
// cannot write this game into the newly chosen slot.
let frozen = false;
export function freezeSaves() { frozen = true; }

/** The active slot's storage key. */
let gameSlot;
export function getGameSlot() {
  gameSlot ??= getActiveSlot();
  return gameSlot;
}

function currentKey() { return keyForSlot(getGameSlot()); }

/**
 * Bump this whenever the save's shape changes, and add a matching step to
 * MIGRATIONS below that turns a save of the previous version into the new one.
 * Saves from before versioning count as version 0.
 */
export const SAVE_VERSION = 4;

/**
 * MIGRATIONS[n] upgrades a version n-1 save to version n. Each step gets a
 * copy of the save and returns the upgraded object. Steps run in order, so a
 * version 0 save passes through 1, 2, 3 ... until it reaches SAVE_VERSION.
 */
const MIGRATIONS = {
  // 0 -> 1: saves from before versioning. Very old saves kept money as a
  // "cash" item in the bag; move it to the money field.
  1(data) {
    if (Array.isArray(data.inventory)) {
      let cash = 0;
      const items = [];
      for (const it of data.inventory) {
        if (it && it.id === 'cash') cash += Number(it.count) || 0;
        else items.push(it);
      }
      data.inventory = items;
      if (data.money == null && cash > 0) data.money = cash;
    }
    return data;
  },
  2: (data) => widenSavedPositions(data, 4, 7),
  3: (data) => widenSavedPositions(data, 7, 14),
  4: (data) => remapSavedPositions(data, widenSavedSidewalkZ)
};

function widenSavedPositions(data, fromWidth, toWidth) {
  return remapSavedPositions(data, (z) => widenSavedStreetZ(z, fromWidth, toWidth));
}

function remapSavedPositions(data, remapZ) {
  for (const point of [data.position, data.car]) {
    if (point && Number.isFinite(point.z)) {
      point.z = remapZ(point.z);
    }
  }
  return data;
}

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readRaw() {
  const ls = storage();
  if (!ls) return {};
  const raw = ls.getItem(currentKey());
  if (!raw) return {};
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Keep the unreadable save so it is not lost when the next autosave overwrites it.
    console.warn('Save could not be read; kept a copy under ' + currentKey() + '_corrupt', e);
    try { ls.setItem(currentKey() + '_corrupt', raw); } catch { /* storage full: nothing more to do */ }
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data;
}

/** Version of a parsed save (0 for saves made before versioning). */
export function saveVersion(data) {
  return data && Number.isInteger(data.version) && data.version > 0 ? data.version : 0;
}

/**
 * Upgrade a parsed save to SAVE_VERSION. Returns { data, from, ok }.
 * On a failed step the original save is returned unchanged with ok: false.
 */
export function migrateSave(data) {
  const from = saveVersion(data);
  if (from >= SAVE_VERSION) return { data, from, ok: true };
  let next = JSON.parse(JSON.stringify(data));
  try {
    for (let v = from + 1; v <= SAVE_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (typeof step === 'function') next = step(next) || next;
      next.version = v;
    }
  } catch (e) {
    console.warn('Save upgrade from version ' + from + ' failed; loading it as it was', e);
    return { data, from, ok: false };
  }
  return { data: next, from, ok: true };
}

export function loadSave() {
  const ls = storage();
  try {
    const data = readRaw();
    if (!Object.keys(data).length) return {};
    const version = saveVersion(data);
    if (version > SAVE_VERSION) {
      console.warn('Save is from a newer version of the game (' + version + ' > ' + SAVE_VERSION + ')');
      return data;
    }
    if (version === SAVE_VERSION) return data;
    const result = migrateSave(data);
    if (result.ok && ls) {
      // Keep the pre-upgrade save once, then store the upgraded one so this runs only once.
      const backupKey = currentKey() + '_backup_v' + version;
      try {
        if (!ls.getItem(backupKey)) ls.setItem(backupKey, JSON.stringify(data));
        ls.setItem(currentKey(), JSON.stringify(result.data));
      } catch (e) {
        console.warn('Could not store the upgraded save', e);
      }
    }
    return result.data;
  } catch {
    return {};
  }
}

export function saveGame(data) {
  if (frozen) return null;
  try {
    const prev = loadSave();
    // Never stamp a lower version over a save written by a newer build.
    const next = { ...prev, ...(data || {}), version: Math.max(SAVE_VERSION, saveVersion(prev)) };
    localStorage.setItem(currentKey(), JSON.stringify(next));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('maple-saved', { detail: next }));
    }
    return next;
  } catch (e) {
    console.warn('Save failed', e);
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(currentKey());
    return true;
  } catch (e) {
    console.warn('Clear save failed', e);
    return false;
  }
}

/** Slot 1's key (the original single save). */
export const SAVE_KEY = BASE_KEY;
