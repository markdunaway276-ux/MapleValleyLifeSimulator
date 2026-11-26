import * as THREE from 'three';

/** Name of the per-vertex roughness attribute written by Parts (buildings.js). */
export const ROUGH_ATTR = 'aRough';

/**
 * Lets one merged mesh carry many roughnesses: the fragment shader uses the
 * per-vertex `aRough` attribute (0..1) times material.roughness. Set the
 * material's own roughness to 1 so the attribute is the final value. It
 * costs no draw calls and no extra textures, so it is mobile-safe.
 */
export function useVertexRoughness(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float ${ROUGH_ATTR};\nvarying float vRough;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvRough = ${ROUGH_ATTR};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRough;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vRough;');
  };
  material.customProgramCacheKey = () => 'vertex-roughness-v1';
  material.userData.vertexRoughness = true;
  return material;
}

/** Standard PBR material that reads per-vertex colour and roughness. */
export function createVertexMaterial({ metalness = 0.04, emissive = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness });
  if (emissive !== null) m.emissive = new THREE.Color(emissive);
  return useVertexRoughness(m);
}

/**
 * Makes a vertex-coloured material's emissive follow the vertex colour, so
 * one merged glass mesh can carry a tint gradient and still never go black
 * at night. The emissive colour/intensity set on the material is the ceiling.
 */
export function useVertexEmissive(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'
    );
  };
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => `${key}|vertex-emissive-v1`;
  material.userData.vertexEmissive = true;
  return material;
}

/** Small deterministic hash for per-vertex speckle: [0, 1). */
function hash01(i, seed) {
  let n = Math.imul(i + 1, 374761393) ^ Math.imul(seed + 7, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Bakes cheap ambient occlusion into any geometry's vertex colours: the
 * lowest `height` metres darken by `strength`, so props and trees sit on the
 * ground instead of floating. `jitter` adds a per-vertex brightness speckle
 * (foliage), `top` brightens the highest vertices a little. Colours multiply
 * the material colour, so build the material with `vertexColors: true`
 * (see createPropMaterial). Returns the same geometry.
 */
export function bakeFootAo(geometry, { strength = 0.35, height = 0.5, jitter = 0, top = 0, seed = 1 } = {}) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-4, Math.min(height, maxY - minY));
  const rise = Math.max(1e-4, maxY - minY);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i) - minY;
    const t = Math.min(1, Math.max(0, y / span));
    const s = t * t * (3 - 2 * t);
    let f = 1 - strength * (1 - s);
    if (top) f *= 1 + top * Math.min(1, Math.max(0, y / rise));
    if (jitter) f *= 1 - jitter + hash01(i, seed) * jitter * 2;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geometry;
}

/** Standard PBR material that multiplies its colour by baked vertex colours. */
export function createPropMaterial({ color = 0xffffff, roughness = 0.8, metalness = 0, emissive = null, flatShading = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, vertexColors: true, flatShading });
  if (emissive !== null) m.emissive = new THREE.Color(emissive);
  return m;
}
