export const ROUTE_9 = { minX: -300, maxX: -44, taper: -69, halfWidth: 4 };

export function routeHalfWidth(x) {
  return 4 + 3 * Math.max(0, Math.min(1, (x + 69) / 25));
}

export function onRoute9(x, z, center) {
  return x >= ROUTE_9.minX && x < ROUTE_9.maxX && Math.abs(z - center) <= routeHalfWidth(x);
}

export function routeDriveAreas(center) {
  // Overlap the town and taper rectangles so the car fits through the join.
  return [
    { minX: -300, maxX: -48, minZ: center - 4, maxZ: center + 4 },
    { minX: -69, maxX: -38, minZ: center - 4, maxZ: center + 4 },
    { minX: -55, maxX: -38, minZ: center - 5.3, maxZ: center + 5.3 }
  ];
}
