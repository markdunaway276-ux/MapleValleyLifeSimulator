import * as THREE from 'three';

/**
 * Procedural PMREM sky environment map synced to the day/night cycle.
 * Gives car paint, windshields, shop glass, metallic fixtures, wet asphalt,
 * and pond water crisp sky/sunset/night reflections with zero external HDRI
 * downloads and negligible frame cost (rebakes only when lighting shifts).
 */
export function createSkyEnvMap(renderer, scene, quality = {}) {
  if (!renderer || !scene || typeof renderer.getContext !== 'function') {
    return { update() {}, dispose() {} };
  }

  let pmrem = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader?.();
  } catch {
    return { update() {}, dispose() {} };
  }

  const envScene = new THREE.Scene();
  const uniforms = {
    topColor: { value: new THREE.Color(0x4a7ea4) },
    bottomColor: { value: new THREE.Color(0xc2d2dc) },
    groundColor: { value: new THREE.Color(0x344632) },
    sunColor: { value: new THREE.Color(0xffe4bc) },
    sunDir: { value: new THREE.Vector3(22, 32, 16).normalize() },
    nightFactor: { value: 0 }
  };

  const domeMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 groundColor;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      uniform float nightFactor;
      varying vec3 vDir;

      void main() {
        vec3 d = normalize(vDir);
        vec3 col;
        if (d.y >= 0.0) {
          col = mix(bottomColor, topColor, pow(d.y, 0.72));
          float sDot = max(dot(d, normalize(sunDir)), 0.0);
          float dayAmt = 1.0 - smoothstep(0.55, 0.92, nightFactor);
          // Bright sun disc + atmospheric sheen for crisp specular highlights on paint & glass.
          col += sunColor * (pow(sDot, 8.0) * 0.45 * dayAmt + pow(sDot, 96.0) * 2.6 * dayAmt);
          // Soft warm town-glow band near the horizon at night so dark chrome still catches light.
          float townBand = exp(-abs(d.y - 0.06) * 14.0) * nightFactor;
          col += vec3(0.42, 0.30, 0.16) * townBand * 0.45;
        } else {
          float g = clamp(-d.y * 2.4, 0.0, 1.0);
          col = mix(bottomColor * 0.55, groundColor * (0.65 - nightFactor * 0.42), g);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 12), domeMat);
  envScene.add(dome);

  let currentRT = null;
  let lastKey = '';
  let lastBakeTime = -999;

  function bake(sample) {
    if (!sample) return;
    uniforms.topColor.value.setHex(sample.skyTop ?? 0x4a7ea4);
    uniforms.bottomColor.value.setHex(sample.skyBottom ?? 0xc2d2dc);
    uniforms.groundColor.value.setHex(sample.hemiGround ?? 0x344632);
    uniforms.sunColor.value.setHex(sample.sun ?? 0xffe4bc);
    if (sample.sunPos) {
      uniforms.sunDir.value.set(sample.sunPos[0], sample.sunPos[1], sample.sunPos[2]).normalize();
    }
    uniforms.nightFactor.value = sample.interior ?? 0;

    const nextRT = pmrem.fromScene(envScene, 0.04);
    if (currentRT) currentRT.dispose();
    currentRT = nextRT;
    scene.environment = currentRT.texture;
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = quality.shadows ? 0.82 : 0.62;
    }
  }

  return {
    update(sample, nowSeconds = 0) {
      if (!sample) return;
      // Quantize key so we rebake smoothly as the sky shifts without per-frame cost.
      const key = `${sample.skyTop >> 4}:${sample.skyBottom >> 4}:${Math.round((sample.interior || 0) * 20)}`;
      if (key === lastKey && currentRT) return;
      if (currentRT && nowSeconds > 0 && nowSeconds - lastBakeTime < 1.2) return;
      lastKey = key;
      lastBakeTime = nowSeconds;
      bake(sample);
    },
    dispose() {
      if (currentRT) currentRT.dispose();
      currentRT = null;
      dome.geometry.dispose();
      domeMat.dispose();
      pmrem.dispose();
    }
  };
}
