import { STREET, MARKED_CROSSINGS } from './street.js';

const ARRIVAL_RADIUS = 1.8;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function walkingRoute(start, goal, street = STREET) {
  if (!start || !goal || ![start.x, start.z, goal.x, goal.z].every(Number.isFinite)) return null;
  const remaining = distance(start, goal);
  if (remaining <= ARRIVAL_RADIUS) return { points: [start, goal], metres: 0, arrived: true };

  const { roadCenterZ: center, roadWidth, sidewalkWidth, length } = street;
  const halfRoad = roadWidth / 2;
  const sidewalkOffset = halfRoad + sidewalkWidth / 2;
  const side = (point) => point.z < center ? -1 : 1;
  const sidewalk = (x, s) => ({ x: Math.max(-length / 2, Math.min(length / 2, x)), z: center + s * sidewalkOffset });
  const from = side(start);
  const to = side(goal);
  const crossings = street.crossings ?? MARKED_CROSSINGS;
  const lead = sidewalk(start.x, from);
  const end = sidewalk(goal.x, to);
  let points;

  if (from === to) {
    // A short approach on this side does not need to backtrack to the sidewalk.
    points = remaining <= 5 ? [start, goal] : [start, lead, end, goal];
  } else {
    let best = Infinity;
    for (const crossing of crossings) {
      const near = sidewalk(crossing, from);
      const far = sidewalk(crossing, to);
      // If already in the crossing, continue through it rather than returning to the curb.
      const inCrossing = Math.abs(start.x - crossing) <= 1.1 && Math.abs(start.z - center) <= halfRoad;
      const option = inCrossing
        ? [start, { x: start.x, z: far.z }, far, end, goal]
        : [start, lead, near, far, end, goal];
      const metres = option.reduce((sum, point, i) => i ? sum + distance(option[i - 1], point) : 0, 0);
      if (metres < best) { points = option; best = metres; }
    }
    points ??= [start, goal];
  }
  const metres = points.reduce((sum, point, i) => i ? sum + distance(points[i - 1], point) : 0, 0);
  return { points, metres, arrived: false };
}
