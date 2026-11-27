/**
 * Where the car may drive: a list of rectangles (the street, the gas station
 * forecourt). The car's box, with half-extents ex / ez, must sit fully inside
 * one of them. The forecourt rectangle reaches down over the street, so the
 * car can turn in and out without ever being outside both.
 * No Three.js (tested in tests/fuel.test.mjs).
 */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The nearest allowed centre for a car centred at (x, z). */
export function carBoundsClamp(x, z, ex, ez, rects) {
  const list = Array.isArray(rects) ? rects : [rects];
  let best = null;
  let bestD = Infinity;
  for (const r of list) {
    if (!r) continue;
    const nx = r.maxX - r.minX < 2 * ex ? (r.minX + r.maxX) / 2 : clamp(x, r.minX + ex, r.maxX - ex);
    const nz = r.maxZ - r.minZ < 2 * ez ? (r.minZ + r.maxZ) / 2 : clamp(z, r.minZ + ez, r.maxZ - ez);
    const d = (nx - x) * (nx - x) + (nz - z) * (nz - z);
    if (d < bestD) { bestD = d; best = { x: nx, z: nz }; if (d === 0) break; }
  }
  return best || { x, z };
}
