import * as THREE from 'three';
import { createScene } from './world/scene.js';
import { createPlayer } from './core/player.js';
import { setupInput } from './core/input.js';
import { loadSave, saveGame } from './systems/save.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

const quality = {
  shadows: !isMobile,
  pixelRatio: isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2),
  far: isMobile ? 60 : 120
};

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = quality.shadows;
document.body.appendChild(renderer.domElement);

const scene = createScene(quality);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, quality.far);
const player = createPlayer(camera, scene);

const saveData = loadSave();
if (saveData.position) {
  player.position.set(saveData.position.x, saveData.position.y, saveData.position.z);
}

setupInput(player, isMobile);

const instructions = document.getElementById('instructions');
document.getElementById('start').onclick = () => {
  instructions.classList.add('hidden');
  if (!isMobile) renderer.domElement.requestPointerLock();
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  player.update(delta);
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
