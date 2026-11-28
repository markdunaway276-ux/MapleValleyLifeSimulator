import { buildApproachRoad, replaceTownTrees } from './scenery.js';
import * as THREE from 'three';
import { generateHouse, getHouseColliders, getHouseBounds } from './buildings.js';
import { scatterTrees, TREE_PLACEMENTS } from './trees.js';
import { CAR_SPAWN } from './props.js';
import { createPlayerPickup } from './pickup.js';
import { createMailbox, MAILBOX_SPAWN, mailboxCollider } from './pickups.js';
import { createVendingMachine, VENDING_SPAWN, vendingCollider } from './vending.js';
import { createColliderWorld } from '../systems/collision.js';
import { buildStreetlights } from './streetlights.js';
import { buildMainHouse, gradeMainHouse } from './mainHouse.js';
import { buildCornerShop } from './cornerShop.js';
import { buildLaundromat } from './laundromat.js';
import { buildClinic } from './clinic.js';
import { buildGasStation } from './gasStation.js';
import { buildPark } from './park.js';
import { buildTrailerPark } from './trailerPark.js';
import { buildPostOffice } from './postOffice.js';
import { createWorldState } from '../systems/interactables.js';
import { sampleLighting } from './daynight.js';
import { HOUSE, LOOK, TEXTURE } from './palette.js';
import { createGrassTexture, createRoadTexture, createSidewalkTexture } from './textures.js';
import { applyPbrSurface, applyRoadAsphaltPbr } from './pbrTextures.js';
import { buildContactGeometry, contactMaterial, createContactBlob, createContactShadows } from './contact.js';
import { CURB_WIDTH, DRIVEWAY, GARAGE_LOT, NORTH_FRONTAGE_OFFSET, STREET, SURFACE_Y, drivewayWalkHeight, surfaceHeightAt } from './street.js';
import { createLightPool } from './lightPool.js';
import { useWorldGrit } from './surfaces.js';
import { buildValleyHorizon, buildStreetDetails, createAmbientParticles } from './atmosphere.js';
import { buildGroundFoliage } from './foliage.js';
import { buildLivingWorld } from './livingWorld.js';
import { buildValleyGraphics } from './valleyGraphics.js';
import { buildTownTraffic } from './traffic.js';

export { STREET, gradeMainHouse };

