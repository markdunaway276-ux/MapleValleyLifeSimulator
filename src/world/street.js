/**
 * East–west street in front of the Kenney house. Spawn sits on the road.
 * Kept in its own small module so props and NPCs can ask what surface is
 * under them without importing the whole scene.
 */
const OLD_ROAD_WIDTH = 4;
const SOUTH_CURB_Z = -3.15;
const ROAD_WIDTH = 7;
const ROAD_CENTER_Z = SOUTH_CURB_Z + ROAD_WIDTH / 2;

// The south curb stays in place. Move the entire north frontage outwards.
export const NORTH_FRONTAGE_OFFSET = ROAD_WIDTH - OLD_ROAD_WIDTH;

export const STREET = {
  length: 44,
  roadWidth: ROAD_WIDTH,
  sidewalkWidth: 1.5,
  roadCenterZ: ROAD_CENTER_Z,
  spawn: { x: 0, y: 1.6, z: ROAD_CENTER_Z }
};

/** Keep the same relative position within the road or alongside the shifted frontage. */
export function widenSavedStreetZ(z) {
  const across = Math.max(0, Math.min(1, (z - SOUTH_CURB_Z) / OLD_ROAD_WIDTH));
  return z + across * NORTH_FRONTAGE_OFFSET;
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
