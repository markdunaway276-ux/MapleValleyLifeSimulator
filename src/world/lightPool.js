/**
 * Fixed-size pool of PointLights and SpotLights that moves to the nearest
 * active fixtures around the player each frame.
 *
 * Three.js compiles the PBR fragment shader per light count in the scene, so
 * keeping a small fixed pool (3 point + 3 spot on desktop, 1 point + 1 spot on
 * mobile) permanently attached to the scene cuts per-pixel shader cost without
 * ever triggering shader recompiles. Unused slots simply stay at intensity 0.
 */

export const POOL_BUDGET = Object.freeze({
  desktop: Object.freeze({ point: 3, spot: 3 }),
  mobile: Object.freeze({ point: 1, spot: 1 })
});

const MIN_INTENSITY = 0.01;

function rankNearest(fixtures, count, fx, fy, fz, outFixtures, outDist) {
  let found = 0;
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (!f || !(f.intensity > MIN_INTENSITY)) continue;
    const dx = f.x - fx;
    const dy = f.y - fy;
    const dz = f.z - fz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (found < count) {
      let pos = found;
      while (pos > 0 && d2 < outDist[pos - 1]) {
        outDist[pos] = outDist[pos - 1];
        outFixtures[pos] = outFixtures[pos - 1];
        pos--;
      }
      outDist[pos] = d2;
      outFixtures[pos] = f;
      found++;
    } else if (d2 < outDist[count - 1]) {
      let pos = count - 1;
      while (pos > 0 && d2 < outDist[pos - 1]) {
        outDist[pos] = outDist[pos - 1];
        outFixtures[pos] = outFixtures[pos - 1];
        pos--;
      }
      outDist[pos] = d2;
      outFixtures[pos] = f;
    }
  }
  return found;
}

export function createLightPool({
  scene,
  quality = {},
  PointLight,
  SpotLight,
  pointCount,
  spotCount
} = {}) {
  const budget = quality && quality.shadows ? POOL_BUDGET.desktop : POOL_BUDGET.mobile;
  const maxPoints = pointCount != null ? Math.max(0, pointCount | 0) : budget.point;
  const maxSpots = spotCount != null ? Math.max(0, spotCount | 0) : budget.spot;

  const pointPool = [];
  const spotPool = [];
  for (let i = 0; i < maxPoints; i++) {
    const light = new PointLight(0xffffff, 0, 10, 2);
    light.name = 'pooled-point-' + i;
    light.userData = light.userData || {};
    light.userData._color = 0xffffff;
    if (scene && typeof scene.add === 'function') scene.add(light);
    pointPool.push(light);
  }
  for (let i = 0; i < maxSpots; i++) {
    const light = new SpotLight(0xffffff, 0, 10, Math.PI / 3, 0.5, 2);
    light.name = 'pooled-spot-' + i;
    light.userData = light.userData || {};
    light.userData._color = 0xffffff;
    if (scene && typeof scene.add === 'function') scene.add(light, light.target);
    spotPool.push(light);
  }

  const pointFixtures = [];
  const spotFixtures = [];
  const topPoints = new Array(maxPoints);
  const topPointDist = new Float64Array(maxPoints);
  const topSpots = new Array(maxSpots);
  const topSpotDist = new Float64Array(maxSpots);

  function addPoint({ x = 0, y = 0, z = 0, color = 0xffffff, intensity = 0, distance = 10, decay = 2 } = {}) {
    const fixture = { kind: 'point', x, y, z, color, intensity, distance, decay };
    pointFixtures.push(fixture);
    return fixture;
  }

  function addSpot({
    x = 0, y = 0, z = 0,
    tx = x, ty = 0, tz = z,
    color = 0xffffff, intensity = 0, distance = 10,
    angle = Math.PI / 3, penumbra = 0.5, decay = 2
  } = {}) {
    const fixture = { kind: 'spot', x, y, z, tx, ty, tz, color, intensity, distance, angle, penumbra, decay };
    spotFixtures.push(fixture);
    return fixture;
  }

  function update(focus) {
    const fx = focus ? (focus.x || 0) : 0;
    const fy = focus ? (focus.y || 0) : 0;
    const fz = focus ? (focus.z || 0) : 0;

    if (maxPoints > 0) {
      const found = rankNearest(pointFixtures, maxPoints, fx, fy, fz, topPoints, topPointDist);
      for (let i = 0; i < maxPoints; i++) {
        const light = pointPool[i];
        if (i < found) {
          const f = topPoints[i];
          if (light.userData._color !== f.color) {
            light.color.setHex(f.color);
            light.userData._color = f.color;
          }
          light.intensity = f.intensity;
          light.distance = f.distance;
          light.decay = f.decay;
          light.position.set(f.x, f.y, f.z);
        } else {
          light.intensity = 0;
        }
      }
    }

    if (maxSpots > 0) {
      const found = rankNearest(spotFixtures, maxSpots, fx, fy, fz, topSpots, topSpotDist);
      for (let i = 0; i < maxSpots; i++) {
        const light = spotPool[i];
        if (i < found) {
          const f = topSpots[i];
          if (light.userData._color !== f.color) {
            light.color.setHex(f.color);
            light.userData._color = f.color;
          }
          light.intensity = f.intensity;
          light.distance = f.distance;
          light.angle = f.angle;
          light.penumbra = f.penumbra;
          light.decay = f.decay;
          light.position.set(f.x, f.y, f.z);
          light.target.position.set(f.tx, f.ty, f.tz);
          if (typeof light.target.updateMatrixWorld === 'function') light.target.updateMatrixWorld();
        } else {
          light.intensity = 0;
        }
      }
    }
  }

  return {
    addPoint,
    addSpot,
    update,
    pointPool,
    spotPool,
    pointFixtures,
    spotFixtures
  };
}
