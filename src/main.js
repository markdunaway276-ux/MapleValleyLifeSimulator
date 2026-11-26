import * as THREE from 'three';
import { createScene } from './world/scene.js';
import { createPlayer } from './core/player.js';
import { setupInput } from './core/input.js';
import { createInventory } from './ui/inventory.js';
import { STARTER_ITEMS } from './data/items.js';
import { loadSave, saveGame } from './systems/save.js';
import { createInteractPrompt, INTERACT_RANGE } from './ui/interactPrompt.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

const quality = {
  shadows: !isMobile,
  pixelRatio: isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2),
  far: isMobile ? 60 : 120
};

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = quality.shadows;
if (quality.shadows) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = createScene(quality);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, quality.far);
const player = createPlayer(camera, scene);

const spawn = scene.userData.spawn || { x: 0, y: 1.6, z: -1.15 };
const saveData = loadSave();
if (saveData.position) {
  player.position.set(saveData.position.x, saveData.position.y, saveData.position.z);
}
// A saved position may be inside a house (older spawns). Push out, or reset to spawn.
if (scene.userData.colliders) {
  const out = scene.userData.colliders.unstick(
    player.position.x,
    player.position.z,
    player.radius,
    spawn
  );
  player.position.x = out.x;
  player.position.z = out.z;
  if (out.reset) player.position.y = spawn.y;
}
camera.position.copy(player.position);

const instructions = document.getElementById('instructions');
const inventory = createInventory({
  canvas: renderer.domElement,
  isStarted: () => instructions.classList.contains('hidden'),
  items: STARTER_ITEMS
});
setupInput(player, isMobile, { isInventoryOpen: () => inventory.isOpen() });

const prompt = createInteractPrompt({
  isMobile,
  isStarted: () => instructions.classList.contains('hidden'),
  isInventoryOpen: () => inventory.isOpen(),
  door: scene.userData.door,
  player,
  range: INTERACT_RANGE
});

document.getElementById('start').onclick = () => {
  instructions.classList.add('hidden');
  if (!isMobile && !inventory.isOpen()) renderer.domElement.requestPointerLock();
  prompt.update();
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Interact only when close to door
const door = scene.userData.door;
window.addEventListener('interact', () => {
  if (door && player.position.distanceTo(door.position) < INTERACT_RANGE) {
    door.userData.open = !door.userData.open;
    door.rotation.y = door.userData.open ? Math.PI / 2 : 0;
    prompt.update();
  }
});

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  player.update(delta);
  prompt.update();
  renderer.render(scene, camera);
}
animate();

// Auto-save every 10 seconds
setInterval(() => {
  saveGame({
    position: { x: player.position.x, y: player.position.y, z: player.position.z }
  });
}, 10000);

console.log(`Maple Valley Life Simulator started — Mobile: ${isMobile}, Shadows: ${quality.shadows}`);
