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
