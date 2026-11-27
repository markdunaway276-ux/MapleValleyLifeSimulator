const area = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });

export const parkContains = (area, x, z) =>
  x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ;

export function parkLayout(street) {
  const streetEnd = street.length / 2;
  const south = street.roadCenterZ - street.roadWidth / 2;
  const north = street.roadCenterZ + street.roadWidth / 2;
  const walkEdge = north + street.sidewalkWidth;
  const west = 52;
  const innerWest = 64;
  const innerEast = 103;
  const east = 115;
  const innerNorth = 46;
  const loopNorth = 58;
  const paths = [
    area(streetEnd, west, north, walkEdge),
    area(innerWest, 73, north, walkEdge),
    area(70, 73, walkEdge, 32)
  ];

  return {
    park: area(innerWest, innerEast, walkEdge, innerNorth),
    pond: area(73, 95, 26, 40),
    roads: [
      area(streetEnd, east, south, north),
      area(west, innerWest, north, innerNorth),
      area(innerEast, east, north, innerNorth),
      area(west, east, innerNorth, loopNorth)
    ],
    // Overlap the driveable strips at the junctions so a turning car fits.
    drive: [
      area(streetEnd - 8, east, south, north),
      area(west, innerWest, south, loopNorth),
      area(innerEast, east, south, loopNorth),
      area(west, east, innerNorth, loopNorth)
    ],
    paths,
    crossing: area(west, innerWest, north, walkEdge)
  };
}

export function expansionSurface(x, z, expansion) {
  if (expansion?.roads.some(rect => parkContains(rect, x, z))) return 'road';
  if (expansion?.paths.some(rect => parkContains(rect, x, z))) return 'sidewalk';
  return null;
}
