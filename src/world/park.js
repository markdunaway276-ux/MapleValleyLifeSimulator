import * as THREE from 'three';
import { Parts } from './parts.js';
import { CURB_WIDTH, STREET, SURFACE_Y } from './street.js';

function createWoodChipMaterial(quality) {
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({ color: 0x8a6140, roughness: 0.94, metalness: 0 });
  }
  const size = quality?.shadows ? 512 : 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  // Deep earthy mulch underlayer.
  ctx.fillStyle = '#4e3522';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#242424';
  bctx.fillRect(0, 0, size, size);

  let seed = 918273;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const tones = ['#7d5535', '#966943', '#ab7c51', '#69472c', '#b78b5e', '#865d3b', '#5d3e26'];
  const count = quality?.shadows ? 1400 : 750;
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = (size / 64) * (1.2 + rand() * 2.2);
    const h = (size / 64) * (0.45 + rand() * 0.85);
    const rot = rand() * Math.PI * 2;
    const tone = tones[Math.floor(rand() * tones.length)];
    const lum = Math.round(95 + rand() * 145);
    // Tile cleanly across edges.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox;
        const py = y + oy;
        if (px < -w * 2 || px > size + w * 2 || py < -w * 2 || py > size + w * 2) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillStyle = 'rgba(28, 17, 10, 0.35)';
        ctx.fillRect(-w / 2 + 1.2, -h / 2 + 1.2, w, h);
        ctx.fillStyle = tone;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        // Subtle wood-grain highlight along the chip.
        ctx.fillStyle = 'rgba(255, 232, 198, 0.14)';
        ctx.fillRect(-w / 2, -h / 2, w, Math.max(1, h * 0.28));
        ctx.restore();

        bctx.save();
        bctx.translate(px, py);
        bctx.rotate(rot);
        bctx.fillStyle = `rgb(${lum},${lum},${lum})`;
        bctx.fillRect(-w / 2, -h / 2, w, h);
        bctx.restore();
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 4.5);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = quality?.shadows ? 4 : 2;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 4.5);

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.048,
    roughness: 0.93,
    metalness: 0
  });
}

