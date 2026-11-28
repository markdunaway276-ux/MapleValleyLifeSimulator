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
  startX: -4.8,
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
    tagline: 'Next-Door Neighbor',
    jobId: null,
    dialogueId: 'sam',
    appearance: { skin: 'tan', shirt: 'forest', pants: 'denim' },
    look: {
      body: 'sam',
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
    tagline: 'Across the Street',
    jobId: null,
    dialogueId: 'june',
    appearance: { skin: 'light', shirt: 'navy', pants: 'charcoal' },
    look: {
      body: 'june',
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
  },
  {
    // Runs Maple Lane Laundromat. Stands behind the counter window in the
    // back room (laundromat door is at x 29.5, z -6.3; see world/laundromat.js).
    id: 'dottie',
    name: 'Dottie',
    role: 'laundromat',
    tagline: 'Maple Lane Laundromat',
    jobId: null,
    dialogueId: 'dottie',
    appearance: { skin: 'tan', shirt: 'forest', pants: 'gray' },
    look: {
      body: 'dottie',
      hair: 'buns',
      hairColor: 0xa29d96,
      outfit: { shirt: 0x2f7d78, pants: 0x3a3f4a, shoes: 0x2b2420 }
    },
    radius: NPC_RADIUS,
    noticeRange: 2.6,
    talkRange: NPC_TALK_RANGE,
    patrol: { z: -8.3, x0: 27.35, x1: 27.35, startX: 27.35, speed: 0 },
    stationary: { yaw: -Math.PI / 2 },
    locationHint: 'Behind the laundromat counter, east end of Maple Lane.'
  },
  {
    // Works the Fuel & Go register. Stands behind the counter, facing the
    // customer side (store front wall at z 31.2; see world/gasStation.js).
    id: 'danny',
    name: 'Danny',
    role: 'gas-station',
    tagline: 'Fuel & Go Clerk',
    jobId: null,
    dialogueId: 'danny',
    appearance: { skin: 'tan', shirt: 'denim', pants: 'denim' },
    look: { body: 'clerk' },
    radius: NPC_RADIUS,
    noticeRange: 2.6,
    talkRange: NPC_TALK_RANGE,
    patrol: { z: 34.5, x0: -4.15, x1: -4.15, startX: -4.15, speed: 0 },
    stationary: { yaw: -Math.PI / 2 },
    locationHint: 'Behind the Fuel & Go counter, across from your house.'
  },
  {
    // Runs Maple Lane Market. Stands between the two checkout lanes near the entrance.
    id: 'vince',
    name: 'Vince',
    role: 'market',
    tagline: 'Maple Lane Market',
    jobId: null,
    dialogueId: 'vince',
    appearance: { skin: 'tan', shirt: 'charcoal', pants: 'denim' },
    look: {
      body: 'clerk',
      suitTint: 0x6f9478,
      hairTint: 0x3b2c22
    },
    radius: NPC_RADIUS,
    noticeRange: 2.8,
    talkRange: NPC_TALK_RANGE,
    patrol: { z: 2.8 + NORTH_FRONTAGE_OFFSET + 2.15, x0: 39.8, x1: 39.8, startX: 39.8, speed: 0 },
    stationary: { yaw: Math.PI / 2 },
    locationHint: 'By the checkout lanes inside Maple Lane Market.'
  },
  {
    // Resident of Trailer #2 at the west end of Maple Lane. Knows every rumor in town.
    id: 'walt',
    name: 'Walt',
    role: 'neighbour',
    tagline: 'Trailer Park Local',
    jobId: null,
    dialogueId: 'walt',
    appearance: { skin: 'tan', shirt: 'gray', pants: 'charcoal' },
    look: { body: 'surviver' },
    radius: NPC_RADIUS,
    noticeRange: NPC_NOTICE_RANGE,
    talkRange: NPC_TALK_RANGE,
    patrol: {
      z: -3.5,
      x0: -41.5,
      x1: -25.5,
      startX: -33.5,
      speed: 0.65,
      idle: 4.0
    },
    routine: {
      walks: [[8, 12], [15, 22]],
      outdoorHours: [7, 23],
      restX: -34.5,
      home: { x: -37.5, z: -6.5 },
      sidewalk: 'trailer park sidewalk',
      homeLabel: 'trailer park lot'
    },
    locationHint: 'Hanging around the Trailer Park at the west end of Maple Lane.'
  },
  {
    // Doctor / nurse at Maple Lane Clinic behind the reception counter.
    id: 'maya',
    name: 'Dr. Maya',
    role: 'clinic',
    tagline: 'Maple Lane Clinic',
    jobId: null,
    dialogueId: 'maya',
    appearance: { skin: 'light', shirt: 'white', pants: 'charcoal' },
    look: {
      body: 'june',
      suitTint: 0xbcd9d2,
      hairTint: 0x241d19
    },
    radius: NPC_RADIUS,
    noticeRange: 2.8,
    talkRange: NPC_TALK_RANGE,
    patrol: { z: 3.1 + NORTH_FRONTAGE_OFFSET + 2.85, x0: -30.35, x1: -30.35, startX: -30.35, speed: 0 },
    stationary: { yaw: 0 },
    locationHint: 'Behind the reception desk inside Maple Lane Clinic.'
  },
  {
    // Off-duty mechanic who hangs out by Maple Lane Park at the east end.
    id: 'marcus',
    name: 'Marcus',
    role: 'neighbour',
    tagline: 'Off-Duty Mechanic',
    jobId: null,
    dialogueId: 'marcus',
    appearance: { skin: 'brown', shirt: 'navy', pants: 'denim' },
    look: {
      body: 'sam',
      suitTint: 0x5c708a,
      hairTint: 0x1e1815
    },
    radius: NPC_RADIUS,
    noticeRange: NPC_NOTICE_RANGE,
    talkRange: NPC_TALK_RANGE,
    patrol: {
      z: STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth / 2 + 1.2,
      x0: 67,
      x1: 79,
      startX: 72,
      speed: 0.72,
      idle: 3.2
    },
    routine: {
      walks: [[10, 14], [16, 20]],
      outdoorHours: [9, 21],
      restX: 72,
      home: { x: 66.5, z: 16.5 },
      sidewalk: 'Maple Lane Park plaza',
      homeLabel: 'park entrance'
    },
    locationHint: 'Strolling near the Maple Lane Park plaza at the east end.'
  },
  {
    // Postal clerk at Maple Lane Post Office behind the service counter.
    id: 'hank',
    name: 'Hank',
    role: 'post-office',
    tagline: 'Maple Lane Post Office',
    jobId: null,
    dialogueId: 'hank',
    appearance: { skin: 'tan', shirt: 'navy', pants: 'charcoal' },
    look: {
      body: 'clerk',
      suitTint: 0x5b7da8,
      hairTint: 0x7b756d
    },
    radius: NPC_RADIUS,
    noticeRange: 2.8,
    talkRange: NPC_TALK_RANGE,
    patrol: { z: -11.35, x0: 47.05, x1: 47.05, startX: 47.05, speed: 0 },
    stationary: { yaw: Math.PI },
    locationHint: 'Behind the service counter inside Maple Lane Post Office.'
  }
];

