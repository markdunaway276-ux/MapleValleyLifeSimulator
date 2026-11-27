import { onRoute9 } from './route9.js';
/**
 * East–west street in front of the Kenney house. Spawn sits on the road.
 * Kept in its own small module so props and NPCs can ask what surface is
 * under them without importing the whole scene.
 */
import { expansionSurface, parkLayout } from './parkLayout.js';

const OLD_ROAD_WIDTH = 4;
const SOUTH_CURB_Z = -3.15;
const ROAD_WIDTH = 14;
const OLD_SIDEWALK_WIDTH = 1.5;
const SIDEWALK_WIDTH = 2.2;
const WIDER_WALK = SIDEWALK_WIDTH - OLD_SIDEWALK_WIDTH;
const ROAD_CENTER_Z = SOUTH_CURB_Z + WIDER_WALK + ROAD_WIDTH / 2;

// Keep the south property line and front walk in place as the pavement widens.
export const NORTH_FRONTAGE_OFFSET = ROAD_WIDTH - OLD_ROAD_WIDTH + 2 * WIDER_WALK;

export const MARKED_CROSSINGS = Object.freeze([0, 14]);

export const STREET = {
  length: 88, // x -44..44: laundromat at the east end, trailer park at the west
  roadWidth: ROAD_WIDTH,
  sidewalkWidth: SIDEWALK_WIDTH,
  parkingLaneWidth: 3,
  crossings: MARKED_CROSSINGS,
  roadCenterZ: ROAD_CENTER_Z,
  spawn: { x: 0, y: 1.6, z: ROAD_CENTER_Z }
};
STREET.expansion = parkLayout(STREET);

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
export const SURFACE_Y = { grass: 0, road: 0.02, walk: 0.11 };

export const CURB_WIDTH = 0.14;
export const GARAGE_LOT = { x: 13.5, z: -10.05, width: 8.25, depth: 9.3, garageWidth: 3.2 };
export const DRIVEWAY = {
  x: GARAGE_LOT.x + (GARAGE_LOT.width + GARAGE_LOT.garageWidth) / 2,
  endZ: GARAGE_LOT.z + GARAGE_LOT.depth / 2 - 0.5,
  width: GARAGE_LOT.garageWidth,
  flare: 0.45,
  rampDepth: 0.65
};

export function drivewayWalkHeight(x, offset) {
  const edge = (Math.abs(x - DRIVEWAY.x) - DRIVEWAY.width / 2) / DRIVEWAY.flare;
  const rise = Math.min(1, Math.max(0, edge, (offset - CURB_WIDTH) / DRIVEWAY.rampDepth));
  return SURFACE_Y.road + rise * (SURFACE_Y.walk - SURFACE_Y.road);
}

/** Height of the ground surface at x, z: grass, road or pavement. */
export function surfaceHeightAt(x, z) {
  if (onRoute9(x, z, STREET.roadCenterZ)) return SURFACE_Y.road;
  const expansion = expansionSurface(x, z, STREET.expansion);
  if (expansion) return expansion === 'road' ? SURFACE_Y.road : SURFACE_Y.walk;
  const { length, roadWidth, sidewalkWidth, roadCenterZ } = STREET;
  if (Math.abs(x) > length / 2) return SURFACE_Y.grass;
  const dz = Math.abs(z - roadCenterZ);
  if (dz <= roadWidth / 2) return SURFACE_Y.road;
  if (dz <= roadWidth / 2 + sidewalkWidth) {
    return z < roadCenterZ ? drivewayWalkHeight(x, dz - roadWidth / 2) : SURFACE_Y.walk;
  }
  if (z < roadCenterZ && z >= DRIVEWAY.endZ && Math.abs(x - DRIVEWAY.x) <= DRIVEWAY.width / 2) {
    const edgeZ = roadCenterZ - roadWidth / 2 - sidewalkWidth;
    return SURFACE_Y.road + (SURFACE_Y.walk - SURFACE_Y.road) * (z - DRIVEWAY.endZ) / (edgeZ - DRIVEWAY.endZ);
  }
  return SURFACE_Y.grass;
}
