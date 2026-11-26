import * as THREE from 'three';
import { LOOK } from '../world/palette.js';
import { createPost } from '../world/post.js';
import { readSettings, qualityFor } from '../systems/settings.js';

/** Quality tier and the WebGL renderer (added to the page). */
export function createRenderer({ isMobile }) {
  // Graphics quality from the player's settings ('auto' = the old per-device choice).
  const level = readSettings().quality;
  const q = qualityFor(level, isMobile, window.devicePixelRatio);
  const quality = { ...q, level };

  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Exposure comes from the palette file (0.95, set by 83bc107) next to the shadow settings.
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = quality.shadows;
  if (quality.shadows) renderer.shadowMap.type = LOOK.shadow.type === 'PCF' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  // First in the page, so every HUD element and menu draws above it. (A CSS filter on
  // the canvas, used for the phone film look, makes it a stacking layer of its own;
  // as the last element it then covered the Start button, joystick and menus.)
  document.body.prepend(renderer.domElement);
  return { quality, renderer };
}

/** Camera, desktop-only post-processing, resize handling and draw(). */
export function createView({ renderer, scene, quality }) {
  const camera = new THREE.PerspectiveCamera(readSettings().fov, window.innerWidth / window.innerHeight, 0.1, quality.far);
  // Rustic film grade: a shader pass on desktop, a CSS approximation on phones (display.js).
  const post = createPost({ renderer, scene, camera, enabled: quality.post });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (post) post.setSize(window.innerWidth, window.innerHeight);
  });

  function draw() {
    if (post) post.render();
    else renderer.render(scene, camera);
  }

  return { camera, post, draw };
}
