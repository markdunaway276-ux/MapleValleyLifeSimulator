/**
 * Player appearance state. Choices are stored in the merged save under
 * `appearance` (skin, shirt, pants today; later slots such as hair or
 * hats drop in through APPEARANCE_SLOTS).
 */

import {
  APPEARANCE_SLOTS,
  getOption,
  normalizeAppearance
} from '../data/appearance.js';

function sameState(a, b, slots) {
  const list = slots || APPEARANCE_SLOTS;
  for (let i = 0; i < list.length; i++) {
    const id = list[i] && list[i].id;
    if (id && a[id] !== b[id]) return false;
  }
  return true;
}

export function createAppearance({ appearance, slots = APPEARANCE_SLOTS } = {}) {
  const list = slots || APPEARANCE_SLOTS;
  let state = normalizeAppearance(appearance, list);
  const listeners = [];

  function emit() {
    const value = get();
    for (let i = 0; i < listeners.length; i++) listeners[i](value);
    return value;
  }

  function get() {
    return { ...state };
  }

  function set(slotId, optionId) {
    if (slotId && typeof slotId === 'object' && optionId == null) {
      return setAll(slotId);
    }
    if (!getOption(slotId, optionId, list)) return get();
    if (state[slotId] === optionId) return get();
    state = { ...state, [slotId]: optionId };
    return emit();
  }

  function setAll(data) {
    const next = normalizeAppearance({ ...state, ...(data || {}) }, list);
    if (sameState(state, next, list)) return get();
    state = next;
    return emit();
  }

  function reset() {
    const next = normalizeAppearance({}, list);
    if (sameState(state, next, list)) return get();
    state = next;
    return emit();
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => off(fn);
  }

  function off(fn) {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  }

  function serialize() {
    return get();
  }

  function apply(data) {
    const src = data && data.appearance != null ? data.appearance : data;
    const next = normalizeAppearance(src == null ? state : src, list);
    if (sameState(state, next, list)) return get();
    state = next;
    return emit();
  }

  return {
    get,
    set,
    setAll,
    reset,
    onChange,
    on: (name, fn) => (name === 'change' ? onChange(fn) : () => {}),
    off,
    serialize,
    apply
  };
}
