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

/**
 * Injects world-space procedural grit, weathering, vertical rain streaks,
 * ground-level splash grime, roughness variation, and subtle screen-space
 * micro-bump into any MeshStandardMaterial. Costs zero draw calls and zero
 * extra textures, breaking up flat low-poly/blocky surfaces across the whole
 * town. Scales with surface roughness so glossy glass/paint stays clean.
 */
export function useWorldGrit(material, {
  strength = 1.0,
  groundGrime = 0.24,
  bump = 0.16,
  useVertexRough = false
} = {}) {
  if (!material || material.userData?.worldGrit) return material;
  const s = Number(strength).toFixed(3);
  const g = Number(groundGrime).toFixed(3);
  const b = Number(bump).toFixed(3);
  const roughExpr = useVertexRough ? '(roughness * vRough)' : 'roughness';
  const prev = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vGritWorldPos;
varying vec3 vGritWorldNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 gritLocalPos = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  gritLocalPos = instanceMatrix * gritLocalPos;
#endif
vGritWorldPos = ( modelMatrix * gritLocalPos ).xyz;
mat3 gritNormMat = mat3( modelMatrix );
#ifdef USE_INSTANCING
  gritNormMat = gritNormMat * mat3( instanceMatrix );
#endif
vGritWorldNormal = normalize( gritNormMat * objectNormal );`);

    const gritHelpers = `#include <common>
varying vec3 vGritWorldPos;
varying vec3 vGritWorldNormal;
float gritHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float gritNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(gritHash(i + vec3(0.0, 0.0, 0.0)), gritHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(gritHash(i + vec3(0.0, 1.0, 0.0)), gritHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(gritHash(i + vec3(0.0, 0.0, 1.0)), gritHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(gritHash(i + vec3(0.0, 1.0, 1.0)), gritHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}`;

    const colorInject = `#include <color_fragment>
float gritBaseRough = ${roughExpr};
float gritMask = smoothstep(0.32, 0.72, gritBaseRough) * ${s};
float gritBroad = gritNoise(vGritWorldPos * 0.55);
float gritMid = gritNoise(vGritWorldPos * 2.8);
float gritFine = gritNoise(vGritWorldPos * 11.5);
float gritStreak = gritNoise(vec3(vGritWorldPos.x * 3.4, vGritWorldPos.y * 0.45, vGritWorldPos.z * 3.4));
float gritVertical = 1.0 - smoothstep(0.45, 0.85, abs(vGritWorldNormal.y));
float gritSplash = gritVertical * (1.0 - smoothstep(0.0, 0.95, max(vGritWorldPos.y, 0.0))) * (0.55 + 0.45 * gritMid);
float gritHeight = gritMid * 0.55 + gritFine * 0.45;
float gritTone = 1.0 + ((gritBroad - 0.5) * 0.14 + (gritMid - 0.5) * 0.11 + (gritFine - 0.5) * 0.09) * gritMask;
gritTone *= 1.0 - gritVertical * smoothstep(0.55, 0.92, gritStreak) * 0.12 * gritMask;
gritTone *= 1.0 - gritSplash * ${g} * gritMask;
diffuseColor.rgb *= gritTone;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.85, 0.83, 0.77), gritSplash * 0.45 * gritMask);`;

    const roughMod = `roughnessFactor = clamp(roughnessFactor + ((gritMid - 0.5) * 0.16 + (gritFine - 0.5) * 0.12 + gritSplash * 0.12) * gritMask, 0.08, 1.0);`;

    const bumpInject = `#include <normal_fragment_maps>
if (gritMask > 0.01) {
  float gritDhx = dFdx(gritHeight);
  float gritDhy = dFdy(gritHeight);
  vec3 gritPosX = dFdx(-vViewPosition);
  vec3 gritPosY = dFdy(-vViewPosition);
  vec3 gritR1 = cross(gritPosY, normal);
  vec3 gritR2 = cross(normal, gritPosX);
  float gritDet = dot(gritPosX, gritR1);
  if (abs(gritDet) > 1e-6) {
    vec3 gritGrad = sign(gritDet) * (gritDhx * gritR1 + gritDhy * gritR2);
    normal = normalize(abs(gritDet) * normal - gritGrad * (${b} * gritMask));
  }
}`;

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', gritHelpers)
      .replace('#include <color_fragment>', colorInject)
      .replace('#include <normal_fragment_maps>', bumpInject);

    if (shader.fragmentShader.includes('#include <roughnessmap_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n${roughMod}`
      );
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        'float roughnessFactor = roughness * vRough;',
        `float roughnessFactor = roughness * vRough;\n${roughMod}`
      );
    }
  };

  const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => `${prevKey}|world-grit-v1:${s}:${g}:${b}:${useVertexRough ? 1 : 0}`;
  material.userData.worldGrit = true;
  return material;
}

/** Standard PBR material that reads per-vertex colour, roughness, and world-space grit. */
export function createVertexMaterial({ metalness = 0.04, emissive = null, grit = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness });
  if (emissive !== null) m.emissive = new THREE.Color(emissive);
  useVertexRoughness(m);
  if (grit) useWorldGrit(m, { useVertexRough: true });
  return m;
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
