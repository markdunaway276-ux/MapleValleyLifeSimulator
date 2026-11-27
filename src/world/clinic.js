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
  ctx.font = `bold ${Math.round(canvas.height * 0.52)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, canvas.height / 2, 916);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map }));
  sign.position.set(x, y, z);
  if (facesStreet) sign.rotation.y = Math.PI;
  return sign;
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
  box(WHITE, 13.66, 0.09, 7, 0, 2.97, 3.6);
  box(0xd2d5cc, 13.8, 0.08, 7.1, 0, 0.044, 3.6);
  box(0xb8b8ad, 8.4, 0.105, 0.7, 0, 0.0525, -0.35);
  box(0xb8b8ad, 2.8, SURFACE_Y.walk, 0.7, 0, SURFACE_Y.walk / 2, -0.65);

  const glassGeometry = new THREE.PlaneGeometry(4.62, 1.55);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x99bcb8, transparent: true, opacity: 0.25, roughness: 0.24,
    side: THREE.DoubleSide, depthWrite: false, emissive: 0xffdca9, emissiveIntensity: 0
  });
  for (const side of [-1, 1]) {
    const x = side * 3.925;
    solid('front-' + side, BASE, 6.15, 0.75, 0.24, x, 0.375, 0.1);
    box(WALL, 6.15, 0.78, 0.24, x, 2.69, 0.1);
    for (const post of [0.97, 1.58, 3.925, 6.27, 6.87]) {
      box(TEAL, 0.16, 1.61, 0.25, post * side, 1.525, 0.1);
    }
    for (const end of [1.27, 6.57]) box(BASE, 0.58, 1.57, 0.24, end * side, 1.525, 0.1);
    box(TEAL, 4.8, 0.08, 0.29, x, 0.75, 0.1);
    box(TEAL, 4.8, 0.08, 0.29, x, 2.3, 0.1);
    const window = new THREE.Mesh(glassGeometry, glass);
    window.position.set(x, 1.525, 0.1);
    clinic.add(window);
  }
  box(TEAL, 1.7, 0.59, 0.23, 0, 2.73, 0.1);
  box(0x254944, 8.6, 0.14, 0.84, 0, 2.49, -0.36);
  box(0x87a89a, 8.58, 0.033, 0.038, 0, 2.47, -0.784);
  const name = plaque('✚  MAPLE LANE COMMUNITY CLINIC', 7.9, 0.62, 0, 2.79, -0.04, true);
  clinic.add(name);

  const pivot = new THREE.Group();
  pivot.position.set(HALF_DOOR, 0.085, 0.1);
  pivot.rotation.y = Math.PI;
  const door = createHingedDoor({
    width: HALF_DOOR * 2, height: 2.34, glazed: true, color: TEAL,
    shadows: quality.shadows, id: 'clinic-entrance'
  });
  pivot.add(door);
  clinic.add(pivot);
  data.doors.push(door);
  const gate = data.colliders.addHouse({
    id: 'clinic-doorway', x: X, z: FRONT + 0.1, width: HALF_DOOR * 2, depth: 0.22
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
  for (const x of [-5.5, -4.5, -3.5]) {
    solid('seat-' + x, 0x3c7771, 0.74, 0.11, 0.64, x, 0.48, 1.08);
    box(0x3c7771, 0.74, 0.53, 0.12, x, 0.75, 0.79);
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

  const lobbyLight = new THREE.PointLight(0xffefdb, 19, 8, 2);
  lobbyLight.position.set(0, 2.72, 2.65);
  const canopyLight = new THREE.PointLight(0xffe4be, 0, 5, 2);
  canopyLight.position.set(0, 2.29, -0.53);
  clinic.add(lobbyLight, canopyLight);
  clinic.userData.updateLighting = (minutes) => {
    const dusk = THREE.MathUtils.smoothstep(minutes, 1080, 1200);
    const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 330, 450);
    const night = Math.max(dusk, dawn);
    glass.emissiveIntensity = night * 0.36;
    canopyLight.intensity = night * 7;
  };

  const footprint = { id: 'community-clinic', minX: X - HALF_WIDTH, maxX: X + HALF_WIDTH, minZ: FRONT, maxZ: FRONT + DEPTH };
  (data.mapBuildings ??= []).push(footprint);
  (data.indoorZones ??= []).push({ ...footprint, minX: footprint.minX + 0.22, maxX: footprint.maxX - 0.22, maxZ: footprint.maxZ - 0.22 });

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
