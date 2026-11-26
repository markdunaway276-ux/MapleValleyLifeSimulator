/**
 * East–west street in front of the Kenney house. Spawn sits on the road.
 * Kept in its own small module so props and NPCs can ask what surface is
 * under them without importing the whole scene.
 */
export const STREET = {
  length: 44,
  roadWidth: 4,
  sidewalkWidth: 1.5,
  roadCenterZ: -1.15,
  spawn: { x: 0, y: 1.6, z: -1.15 }
};

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