/**
 * Story characters: not spawned with the neighbours. A story beat (dayOne.js)
 * creates them with createNpc while it needs them and removes them after.
 */
export const STORY_NPCS = [
  {
    // Your realtor on moving day. Waits on your front path, 2m clear of both vending machine & mailbox.
    id: 'rita',
    name: 'Rita',
    role: 'realtor',
    tagline: 'Maple Lane Realty',
    jobId: null,
    dialogueId: 'rita',
    appearance: { skin: 'light', shirt: 'navy', pants: 'charcoal' },
    look: {
      body: 'dottie',
      suitTint: 0xb04e60,
      hairTint: 0x3b261c
    },
    radius: NPC_RADIUS,
    noticeRange: 3.6,
    talkRange: NPC_TALK_RANGE,
    patrol: { z: -4.40, x0: 0.0, x1: 0.0, startX: 0.0, speed: 0 },
    stationary: { yaw: Math.PI },
    locationHint: 'Waiting by your front path.'
  }
];

export function getNpc(id, list = NPC_DEFS) {
  if (!id || !list) return null;
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) return list[i];
  }
  if (list === NPC_DEFS) return getNpc(id, STORY_NPCS);
  return null;
}

export function listNpcs(list = NPC_DEFS) {
  return (list || []).slice();
}
