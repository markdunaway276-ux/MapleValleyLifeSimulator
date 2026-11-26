/**
 * Lifetime stats for the pause menu's Stats page, saved with the game:
 * money earned (every rise in cash), distance walked and the neighbours you
 * have talked to. Days come from the clock and levels from skills.
 */

export function createStats({ money = null, dialogue = null } = {}) {
  const state = { moneyEarned: 0, walked: 0, met: [] };
  let lastCash = money && typeof money.get === 'function' ? money.get() : null;

  if (money && typeof money.onChange === 'function') {
    money.onChange((value) => {
      const v = Number(value);
      if (lastCash != null && Number.isFinite(v) && v > lastCash) state.moneyEarned += v - lastCash;
      lastCash = Number.isFinite(v) ? v : lastCash;
    });
  }

  function meet(id) {
    if (id && !state.met.includes(id)) state.met.push(id);
  }

  // Talking to someone counts as meeting them.
  if (dialogue && typeof dialogue.isOpen === 'function') {
    setInterval(() => { if (dialogue.isOpen()) meet(dialogue.currentNpc && dialogue.currentNpc()); }, 400);
  }

  function addWalk(metres) {
    const m = Number(metres);
    if (Number.isFinite(m) && m > 0 && m < 50) state.walked += m;
  }

  function serialize() {
    return { moneyEarned: Math.round(state.moneyEarned * 100) / 100, walked: Math.round(state.walked), met: state.met.slice() };
  }

  function apply(data) {
    const src = data && data.stats ? data.stats : data;
    if (!src || typeof src !== 'object') return serialize();
    if (Number.isFinite(Number(src.moneyEarned))) state.moneyEarned = Math.max(0, Number(src.moneyEarned));
    if (Number.isFinite(Number(src.walked))) state.walked = Math.max(0, Number(src.walked));
    if (Array.isArray(src.met)) state.met = src.met.filter((x) => typeof x === 'string');
    if (money && typeof money.get === 'function') lastCash = money.get();
    return serialize();
  }

  return { addWalk, meet, serialize, apply, get: serialize };
}
