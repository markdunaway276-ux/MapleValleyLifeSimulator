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
 * Injects world-space procedural grit, subtle weathering, ground-level splash
 * grime, and roughness variation into any MeshStandardMaterial. Costs zero
 * draw calls and zero extra textures, breaking up flat surfaces without
 * warping wall normals. Scales with surface roughness so glossy glass/paint
 * stays clean.
 */
export function useWorldGrit(material, {
  strength = 1.0,
  groundGrime = 0.24,
  useVertexRough = false
} = {}) {
  if (!material || material.userData?.worldGrit) return material;
  const s = Number(strength).toFixed(3);
  const g = Number(groundGrime).toFixed(3);
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
// Crisp high-frequency surface grain + distance-faded architectural detail.
float gritDist = smoothstep(46.0, 12.0, length(vGritWorldPos - cameraPosition));
float gritFine = gritNoise(vGritWorldPos * 18.0);
float gritMicro = gritHash(floor(vGritWorldPos * 42.0));
float gritAge = gritNoise(vGritWorldPos * 0.35);
float gritVertical = 1.0 - smoothstep(0.45, 0.85, abs(vGritWorldNormal.y));
float gritSplash = gritVertical * (1.0 - smoothstep(0.0, 0.85, max(vGritWorldPos.y, 0.0))) * (0.65 + 0.35 * gritFine);
float gritTone = 1.0 + ((gritAge - 0.5) * 0.07 + (gritFine - 0.5) * 0.08 + (gritMicro - 0.5) * 0.06) * gritMask;

// Triplanar horizontal coordinate along walls/roofs.
float gritHoriz = abs(vGritWorldNormal.x) > abs(vGritWorldNormal.z) ? vGritWorldPos.z : vGritWorldPos.x;

// 1) Roof shingles on sloped roof planes (roughness ~0.82).
float roofSlope = smoothstep(0.28, 0.52, abs(vGritWorldNormal.y)) * (1.0 - smoothstep(0.92, 0.99, abs(vGritWorldNormal.y)));
float roofMatMask = roofSlope * smoothstep(0.76, 0.80, gritBaseRough) * (1.0 - smoothstep(0.84, 0.88, gritBaseRough)) * gritDist * ${s};
if (roofMatMask > 0.01) {
  float course = vGritWorldPos.y * 5.6 + (abs(vGritWorldNormal.x) > abs(vGritWorldNormal.z) ? vGritWorldPos.x : vGritWorldPos.z) * 1.4;
  float rowIdx = floor(course);
  float rowF = fract(course);
  float tabU = fract(gritHoriz * 2.8 + mod(rowIdx, 2.0) * 0.5);
  float lapShadow = smoothstep(0.0, 0.14, rowF);
  float tabSeam = smoothstep(0.0, 0.05, tabU) * smoothstep(0.0, 0.05, 1.0 - tabU);
  float tileVar = gritHash(vec3(floor(gritHoriz * 2.8 + mod(rowIdx, 2.0) * 0.5), rowIdx, 3.0)) - 0.5;
  gritTone *= mix(1.0, (0.86 + 0.14 * lapShadow) * (0.91 + 0.09 * tabSeam) + tileVar * 0.08, roofMatMask * 0.82);
}

// 2) Weathered running-bond brick on rough masonry walls (roughness >= 0.955).
float brickMask = gritVertical * smoothstep(0.952, 0.968, gritBaseRough) * gritDist * ${s};
if (brickMask > 0.01) {
  float bRow = vGritWorldPos.y * 11.5;
  float bRowI = floor(bRow);
  float bRowF = fract(bRow);
  float bCol = gritHoriz * 4.4 + mod(bRowI, 2.0) * 0.5;
  float bColI = floor(bCol);
  float bColF = fract(bCol);
  float mortar = 1.0 - smoothstep(0.0, 0.09, bRowF) * smoothstep(0.0, 0.06, bColF);
  float bVar = (gritHash(vec3(bColI, bRowI, 7.0)) - 0.5) * 0.12;
  gritTone *= 1.0 + bVar * brickMask;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.60, 0.56), mortar * brickMask * 0.34);
}

// 3) Clapboard lap siding on exterior plaster/siding walls (roughness ~0.915..0.952).
float sidingMask = gritVertical * smoothstep(0.915, 0.932, gritBaseRough) * (1.0 - smoothstep(0.948, 0.958, gritBaseRough)) * gritDist * ${s};
if (sidingMask > 0.01) {
  float plankY = fract(vGritWorldPos.y * 5.4);
  float lap = smoothstep(0.0, 0.13, plankY);
  float highlight = smoothstep(0.75, 0.96, plankY) * 0.05;
  gritTone *= mix(1.0, 0.87 + 0.13 * lap + highlight, sidingMask * 0.85);
}

