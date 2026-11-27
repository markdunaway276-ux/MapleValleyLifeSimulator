import * as THREE from 'three';
import { Parts } from './parts.js';
import { STREET, SURFACE_Y, NORTH_FRONTAGE_OFFSET } from './street.js';
import { createVertexMaterial } from './surfaces.js';
import { createContactBlob } from './contact.js';

/**
 * Environmental polish for Maple Lane:
 * - Distant rolling valley hills along the horizon (eliminates flat world edge)
 * - Utility poles with catenary overhead power lines + gritty street clutter
 *   (dumpsters, curb storm drains, wall AC units)
 * - Dynamic rain wetness on road & sidewalks
 * - Golden-hour dust motes & night fireflies
 */

function ridgeHeight(angle, seed) {
  return (
    Math.sin(angle * 3 + seed) * 4.5 +
    Math.sin(angle * 7 - seed * 1.7) * 2.8 +
    Math.cos(angle * 13 + seed * 0.6) * 1.4
  );
}

/**
 * Two misty low-poly mountain/hill rings encircling Maple Lane so the ground
 * plane never ends abruptly in fog. 1 draw call, fog-blended.
 */
export function buildValleyHorizon(scene, quality = {}) {
  const group = new THREE.Group();
  group.name = 'valley-horizon';

  const rings = [
    { radius: 118, baseH: 11, amp: 1.0, segs: 64, seed: 1.2, colLow: 0x26322b, colHigh: 0x3b4943 },
    { radius: 158, baseH: 20, amp: 1.35, segs: 64, seed: 3.7, colLow: 0x2b363a, colHigh: 0x4b5a62 }
  ];

  const pos = [];
  const col = [];
  const cLow = new THREE.Color();
  const cHigh = new THREE.Color();

  for (const r of rings) {
    cLow.setHex(r.colLow);
    cHigh.setHex(r.colHigh);
    for (let i = 0; i < r.segs; i++) {
      const a0 = (i / r.segs) * Math.PI * 2;
      const a1 = ((i + 1) / r.segs) * Math.PI * 2;
      // Keep the far west Route 9 approach slightly lower so the highway feels open.
      const westDip0 = 1 - 0.42 * Math.exp(-(((Math.cos(a0) + 1) / 0.45) ** 2));
      const westDip1 = 1 - 0.42 * Math.exp(-(((Math.cos(a1) + 1) / 0.45) ** 2));
      const h0 = Math.max(4, (r.baseH + ridgeHeight(a0, r.seed) * r.amp) * westDip0);
      const h1 = Math.max(4, (r.baseH + ridgeHeight(a1, r.seed) * r.amp) * westDip1);

      const x0 = Math.cos(a0) * r.radius;
      const z0 = Math.sin(a0) * r.radius + 10;
      const x1 = Math.cos(a1) * r.radius;
      const z1 = Math.sin(a1) * r.radius + 10;

      // Two triangles per quad, inward-facing so the player sees them from inside the valley.
      pos.push(
        x0, -2, z0, x1, -2, z1, x1, h1, z1,
        x0, -2, z0, x1, h1, z1, x0, h0, z0
      );
      col.push(
        cLow.r, cLow.g, cLow.b, cLow.r, cLow.g, cLow.b, cHigh.r, cHigh.g, cHigh.b,
        cLow.r, cLow.g, cLow.b, cHigh.r, cHigh.g, cHigh.b, cHigh.r, cHigh.g, cHigh.b
      );
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'valley-hills';
  mesh.frustumCulled = false;
  group.add(mesh);
  scene.add(group);
  return group;
}

/**
 * Small-town silhouette details: wooden utility poles with sagging overhead
 * power lines, commercial dumpsters, curb storm drains, and AC condensers.
 */
export function buildStreetDetails(scene, quality = {}) {
  const group = new THREE.Group();
  group.name = 'street-details';

  const parts = new Parts(true);
  const northWalkOuter = STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth + 0.35;
  const poleXs = [-46, -24, -4, 18, 44, 62];
  const poleHeight = 7.4;
  const crossY = poleHeight - 0.55;
  const wireOffsets = [-0.62, 0.0, 0.62];

  // Utility poles + crossarms + ceramic insulators along the north utility strip.
  for (const x of poleXs) {
    parts.surface('woodRaw');
    parts.cylinder(0x4b3b2d, 0.105, 0.145, poleHeight, x, poleHeight / 2, northWalkOuter, 0, 0, 0, 8);
    parts.box(0x524133, 0.14, 0.13, 1.55, x, crossY, northWalkOuter);
    // Diagonal metal brace under crossarm.
    parts.surface('metal');
    parts.box(0x3a3e42, 0.04, 0.04, 0.72, x, crossY - 0.24, northWalkOuter - 0.28, 0.55, 0, 0);
    parts.box(0x3a3e42, 0.04, 0.04, 0.72, x, crossY - 0.24, northWalkOuter + 0.28, -0.55, 0, 0);
    for (const wz of wireOffsets) {
      parts.cylinder(0x5d6e74, 0.032, 0.04, 0.09, x, crossY + 0.1, northWalkOuter + wz, 0, 0, 0, 6);
    }
    scene.userData.colliders?.addTree?.({ id: 'utility-pole-' + x, x, z: northWalkOuter, radius: 0.18 });
  }

  // Sagging overhead power lines connecting consecutive utility poles.
  const wirePoints = [];
  const segsPerSpan = 10;
  for (let i = 0; i < poleXs.length - 1; i++) {
    const x0 = poleXs[i];
    const x1 = poleXs[i + 1];
    const span = x1 - x0;
    const sag = Math.min(0.85, span * 0.028);
    for (const wz of wireOffsets) {
      const z = northWalkOuter + wz;
      for (let s = 0; s < segsPerSpan; s++) {
        const t0 = s / segsPerSpan;
        const t1 = (s + 1) / segsPerSpan;
        const y0 = crossY + 0.14 - 4 * sag * t0 * (1 - t0);
        const y1 = crossY + 0.14 - 4 * sag * t1 * (1 - t1);
        wirePoints.push(
          x0 + span * t0, y0, z,
          x0 + span * t1, y1, z
        );
      }
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePoints, 3));
  const wires = new THREE.LineSegments(
    wireGeo,
    new THREE.LineBasicMaterial({ color: 0x1b1e22, transparent: true, opacity: 0.85 })
  );
  wires.name = 'power-lines';
  group.add(wires);

  // Commercial dumpsters tucked beside the Market and Laundromat.
  const dumpsters = [
    { id: 'dumpster-market', x: 22.1, z: 2.8 + NORTH_FRONTAGE_OFFSET + 4.8, ry: Math.PI / 2 },
    { id: 'dumpster-laundromat', x: 24.4, z: -11.4, ry: 0 }
  ];
  for (const d of dumpsters) {
    parts.setFrame(d.x, 0, d.z, d.ry);
    parts.surface('metal');
    parts.box(0x2d4234, 1.55, 1.05, 1.05, 0, 0.56, 0);
    // Side lift pockets
    parts.box(0x233429, 0.14, 0.24, 1.12, -0.78, 0.52, 0);
    parts.box(0x233429, 0.14, 0.24, 1.12, 0.78, 0.52, 0);
    // Slightly ajar dark rubber lids
    parts.surface('rubber');
    parts.box(0x1f2124, 0.74, 0.06, 1.08, -0.39, 1.12, 0, 0.04, 0, 0.05);
    parts.box(0x1f2124, 0.74, 0.06, 1.08, 0.39, 1.11, 0, 0, 0, -0.02);
    // Casters
    parts.box(0x18191b, 0.12, 0.08, 0.12, -0.62, 0.04, -0.4);
    parts.box(0x18191b, 0.12, 0.08, 0.12, 0.62, 0.04, -0.4);
    parts.box(0x18191b, 0.12, 0.08, 0.12, -0.62, 0.04, 0.4);
    parts.box(0x18191b, 0.12, 0.08, 0.12, 0.62, 0.04, 0.4);
    parts.resetFrame();

    if (typeof document !== 'undefined') {
      const blob = createContactBlob({ rx: 1.05, rz: 0.78, strength: 0.85 }, { shadows: !!quality.shadows });
      blob.position.set(d.x, 0.014, d.z);
      group.add(blob);
    }
    scene.userData.colliders?.addHouse?.({ id: d.id, x: d.x, z: d.z, width: 1.65, depth: 1.15, rotY: d.ry });
  }

  // Wall-mounted AC condenser units on the Market and Clinic flanks.
  const acUnits = [
    { x: 22.8, y: 0.45, z: 2.8 + NORTH_FRONTAGE_OFFSET + 8.5, ry: Math.PI / 2 },
    { x: -26.7, y: 0.45, z: 3.1 + NORTH_FRONTAGE_OFFSET + 4.4, ry: -Math.PI / 2 }
  ];
  for (const ac of acUnits) {
    parts.setFrame(ac.x, ac.y, ac.z, ac.ry);
    parts.surface('metal');
    parts.box(0x7c827e, 0.76, 0.62, 0.38, 0, 0, 0);
    parts.box(0x282d30, 0.44, 0.44, 0.04, -0.1, 0, 0.19);
    parts.box(0x525856, 0.16, 0.48, 0.04, 0.24, 0, 0.19);
    parts.resetFrame();
  }

  // Curbside storm-drain grates along both gutters.
  const southGutterZ = STREET.roadCenterZ - STREET.roadWidth / 2 + 0.26;
  const northGutterZ = STREET.roadCenterZ + STREET.roadWidth / 2 - 0.26;
  parts.surface('metal');
  for (const x of [-18, 6, 28]) {
    for (const z of [southGutterZ, northGutterZ]) {
      parts.box(0x232629, 0.72, 0.016, 0.34, x, SURFACE_Y.road + 0.004, z);
      for (let b = -3; b <= 3; b++) {
        parts.box(0x3a3f44, 0.035, 0.02, 0.28, x + b * 0.088, SURFACE_Y.road + 0.008, z);
      }
    }
  }

  const mesh = new THREE.Mesh(parts.merge(), createVertexMaterial({ metalness: 0.18 }));
  mesh.name = 'street-clutter';
  mesh.castShadow = !!quality.shadows;
  mesh.receiveShadow = !!quality.shadows;
  group.add(mesh);

  scene.add(group);
  return group;
}

/**
 * Darkens and glosses up the asphalt road and sidewalks when raining so
 * streetlights and sky reflect off wet pavement.
 */
export function updateWetSurfaces(scene, rainAmount) {
  const wet = Math.max(0, Math.min(1, Number(rainAmount) || 0));
  const road = scene?.getObjectByName?.('road');
  if (road?.material) {
    road.material.roughness = 0.90 - wet * 0.64;
    const c = 1 - wet * 0.28;
    road.material.color.setRGB(c, c, c * (1 + wet * 0.04));
  }
  const walk = scene?.getObjectByName?.('sidewalk-north');
  if (walk?.material) {
    walk.material.roughness = 0.90 - wet * 0.52;
    const c = 1 - wet * 0.20;
    walk.material.color.setRGB(c, c, c * (1 + wet * 0.03));
  }
}

/**
 * Ambient golden-hour dust motes & warm nighttime fireflies floating near the
 * player. Single Points draw call, mobile-safe.
 */
export function createAmbientParticles(scene, quality = {}) {
  const count = quality.shadows ? 90 : 45;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const spanX = 34;
  const spanZ = 34;

  for (let i = 0; i < count; i++) {
    seeds[i * 3] = (Math.random() - 0.5) * spanX;
    seeds[i * 3 + 1] = 0.45 + Math.random() * 2.8;
    seeds[i * 3 + 2] = (Math.random() - 0.5) * spanZ;
    positions[i * 3] = seeds[i * 3];
    positions[i * 3 + 1] = seeds[i * 3 + 1];
    positions[i * 3 + 2] = seeds[i * 3 + 2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffe4a0,
    size: quality.shadows ? 0.085 : 0.11,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'ambient-particles';
  points.frustumCulled = false;
  scene.add(points);

  let t = 0;
  return {
    points,
    update(delta, { playerPos, minutes = 600, rain = 0 } = {}) {
      t += Math.max(0, Math.min(0.1, Number(delta) || 0));
      // Strongest at golden hour / dusk / night; suppressed in rain.
      const evening = THREE.MathUtils.smoothstep(minutes, 16 * 60 + 30, 19 * 60 + 30);
      const morning = 1 - THREE.MathUtils.smoothstep(minutes, 5 * 60, 7 * 60 + 30);
      const night = Math.min(1, evening + morning);
      const golden = Math.exp(-(((minutes - (17 * 60 + 30)) / 95) ** 2));
      const dry = Math.max(0, 1 - rain * 2.5);
      const vis = Math.max(night * 0.72, golden * 0.48) * dry;
      points.visible = vis > 0.02;
      if (!points.visible) return;

      // Warm amber-green fireflies at night, soft gold dust in golden hour.
      mat.color.setHex(night > 0.55 ? 0xd8f078 : 0xffdf9e);
      mat.opacity = vis * (0.72 + 0.28 * Math.sin(t * 2.2));

      const px = playerPos ? playerPos.x : 0;
      const pz = playerPos ? playerPos.z : 0;
      const attr = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        const sx = seeds[i * 3];
        const sy = seeds[i * 3 + 1];
        const sz = seeds[i * 3 + 2];
        const x = px + ((((sx + Math.sin(t * 0.35 + i) * 1.4) + spanX / 2) % spanX + spanX) % spanX) - spanX / 2;
        const z = pz + ((((sz + Math.cos(t * 0.28 + i * 1.3) * 1.4) + spanZ / 2) % spanZ + spanZ) % spanZ) - spanZ / 2;
        const y = sy + Math.sin(t * 0.8 + i * 2.1) * 0.28;
        attr.setXYZ(i, x, y, z);
      }
      attr.needsUpdate = true;
    }
  };
}
