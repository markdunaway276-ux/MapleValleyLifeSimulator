const KEY = 'mapleValleyLife_save';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save failed', e);
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
