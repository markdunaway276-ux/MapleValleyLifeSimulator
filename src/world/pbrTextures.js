import * as THREE from 'three';

/**
 * Real CC0 PBR surface textures (512 px WebP, sourced from Poly Haven) with
 * seamless procedural fallbacks. Streams gently in the background (max 3
 * concurrent decodes with 1-frame yields) so the loading/title screen stays
 * responsive, and safely no-ops in headless Node unit tests.
 */

export const PBR_BASE_PATH = './assets/textures/pbr/';

export const PBR_SETS = Object.freeze({
  grass: { source: 'grass_ground', normalScale: 0.65 },
  asphalt: { source: 'asphalt_02', normalScale: 0.60 },
  concrete: { source: 'concrete_pavement', normalScale: 0.55 },
  gravel: { source: 'gravel_road', normalScale: 0.75 },
  wood_floor: { source: 'old_wood_floor', normalScale: 0.55 }
});

let sharedLoader = null;
const imageCache = new Map();
const texQueue = [];
let activeTex = 0;
const MAX_CONCURRENT_TEX = 3;

function canLoadInBrowser() {
  return typeof document !== 'undefined' && typeof Image !== 'undefined';
}

function getLoader() {
  if (!sharedLoader) sharedLoader = new THREE.TextureLoader();
  return sharedLoader;
}

function nextFrame() {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return Promise.resolve();
}

function pumpTexQueue() {
  while (activeTex < MAX_CONCURRENT_TEX && texQueue.length > 0) {
    const job = texQueue.shift();
    activeTex += 1;
    getLoader().load(
      job.url,
      (loaded) => {
        activeTex -= 1;
        job.entry.texture = loaded;
        const waiters = job.entry.waiters || [];
        job.entry.waiters = null;
        for (let i = 0; i < waiters.length; i++) {
          const w = waiters[i];
          const tex = i === 0 ? loaded : loaded.clone();
          tex.image = loaded.image;
          configureTexture(tex, w.opts);
          w.onReady(tex);
        }
        nextFrame().then(pumpTexQueue);
      },
      undefined,
      () => {
        activeTex -= 1;
        job.entry.waiters = null;
        nextFrame().then(pumpTexQueue);
      }
    );
  }
}

function configureTexture(tex, { repeat, anisotropy = 4, colorSpace = THREE.SRGBColorSpace }) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) {
    if (Array.isArray(repeat)) tex.repeat.set(repeat[0], repeat[1]);
    else if (typeof repeat.x === 'number') tex.repeat.copy(repeat);
  }
  tex.colorSpace = colorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function loadCachedTexture(url, opts, onReady) {
  const existing = imageCache.get(url);
  if (existing && existing.texture) {
    const clone = existing.texture.clone();
    clone.image = existing.texture.image;
    configureTexture(clone, opts);
    onReady(clone);
    return;
  }
  if (existing && existing.waiters) {
    existing.waiters.push({ opts, onReady });
    return;
  }
  const entry = { texture: null, waiters: [{ opts, onReady }] };
  imageCache.set(url, entry);
  texQueue.push({ url, entry });
  pumpTexQueue();
}

/**
 * Upgrades a MeshStandardMaterial in-place with CC0 PBR diffuse, normal, and
 * roughness maps once loaded, keeping whatever procedural map it already has
 * as an instant fallback.
 */
export function applyPbrSurface(material, setName, {
  repeat = [1, 1],
  anisotropy = 4,
  normalScale = null,
  useDiffuse = true,
  useNormal = true,
  useRoughness = true,
  tint = null,
  roughness = null
} = {}) {
  if (!material || !PBR_SETS[setName] || !canLoadInBrowser()) return material;
  const spec = PBR_SETS[setName];
  const nScale = normalScale ?? spec.normalScale ?? 0.6;

  if (useDiffuse) {
    loadCachedTexture(
      `${PBR_BASE_PATH}${setName}_diff.webp`,
      { repeat, anisotropy, colorSpace: THREE.SRGBColorSpace },
      (tex) => {
        material.map = tex;
        if (tint !== null) material.color.set(tint);
        material.needsUpdate = true;
      }
    );
  }

  if (useNormal) {
    loadCachedTexture(
      `${PBR_BASE_PATH}${setName}_nor.webp`,
      { repeat, anisotropy, colorSpace: THREE.NoColorSpace },
      (tex) => {
        material.normalMap = tex;
        material.normalScale = new THREE.Vector2(nScale, nScale);
        material.bumpMap = null;
        material.needsUpdate = true;
      }
    );
  }

  if (useRoughness) {
    loadCachedTexture(
      `${PBR_BASE_PATH}${setName}_rough.webp`,
      { repeat, anisotropy, colorSpace: THREE.NoColorSpace },
      (tex) => {
        material.roughnessMap = tex;
        if (roughness !== null) material.roughness = roughness;
        material.needsUpdate = true;
      }
    );
  }

  return material;
}

function makeTiledCanvasTexture(img, tilesX, tilesY, width, height, { repeat, anisotropy, colorSpace }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const tw = width / tilesX;
  const th = height / tilesY;
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.drawImage(img, x * tw, y * th, tw, th);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  return configureTexture(tex, { repeat, anisotropy, colorSpace });
}

/**
 * Upgrades the Maple Lane road material with real CC0 asphalt PBR maps while
 * preserving the crisp painted lane dashes, parking lines, and kerb wear on
 * `roadTex`.
 */
export function applyRoadAsphaltPbr(roadMat, roadTex, {
  tilesX = 4,
  tilesY = 2,
  anisotropy = 8,
  normalScale = 0.55,
  hiRes = true
} = {}) {
  if (!roadMat || !roadTex || !canLoadInBrowser()) return roadMat;
  const w = hiRes ? 1024 : 512;
  const h = hiRes ? 512 : 256;
  const repeat = roadTex.repeat;

  // Blend photographic asphalt grain into the road diffuse canvas without washing out lane paint.
  loadCachedTexture(
    `${PBR_BASE_PATH}asphalt_diff.webp`,
    { repeat: [1, 1], anisotropy, colorSpace: THREE.SRGBColorSpace },
    (tex) => {
      const src = roadTex.image;
      if (!src || typeof src.getContext !== 'function') return;
      const ctx = src.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.42;
      const tw = src.width / tilesX;
      const th = src.height / tilesY;
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          ctx.drawImage(tex.image, x * tw, y * th, tw, th);
        }
      }
      ctx.restore();
      roadTex.needsUpdate = true;
    }
  );

  loadCachedTexture(
    `${PBR_BASE_PATH}asphalt_nor.webp`,
    { repeat: [1, 1], anisotropy, colorSpace: THREE.NoColorSpace },
    (tex) => {
      roadMat.normalMap = makeTiledCanvasTexture(tex.image, tilesX, tilesY, w, h, {
        repeat, anisotropy, colorSpace: THREE.NoColorSpace
      });
      roadMat.normalScale = new THREE.Vector2(normalScale, normalScale);
      roadMat.bumpMap = null;
      roadMat.needsUpdate = true;
    }
  );

  loadCachedTexture(
    `${PBR_BASE_PATH}asphalt_rough.webp`,
    { repeat: [1, 1], anisotropy, colorSpace: THREE.NoColorSpace },
    (tex) => {
      roadMat.roughnessMap = makeTiledCanvasTexture(tex.image, tilesX, tilesY, w, h, {
        repeat, anisotropy, colorSpace: THREE.NoColorSpace
      });
      roadMat.roughness = 0.94;
      roadMat.needsUpdate = true;
    }
  );

  return roadMat;
}
