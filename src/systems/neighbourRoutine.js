/** Outdoor routines in local game time. Rain sends neighbours to their home entrance. */
export function routineAt(def, minutes, raining) {
  if (!def.routine || !Number.isFinite(minutes)) return 'walk';
  const hour = minutes / 60;
  const { walks, outdoorHours } = def.routine;
  if (raining || hour < outdoorHours[0] || hour >= outdoorHours[1]) return 'home';
  return walks.some(([start, end]) => hour >= start && hour < end) ? 'walk' : 'rest';
}

/** Stay on the sidewalk until lined up with the house, then turn towards the entrance. */
export function routineStop(def, routine, { x, z }) {
  const { patrol, routine: schedule } = def;
  if (!schedule) return null;
  const { home, restX } = schedule;
  if (routine === 'home') {
    return Math.abs(x - home.x) > 0.04
      ? { x: home.x, z: patrol.z }
      : home;
  }
  if (Math.abs(z - patrol.z) > 0.04) return { x: home.x, z: patrol.z };
  if (routine === 'rest') return { x: restX, z: patrol.z };
  // Rejoin the usual route before starting a patrol.
  if (x < patrol.x0 - 0.025 || x > patrol.x1 + 0.025) {
    return { x: Math.max(patrol.x0, Math.min(patrol.x1, x)), z: patrol.z };
  }
  return null;
}
