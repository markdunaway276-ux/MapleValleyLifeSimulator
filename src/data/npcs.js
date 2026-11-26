/**
 * NPC registry. Each neighbour is one entry: appearance, a sidewalk
 * patrol, and an optional jobId so later NPC-given work (jobs.js) can
 * plug in without rewriting the interact path.
 */

import { NORTH_FRONTAGE_OFFSET, STREET } from '../world/street.js';

export const NPC_RADIUS = 0.32;
export const NPC_NOTICE_RANGE = 3.2;
export const NPC_TALK_RANGE = 3;

/**
 * South sidewalk, toward the street so the loop stays clear of the
 * mailbox, vending machine and the parked car on the north side.
 */
export const SAM_PATROL = {
  z: -3.5,
  x0: -5.5,
  x1: 5.5,
  startX: 0.8,
  speed: 0.8,
  idle: 2.5
};

/**
 * North sidewalk, across the street from your house and west of the parked car.
 */
export const JUNE_PATROL = {
  z: STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth / 2,
  x0: -7,
  x1: 3.5,
  startX: -3,
  speed: 0.7,
  idle: 3.5
};

/**
 * `look` is the animated character (characterModel.js): body, hair file
 * (hair-<name>.glb), hair colour and the painted-on outfit. `appearance`
 * still colours the box placeholder shown while the model loads.
 */
export const NPC_DEFS = [
  {
    id: 'sam',
    name: 'Sam',
    role: 'neighbour',
    jobId: null,
    dialogueId: 'sam',
    appearance: { skin: 'tan', shirt: 'forest', pants: 'denim' },
    look: {
      body: 'male',
      hair: 'simpleparted',
      hairColor: 0x4a2f1c,
      outfit: { shirt: 0x3f5a44, pants: 0x3c4c68, shoes: 0x2a211a }
    },
    radius: NPC_RADIUS,
    noticeRange: NPC_NOTICE_RANGE,
    talkRange: NPC_TALK_RANGE,
    patrol: SAM_PATROL,
    routine: {
      walks: [[7, 11], [16, 19]],
      outdoorHours: [7, 20],
      restX: SAM_PATROL.x0,
      home: { x: -13, z: -5.5 },
      sidewalk: 'south sidewalk',
      homeLabel: 'southwest house porch'
    }
  },
  {
    id: 'june',
    name: 'June',
    role: 'neighbour',
    jobId: null,
    dialogueId: 'june',
    appearance: { skin: 'light', shirt: 'navy', pants: 'charcoal' },
    look: {
      body: 'female',
      hair: 'long',
      hairColor: 0x6e4a2a,
      outfit: { shirt: 0x46627a, pants: 0x3a3a40, shoes: 0x2b2420, longSleeve: true }
    },
    radius: NPC_RADIUS,
    noticeRange: NPC_NOTICE_RANGE,
    talkRange: NPC_TALK_RANGE,
    patrol: JUNE_PATROL,
    routine: {
      walks: [[9, 13], [17, 21]],
      outdoorHours: [8, 21],
      restX: JUNE_PATROL.x1,
      home: { x: -13, z: 2.08 + NORTH_FRONTAGE_OFFSET },
      sidewalk: 'north sidewalk',
      homeLabel: 'northwest house entrance'
    }
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