/** Large inverted dome, fog disabled, drawn behind the world: gradient + drifting clouds + sun/moon glow + stars + distant valley ridges. */
function createSkyDome(quality, look) {
  const radius = Math.max(40, (quality.far || 120) * 0.85);
  const geometry = new THREE.SphereGeometry(radius, 32, 20);
  const sunDir = new THREE.Vector3(...(look.sunPos || [22, 32, 16])).normalize();
  const uniforms = {
    topColor: { value: new THREE.Color(look.skyTop) },
    bottomColor: { value: new THREE.Color(look.skyBottom) },
    exponent: { value: look.exponent },
    sunDir: { value: sunDir },
    sunColor: { value: new THREE.Color(look.sun || 0xffe4bc) },
    time: { value: 0 },
    nightFactor: { value: look.interior || 0 },
    cloudCover: { value: 0.42 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        // Local unit direction so moving sky.position with the camera never warps the sky.
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float time;
      uniform float nightFactor;
      uniform float cloudCover;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.52 * vnoise(p);
        v += 0.28 * vnoise(p * 2.05 + vec2(4.1, 1.7));
        v += 0.14 * vnoise(p * 4.2 + vec2(9.3, 5.2));
        return v;
      }

      float ridge(float a, float seed) {
        return 0.045
          + 0.022 * sin(a * 3.0 + seed)
          + 0.013 * sin(a * 7.0 - seed * 1.6)
          + 0.006 * cos(a * 13.0 + seed * 0.7);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = max(dir.y, 0.0);
        vec3 col = mix(bottomColor, topColor, pow(h, exponent));

        // Sun atmospheric Mie/Rayleigh horizon scattering + crisp sun disc.
        vec3 sDir = normalize(sunDir);
        float sDot = max(dot(dir, sDir), 0.0);
        float dayAmt = 1.0 - smoothstep(0.55, 0.92, nightFactor);
        float horizonBand = pow(1.0 - h, 3.6);
        // Warm sunlit horizon scatter (strongest at dawn and golden hour).
        col += sunColor * horizonBand * pow(sDot, 2.5) * 0.34 * dayAmt;
        float halo = pow(sDot, 8.0) * 0.28 * dayAmt + pow(sDot, 64.0) * 0.36 * dayAmt;
        float disc = smoothstep(0.9985, 0.9995, sDot) * (0.95 * dayAmt);
        col += sunColor * (halo + disc);

        // Crisp moon disc + soft lunar halo at night.
        if (nightFactor > 0.15) {
          float mDot = max(dot(dir, sDir), 0.0);
          float moonHalo = pow(mDot, 16.0) * 0.16 + pow(mDot, 120.0) * 0.22;
          float moonDisc = smoothstep(0.9982, 0.9991, mDot) * 0.92;
          col += vec3(0.84, 0.90, 1.0) * (moonHalo + moonDisc) * smoothstep(0.15, 0.72, nightFactor);
        }

        // Two-layer clouds: high wispy cirrus + billowing cumulus with sunlit silver linings.
        float cloudMask = 0.0;
        if (dir.y > 0.015) {
          float horizonFade = smoothstep(0.015, 0.22, dir.y);
          vec2 proj = dir.xz / (dir.y + 0.24);

          // High wispy cirrus streaks.
          vec2 cirrusUv = proj * 0.72 + vec2(time * 0.004, -time * 0.002);
          float cirrus = fbm(cirrusUv * vec2(1.8, 0.65));
          float cirrusMask = smoothstep(0.56, 0.84, cirrus) * horizonFade * 0.26 * (1.0 - nightFactor * 0.5);
          col = mix(col, mix(bottomColor * 1.15, sunColor * 1.1, 0.45), cirrusMask);

          // Main billowing cumulus layer with directional self-shadowing toward the sun.
          vec2 uv = proj * 1.12 + vec2(time * 0.0085, time * 0.0032);
          float n = fbm(uv);
          float nSun = fbm(uv + sDir.xz * 0.14);
          float thresh = mix(0.60, 0.33, clamp(cloudCover, 0.0, 1.0));
          cloudMask = smoothstep(thresh, thresh + 0.23, n) * horizonFade;

          // Cloud lighting: warm backlit silver lining near sun + cool shaded undersides.
          float litDelta = clamp((n - nSun) * 2.2 + 0.45, 0.0, 1.0);
          float silverLining = pow(sDot, 6.0) * smoothstep(thresh, thresh + 0.12, n) * (1.0 - smoothstep(thresh + 0.12, thresh + 0.30, n)) * dayAmt;
          vec3 cloudShadow = mix(topColor * 0.62, bottomColor * 0.76, 0.55);
          vec3 cloudBright = mix(bottomColor * 1.18, sunColor * 1.14, 0.38 + 0.48 * pow(sDot, 3.0));
          vec3 cloudLit = mix(cloudShadow, cloudBright, litDelta) + sunColor * silverLining * 0.55;
          vec3 cloudCol = mix(cloudLit, topColor * 0.52 + vec3(0.05, 0.07, 0.11), nightFactor);
          col = mix(col, cloudCol, cloudMask * (0.68 - nightFactor * 0.24));
        }

        // Crisp multi-tinted twinkling stars at night (masked near horizon and behind clouds).
        if (nightFactor > 0.2 && dir.y > 0.07) {
          vec2 starUv = floor(dir.xz / (dir.y + 0.45) * 185.0);
          float r = hash21(starUv);
          if (r > 0.992) {
            float twinkle = 0.62 + 0.38 * sin(time * (2.0 + fract(r * 73.0) * 2.2) + r * 900.0);
            float starAlpha = smoothstep(0.2, 0.75, nightFactor) * smoothstep(0.07, 0.26, dir.y) * (1.0 - cloudMask * 0.85);
            vec3 starTint = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.92, 0.78), fract(r * 131.0));
            col += starTint * twinkle * starAlpha * 0.92;
          }
        }

        // Distant misty valley hill silhouettes painted into the horizon (never clips or blocks roads).
        float az = atan(dir.z, dir.x);
        float farH = ridge(az, 1.4) * 1.35 + 0.015;
        float nearH = ridge(az, 4.1) * 0.92;
        float farMask = 1.0 - smoothstep(farH - 0.004, farH + 0.004, dir.y);
        float nearMask = 1.0 - smoothstep(nearH - 0.004, nearH + 0.004, dir.y);
        vec3 farCol = mix(bottomColor * 0.72, vec3(0.14, 0.18, 0.20), 0.35 + nightFactor * 0.45);
        vec3 nearCol = mix(bottomColor * 0.52, vec3(0.10, 0.14, 0.12), 0.50 + nightFactor * 0.38);
        col = mix(col, farCol, farMask * 0.62 * smoothstep(-0.02, 0.015, dir.y));
        col = mix(col, nearCol, nearMask * 0.78 * smoothstep(-0.02, 0.01, dir.y));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

export function createScene(quality) {
  const scene = new THREE.Scene();
  const colliders = createColliderWorld();
  scene.userData.colliders = colliders;
  // Start from the 10:00 key (the same palette daynight.js applies), so the
  // first frame and the first day/night update agree: no flash of the old sky.
  const look = sampleLighting(10 * 60);
  const horizon = new THREE.Color(look.fog);
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, quality.far * LOOK.fog.near, quality.far * LOOK.fog.far);
  scene.add(createSkyDome(quality, look));

  // Ground with a repeating grass canvas texture
  const groundGeo = new THREE.PlaneGeometry(450, 125);
  groundGeo.translate(-95, -12.5, 0);
  const groundUv = groundGeo.getAttribute('uv');
  for (let i = 0; i < groundUv.count; i++) {
    groundUv.setXY(i, groundUv.getX(i) * 4.5 - 2.7, groundUv.getY(i) * 1.25 - 0.25);
  }
  const grassTex = createGrassTexture(quality);
  const groundMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    bumpMap: grassTex.userData?.bumpMap || null,
    bumpScale: 0.04,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0
  });
  applyPbrSurface(groundMat, 'grass', {
    repeat: [TEXTURE.grass.repeat * 1.4, TEXTURE.grass.repeat * 1.4],
    anisotropy: quality.shadows ? TEXTURE.grass.anisotropy : 1,
    normalScale: 0.55,
    tint: 0xc2ccb0
  });
  // Snow cover 0..1 (weather.js); settles in patches first, then blankets the lawn.
  const snowUniform = { value: 0 };
  groundMat.userData.snow = snowUniform;
  // Modulate the repeated tile across the entire ground plane in metre coordinates.
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.uSnow = snowUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLawnMetres;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLawnMetres = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLawnMetres;\nuniform float uSnow;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 p = vLawnMetres;
        float broad = sin(p.x * 0.39 + p.y * 0.16) * sin(p.y * 0.32 - p.x * 0.12);
        float fine = sin(p.x * 1.54 - p.y * 1.12) * sin(p.y * 1.18 + p.x * 0.72);
        float dry = smoothstep(0.20, 0.82, broad + fine * 0.24);
        diffuseColor.rgb *= mix(vec3(0.86, 0.92, 0.88), vec3(1.16, 1.04, 0.82), dry) + fine * 0.065;
        float wide = sin(p.x * 0.083 + p.y * 0.051 + 1.7) * sin(p.y * 0.067 - p.x * 0.029);
        float drift = 0.5 + wide * 0.26 + broad * 0.2 + fine * 0.12;
        float cover = smoothstep(drift - 0.14, drift + 0.14, uSnow * 1.25 - 0.08);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.93, 0.97) * (0.94 + fine * 0.05), cover * 0.94);
      `);
  };
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality.shadows;
  scene.add(ground);

  // East–west road with sidewalks, running in front of the Kenney house
  const { length: streetLen, roadWidth, sidewalkWidth, roadCenterZ } = STREET;
  const roadTex = createRoadTexture(quality);
  roadTex.repeat.set(streetLen / TEXTURE.road.tileMetres, 1);
  if (roadTex.userData?.bumpMap) roadTex.userData.bumpMap.repeat.copy(roadTex.repeat);
  const roadMat = useWorldGrit(new THREE.MeshStandardMaterial({
    map: roadTex,
    bumpMap: roadTex.userData?.bumpMap || null,
    bumpScale: 0.055,
    color: 0xffffff,
    roughness: 0.90,
    metalness: 0
  }), { strength: 0.75, groundGrime: 0 });
  applyRoadAsphaltPbr(roadMat, roadTex, {
    tilesX: 4,
    tilesY: 2,
    anisotropy: quality.shadows ? 8 : 4,
    normalScale: 0.58,
    hiRes: !!quality.shadows
  });
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(streetLen, roadWidth),
    roadMat
  );
  road.name = 'road';
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, SURFACE_Y.road, roadCenterZ);
  road.receiveShadow = quality.shadows;
  scene.add(road);

  const stripeCount = 20;
  const stripe = new THREE.PlaneGeometry(2.2, 0.26);
  stripe.rotateX(-Math.PI / 2);
  const paint = useWorldGrit(new THREE.MeshStandardMaterial({ color: 0xc9c6b6, roughness: 0.92 }), { strength: 1.15, groundGrime: 0 });
  const crossings = new THREE.InstancedMesh(stripe, paint, STREET.crossings.length * stripeCount);
  crossings.name = 'pedestrian-crossings';
  crossings.receiveShadow = quality.shadows;
  const matrix = new THREE.Matrix4();
  let stripeIndex = 0;
  for (const x of STREET.crossings) {
    for (let i = 0; i < stripeCount; i++) {
      const z = roadCenterZ + ((i + 0.5) / stripeCount - 0.5) * roadWidth;
      crossings.setMatrixAt(stripeIndex++, matrix.makeTranslation(x, SURFACE_Y.road + 0.002, z));
    }
  }
  scene.add(crossings);

  const walkTex = createSidewalkTexture(quality);
  // One tile is one pavement slab, so the joints line up with the tile edge.
  walkTex.repeat.set(Math.round(streetLen / TEXTURE.walk.slabMetres), 1);
  if (walkTex.userData?.bumpMap) walkTex.userData.bumpMap.repeat.copy(walkTex.repeat);
  const walkMat = useWorldGrit(new THREE.MeshStandardMaterial({
    map: walkTex,
    bumpMap: walkTex.userData?.bumpMap || null,
    bumpScale: 0.045,
    color: 0xffffff,
    roughness: 0.90,
    metalness: 0
  }), { strength: 0.65, groundGrime: 0 });
  applyPbrSurface(walkMat, 'concrete', {
    repeat: walkTex.repeat,
    anisotropy: quality.shadows ? 4 : 1,
    normalScale: 0.50,
    tint: 0xd8d4c8
  });
  const curbMat = useWorldGrit(new THREE.MeshStandardMaterial({ color: 0x989386, roughness: 0.95 }), { strength: 1.15, groundGrime: 0.32 });
  const halfStreet = streetLen / 2;
  const southEdge = roadCenterZ - roadWidth / 2;
  const northEdge = roadCenterZ + roadWidth / 2;
  const { x: driveX, width: driveWidth, flare, endZ, rampDepth } = DRIVEWAY;
  const left = driveX - driveWidth / 2;
  const right = driveX + driveWidth / 2;
  const cutStart = left - flare;
  const cutEnd = right + flare;

  function paving(name, geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = quality.shadows;
    scene.add(mesh);
    return mesh;
  }

  function curb(name, x0, x1, z) {
    const height = SURFACE_Y.walk - 0.003;
    const mesh = paving(name, new THREE.BoxGeometry(x1 - x0, height, CURB_WIDTH), curbMat);
    mesh.position.set((x0 + x1) / 2, height / 2, z);
  }

  const northWalk = paving('sidewalk-north', new THREE.PlaneGeometry(streetLen, sidewalkWidth), walkMat);
  northWalk.rotation.x = -Math.PI / 2;
  northWalk.position.set(0, SURFACE_Y.walk, northEdge + sidewalkWidth / 2);
  curb('sidewalk-north-curb', -halfStreet, halfStreet, northEdge + CURB_WIDTH / 2);
  curb('sidewalk-south-curb-west', -halfStreet, cutStart, southEdge - CURB_WIDTH / 2);
  curb('sidewalk-south-curb-east', cutEnd, halfStreet, southEdge - CURB_WIDTH / 2);

  // Keep the sidewalk texture continuous across the ramp and its two flares.
  const columns = [-halfStreet, cutStart, left, right, cutEnd, halfStreet];
  const rows = [0, CURB_WIDTH, CURB_WIDTH + rampDepth, sidewalkWidth];
  const positions = [];
  const uv = [];
  const indices = [];
  for (const offset of rows) {
    for (const x of columns) {
      positions.push(x, drivewayWalkHeight(x, offset), southEdge - offset);
      uv.push((x + halfStreet) / streetLen, offset / sidewalkWidth);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let col = 0; col < columns.length - 1; col++) {
      const i = row * columns.length + col;
      const j = i + columns.length;
      if (col === 3) indices.push(i, i + 1, j, i + 1, j + 1, j);
      else indices.push(i, i + 1, j + 1, i, j + 1, j);
    }
  }
  const southWalk = new THREE.BufferGeometry();
  southWalk.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  southWalk.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  southWalk.setIndex(indices);
  southWalk.computeVertexNormals();
  paving('sidewalk-south', southWalk, walkMat);

  const driveStart = southEdge - sidewalkWidth;
  const driveCenter = (driveStart + endZ) / 2;
  const driveway = new THREE.PlaneGeometry(driveWidth, driveStart - endZ);
  driveway.rotateX(-Math.PI / 2);
  driveway.translate(driveX, 0, driveCenter);
  const vertices = driveway.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    vertices.setY(i, vertices.getZ(i) > driveCenter ? SURFACE_Y.walk : SURFACE_Y.road);
  }
  driveway.computeVertexNormals();
  const driveMap = walkTex.clone();
  driveMap.repeat.set(2, 1);
  const driveMat = new THREE.MeshStandardMaterial({
    map: driveMap, color: 0xc3b8a6, roughness: 0.96
  });
  applyPbrSurface(driveMat, 'concrete', {
    repeat: [2, 2],
    anisotropy: quality.shadows ? 4 : 1,
    normalScale: 0.52,
    tint: 0xc9c1b2
  });
  paving('garage-driveway', driveway, driveMat);

  // Player's main house: fallback procedural house + hinged door now, Kenney GLB + interior once loaded.
  const { door } = buildMainHouse(scene, quality);

  // Four generated houses on both sides of the street, facing the road.
  // The Kenney house (above) is the fifth house, on the south side at x=0.
  // Each lot has its own seeded combination of roof, porch, chimney, window
  // layout and extension. Porched houses sit back by the porch depth so the
  // porch front lines up with the other houses and clears the sidewalk.
  // Extensions (garage / wing) face away from the Kenney house so the
  // walking gaps between lots stay open.
  const lots = [
    { name: 'house-sw', x: -13, z: -10.8, rotY: 0, width: 7.5, depth: 9, height: 3.5, roofType: 'gable', wallColor: HOUSE.lots[0].wall, roofColor: HOUSE.lots[0].roof, windowCount: 4,
      seed: 11, windowLayout: 'shutters', chimney: true, porch: { depth: 1.4, width: 3.2, roof: 'shed' } },
    { name: 'house-se', x: GARAGE_LOT.x, z: GARAGE_LOT.z, rotY: 0, width: GARAGE_LOT.width, depth: GARAGE_LOT.depth, height: 3.8, roofType: 'hip', wallColor: HOUSE.lots[1].wall, roofColor: HOUSE.lots[1].roof, windowCount: 3,
      seed: 22, windowLayout: 'bay', extension: { side: 1, type: 'garage', width: GARAGE_LOT.garageWidth } },
    { name: 'house-nw', x: -13, z: 6.85 + NORTH_FRONTAGE_OFFSET, rotY: Math.PI, width: 7.5, depth: 8.7, height: 3.6, roofType: 'shed', wallColor: HOUSE.lots[2].wall, roofColor: HOUSE.lots[2].roof, windowCount: 3,
      seed: 33, windowLayout: 'ribbon', chimney: true, extension: { side: 1, type: 'wing', width: 3.0 } },
    { name: 'house-ne', x: 13.2, z: 8.3 + NORTH_FRONTAGE_OFFSET, rotY: Math.PI, width: 7.8, depth: 9, height: 3.7, roofType: 'gable', wallColor: HOUSE.lots[3].wall, roofColor: HOUSE.lots[3].roof, windowCount: 4,
      seed: 44, windowLayout: 'grid', chimney: true, porch: { depth: 1.2, width: 3.0, roof: 'gable' } }
  ];
  const streetHouses = lots.map((lot) => {
    const h = generateHouse({
      width: lot.width,
      depth: lot.depth,
      height: lot.height,
      roofType: lot.roofType,
      wallColor: lot.wallColor,
      roofColor: lot.roofColor,
      windowCount: lot.windowCount,
      hasDoor: true,
      shadows: quality.shadows,
      merge: true,
      seed: lot.seed,
      windowLayout: lot.windowLayout,
      porch: lot.porch,
      chimney: lot.chimney,
      extension: lot.extension
    });
    h.name = lot.name;
    h.position.set(lot.x, 0, lot.z);
    h.rotation.y = lot.rotY;
    scene.add(h);
    colliders.addHouse({
      id: lot.name,
      x: lot.x,
      z: lot.z,
      width: lot.width,
      depth: lot.depth,
      rotY: lot.rotY
    });
    // Extension / bay boxes and porch-post circles. The porch deck itself
    // has no collider, so it stays walkable.
    const extra = getHouseColliders(h, { x: lot.x, z: lot.z, rotY: lot.rotY, id: lot.name });
    extra.boxes.forEach((b) => colliders.addHouse(b));
    extra.posts.forEach((p) => colliders.addTree(p));
    if (h.userData.door) h.userData.door.userData.doorId = lot.name;
    return h;
  });
  scene.userData.streetHouses = streetHouses;

  // Worn footpaths join the front of each lot to the nearest sidewalk.
  const patches = [];
  const plantings = [];
  for (const lot of lots) {
    const facing = lot.rotY === 0 ? 1 : -1;
    const edge = roadCenterZ - facing * (roadWidth / 2 + sidewalkWidth);
    const porch = lot.z + facing * (lot.depth / 2 + (lot.porch?.depth ?? 0));
    const length = (edge - porch) * facing;
    if (length < 0.25) continue;
    patches.push({
      kind: 'rect', x: lot.x, z: (porch + edge) / 2, y: 0,
      w: 0.56, d: length, margin: 0.27, strength: 0.82
    });
    if (lot.porch) {
      const z = porch + facing * Math.min(0.45, length * 0.45);
      for (const side of [-1, 1]) {
        const x = lot.x + side * (lot.porch.width / 2 + 0.35);
        plantings.push({ x, z, side });
        patches.push({ x, z, y: 0, rx: 0.44, rz: 0.31, strength: 0.58 });
      }
    }
  }
  const soilGeometry = buildContactGeometry(patches);
  const soilColors = soilGeometry.attributes.color;
  for (let i = 0; i < soilColors.count; i++) soilColors.setXYZ(i, 1, 1, 1);
  const soilMaterial = new THREE.MeshStandardMaterial({
    color: 0x756747, roughness: 1, alphaMap: contactMaterial().alphaMap,
    vertexColors: true, transparent: true, depthWrite: false
  });
  const soil = new THREE.Mesh(soilGeometry, soilMaterial);
  soil.name = 'worn-lawn-paths';
  soil.receiveShadow = quality.shadows;
  scene.add(soil);

  const shrubs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.92 }),
    plantings.length * 5
  );
  const plant = new THREE.Object3D();
  const leafColor = new THREE.Color();
  let foliage = 0;
  for (const { x, z, side } of plantings) {
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4 + side;
      plant.position.set(x + Math.cos(angle) * 0.19, 0.15 + i * 0.014, z + Math.sin(angle) * 0.14);
      plant.scale.set(0.18 - i * 0.008, 0.19 - i * 0.008, 0.15);
      plant.rotation.y = angle;
      plant.updateMatrix();
      shrubs.setMatrixAt(foliage, plant.matrix);
      shrubs.setColorAt(foliage++, leafColor.setHex([0x435c3a, 0x60734a, 0x526c46, 0x3f5736, 0x69794f][i]));
    }
  }
  shrubs.name = 'porch-shrubs';
  shrubs.castShadow = quality.shadows;
  shrubs.receiveShadow = quality.shadows;
  scene.add(shrubs);

  // Lighting: a sky/ground hemisphere, a soft ambient and a warm sun, all
  // starting from the 10:00 key (daynight.js then takes over).
  const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, look.hemiInt);
  hemi.name = 'hemi';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(look.ambient, look.ambientInt);
  ambient.name = 'ambient';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(look.sun, look.sunInt);
  sun.name = 'sun';
  sun.position.set(look.sunPos[0], look.sunPos[1], look.sunPos[2]);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    // Desktop only. 2048 over ±38 m is ~3.7 cm a texel (was 1024 over ±44 m),
    // which tightens the contact shadows under the rounded props and eaves.
    // PCFSoft + tuned bias / normalBias keep it soft without acne or floating
    // shadows; contact blobs (contact.js) add the soft foot shadow on top.
    const sh = LOOK.shadow;
    sun.shadow.radius = sh.radius;
    sun.shadow.mapSize.width = sh.mapSize;
    sun.shadow.mapSize.height = sh.mapSize;
    sun.shadow.camera.near = sh.near;
    sun.shadow.camera.far = sh.far;
    sun.shadow.camera.left = -sh.extent;
    sun.shadow.camera.right = sh.extent;
    sun.shadow.camera.top = sh.extent;
    sun.shadow.camera.bottom = -sh.extent;
    sun.shadow.bias = sh.bias;
    sun.shadow.normalBias = sh.normalBias;
  }
  scene.add(sun);
  scene.add(sun.target);

  const parkTrees = [
    { x: 65.5, z: 19.5, seed: 81, scale: 0.83 },
    { x: 67.5, z: 42.5, seed: 45, scale: 1.06 },
    { x: 65, z: 34, seed: 68, scale: 0.78 },
    { x: 65.1, z: 38.6, seed: 23, scale: 0.88 },
    { x: 68.8, z: 36.5, seed: 84, scale: 0.73 },
    { x: 77, z: 44, seed: 36, scale: 0.84 },
    { x: 100.5, z: 43, seed: 72, scale: 0.94 }
  ];
  const trees = scatterTrees(scene, [...TREE_PLACEMENTS, ...parkTrees], quality);
  replaceTownTrees(trees, [...TREE_PLACEMENTS, ...parkTrees]);
  scene.userData.trees = trees;
  trees.forEach((tree, i) => {
    colliders.addTree({
      id: `tree-${i}`,
      x: tree.position.x,
      z: tree.position.z,
      radius: tree.userData.trunkRadius
    });
  });

  // Parked car on the north side of the road, east of spawn, clear of the
  // Kenney walking path (x=0) and of the neighbour lots / door approaches.
  const car = createPlayerPickup({ shadows: quality.shadows });
  car.position.set(CAR_SPAWN.x, 0, CAR_SPAWN.z);
  scene.add(car);
  colliders.addHouse({
    id: 'parked-car',
    x: car.position.x,
    z: car.position.z,
    width: car.userData.size.width,
    depth: car.userData.size.depth,
    rotY: car.rotation.y
  });
  scene.userData.prop = car;

  const doors = [door, ...streetHouses.map((h) => h.userData.door).filter(Boolean)];
  scene.userData.door = door;
  scene.userData.doors = doors;
  // The shared light pool (lightPool.js) is switched off: it relit only the few
  // lamps nearest the player, so lighting jumped around while walking. Every
  // building falls back to its own fixed lights. Set USE_LIGHT_POOL to try it again.
  const USE_LIGHT_POOL = false;
  scene.userData.lightPool = USE_LIGHT_POOL ? createLightPool({
    scene,
    quality,
    PointLight: THREE.PointLight,
    SpotLight: THREE.SpotLight
  }) : null;
  scene.userData.streetlights = buildStreetlights(scene, quality);
  scene.userData.street = STREET;
  scene.userData.spawn = STREET.spawn;

  // Pickups live in one group so adding the snack later (after the interior
  // loads) does not change the scene's top-level child count.
  const pickups = new THREE.Group();
  pickups.name = 'pickups';
  scene.add(pickups);
  scene.userData.pickups = pickups;
  scene.userData.interactables = [];
  buildCornerShop(scene, quality);
  buildLaundromat(scene, quality);
  buildClinic(scene, quality);
  buildGasStation(scene, quality);
  buildApproachRoad(scene, quality, road.material);
  scene.userData.park = buildPark(scene, quality, { road: road.material, walk: walkMat, curb: curbMat });
  buildTrailerPark(scene, quality);
  buildPostOffice(scene, quality);
  scene.userData.world = createWorldState(scene);

  const mailbox = createMailbox({ shadows: quality.shadows });
  mailbox.position.set(MAILBOX_SPAWN.x, 0, MAILBOX_SPAWN.z);
  pickups.add(mailbox);
  mailbox.updateMatrixWorld(true);
  const mailboxPoint = mailbox.localToWorld(mailbox.userData.interactLocal.clone());
  colliders.addHouse(mailboxCollider(mailbox));
  scene.userData.interactables.push({
    id: 'mailbox',
    kind: 'mailbox',
    object: mailbox,
    range: 1.65,
    getPoint: () => mailboxPoint
  });
  scene.userData.mailbox = mailbox;

  const vending = createVendingMachine({ shadows: quality.shadows });
  vending.position.set(VENDING_SPAWN.x, 0, VENDING_SPAWN.z);
  pickups.add(vending);
  vending.updateMatrixWorld(true);
  const vendingPoint = vending.localToWorld(vending.userData.interactLocal.clone());
  colliders.addHouse(vendingCollider(vending));
  scene.userData.interactables.push({
    id: 'vending',
    kind: 'vending',
    object: vending,
    range: 1.65,
    getPoint: () => vendingPoint
  });
  scene.userData.vending = vending;

  // Fake ambient occlusion: soft blobs under the trees, houses, car and props,
  // merged into ONE mesh (one draw call, no light, no shadow caster). It sits
  // on whatever surface is underneath (grass, road or pavement).
  const surfaceY = surfaceHeightAt;
  const contactItems = [];
  trees.forEach((tree) => {
    const r = tree.userData.radius || 1.2;
    contactItems.push({ kind: 'blob', x: tree.position.x, z: tree.position.z, y: 0, rx: r * 1.15, rz: r * 1.15, strength: 0.69 });
    contactItems.push({ kind: 'blob', x: tree.position.x, z: tree.position.z, y: 0, rx: tree.userData.trunkRadius * 3.4, rz: tree.userData.trunkRadius * 3.4, strength: 0.9 });
  });
  lots.forEach((lot, i) => {
    const b = getHouseBounds(streetHouses[i], { x: lot.x, z: lot.z, rotY: lot.rotY });
    if (!b) return;
    const fp = streetHouses[i].userData.footprint.bounds;
    const lcx = (fp.minX + fp.maxX) / 2;
    const lcz = (fp.minZ + fp.maxZ) / 2;
    const cos = Math.cos(lot.rotY);
    const sin = Math.sin(lot.rotY);
    contactItems.push({
      kind: 'rect',
      x: lot.x + lcx * cos + lcz * sin,
      z: lot.z - lcx * sin + lcz * cos,
      y: 0, w: fp.maxX - fp.minX, d: fp.maxZ - fp.minZ, margin: 0.85, rot: lot.rotY, strength: 0.7
    });
  });
  // The main house (the placeholder and the Kenney model share this footprint).
  contactItems.push({ kind: 'rect', x: 0, z: -10, y: 0, w: 8.9, d: 9.4, margin: 0.9, strength: 0.7 });
  contactItems.push({ kind: 'blob', x: MAILBOX_SPAWN.x, z: MAILBOX_SPAWN.z, y: surfaceY(MAILBOX_SPAWN.x, MAILBOX_SPAWN.z), rx: 0.34, rz: 0.34, strength: 0.8 });
  contactItems.push({ kind: 'blob', x: VENDING_SPAWN.x, z: VENDING_SPAWN.z, y: surfaceY(VENDING_SPAWN.x, VENDING_SPAWN.z), rx: 0.62, rz: 0.55, strength: 0.85 });
  const contact = createContactShadows(contactItems, quality);
  scene.add(contact);
  scene.userData.contactShadows = contact;

  // Dynamic contact shadow attached to the car so it moves and turns with the car.
  const carShadow = createContactBlob({
    kind: 'rect',
    w: car.userData.size.width - 0.5,
    d: car.userData.size.depth - 0.2,
    margin: 0.4,
    y: 0,
    strength: 0.85
  }, quality);
  carShadow.name = 'car-contact-shadow';
  carShadow.position.y = Math.max(SURFACE_Y.road, surfaceY(car.position.x, car.position.z));
  car.add(carShadow);
  car.userData.contactShadow = carShadow;

  // Environmental polish: valley horizon hills, utility poles/power lines & street clutter, dust/fireflies, 3D foliage.
  scene.userData.valleyHorizon = buildValleyHorizon(scene, quality);
  scene.userData.streetDetails = buildStreetDetails(scene, quality);
  scene.userData.ambientParticles = createAmbientParticles(scene, quality);
  scene.userData.groundFoliage = buildGroundFoliage(scene, quality);
  scene.userData.livingWorld = buildLivingWorld(scene, quality);
  scene.userData.valleyGraphics = buildValleyGraphics(scene, quality);
  scene.userData.traffic = buildTownTraffic(scene, quality);

  return scene;
}