// 4) Warm wood grain on timber / doors / fences (roughness ~0.68..0.88).
float woodMask = smoothstep(0.68, 0.72, gritBaseRough) * (1.0 - smoothstep(0.86, 0.90, gritBaseRough)) * (1.0 - roofSlope) * gritDist * ${s};
if (woodMask > 0.01) {
  float grain = gritNoise(vec3(gritHoriz * 14.0, vGritWorldPos.y * 3.2, vGritWorldPos.z * 14.0));
  float plankSeam = smoothstep(0.0, 0.06, fract(gritHoriz * 4.2));
  gritTone *= mix(1.0, (0.92 + grain * 0.14) * (0.93 + 0.07 * plankSeam), woodMask * 0.75);
}

gritTone *= 1.0 - gritSplash * ${g} * gritMask;
diffuseColor.rgb *= gritTone;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.84, 0.78), gritSplash * 0.40 * gritMask);`;

    const roughMod = `roughnessFactor = clamp(roughnessFactor + ((gritFine - 0.5) * 0.10 + (gritMicro - 0.5) * 0.08 + gritSplash * 0.10) * gritMask, 0.08, 1.0);`;

    const normalRelief = `#include <normal_fragment_maps>
{
  // Analytical 3D lighting relief along siding laps, roof shingle lips, and brick mortar (no dFdx).
  float reliefDist = smoothstep(38.0, 10.0, length(vGritWorldPos - cameraPosition)) * ${s};
  if (reliefDist > 0.01) {
    float rBase = ${roughExpr};
    float rVert = 1.0 - smoothstep(0.45, 0.85, abs(vGritWorldNormal.y));
    float rSlope = smoothstep(0.28, 0.52, abs(vGritWorldNormal.y)) * (1.0 - smoothstep(0.92, 0.99, abs(vGritWorldNormal.y)));
    float rHoriz = abs(vGritWorldNormal.x) > abs(vGritWorldNormal.z) ? vGritWorldPos.z : vGritWorldPos.x;
    vec3 vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 vSide = normalize(cross(vUp, normal) + vec3(1e-4));
    float dUp = 0.0;
    float dSide = 0.0;

    // Clapboard siding bevel lip
    float sMask = rVert * smoothstep(0.915, 0.932, rBase) * (1.0 - smoothstep(0.948, 0.958, rBase));
    if (sMask > 0.01) {
      float py = fract(vGritWorldPos.y * 5.4);
      dUp += (py < 0.13 ? -0.34 : 0.06) * sMask;
    }
    // Roof shingle course step
    float rfMask = rSlope * smoothstep(0.76, 0.80, rBase) * (1.0 - smoothstep(0.84, 0.88, rBase));
    if (rfMask > 0.01) {
      float course = vGritWorldPos.y * 5.6 + (abs(vGritWorldNormal.x) > abs(vGritWorldNormal.z) ? vGritWorldPos.x : vGritWorldPos.z) * 1.4;
      float rf = fract(course);
      dUp += (rf < 0.15 ? -0.30 : 0.04) * rfMask;
    }
    // Brick horizontal & vertical mortar recess
    float bMask = rVert * smoothstep(0.952, 0.968, rBase);
    if (bMask > 0.01) {
      float br = fract(vGritWorldPos.y * 11.5);
      float bc = fract(rHoriz * 4.4 + mod(floor(vGritWorldPos.y * 11.5), 2.0) * 0.5);
      dUp += (br < 0.09 ? -0.26 : (br > 0.92 ? 0.18 : 0.0)) * bMask;
      dSide += (bc < 0.06 ? -0.20 : (bc > 0.94 ? 0.16 : 0.0)) * bMask;
    }
    if (abs(dUp) + abs(dSide) > 0.001) {
      normal = normalize(normal + (vUp * dUp + vSide * dSide) * reliefDist);
    }
  }
}`;

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', gritHelpers)
      .replace('#include <color_fragment>', colorInject)
      .replace('#include <normal_fragment_maps>', normalRelief);

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
  material.customProgramCacheKey = () => `${prevKey}|world-grit-v3:${s}:${g}:${useVertexRough ? 1 : 0}`;
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
 * at night. Adds subtle world-space interior curtain folds and warm room
 * ceiling falloff so lit windows feel lived-in rather than flat rectangles.
 */
export function useVertexEmissive(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    if (!shader.vertexShader.includes('vWinWorldPos')) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWinWorldPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWinWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWinWorldPos;');
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
#ifdef USE_COLOR
  totalEmissiveRadiance *= vColor.rgb;
  float curtainFold = 0.84 + 0.16 * sin((vWinWorldPos.x + vWinWorldPos.z) * 16.0);
  float roomGrad = 0.78 + 0.28 * fract(vWinWorldPos.y * 0.72);
  totalEmissiveRadiance *= curtainFold * roomGrad;
#endif`
    );
  };
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => `${key}|vertex-emissive-v2`;
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
