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
    const prev = loadSave();
    const next = { ...prev, ...(data || {}) };
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