export function buildPark(scene, quality, streetMaterials) {
  const layout = STREET.expansion;
  const park = new THREE.Group();
  park.name = 'maple-lane-park';
  scene.add(park);

  function surface(name, rect, y, finish, { turn = false, span = 1, phase = 0 } = {}) {
    const width = rect.maxX - rect.minX;
    const depth = rect.maxZ - rect.minZ;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, phase + (turn ? v : u) * span, turn ? u : v);
    }
    const material = finish.isMaterial ? finish : new THREE.MeshStandardMaterial({ color: finish, roughness: 0.94 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
    mesh.receiveShadow = quality.shadows;
    park.add(mesh);
  }

  for (const [index, road] of layout.roads.entries()) {
    const turn = index === 1 || index === 2;
    const length = turn ? road.maxZ - road.minZ : road.maxX - road.minX;
    surface('service-road', road, SURFACE_Y.road, streetMaterials.road, {
      turn, span: length / STREET.length, phase: index === 0 ? 1 : 0
    });
  }
  for (const [index, path] of layout.paths.entries()) {
    if (index === 3) continue; // Deck spans the water.
    const turn = index === 2 || index === 5;
    const length = turn ? path.maxZ - path.minZ : path.maxX - path.minX;
    surface('park-path', path, SURFACE_Y.walk, index < 2 ? streetMaterials.walk : 0xb9a48a, {
      turn, span: length / STREET.length, phase: index === 0 ? 1 : 0
    });
  }

  const southWalk = layout.southSidewalk;
  surface('park-south-sidewalk', southWalk, SURFACE_Y.walk, streetMaterials.walk, {
    span: (southWalk.maxX - southWalk.minX) / STREET.length, phase: 1
  });

  const firstRoad = layout.roads[0];
  const westRoad = layout.roads[1];
  const eastRoad = layout.roads[2];
  const backRoad = layout.roads[3];
  function curb(x, z, width, depth) {
    const height = SURFACE_Y.walk - 0.003;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), streetMaterials.curb);
    mesh.position.set(x, height / 2, z);
    mesh.receiveShadow = quality.shadows;
    park.add(mesh);
  }
  const halfCurb = CURB_WIDTH / 2;
  curb((firstRoad.minX + firstRoad.maxX) / 2, firstRoad.minZ - halfCurb,
    firstRoad.maxX - firstRoad.minX, CURB_WIDTH);
  for (const [start, end] of [[firstRoad.minX, westRoad.minX], [westRoad.maxX, eastRoad.minX]]) {
    curb((start + end) / 2, firstRoad.maxZ + halfCurb, end - start, CURB_WIDTH);
  }
  curb((backRoad.minX + backRoad.maxX) / 2, backRoad.maxZ + halfCurb,
    backRoad.maxX - backRoad.minX, CURB_WIDTH);
  for (const x of [westRoad.minX - halfCurb, eastRoad.maxX + halfCurb]) {
    curb(x, (westRoad.minZ + backRoad.maxZ) / 2, CURB_WIDTH, backRoad.maxZ - westRoad.minZ);
  }
  for (const trail of layout.gravel) surface('wooded-gravel-trail', trail, 0.004, 0x9e947e);
  buildPond(park, scene.userData.colliders, quality);
  surface('entrance-plaza', layout.plaza, SURFACE_Y.walk + 0.002, 0xbcb6a6);
  surface('playground-mulch', layout.playground, SURFACE_Y.walk, createWoodChipMaterial(quality));
  surface('basketball-asphalt', layout.court, SURFACE_Y.walk, 0x505651);
  surface('court-approach', layout.courtWalk, SURFACE_Y.walk, 0xbcb6a6);
  surface('picnic-walk', layout.picnicWalk, SURFACE_Y.walk, 0xb8a990);
  const { minX, maxX, minZ, maxZ } = layout.crossing;
  for (let x = minX + 0.35; x < maxX - 0.35; x += 0.65) {
    surface('service-road-crossing', { minX: x, maxX: x + 0.3, minZ, maxZ }, SURFACE_Y.road + 0.002, 0xd8d6c7);
  }
  return buildActivityArea(park, scene.userData.colliders, quality);
}

