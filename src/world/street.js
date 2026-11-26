/**
 * East–west street in front of the Kenney house. Spawn sits on the road.
 * Kept in its own small module so props and NPCs can ask what surface is
 * under them without importing the whole scene.
 */
const OLD_ROAD_WIDTH = 4;
const SOUTH_CURB_Z = -3.15;
const ROAD_WIDTH = 14;
const OLD_SIDEWALK_WIDTH = 1.5;
const SIDEWALK_WIDTH = 2.2;
const WIDER_WALK = SIDEWALK_WIDTH - OLD_SIDEWALK_WIDTH;
const ROAD_CENTER_Z = SOUTH_CURB_Z + WIDER_WALK + ROAD_WIDTH / 2;

// Keep the south property line and front walk in place as the pavement widens.
export const NORTH_FRONTAGE_OFFSET = ROAD_WIDTH - OLD_ROAD_WIDTH + 2 * WIDER_WALK;

export const STREET = {
  length: 44,
  roadWidth: ROAD_WIDTH,
  sidewalkWidth: SIDEWALK_WIDTH,
  parkingLaneWidth: 3,
  roadCenterZ: ROAD_CENTER_Z,
  spawn: { x: 0, y: 1.6, z: ROAD_CENTER_Z }
};

/** Keep the same relative position within the road or alongside the shifted frontage. */
export function widenSavedStreetZ(z, fromWidth, toWidth) {
  const across = Math.max(0, Math.min(1, (z - SOUTH_CURB_Z) / fromWidth));
  return z + across * (toWidth - fromWidth);
}

/** Remap the previous street into the wider walks and shifted carriageway. */
export function widenSavedSidewalkZ(z) {
  const southEdge = SOUTH_CURB_Z - OLD_SIDEWALK_WIDTH;
  const northCurb = SOUTH_CURB_Z + ROAD_WIDTH;
  const southAmount = Math.max(0, Math.min(1, (z - southEdge) / OLD_SIDEWALK_WIDTH));
  const northAmount = Math.max(0, Math.min(1, (z - northCurb) / OLD_SIDEWALK_WIDTH));
  return z + WIDER_WALK * (southAmount + northAmount);
}

/** Heights the road and pavement planes sit at (scene.js places them here). */
export const SURFACE_Y = { grass: 0, road: 0.02, walk: 0.03 };

/** Height of the ground surface at x, z: grass, road or pavement. */
export function surfaceHeightAt(x, z) {
  const { length, roadWidth, sidewalkWidth, roadCenterZ } = STREET;
  if (Math.abs(x) > length / 2) return SURFACE_Y.grass;
  const dz = Math.abs(z - roadCenterZ);
  if (dz <= roadWidth / 2) return SURFACE_Y.road;
  if (dz <= roadWidth / 2 + sidewalkWidth) return SURFACE_Y.walk;
  return SURFACE_Y.grass;
}
