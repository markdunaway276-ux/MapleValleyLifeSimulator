import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/** Gentle vignette + mild contrast/saturation grading. Desktop only. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.55 },
    contrast: { value: 1.06 },
    saturation: { value: 1.08 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Mild contrast
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;

      // Mild saturation
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);

      // Soft vignette
      vec2 uv = vUv * 2.0 - 1.0;
      float vig = 1.0 - dot(uv, uv) * vignette;
      color.rgb *= clamp(vig, 0.0, 1.0);

      gl_FragColor = color;
    }
  `
};

/**
 * Optional post-processing. Returns null on mobile so the plain renderer is used.
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, enabled: boolean }} opts
 */
export function createPost({ renderer, scene, camera, enabled }) {
  if (!enabled) return null;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  return {
    render() {
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
    }
  };
}