function buildPond(park, colliders, quality) {
  const { pond, paths } = STREET.expansion;
  const bridge = paths[3];
  const centerX = (pond.minX + pond.maxX) / 2;
  const centerZ = (pond.minZ + pond.maxZ) / 2;
  const radiusX = (pond.maxX - pond.minX) / 2;
  const radiusZ = (pond.maxZ - pond.minZ) / 2;
  const shore = new THREE.Mesh(new THREE.CircleGeometry(1, 64),
    new THREE.MeshStandardMaterial({ color: 0x777460, roughness: 0.99 }));
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(radiusX, radiusZ, 1);
  shore.position.set(centerX, 0.005, centerZ);
  shore.receiveShadow = quality.shadows;
  park.add(shore);

  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x406d69, roughness: 0.34, metalness: 0.15 });
  waterMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPondPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPondPosition = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPondPosition;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 pondPoint = vPondPosition;
        float ripples = sin(pondPoint.y * 74.0 + sin(pondPoint.x * 23.0) * 2.0);
        float rim = smoothstep(0.62, 1.0, length(pondPoint));
        diffuseColor.rgb *= 0.88 + rim * 0.34 + ripples * 0.07;`);
  };
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), waterMaterial);
  water.name = 'park-pond-water';
  water.rotation.x = -Math.PI / 2;
  water.scale.set(radiusX - 0.43, radiusZ - 0.47, 1);
  water.position.set(centerX, 0.012, centerZ);
  park.add(water);

  const parts = new Parts(true);
  const deck = SURFACE_Y.walk;
  const bridgeWidth = bridge.maxZ - bridge.minZ;
  for (let x = bridge.minX + 0.14; x < bridge.maxX; x += 0.28) {
    parts.box(Math.floor(x * 10) % 3 === 0 ? 0x927052 : 0xa17d5c, 0.27, 0.087, bridgeWidth,
      x, deck - 0.044, (bridge.minZ + bridge.maxZ) / 2);
  }
  for (const z of [bridge.minZ + 0.06, bridge.maxZ - 0.06]) {
    for (let x = bridge.minX + 0.4; x < bridge.maxX; x += 2.6) {
      parts.box(0x66503d, 0.13, 1.12, 0.13, x, deck + 0.51, z);
    }
    for (const y of [0.43, 0.98]) {
      parts.box(0x705743, bridge.maxX - bridge.minX, 0.095, 0.115, centerX, deck + y, z);
    }
    colliders.addHouse({ id: 'park-bridge-rail-' + z, x: centerX, z, width: bridge.maxX - bridge.minX,
      depth: 0.13, rotY: 0 });
  }

  // Shore obstacles follow the waterline, with openings at each end of the bridge.
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI / 24;
    const x = centerX + Math.cos(angle) * (radiusX - 0.48);
    const z = centerZ + Math.sin(angle) * (radiusZ - 0.48);
    if (z >= bridge.minZ - 0.48 && z <= bridge.maxZ + 0.48) continue;
    colliders.addTree({ id: 'park-pond-bank-' + i, x, z, radius: 0.68 });
    parts.cylinder(i % 2 ? 0x78776d : 0x8c826f, 0.31, 0.62, 0.15 + (i % 3) * 0.08,
      x, 0.08, z, 0, angle, 0, 6);
    if (i % 3 === 0) {
      for (let reed = -1; reed <= 1; reed++) {
        parts.cylinder(0x747b40, 0.012, 0.027, 0.56, x + reed * 0.16, 0.29, z, 0, 0, reed * 0.16, 5);
      }
    }
  }
  const details = new THREE.Mesh(parts.merge(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.91 }));
  details.name = 'park-footbridge-and-bank';
  details.castShadow = details.receiveShadow = !!quality.shadows;
  park.add(details);
}

function buildActivityArea(park, colliders, quality) {
  const parts = new Parts(true);
  const metal = 0x35413d;
  const wood = 0x986341;
  const cream = 0xe2d9be;
  const red = 0xa44734;
  const ground = SURFACE_Y.walk;
  function box(color, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    parts.box(color, w, h, d, x, ground + y, z, rx, ry, rz);
  }
  function post(x, z, height, color = metal, width = 0.12) {
    box(color, width, height, width, x, height / 2, z);
  }
  function obstacle(id, x, z, width, depth) {
    colliders.addHouse({ id: 'park-' + id, x, z, width, depth, rotY: 0 });
  }

  // Scored concrete and a trailhead sign at the market-side entrance.
  const plaza = STREET.expansion.plaza;
  for (let x = plaza.minX + 1.5; x < plaza.maxX; x += 1.5) {
    box(0x918c80, 0.018, 0.005, 18 - plaza.minZ, x, 0.005, (18 + plaza.minZ) / 2);
  }
  for (let z = plaza.minZ + 1.5; z < 18; z += 1.5) {
    box(0x918c80, 17, 0.005, 0.018, 74.5, 0.005, z);
  }
  post(67, 17, 2.15);
  post(69, 17, 2.15);
  box(metal, 2.22, 0.72, 0.15, 68, 1.76, 17);
  obstacle('sign', 68, 17, 2.22, 0.18);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#284339';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#cfbd89';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 140);
  ctx.fillStyle = '#f5ecd5';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Georgia';
  ctx.fillText('MAPLE LANE PARK', 256, 75);
  ctx.font = '22px sans-serif';
  ctx.fillText('PLAYGROUND  •  PICNIC AREA', 256, 114);
  const signTexture = new THREE.CanvasTexture(canvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.13, 0.65), new THREE.MeshStandardMaterial({ map: signTexture }));
  sign.rotation.y = Math.PI;
  sign.position.set(68, ground + 1.76, 16.918);
  park.add(sign);

  // --- Playground: galvanized steel & molded plastic tower, slide, swingset, seesaw, and 3D wood chips ---
  const swingPivots = buildPlaygroundEquipment(park, colliders, quality, ground);

  // Painted half court, clear access from the south and a rear ball-stop fence.
  box(0x687968, 4.2, 0.003, 3.6, 99.5, 0.003, 20);
  for (const z of [15.05, 24.95]) box(cream, 15.8, 0.005, 0.065, 93.5, 0.005, z);
  for (const x of [85.6, 101.4]) box(cream, 0.065, 0.005, 9.9, x, 0.005, 20);
  for (const z of [18.2, 21.8]) box(cream, 4.2, 0.005, 0.06, 99.3, 0.005, z);
  box(cream, 0.06, 0.005, 3.6, 97.2, 0.005, 20);
  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI / 2 + (i + 0.5) * Math.PI / 16;
    box(cream, 0.31, 0.005, 0.06, 97.2 - 1.5 * Math.cos(angle), 0.005,
      20 + 1.5 * Math.sin(angle), 0, -Math.PI / 2 + angle);
  }
  post(101.25, 20, 3.5, metal, 0.18);
  box(metal, 0.93, 0.1, 0.11, 100.83, 3.38, 20);
  box(cream, 0.1, 0.96, 1.65, 100.37, 3.42, 20);
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    box(red, 0.098, 0.035, 0.035, 100.05 + 0.23 * Math.cos(angle), 3.05,
      20 + 0.23 * Math.sin(angle), 0, Math.PI / 2 - angle);
  }
  obstacle('hoop', 101.25, 20, 0.2, 0.2);
  for (let z = 15; z <= 25; z += 2) post(101.85, z, 2.4);
  for (let z = 15.2; z < 25; z += 0.24) box(metal, 0.024, 2.2, 0.024, 101.85, 1.15, z);
  for (const y of [0.19, 1.2, 2.29]) box(metal, 0.055, 0.045, 10, 101.85, y, 20);
  obstacle('court-fence', 101.85, 20, 0.13, 10.1);

  for (const z of [30, 37]) {
    for (const x of [96.2, 99.8]) for (const offset of [-1.65, 1.65]) {
      post(x, z + offset, 2.6, wood, 0.17);
      obstacle('shelter-' + x + '-' + (z + offset), x, z + offset, 0.2, 0.2);
    }
    for (const side of [-1, 1]) {
      box(0x43574c, 2.38, 0.15, 4.15, 98 + side * 1.12, 2.78, z, 0, 0, -side * 0.27);
      box(wood, 1.9, 0.09, 0.28, 98, 0.47, z + side * 0.63);
      box(metal, 0.09, 0.47, 1.54, 98 + side * 0.69, 0.235, z);
    }
    box(wood, 2, 0.09, 0.76, 98, 0.78, z);
    obstacle('picnic-table-' + z, 98, z, 2, 1.54);
  }

  for (const [x, z] of [[80, 16.6], [81, 40.7], [90, 40.7]]) {
    const base = z > 40 ? -ground : 0;
    for (const offset of [-0.66, 0.66]) box(metal, 0.08, 0.47, 0.45, x + offset, base + 0.24, z);
    for (const offset of [-0.14, 0, 0.14]) box(wood, 1.8, 0.055, 0.12, x, base + 0.49, z + offset);
    for (const y of [0.71, 0.85]) box(wood, 1.8, 0.105, 0.055, x, base + y, z + 0.21);
    obstacle('bench-' + x, x, z, 1.8, 0.5);
  }

  for (const x of [66.35, 82.65]) {
    box(0x6d5241, 0.52, 0.12, 2.05, x, 0.06, 16.15);
    for (const offset of [-0.66, 0, 0.66]) {
      parts.cylinder(0x506640, 0.16, 0.26, 0.33, x, ground + 0.26, 16.15 + offset);
      parts.cylinder(0x768650, 0.08, 0.18, 0.23, x + 0.07, ground + 0.4, 16.15 + offset);
    }
    obstacle('planter-' + x, x, 16.15, 0.52, 2.05);
  }

  // Low, warm light around the entrance and first path junction.
  const lights = [];
  const lenses = new THREE.MeshStandardMaterial({ color: 0xe5d9b7, emissive: 0xffd397, emissiveIntensity: 0 });
  for (const [x, z] of [[69.25, 14.25], [73.5, 17.5], [72.8, 29.6]]) {
    post(x, z, 2.9, metal, 0.11);
    box(metal, 0.38, 0.075, 0.38, x, 2.89, z);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.075, 0.28), lenses);
    lens.position.set(x, ground + 2.82, z);
    const light = new THREE.PointLight(0xffd7a0, 0, 7);
    light.position.set(x, ground + 2.72, z);
    lights.push(light);
    park.add(lens, light);
    obstacle('lamp-' + x, x, z, 0.18, 0.18);
  }
  const fixtures = new THREE.Mesh(parts.merge(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }));
  fixtures.castShadow = fixtures.receiveShadow = !!quality.shadows;
  park.add(fixtures);
  let swayClock = 0;
  return {
    update(minutes) {
      swayClock += 0.016;
      const dusk = THREE.MathUtils.smoothstep(minutes, 1100, 1160);
      const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 335, 395);
      for (const [index, light] of lights.entries()) light.intensity = (index === 2 ? 12 : 20) * (dusk + dawn);
      lenses.emissiveIntensity = dusk + dawn;
      // Gentle breeze sway on the hanging swing seats.
      for (let i = 0; i < swingPivots.length; i++) {
        swingPivots[i].rotation.x = Math.sin(swayClock * 1.35 + i * 2.1) * 0.045;
      }
    }
  };
}

function buildPlaygroundEquipment(park, colliders, quality, ground) {
  const group = new THREE.Group();
  group.name = 'playground-equipment';
  park.add(group);
  const cast = !!quality?.shadows;

  // Distinct realistic materials: galvanized steel, powder-coated metal, glossy molded plastic, flexible rubber, timber.
  const galvanizedSteel = new THREE.MeshStandardMaterial({ color: 0x9aa4ac, metalness: 0.80, roughness: 0.28 });
  const chainMetal = new THREE.MeshStandardMaterial({ color: 0xbac4cc, metalness: 0.86, roughness: 0.24 });
  const greenPowderMetal = new THREE.MeshStandardMaterial({ color: 0x2f5a47, metalness: 0.46, roughness: 0.30 });
  const redPowderMetal = new THREE.MeshStandardMaterial({ color: 0xa93629, metalness: 0.44, roughness: 0.30 });
  const yellowPlastic = new THREE.MeshStandardMaterial({ color: 0xdca024, metalness: 0.04, roughness: 0.22 });
  const redPlastic = new THREE.MeshStandardMaterial({ color: 0xb8382a, metalness: 0.04, roughness: 0.24 });
  const rubberSeatMat = new THREE.MeshStandardMaterial({ color: 0x1e2228, metalness: 0.05, roughness: 0.46 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x7c5536, metalness: 0.0, roughness: 0.90 });

  function addMesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = group) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = cast;
    m.receiveShadow = cast;
    parent.add(m);
    return m;
  }
  function obstacle(id, x, z, width, depth) {
    colliders.addHouse({ id: 'park-' + id, x, z, width, depth, rotY: 0 });
  }

  // --- 1. Timber playground border & 3D scattered wood chips ---
  const pg = STREET.expansion.playground;
  const borderH = 0.13;
  const borderY = ground + borderH / 2 - 0.02;
  addMesh(new THREE.BoxGeometry(pg.maxX - pg.minX, borderH, 0.14), timberMat, (pg.minX + pg.maxX) / 2, borderY, pg.minZ + 0.07);
  addMesh(new THREE.BoxGeometry(pg.maxX - pg.minX, borderH, 0.14), timberMat, (pg.minX + pg.maxX) / 2, borderY, pg.maxZ - 0.07);
  addMesh(new THREE.BoxGeometry(0.14, borderH, pg.maxZ - pg.minZ), timberMat, pg.maxX - 0.07, borderY, (pg.minZ + pg.maxZ) / 2);
  addMesh(new THREE.BoxGeometry(0.14, borderH, pg.maxZ - pg.minZ), timberMat, pg.minX + 0.07, borderY, (pg.minZ + pg.maxZ) / 2);

  // Scattered 3D wood chips across the mulch bed for tactile surface depth.
  const chipCount = quality?.shadows ? 180 : 90;
  const chipGeo = new THREE.BoxGeometry(0.085, 0.012, 0.036);
  const chipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const chips = new THREE.InstancedMesh(chipGeo, chipMat, chipCount);
  chips.name = 'playground-wood-chips-3d';
  chips.receiveShadow = cast;
  let chipSeed = 4219;
  const chipRand = () => ((chipSeed = (Math.imul(chipSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const chipColors = [0x8b603c, 0xa2744a, 0x704b2d, 0xb2865a, 0x644329];
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  for (let i = 0; i < chipCount; i++) {
    const cx = pg.minX + 0.25 + chipRand() * (pg.maxX - pg.minX - 0.5);
    const cz = pg.minZ + 0.25 + chipRand() * (pg.maxZ - pg.minZ - 0.5);
    dummy.position.set(cx, ground + 0.008 + chipRand() * 0.006, cz);
    dummy.rotation.set((chipRand() - 0.5) * 0.35, chipRand() * Math.PI * 2, (chipRand() - 0.5) * 0.35);
    dummy.scale.set(0.7 + chipRand() * 0.8, 0.8 + chipRand() * 0.6, 0.7 + chipRand() * 0.7);
    dummy.updateMatrix();
    chips.setMatrixAt(i, dummy.matrix);
    cTmp.setHex(chipColors[Math.floor(chipRand() * chipColors.length)]);
    chips.setColorAt(i, cTmp);
  }
  chips.instanceMatrix.needsUpdate = true;
  if (chips.instanceColor) chips.instanceColor.needsUpdate = true;
  group.add(chips);

  // --- 2. Real Metal & Plastic Swingset ---
  const swingZ = 22.25;
  const barY = ground + 2.38;
  const legGeo = new THREE.CylinderGeometry(0.044, 0.048, 2.58, 10);
  const collarGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.16, 10);
  for (const x of [79.8, 83.0]) {
    for (const side of [-1, 1]) {
      addMesh(legGeo, galvanizedSteel, x, ground + 1.20, swingZ + side * 0.44, -side * 0.34);
    }
    // Cast apex bracket where A-frame meets the top crossbar.
    addMesh(collarGeo, redPowderMetal, x, barY, swingZ, 0, 0, Math.PI / 2);
    obstacle('swing-frame-' + x, x, swingZ, 0.18, 1.75);
  }
  // Glossy powder-coated tubular top crossbar.
  addMesh(new THREE.CylinderGeometry(0.052, 0.052, 3.46, 12), redPowderMetal, 81.4, barY, swingZ, 0, 0, Math.PI / 2);

  // Two realistic hanging swings with linked metal chains, plastic grip sleeves, and curved rubber sling seats.
  const swingPivots = [];
  const linkGeo = new THREE.TorusGeometry(0.015, 0.0045, 6, 10);
  const sleeveGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.48, 8);
  const shackleGeo = new THREE.TorusGeometry(0.032, 0.008, 6, 10);

  for (const sx of [80.65, 82.15]) {
    const pivot = new THREE.Group();
    pivot.name = 'playground-swing-pivot';
    pivot.position.set(sx, barY, swingZ);
    group.add(pivot);
    swingPivots.push(pivot);

    for (const side of [-1, 1]) {
      const lx = side * 0.23;
      // Steel clevis ring clamped around the crossbar.
      addMesh(shackleGeo, galvanizedSteel, lx, 0, 0, 0, Math.PI / 2, 0, pivot);
      // Alternating linked metal chain down to the yellow plastic grip sleeve.
      for (let k = 0; k < 22; k++) {
        addMesh(linkGeo, chainMetal, lx, -0.08 - k * 0.056, 0, 0, (k % 2) * (Math.PI / 2), 0, pivot);
      }
      // Molded yellow plastic safety grip sleeve on the lower chain.
      addMesh(sleeveGeo, yellowPlastic, lx, -1.52, 0, 0, 0, 0, pivot);
      // Metal seat triangle bracket connecting chain to rubber sling.
      addMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), galvanizedSteel, lx, -1.78, 0, 0, 0, -side * 0.25, pivot);
    }

    // Curved flexible rubber sling seat (3 angled panels forming a true U-sling).
    addMesh(new THREE.BoxGeometry(0.30, 0.028, 0.22), rubberSeatMat, 0, -1.87, 0, 0, 0, 0, pivot);
    addMesh(new THREE.BoxGeometry(0.14, 0.028, 0.22), rubberSeatMat, -0.19, -1.83, 0, 0, 0, -0.52, pivot);
    addMesh(new THREE.BoxGeometry(0.14, 0.028, 0.22), rubberSeatMat, 0.19, -1.83, 0, 0, 0, 0.52, pivot);
    obstacle('swing-' + sx, sx, swingZ, 0.52, 0.34);
  }

  // --- 3. Playground Tower, Steel Stairs & Glossy Molded Plastic Slide ---
  const towerPostGeo = new THREE.CylinderGeometry(0.055, 0.055, 2.85, 10);
  const capGeo = new THREE.SphereGeometry(0.068, 10, 8);
  for (const tx of [76.6, 78.1]) {
    for (const tz of [19.3, 20.8]) {
      addMesh(towerPostGeo, greenPowderMetal, tx, ground + 1.425, tz);
      addMesh(capGeo, yellowPlastic, tx, ground + 2.86, tz);
    }
  }
  // Textured deck platform & molded red plastic pitched roof + safety guardrails.
  addMesh(new THREE.BoxGeometry(1.66, 0.14, 1.66), timberMat, 77.35, ground + 1.35, 20.05);
  for (const side of [-1, 1]) {
    addMesh(new THREE.BoxGeometry(1.10, 0.08, 1.88), redPlastic, 77.35 + side * 0.48, ground + 2.84, 20.05, 0, 0, -side * 0.32);
    // Molded plastic side panels with safety railings.
    addMesh(new THREE.BoxGeometry(0.075, 0.58, 1.56), redPlastic, 77.35 + side * 0.77, ground + 1.72, 20.05);
    addMesh(new THREE.CylinderGeometry(0.022, 0.022, 1.56, 8), galvanizedSteel, 77.35 + side * 0.77, ground + 2.08, 20.05, Math.PI / 2, 0, 0);
    // Glossy molded red plastic slide side rails.
    addMesh(new THREE.BoxGeometry(0.075, 0.24, 2.38), redPlastic, 77.35 + side * 0.38, ground + 0.90, 21.84, 0.54);
    // Tubular steel stair handrails.
    addMesh(new THREE.CylinderGeometry(0.022, 0.022, 1.55, 8), galvanizedSteel, 77.35 + side * 0.44, ground + 1.05, 18.68, -0.78, 0, 0);
  }
  // Glossy yellow molded plastic slide chute + curved run-out lip at the bottom.
  addMesh(new THREE.BoxGeometry(0.72, 0.075, 2.38), yellowPlastic, 77.35, ground + 0.74, 21.84, 0.54);
  addMesh(new THREE.BoxGeometry(0.72, 0.075, 0.48), yellowPlastic, 77.35, ground + 0.16, 22.98, 0.12);
  // Perforated steel steps.
  for (let step = 0; step < 5; step++) {
    const sy = ground + (step + 1) * 0.25;
    addMesh(new THREE.BoxGeometry(0.84, 0.055, 0.26), galvanizedSteel, 77.35, sy, 18.18 + step * 0.25);
  }
  obstacle('slide', 77.35, 20.95, 1.7, 5.9);

  // --- 4. Molded-Plastic & Steel Seesaw ---
  const seeX = 75.25;
  const seeZ = 21.85;
  addMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.52, 8), galvanizedSteel, seeX, ground + 0.26, seeZ);
  addMesh(new THREE.BoxGeometry(0.12, 0.09, 2.65), greenPowderMetal, seeX, ground + 0.54, seeZ, 0.16);
  for (const side of [-1, 1]) {
    const seatZ = seeZ + side * 1.12;
    const seatY = ground + 0.58 - side * 0.18;
    addMesh(new THREE.BoxGeometry(0.30, 0.06, 0.34), redPlastic, seeX, seatY, seatZ, 0.16);
    addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), yellowPlastic, seeX, seatY + 0.14, seatZ - side * 0.22);
    addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8), yellowPlastic, seeX, seatY + 0.24, seatZ - side * 0.22, 0, 0, Math.PI / 2);
  }
  obstacle('seesaw', seeX, seeZ, 0.45, 2.7);

  return swingPivots;
}
