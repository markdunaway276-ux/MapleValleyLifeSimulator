const KEY = 'mapleValleyLife_save';

/**
 * Bump this whenever the save's shape changes, and add a matching step to
 * MIGRATIONS below that turns a save of the previous version into the new one.
 * Saves from before versioning count as version 0.
 */
export const SAVE_VERSION = 1;

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
  }
};

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
  const raw = ls.getItem(KEY);
  if (!raw) return {};
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Keep the unreadable save so it is not lost when the next autosave overwrites it.
    console.warn('Save could not be read; kept a copy under ' + KEY + '_corrupt', e);
    try { ls.setItem(KEY + '_corrupt', raw); } catch { /* storage full: nothing more to do */ }
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
      const backupKey = KEY + '_backup_v' + version;
      try {
        if (!ls.getItem(backupKey)) ls.setItem(backupKey, JSON.stringify(data));
        ls.setItem(KEY, JSON.stringify(result.data));
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
  try {
    const prev = loadSave();
    // Never stamp a lower version over a save written by a newer build.
    const next = { ...prev, ...(data || {}), version: Math.max(SAVE_VERSION, saveVersion(prev)) };
    localStorage.setItem(KEY, JSON.stringify(next));
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
    localStorage.removeItem(KEY);
    return true;
  } catch (e) {
    console.warn('Clear save failed', e);
    return false;
  }
}

export const SAVE_KEY = KEY;
