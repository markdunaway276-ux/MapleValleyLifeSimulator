import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { generateHouse } from './buildings.js';
import { scatterTrees, TREE_PLACEMENTS } from './trees.js';
import { createColliderWorld } from '../systems/collision.js';

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

/** Dark asphalt with a dashed center line. U runs along the street. */
function createRoadTexture(quality) {
  const along = quality.shadows ? 256 : 128;
  const across = 64;
  const canvas = document.createElement('canvas');
  canvas.width = along;
  canvas.height = across;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(along, across);
  const data = img.data;
  const mid = across / 2;
  for (let y = 0; y < across; y++) {
    for (let x = 0; x < along; x++) {
      const n = valueNoise(x / 20, y / 10) * 0.6 + hash2(x, y) * 0.4;
      let r = 48 + n * 18;
      let g = 48 + n * 18;
      let b = 50 + n * 16;
      // Dashed center line (on 40%, off 60% of the tile)
      const onDash = (x % 40) < 16;
      if (onDash && Math.abs(y - mid) <= 1.5) {
        r = 220; g = 196; b = 64;
      }
      const i = (y * along + x) * 4;
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
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSidewalkTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = valueNoise(x / 16, y / 16) * 0.7 + hash2(x, y) * 0.3;
      const r = 186 + n * 18;
      const g = 182 + n * 16;
      const b = 172 + n * 14;
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
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** East–west street in front of the Kenney house. Spawn sits on the road. */
export const STREET = {
  length: 44,
  roadWidth: 4,
  sidewalkWidth: 1.5,
  roadCenterZ: -1.15,
  spawn: { x: 0, y: 1.6, z: -1.15 }
};

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
  const colliders = createColliderWorld();
  scene.userData.colliders = colliders;
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

  // East–west road with sidewalks, running in front of the Kenney house
  const { length: streetLen, roadWidth, sidewalkWidth, roadCenterZ } = STREET;
  const roadTex = createRoadTexture(quality);
  roadTex.repeat.set(streetLen / 8, 1);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(streetLen, roadWidth),
    new THREE.MeshStandardMaterial({
      map: roadTex,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0
    })
  );
  road.name = 'road';
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, roadCenterZ);
  road.receiveShadow = quality.shadows;
  scene.add(road);

  const walkTex = createSidewalkTexture();
  walkTex.repeat.set(streetLen / 4, 1);
  const walkMat = new THREE.MeshStandardMaterial({
    map: walkTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0
  });
  const walkGeo = new THREE.PlaneGeometry(streetLen, sidewalkWidth);
  const southWalkZ = roadCenterZ - roadWidth / 2 - sidewalkWidth / 2;
  const northWalkZ = roadCenterZ + roadWidth / 2 + sidewalkWidth / 2;
  for (const [name, z] of [['sidewalk-south', southWalkZ], ['sidewalk-north', northWalkZ]]) {
    const walk = new THREE.Mesh(walkGeo, walkMat);
    walk.name = name;
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.03, z);
    walk.receiveShadow = quality.shadows;
    scene.add(walk);
  }

  // Fallback procedural house. The Kenney GLB is the main house; this group
  // stays only while the model loads, or if the load fails.
  const house = generateHouse({
    width: 9.5,
    height: 6,
    depth: 10,
    roofType: 'pyramid',
    wallColor: 0xd2b48c,
    roofColor: 0x8b4513,
    hasDoor: false,
    shadows: quality.shadows
  });
  house.position.set(0, 0, -10);
  scene.add(house);
  // Temporary collider for the fallback house; replaced (not duplicated) when the GLB loads.
  colliders.addHouse({ id: 'main-house', x: 0, z: -10, width: 9.5, depth: 10, rotY: 0 });

  // Standalone interactable door (kept independent of the fallback / GLB house).
  // Sized like a normal door (~1 × 2 m) and placed on the fallback's front face.
  const doorGeo = new THREE.BoxGeometry(1.0, 2.0, 0.1);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.0, -4.94);
  door.castShadow = quality.shadows;
  scene.add(door);
  door.userData.isDoor = true;
  door.userData.open = false;

  // Four generated houses on both sides of the street, facing the road.
  // The Kenney house (above) is the fifth house, on the south side at x=0.
  const lots = [
    { name: 'house-sw', x: -13, z: -9.3, rotY: 0, width: 7.5, depth: 9, height: 3.5, roofType: 'gable', wallColor: 0xa8c5e0, roofColor: 0x6b3a2a, windowCount: 4 },
    { name: 'house-se', x: 13.5, z: -9.45, rotY: 0, width: 8.25, depth: 9.3, height: 3.8, roofType: 'pyramid', wallColor: 0xe8d5b7, roofColor: 0x4a5560, windowCount: 3 },
    { name: 'house-nw', x: -13, z: 6.85, rotY: Math.PI, width: 7.5, depth: 8.7, height: 3.6, roofType: 'flat', wallColor: 0xd4d0c8, roofColor: 0x5c4033, windowCount: 4 },
    { name: 'house-ne', x: 13.2, z: 7.0, rotY: Math.PI, width: 7.8, depth: 9, height: 3.7, roofType: 'gable', wallColor: 0xc9a66b, roofColor: 0x7a2e2e, windowCount: 4 }
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
      shadows: quality.shadows
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
    return h;
  });
  scene.userData.streetHouses = streetHouses;

  // Lighting: sky-blue hemisphere over grass, a soft ambient, and a warm sun
  const hemi = new THREE.HemisphereLight(0x9ecbff, 0x3d6b32, 0.5);
  hemi.name = 'hemi';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xfff4e8, 0.2);
  ambient.name = 'ambient';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffe2b8, 1.25);
  sun.name = 'sun';
  sun.position.set(22, 32, 16);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 110;
    sun.shadow.camera.left = -44;
    sun.shadow.camera.right = 44;
    sun.shadow.camera.top = 44;
    sun.shadow.camera.bottom = -44;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
  }
  scene.add(sun);
  scene.add(sun.target);

  const trees = scatterTrees(scene, TREE_PLACEMENTS, quality);
  scene.userData.trees = trees;
  trees.forEach((tree, i) => {
    colliders.addTree({
      id: `tree-${i}`,
      x: tree.position.x,
      z: tree.position.z,
      radius: tree.userData.trunkRadius
    });
  });

  scene.userData.door = door;
  scene.userData.street = STREET;
  scene.userData.spawn = STREET.spawn;

  // Real house model (Kenney City Kit Suburban, CC0). The procedural house
  // and the standalone door above stay as a fallback until the model has loaded.
  const HOUSE_URL = './assets/models/house_type02.glb'; // relative to the page, so it works under the Pages subpath
  const HOUSE_CENTER = new THREE.Vector3(0, 0, -10);    // same spot as the old box house
  // house_type02 door is 0.27 model-units tall. Scale so that door is 2 m and
  // the porch underside (~0.326 model-units) sits at ~2.41 m, clear of a 1.6–1.7 m eye height.
  const MODEL_FRONT_DOOR = { x: 0.004, y: 0.135, z: 0.535, w: 0.14, h: 0.27 };
  const TARGET_DOOR_HEIGHT = 2.0;

  new GLTFLoader().load(
    HOUSE_URL,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'kenney-house';

      // Uniform scale so the model's front door is 2 m tall
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      const s = TARGET_DOOR_HEIGHT / MODEL_FRONT_DOOR.h;
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
      // Realign a ~0.9–1.0 × 2.0 m slab over the model's front door
      const doorW = Math.min(1.0, Math.max(0.9, d.w * s));
      const doorH = d.h * s;
      door.scale.set(doorW / 1.0, doorH / 2.0, 1);
      door.position.set(doorWorld.x, doorH / 2, doorWorld.z + 0.06);

      // Replace the fallback collider with the Kenney footprint. Front (maxZ) is
      // inset to the door slab so the porch stays walkable and the door is in range.
      const kenneyBox = new THREE.Box3().setFromObject(model);
      colliders.addHouse({
        id: 'main-house',
        minX: kenneyBox.min.x,
        maxX: kenneyBox.max.x,
        minZ: kenneyBox.min.z,
        maxZ: door.position.z
      });
    },
    undefined,
    (err) => {
      console.warn('House model failed to load, keeping the placeholder house', err);
    }
  );

  return scene;
}
