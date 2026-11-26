/**
 * Data-driven appearance options for the player. Each slot is a list of
 * { id, name, color } choices so later features (hair, hats) can add a
 * slot without rewriting the Style app or the save format.
 */

export const APPEARANCE_SLOTS = [
  {
    id: 'skin',
    name: 'Skin',
    options: [
      { id: 'porcelain', name: 'Porcelain', color: '#f3d6c4' },
      { id: 'light', name: 'Light', color: '#e0b896' },
      { id: 'olive', name: 'Olive', color: '#c4a070' },
      { id: 'tan', name: 'Tan', color: '#c48a5c' },
      { id: 'medium', name: 'Medium', color: '#a06b42' },
      { id: 'brown', name: 'Brown', color: '#7a4a2a' },
      { id: 'deep', name: 'Deep', color: '#4a2c1a' },
      { id: 'deepWarm', name: 'Deep warm', color: '#3a2218' }
    ]
  },
  {
    id: 'shirt',
    name: 'Shirt',
    options: [
      { id: 'white', name: 'White', color: '#f2f2f0' },
      { id: 'sky', name: 'Sky', color: '#4a90d9' },
      { id: 'forest', name: 'Forest', color: '#2f6b3a' },
      { id: 'red', name: 'Red', color: '#c43b3b' },
      { id: 'mustard', name: 'Mustard', color: '#d4a017' },
      { id: 'navy', name: 'Navy', color: '#1e3358' },
      { id: 'pink', name: 'Pink', color: '#e08aaa' },
      { id: 'charcoal', name: 'Charcoal', color: '#3a3a40' }
    ]
  },
  {
    id: 'pants',
    name: 'Pants',
    options: [
      { id: 'navy', name: 'Navy', color: '#24324d' },
      { id: 'khaki', name: 'Khaki', color: '#c4b07a' },
      { id: 'black', name: 'Black', color: '#222226' },
      { id: 'denim', name: 'Denim', color: '#3c5a7a' },
      { id: 'olive', name: 'Olive', color: '#5a6b3a' },
      { id: 'brown', name: 'Brown', color: '#5c3d2e' },
      { id: 'gray', name: 'Gray', color: '#6b6e75' },
      { id: 'cream', name: 'Cream', color: '#d8d0be' }
    ]
  }
];

export const DEFAULT_APPEARANCE = {
  skin: 'light',
  shirt: 'sky',
  pants: 'navy'
};

export function getSlot(id, slots = APPEARANCE_SLOTS) {
  if (!id || !slots) return null;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i].id === id) return slots[i];
  }
  return null;
}

export function getOption(slotId, optionId, slots = APPEARANCE_SLOTS) {
  const slot = getSlot(slotId, slots);
  if (!slot || !slot.options) return null;
  for (let i = 0; i < slot.options.length; i++) {
    if (slot.options[i] && slot.options[i].id === optionId) return slot.options[i];
  }
  return null;
}

export function defaultOptionId(slot) {
  if (!slot || !slot.options || !slot.options.length) return null;
  const preferred = DEFAULT_APPEARANCE[slot.id];
  if (preferred && getOption(slot.id, preferred, [slot])) return preferred;
  return slot.options[0].id;
}

export function getOptionColor(slotId, optionId, slots = APPEARANCE_SLOTS) {
  const option = getOption(slotId, optionId, slots);
  if (option && option.color) return option.color;
  const slot = getSlot(slotId, slots);
  const fallback = slot ? getOption(slot.id, defaultOptionId(slot), [slot]) : null;
  return (fallback && fallback.color) || '#888888';
}

/** Return a complete { slotId: optionId } map, falling back to defaults. */
export function normalizeAppearance(data, slots = APPEARANCE_SLOTS) {
  const src = (data && data.appearance && typeof data.appearance === 'object')
    ? data.appearance
    : (data || {});
  const list = slots || APPEARANCE_SLOTS;
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const slot = list[i];
    if (!slot || !slot.id) continue;
    const raw = src[slot.id];
    out[slot.id] = getOption(slot.id, raw, list) ? raw : defaultOptionId(slot);
  }
  return out;
}
