/**
 * Data-driven job definitions. Later jobs (a shop counter, NPC-given work)
 * can be added here and looked up by id; the work system and interactable
 * only need a job object.
 */

export const WORK_DURATION = 3; // real seconds for the "Working…" bar
export const WORK_GAME_MINUTES = 2 * 60; // 2 game hours
export const WORK_PAY = 20;
export const WORK_ENERGY = 20;
export const WORK_MIN_ENERGY = 15;
export const WORK_TIRED = 'Too tired to work.';

export const JOB_DEFS = [
  {
    id: 'desk',
    name: 'Home office',
    verb: 'work',
    duration: WORK_DURATION,
    gameMinutes: WORK_GAME_MINUTES,
    pay: WORK_PAY,
    energy: WORK_ENERGY,
    minEnergy: WORK_MIN_ENERGY,
    tiredMessage: WORK_TIRED,
    sfx: 'cash',
    action: 'typing'
  },
  {
    id: 'restock',
    name: 'Market restocking',
    verb: 'restock shelves',
    label: 'Restocking shelves…',
    action: 'restock',
    duration: 5,
    gameMinutes: 60,
    pay: 15,
    energy: 10,
    minEnergy: 10,
    tiredMessage: WORK_TIRED,
    sfx: 'cash'
  }
];

export const DEFAULT_JOB_ID = 'desk';

export function getJob(id = DEFAULT_JOB_ID) {
  const key = id || DEFAULT_JOB_ID;
  for (let i = 0; i < JOB_DEFS.length; i++) {
    if (JOB_DEFS[i].id === key) return JOB_DEFS[i];
  }
  return null;
}

export const DEFAULT_JOB = getJob(DEFAULT_JOB_ID);
