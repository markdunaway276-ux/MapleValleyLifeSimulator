import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { generateHouse } from './buildings.js';
import { scatterTrees, TREE_PLACEMENTS } from './trees.js';

function disposeGroup(group) {
  const materials = new Set();
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mat) => materials.add(mat));
  });
  materials.forEach((m) => m.dispose());
}

function hash2(ix, iy) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (d - a - b + c) * sx * sy;
}

function fbm(x, y) {
  return (
    valueNoise(x, y) * 0.55 +
    valueNoise(x * 2.1, y * 2.1) * 0.3 +
    valueNoise(x * 4.3, y * 4.3) * 0.15
  );
}

/** Subtle grass variation. 512px + anisotropy on desktop, 256px on mobile. */
function createGrassTexture(quality) {
  const hi = !!quality.shadows;
  const size = hi ? 512 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 8;
      const ny = (y / size) * 8;
      const patch = fbm(nx, ny);
      const speck = hash2(x * 13, y * 17);
      // Base 0x3a7d3a, with darker clumps and a few paler blades
      let r = 58 + (patch - 0.5) * 36;
      let g = 125 + (patch - 0.5) * 40;
      let b = 58 + (patch - 0.5) * 22;
      if (speck > 0.82) {
        r += 18;
        g += 22;
        b += 8;
      } else if (speck < 0.08) {
        r -= 16;
        g -= 22;
        b -= 10;
      }
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = hi ? 8 : 1;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createPathTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = valueNoise(x / 18, y / 18) * 0.7 + hash2(x, y) * 0.3;
      const r = 168 + n * 22;
      const g = 156 + n * 18;
      const b = 132 + n * 14;
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Large inverted dome, fog disabled, drawn behind the world. */
function createSkyDome(quality) {
  const radius = quality.far * 0.85;
  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  const uniforms = {
    topColor: { value: new THREE.Color(0x4e9ad8) },
    bottomColor: { value: new THREE.Color(0xd4ecfa) },
    exponent: { value: 0.7 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying float vSky;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vSky = normalize(w.xyz).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      varying float vSky;
      void main() {
        float t = pow(max(vSky, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
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
  const horizon = new THREE.Color(0xd4ecfa);
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, quality.far * 0.55, quality.far * 0.98);
  scene.add(createSkyDome(quality));

  // Ground with a repeating grass canvas texture
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({
    map: createGrassTexture(quality),
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality.shadows;
  scene.add(ground);

  // Simple path from the spawn toward the house front / door
  const pathLen = 11.6;
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, pathLen),
    new THREE.MeshStandardMaterial({
      map: createPathTexture(),
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0
    })
  );
  path.name = 'path';
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, -0.4);
  path.receiveShadow = quality.shadows;
  scene.add(path);

  // Fallback procedural house. The Kenney GLB is the main house; this group
  // stays only while the model loads, or if the load fails.
  const house = generateHouse({
    width: 6,
    height: 4,
    depth: 8,
    roofType: 'pyramid',
    wallColor: 0xd2b48c,
    roofColor: 0x8b4513,
    hasDoor: false,
    shadows: quality.shadows
  });
  house.position.set(0, 0, -10);
  scene.add(house);

  // Standalone interactable door (kept independent of the fallback / GLB house)
  const doorGeo = new THREE.BoxGeometry(1.4, 2.4, 0.1);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.2, -6);
  door.castShadow = quality.shadows;
  scene.add(door);
  door.userData.isDoor = true;
  door.userData.open = false;

  // A second generated house so the generator is visible next to the GLB.
  // Placed to the east, rotated to face the player spawn at (0, 1.6, 5).
  const generatedHouse = generateHouse({
    width: 5,
    depth: 6,
    height: 3.5,
    roofType: 'gable',
    wallColor: 0xa8c5e0,
    windowCount: 4,
    shadows: quality.shadows
  });
  generatedHouse.position.set(12, 0, -10);
  generatedHouse.rotation.y = Math.atan2(0 - 12, 5 - (-10));
  scene.add(generatedHouse);

  // Lighting: sky-blue hemisphere over grass, a soft ambient, and a warm sun
  const hemi = new THREE.HemisphereLight(0x9ecbff, 0x3d6b32, 0.5);
  hemi.name = 'hemi';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xfff4e8, 0.2);
  ambient.name = 'ambient';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffe2b8, 1.25);
  sun.name = 'sun';
  sun.position.set(18, 28, 12);
  sun.target.position.set(2, 0, -8);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
  }
  scene.add(sun);
  scene.add(sun.target);

  const trees = scatterTrees(scene, TREE_PLACEMENTS, quality);
  scene.userData.trees = trees;

  scene.userData.door = door;

  // Real house model (Kenney City Kit Suburban, CC0). The procedural house
  // and the standalone door above stay as a fallback until the model has loaded.
  const HOUSE_URL = './assets/models/house_type02.glb'; // relative to the page, so it works under the Pages subpath
  const HOUSE_CENTER = new THREE.Vector3(0, 0, -10);    // same spot as the old box house
  const HOUSE_TARGET = { x: 6.5, z: 8 };                // approximate footprint in metres
  // Front door of house_type02 in the model's own units (before scaling/centering)
  const MODEL_FRONT_DOOR = { x: 0.004, y: 0.135, z: 0.535, w: 0.14, h: 0.27 };

  new GLTFLoader().load(
    HOUSE_URL,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'kenney-house';

      // Uniform scale so the footprint fits roughly 6.5 x 8 m
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      const s = Math.min(HOUSE_TARGET.x / rawSize.x, HOUSE_TARGET.z / rawSize.z);
      model.scale.setScalar(s);

      // Base on y = 0, centered on HOUSE_CENTER (the model's front already faces +z)
      model.position.set(
        HOUSE_CENTER.x - rawCenter.x * s,
        -rawBox.min.y * s,
        HOUSE_CENTER.z - rawCenter.z * s
      );

      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = quality.shadows;
          o.receiveShadow = quality.shadows;
        }
      });
      scene.add(model);

      // Swap out the placeholder procedural house
      scene.remove(house);
      disposeGroup(house);

      // Fit the interactable door over the model's own front door
      model.updateMatrixWorld(true);
      const d = MODEL_FRONT_DOOR;
      const doorWorld = model.localToWorld(new THREE.Vector3(d.x, d.y, d.z));
      door.scale.set((d.w * s) / 1.4, (d.h * s) / 2.4, 1);
      door.position.set(doorWorld.x, doorWorld.y, doorWorld.z + 0.06);
    },
    undefined,
    (err) => {
      console.warn('House model failed to load, keeping the placeholder house', err);
    }
  );

  return scene;
}
