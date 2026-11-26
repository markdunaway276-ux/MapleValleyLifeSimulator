import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LOOK } from './palette.js';

const G = LOOK.grade;

/**
 * Rustic "movie" grade on display colours: darker gain, filmic S-curve, earthier
 * saturation, olive shadows / amber highlights, lifted warm blacks, a vignette and
 * light animated grain. Tuning lives in LOOK.grade (palette.js). Desktop only.
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    strength: { value: 1 },
    gain: { value: G.gain },
    curve: { value: G.curve },
    saturation: { value: G.saturation },
    shadowTint: { value: new THREE.Vector3(...G.shadowTint) },
    highlightTint: { value: new THREE.Vector3(...G.highlightTint) },
    fade: { value: G.fade },
    fadeColor: { value: new THREE.Vector3(...G.fadeColor) },
    vignette: { value: G.vignette },
    grain: { value: G.grain }
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
    uniform float time;
    uniform float strength;
    uniform float gain;
    uniform float curve;
    uniform float saturation;
    uniform vec3 shadowTint;
    uniform vec3 highlightTint;
    uniform float fade;
    uniform vec3 fadeColor;
    uniform float vignette;
    uniform float grain;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = clamp(src.rgb * gain, 0.0, 1.0);

      // Filmic S-curve: deeper shadows, gently rolled highlights.
      c = mix(c, c * c * (3.0 - 2.0 * c), curve);

      // Earthier saturation.
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, saturation);

      // Split tone: cool olive shadows, warm amber highlights.
      float sh = 1.0 - smoothstep(0.0, 0.55, luma);
      float hi = smoothstep(0.35, 1.0, luma);
      c += shadowTint * sh + highlightTint * hi;

      // Lifted, warm film blacks.
      c = fadeColor * fade + c * (1.0 - fade);

      // Vignette, slightly warm-brown at the edges.
      vec2 q = vUv * 2.0 - 1.0;
      float v = smoothstep(1.6, 0.35, length(q * vec2(0.92, 1.0)));
      c *= mix(1.0 - vignette * 0.55, 1.0, v);

      // Light animated grain, strongest in the midtones.
      if (grain > 0.0) {
        float n = hash(gl_FragCoord.xy + fract(time * 7.13) * 91.7) - 0.5;
        c += n * grain * (1.0 - abs(luma - 0.5) * 1.2);
      }

      // strength 0 = the plain image, 1 = the full grade (Debug -> Display -> Film look).
      c = mix(clamp(src.rgb, 0.0, 1.0), c, strength);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
    }
  `
};

/**
 * Optional post-processing. Returns null on mobile so the plain renderer is used
 * (display.js gives phones a cheap CSS grade instead).
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, enabled: boolean }} opts
 */
export function createPost({ renderer, scene, camera, enabled }) {
  if (!enabled) return null;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // RenderPass draws into a linear render target, so tone mapping (ACES, LOOK.exposure)
  // and the sRGB conversion are NOT applied there. OutputPass applies them; without it
  // the whole frame comes out far too dark. The grade below then works on display colours.
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const start = performance.now();

  return {
    render() {
      grade.uniforms.time.value = (performance.now() - start) / 1000;
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
    },
    /** 0 = no grade, 1 = full grade. */
    setGradeStrength(v) {
      grade.uniforms.strength.value = Math.min(1, Math.max(0, Number(v) || 0));
    },
    setGrain(on) {
      grade.uniforms.grain.value = on ? G.grain : 0;
    }
  };
}
