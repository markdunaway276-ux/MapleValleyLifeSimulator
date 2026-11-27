import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHingedDoor } from '../systems/doors.js';
import { Parts } from './parts.js';
import { NORTH_FRONTAGE_OFFSET, SURFACE_Y } from './street.js';
import { createVertexMaterial } from './surfaces.js';

const X = -34;
const FRONT = 3.1 + NORTH_FRONTAGE_OFFSET;
const HALF_WIDTH = 7;
const DEPTH = 7.2;
const HEIGHT = 3.08;
const HALF_DOOR = 0.85;
const DOOR_RECESS = 0.66;
const TEAL = 0x316961;
const WALL = 0xe5ded0;
const BASE = 0xbcb19c;
const WHITE = 0xf4f4ed;

function plaque(text, width, height, x, y, z, facesStreet) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 * height / width);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#204d48';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#9ec7b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = '#f5f6ed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = Array.isArray(text) ? text : [text];
  const rowHeight = canvas.height / (lines.length + 0.55);
  ctx.font = `bold ${Math.round(rowHeight * 0.8)}px sans-serif`;
  lines.forEach((line, index) => {
    ctx.fillText(line, 512, canvas.height / 2 + (index - (lines.length - 1) / 2) * rowHeight, 916);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map }));
  sign.position.set(x, y, z);
  if (facesStreet) sign.rotation.y = Math.PI;
  return sign;
}

function makeStucco() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(128, 128);
  let seed = 37;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = 225 + (seed >>> 27);
    pixels.data.set([grain, grain, grain, 255], index);
  }
  context.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(10, 1.25);
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ color: WALL, map, roughness: 0.94 });
}

