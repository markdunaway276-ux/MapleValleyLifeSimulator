import * as THREE from 'three';
import { Parts } from './parts.js';
import { STREET, SURFACE_Y } from './street.js';

export function buildPark(scene, quality) {
  const layout = STREET.expansion;
  const park = new THREE.Group();
  park.name = 'maple-lane-park';
  scene.add(park);

  function surface(name, rect, y, color) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rect.maxX - rect.minX, rect.maxZ - rect.minZ),
      new THREE.MeshStandardMaterial({ color, roughness: 0.94 })
    );
    mesh.name = name;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
    mesh.receiveShadow = quality.shadows;
    park.add(mesh);
  }

  surface('future-pond-footprint', layout.pond, 0.009, 0x829588);
  for (const road of layout.roads) surface('service-road', road, SURFACE_Y.road, 0x464745);
  for (const path of layout.paths) surface('park-path', path, SURFACE_Y.walk, 0xc0ad8e);
  surface('entrance-plaza', layout.plaza, SURFACE_Y.walk + 0.002, 0xbcb6a6);
  surface('playground-mulch', layout.playground, SURFACE_Y.walk, 0x896044);
  surface('basketball-asphalt', layout.court, SURFACE_Y.walk, 0x505651);
  surface('court-approach', layout.courtWalk, SURFACE_Y.walk, 0xbcb6a6);
  surface('picnic-walk', layout.picnicWalk, SURFACE_Y.walk, 0xb8a990);
  const { minX, maxX, minZ, maxZ } = layout.crossing;
  for (let x = minX + 0.35; x < maxX - 0.35; x += 0.65) {
    surface('service-road-crossing', { minX: x, maxX: x + 0.3, minZ, maxZ }, SURFACE_Y.road + 0.002, 0xd8d6c7);
  }
  return buildActivityArea(park, scene.userData.colliders, quality);
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

  // Playground tower, stairs, slide and swings on a bordered mulch bed.
  for (const x of [76.6, 78.1]) for (const z of [19.3, 20.8]) post(x, z, 2.8, metal);
  box(wood, 1.65, 0.15, 1.65, 77.35, 1.35, 20.05);
  for (const side of [-1, 1]) {
    box(red, 1.06, 0.09, 1.85, 77.35 + side * 0.46, 2.83, 20.05, 0, 0, -side * 0.32);
    box(red, 0.085, 0.55, 1.55, 77.35 + side * 0.76, 1.72, 20.05);
    box(red, 0.07, 0.22, 2.35, 77.35 + side * 0.37, 0.88, 21.83, 0.54);
  }
  box(0xc2a354, 0.72, 0.09, 2.35, 77.35, 0.73, 21.83, 0.54);
  for (let step = 0; step < 5; step++) {
    const height = (step + 1) * 0.24;
    box(wood, 0.83, height, 0.25, 77.35, height / 2, 18.16 + step * 0.25);
  }
  obstacle('slide', 77.35, 20.95, 1.7, 5.9);
  for (const x of [79.8, 83]) for (const side of [-1, 1]) {
    box(metal, 0.09, 2.47, 0.09, x, 1.17, 22.25 + side * 0.44, -side * 0.35);
  }
  box(red, 3.35, 0.11, 0.12, 81.4, 2.3, 22.25);
  for (const x of [80.65, 82.15]) {
    for (const side of [-1, 1]) box(metal, 0.022, 1.73, 0.022, x + side * 0.2, 1.4, 22.25);
    box(wood, 0.47, 0.07, 0.29, x, 0.51, 22.25);
    obstacle('swing-' + x, x, 22.25, 0.48, 0.32);
  }
  for (const x of [79.8, 83]) obstacle('swing-frame-' + x, x, 22.25, 0.16, 1.73);
  for (const z of [18.05, 25.45]) box(wood, 10, 0.09, 0.1, 79, 0.02, z);
  box(wood, 0.1, 0.09, 7.5, 83.95, 0.02, 21.75);

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
  for (const [x, z] of [[69.25, 14.25], [73.5, 17.5]]) {
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
  return {
    update(minutes) {
      const dusk = THREE.MathUtils.smoothstep(minutes, 1100, 1160);
      const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 335, 395);
      for (const light of lights) light.intensity = 20 * (dusk + dawn);
      lenses.emissiveIntensity = dusk + dawn;
    }
  };
}
