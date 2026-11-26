/**
 * NPC registry. Each neighbour is one entry: appearance, a sidewalk
 * patrol, and an optional jobId so later NPC-given work (jobs.js) can
 * plug in without rewriting the interact path.
 */

export const NPC_RADIUS = 0.32;
export const NPC_NOTICE_RANGE = 3.2;
export const NPC_TALK_RANGE = 3;

/**
 * South sidewalk, toward the street so the loop stays clear of the
 * mailbox (2, -4.4), the vending machine (-2, -4.29) and the parked car
 * on the north side. Sidewalk covers z ≈ -3.15..-4.65; this line is z=-3.5.
 */
export const SAM_PATROL = {
  z: -3.5,
  x0: -5.5,
  x1: 5.5,
  startX: 0.8,
  speed: 0.8,
  idle: 2.5
};

export const NPC_DEFS = [
  {
    id: 'sam',
    name: 'Sam',
    role: 'neighbour',
    jobId: null,
    dialogueId: 'sam',
    appearance: { skin: 'tan', shirt: 'mustard', pants: 'denim' },
    radius: NPC_RADIUS,
    noticeRange: NPC_NOTICE_RANGE,
    talkRange: NPC_TALK_RANGE,
    patrol: SAM_PATROL
  }
];

export function getNpc(id, list = NPC_DEFS) {
  if (!id || !list) return null;
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) return list[i];
  }
  return null;
}

export function listNpcs(list = NPC_DEFS) {
  return (list || []).slice();
}