function addWindowReflection(material, daylight) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.clinicDaylight = daylight;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vClinicPaneNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvClinicPaneNormal = normalMatrix * normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform float clinicDaylight;\nvarying vec3 vClinicPaneNormal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float facing = abs(dot(normalize(vClinicPaneNormal), normalize(vViewPosition)));
      float reflection = pow(1.0 - facing, 3.0) * clinicDaylight;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.61, 0.76, 0.86), reflection * 0.55);
      diffuseColor.a += reflection * 0.20;
    `);
  };
}

export function buildClinic(scene, quality) {
  const data = scene.userData;
  const clinic = new THREE.Group();
  clinic.name = 'community-clinic';
  clinic.position.set(X, 0, FRONT);
  scene.add(clinic);
  data.clinic = clinic;

  const parts = new Parts(true);
  parts.bevelMax = 0.025;
  const box = (...args) => parts.box(...args);
  function solid(id, color, width, height, depth, x, y, z) {
    box(color, width, height, depth, x, y, z);
    return data.colliders.addHouse({
      id: 'clinic-' + id,
      x: X + x, z: FRONT + z, width, depth
    });
  }

  solid('west', BASE, 0.22, HEIGHT, DEPTH, -6.89, HEIGHT / 2, 3.6);
  solid('east', BASE, 0.22, HEIGHT, DEPTH, 6.89, HEIGHT / 2, 3.6);
  solid('back', BASE, 14, HEIGHT, 0.22, 0, HEIGHT / 2, 7.09);
  box(TEAL, 14, 0.18, 7.2, 0, 3.04, 3.6);
  parts.surface('metal');
  box(0x6f8179, 14.12, 0.065, 0.15, 0, 3.13, 0.02);
  box(0x485d55, 14.12, 0.033, 0.045, 0, 3.088, -0.043);
  for (const side of [-1, 1]) {
    box(0x6f8179, 0.15, 0.065, DEPTH, side * 6.99, 3.13, DEPTH / 2);
  }
  parts.surface('plaster');
  box(WHITE, 13.66, 0.09, 7, 0, 2.97, 3.6);
  box(0xd2d5cc, 13.8, 0.08, 7.1, 0, 0.044, 3.6);
  box(0xb8b8ad, 8.4, 0.105, 0.7, 0, 0.0525, -0.35);
  box(0xb8b8ad, 2.8, SURFACE_Y.walk, 0.7, 0, SURFACE_Y.walk / 2, -0.65);
  box(0xb8b8ad, 1.72, 0.10, DOOR_RECESS, 0, 0.05, DOOR_RECESS / 2);
  for (const x of [-6.05, -4.2, 6.05]) {
    box(0xa7aaa4, x === -4.2 ? 2.15 : 1.54, 0.095, 0.72, x, 0.0475, -0.36);
  }
  for (const x of [-6.05, 6.05]) {
    solid('planter-' + x, 0x646d62, 1.30, 0.36, 0.50, x, 0.27, -0.37);
    box(0xa3a892, 1.35, 0.045, 0.55, x, 0.45, -0.37);
    box(0x4e4033, 1.21, 0.037, 0.41, x, 0.48, -0.37);
    for (let i = 0; i < 7; i++) {
      const stemX = x + (i - 3) * 0.16;
      const plantZ = -0.37 + (i % 2 ? 0.075 : -0.075);
      const height = 0.16 + (i % 3) * 0.055;
      parts.cylinder(i % 2 ? 0x6c8260 : 0x4c6c50, 0.035, 0.125, height, stemX, 0.48 + height / 2, plantZ, 0, 0, (i - 3) * 0.08, 6);
    }
  }

  // Control joints stay flush so the sidewalk approach remains unobstructed.
  for (const x of [-3.15, -2.10, -1.05, 1.05, 2.10, 3.15]) {
    box(0x898981, 0.012, 0.002, 0.64, x, Math.abs(x) < 1.4 ? 0.111 : 0.106, -0.35);
  }
  box(0x96978e, 2.77, 0.002, 0.012, 0, SURFACE_Y.walk + 0.001, -0.66);

  const stucco = makeStucco();
  const stuccoGeometry = new THREE.PlaneGeometry(6.15, 0.78);
  const daylight = { value: 1 };
  const glassGeometry = new THREE.PlaneGeometry(4.62, 1.55);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x99bcb8, transparent: true, opacity: 0.25, roughness: 0.24,
    side: THREE.DoubleSide, depthWrite: false, emissive: 0xffdca9, emissiveIntensity: 0
  });
  addWindowReflection(glass, daylight);
  for (const side of [-1, 1]) {
    const x = side * 3.925;
    solid('front-' + side, BASE, 6.15, 0.75, 0.24, x, 0.375, 0.1);
    // Narrow recessed mortar joints and staggered brick faces at eye level.
    box(0xa59a87, 6.15, 0.59, 0.035, x, 0.395, -0.032);
    const brick = [0x976f5e, 0xa37d67, 0x896553, 0xad8872];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 21; col++) {
        const left = Math.max(0, col * 0.30 - (row % 2) * 0.15);
        const right = Math.min(6.15, (col + 1) * 0.30 - (row % 2) * 0.15);
        if (right - left < 0.03) continue;
        box(brick[(col * 3 + row) % brick.length], right - left - 0.012, 0.101, 0.029,
          x - 3.075 + (left + right) / 2, 0.168 + row * 0.116, -0.057);
      }
    }
    box(0xbeb8a5, 6.15, 0.09, 0.34, x, 0.723, 0.035);
    box(WALL, 6.15, 0.78, 0.24, x, 2.69, 0.1);
    const finish = new THREE.Mesh(stuccoGeometry, stucco);
    finish.position.set(x, 2.69, -0.021);
    finish.rotation.y = Math.PI;
    finish.receiveShadow = !!quality.shadows;
    clinic.add(finish);
    for (const post of [0.97, 1.58, 3.925, 6.27, 6.87]) {
      box(TEAL, 0.19, 1.61, 0.36, post * side, 1.525, 0.1);
    }
    for (const end of [1.27, 6.57]) box(BASE, 0.58, 1.57, 0.24, end * side, 1.525, 0.1);
    box(TEAL, 4.8, 0.08, 0.29, x, 0.75, 0.1);
    box(TEAL, 4.8, 0.10, 0.36, x, 2.3, 0.1);
    box(TEAL, 4.8, 0.065, 0.34, x, 1.96, 0.1);
    solid('door-return-' + side, TEAL, 0.17, 2.44, DOOR_RECESS, side * 0.935, 1.22, DOOR_RECESS / 2);
    const window = new THREE.Mesh(glassGeometry, glass);
    window.position.set(x, 1.525, 0.1);
    clinic.add(window);
  }
  box(TEAL, 1.7, 0.59, DOOR_RECESS + 0.12, 0, 2.73, DOOR_RECESS / 2);
  box(0x535e53, 0.70, 0.38, 0.055, 1.29, 1.59, -0.052);
  clinic.add(plaque(['CLINIC HOURS', '8 AM – 6 PM'], 0.65, 0.33, 1.29, 1.59, -0.082, true));
  box(0x254944, 8.6, 0.14, 0.84, 0, 2.49, -0.36);
  box(0x87a89a, 8.58, 0.033, 0.038, 0, 2.47, -0.784);
  const name = plaque('✚  MAPLE LANE COMMUNITY CLINIC', 7.9, 0.62, 0, 2.79, -0.04, true);
  clinic.add(name);

  const pivot = new THREE.Group();
  pivot.position.set(HALF_DOOR, 0.085, DOOR_RECESS);
  pivot.rotation.y = Math.PI;
  const door = createHingedDoor({
    width: HALF_DOOR * 2, height: 2.34, glazed: true, color: TEAL,
    shadows: quality.shadows, id: 'clinic-entrance'
  });
  // Two panes keep the stripe between the existing horizontal rails.
  const privacyStripe = new THREE.PlaneGeometry(0.638, 0.20);
  const frost = new THREE.MeshStandardMaterial({
    color: 0xbdd0c9, roughness: 0.95, side: THREE.DoubleSide
  });
  for (const face of [-1, 1]) {
    for (const offset of [-0.332, 0.332]) {
      const stripe = new THREE.Mesh(privacyStripe, frost);
      stripe.position.set(HALF_DOOR + offset, 1.72, face * 0.056);
      door.add(stripe);
    }
  }
  pivot.add(door);
  clinic.add(pivot);
  data.doors.push(door);
  const gate = data.colliders.addHouse({
    id: 'clinic-doorway', x: X, z: FRONT + DOOR_RECESS, width: HALF_DOOR * 2, depth: 0.22
  });
  Object.defineProperty(gate, 'disabled', {
    get: () => door.userData.open || Math.abs(door.rotation.y) > 0.05
  });

  // Reception and waiting room open into the central passage between the exam rooms.
  solid('reception', TEAL, 2.25, 0.97, 0.76, 3.65, 0.57, 2.05);
  box(WHITE, 2.36, 0.09, 0.85, 3.65, 1.09, 2.05);
  box(0x303b3d, 0.44, 0.29, 0.07, 3.65, 1.28, 2.17);
  box(0x707c7a, 0.19, 0.04, 0.15, 3.65, 1.16, 2.17);
  clinic.add(plaque('RECEPTION', 1.35, 0.25, 3.65, 0.81, 1.666, true));
  // The rear wall of the lobby is visible through the street windows.
  box(0x785744, 4.00, 2.18, 0.04, 3.8, 1.30, 3.34);
  for (let i = 0; i < 20; i++) {
    box(i % 3 === 0 ? 0xb88e66 : 0xa77b55, 0.158, 2.16, 0.042, 1.90 + i * 0.20, 1.30, 3.305);
  }
  for (const [x, y, sky, hill] of [[-5.25, 1.83, 0xd8e1d8, 0x627d71], [-3.96, 1.83, 0xe4ddc8, 0x8f9a79]]) {
    box(0x906745, 0.80, 0.58, 0.045, x, y, 3.33);
    box(WHITE, 0.72, 0.50, 0.015, x, y, 3.30);
    box(sky, 0.59, 0.37, 0.008, x, y, 3.286);
    const landscape = new THREE.Shape();
    landscape.moveTo(-0.285, -0.17);
    landscape.lineTo(0.285, -0.17);
    landscape.lineTo(0.285, 0.02);
    landscape.lineTo(0.175, 0.10);
    landscape.lineTo(0.02, -0.025);
    landscape.lineTo(-0.10, 0.04);
    landscape.lineTo(-0.285, -0.07);
    landscape.closePath();
    const print = new THREE.ShapeGeometry(landscape);
    print.rotateY(Math.PI);
    parts.geometry(print, hill, x, y, 3.279);
    print.dispose();
  }
  for (const x of [-5.5, -4.5, -3.5]) {
    parts.bevelMax = 0.045;
    solid('seat-' + x, 0x638078, 0.74, 0.11, 0.64, x, 0.48, 1.08);
    box(0x708980, 0.74, 0.53, 0.12, x, 0.75, 0.79);
    parts.bevelMax = 0.025;
    for (const dx of [-0.28, 0.28]) box(0x5c6767, 0.055, 0.37, 0.56, x + dx, 0.27, 1.08);
  }
  box(0x444849, 1.68, 0.012, 0.77, 0, 0.091, 0.95);
  solid('outside-bench', TEAL, 1.65, 0.1, 0.43, -4.2, 0.52, -0.48);
  box(TEAL, 1.65, 0.28, 0.07, -4.2, 0.75, -0.27);
  for (const x of [-4.85, -3.55]) box(0x4d5855, 0.07, 0.37, 0.34, x, 0.286, -0.48);
  for (const side of [-1, 1]) {
    solid('exam-front-' + side, WALL, 6, 2.83, 0.12, 3.88 * side, 1.5, 3.42);
    solid('exam-wall-' + side, WALL, 0.12, 2.83, 1.95, 0.94 * side, 1.5, 6.10);
    box(WALL, 0.12, 0.58, 1.67, 0.94 * side, 2.62, 4.3);
    clinic.add(plaque('EXAM ' + (side < 0 ? '1' : '2'), 0.78, 0.22, 1.55 * side, 2.15, 3.35, true));
    solid('exam-table-' + side, 0x8b9994, 0.74, 0.75, 1.85, 4.22 * side, 0.465, 5.49);
    box(0x427d76, 0.79, 0.1, 1.9, 4.22 * side, 0.86, 5.49);
    box(WHITE, 0.54, 0.05, 1.48, 4.22 * side, 0.934, 5.57);
    solid('cabinet-' + side, TEAL, 1.45, 0.84, 0.51, 2.43 * side, 0.51, 6.75);
    box(WHITE, 1.51, 0.07, 0.57, 2.43 * side, 0.965, 6.75);
    box(0xbfc9c4, 0.38, 0.025, 0.27, 2.43 * side, 1.015, 6.75);
    box(0x9faeaa, 0.043, 0.15, 0.05, 2.43 * side, 1.09, 6.89);
    box(0x9faeaa, 0.043, 0.04, 0.14, 2.43 * side, 1.15, 6.835);
  }

  const fixtureParts = new Parts(false);
  fixtureParts.box(0, 1.05, 0.045, 0.21, 0, 2.397, -0.42);
  for (const [x, z] of [[-3.8, 1.9], [3.8, 1.9], [0, 5], [-4.2, 5.5], [4.2, 5.5]]) {
    fixtureParts.box(0, 1.45, 0.045, 0.33, x, 2.9, z);
  }
  const fixtures = new THREE.Mesh(fixtureParts.merge(), new THREE.MeshBasicMaterial({ color: 0xfff0d3 }));
  const model = new THREE.Mesh(parts.merge(), createVertexMaterial());
  model.castShadow = model.receiveShadow = !!quality.shadows;
  clinic.add(model, fixtures);

  const lobbyLight = new THREE.PointLight(0xffdfb3, 18, 8, 2);
  lobbyLight.position.set(-1.8, 2.66, 2.2);
  const canopyLight = new THREE.SpotLight(0xffe4be, 0, 4, Math.PI / 4, 0.78, 2);
  canopyLight.position.set(0, 2.30, -0.48);
  canopyLight.target.position.set(0, 0.08, -0.83);
  clinic.add(lobbyLight, canopyLight, canopyLight.target);
  clinic.userData.updateLighting = (minutes) => {
    const dusk = THREE.MathUtils.smoothstep(minutes, 1080, 1200);
    const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 330, 450);
    const night = Math.max(dusk, dawn);
    daylight.value = 1 - night;
    glass.emissiveIntensity = night * 0.24;
    lobbyLight.intensity = 18 + night * 7;
    canopyLight.intensity = night * 14;
  };

  const footprint = { id: 'community-clinic', minX: X - HALF_WIDTH, maxX: X + HALF_WIDTH, minZ: FRONT, maxZ: FRONT + DEPTH };
  (data.mapBuildings ??= []).push(footprint);
  (data.indoorZones ??= []).push({ ...footprint, minX: footprint.minX + 0.22, minZ: FRONT + DOOR_RECESS, maxX: footprint.maxX - 0.22, maxZ: footprint.maxZ - 0.22 });

  new GLTFLoader().load('./assets/models/clinic-roof.glb', ({ scene: exterior }) => {
    exterior.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = !!quality.shadows;
      mesh.material.map.anisotropy = 8;
      mesh.material.roughness = 0.86;
    });
    clinic.add(exterior);
  }, undefined, (error) => console.warn('Clinic exterior failed to load', error));
}
