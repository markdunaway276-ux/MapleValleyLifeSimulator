import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LOOK } from './palette.js';

const G = LOOK.grade;

/**
 * Gritty small-town grade on display colours: subtle micro-sharpening, soft
 * highlight bloom/halation for lights and signs, punchier filmic S-curve,
 * desaturated midtones, cool-slate shadows / dusty highlights, tight charcoal
 * blacks, cool vignette, and tactile animated grain. Tuning lives in LOOK.grade
 * (palette.js). Desktop only.
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1280, 720) },
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
    grain: { value: G.grain },
    sharpen: { value: G.sharpen ?? 0.22 },
    bloom: { value: G.bloom ?? 0.24 },
    bloomThreshold: { value: G.bloomThreshold ?? 0.78 }
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
    uniform vec2 resolution;
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
    uniform float sharpen;
    uniform float bloom;
    uniform float bloomThreshold;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    vec3 sampleBloom(vec2 uv, vec2 px) {
      vec3 acc = vec3(0.0);
      // 8-tap wide cross + diagonal halo for cheap single-pass highlight glow.
      vec2 o1 = px * 3.5;
      vec2 o2 = px * 7.5;
      vec3 s;
      float b;
      s = texture2D(tDiffuse, uv + vec2( o1.x,  0.0)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b);
      s = texture2D(tDiffuse, uv + vec2(-o1.x,  0.0)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b);
      s = texture2D(tDiffuse, uv + vec2( 0.0,  o1.y)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b);
      s = texture2D(tDiffuse, uv + vec2( 0.0, -o1.y)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b);
      s = texture2D(tDiffuse, uv + vec2( o2.x,  o2.y)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b) * 0.7;
      s = texture2D(tDiffuse, uv + vec2(-o2.x,  o2.y)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b) * 0.7;
      s = texture2D(tDiffuse, uv + vec2( o2.x, -o2.y)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b) * 0.7;
      s = texture2D(tDiffuse, uv + vec2(-o2.x, -o2.y)).rgb; b = max(max(s.r, s.g), s.b); acc += s * smoothstep(bloomThreshold, 1.0, b) * 0.7;
      return acc * (1.0 / 6.8);
    }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec2 px = 1.0 / max(resolution, vec2(1.0));
      vec3 c = src.rgb;

      // Subtle unsharp-mask crispness so rough textures and edges read clearly.
      if (sharpen > 0.0 && strength > 0.0) {
        vec3 n = (
          texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb +
          texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb +
          texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb +
          texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb
        ) * 0.25;
        vec3 edge = clamp(c - n, -0.12, 0.12);
        c += edge * sharpen;
      }

      // Soft highlight glow on bright lights, signs, and bright sky edges.
      if (bloom > 0.0 && strength > 0.0) {
        c += sampleBloom(vUv, px) * bloom;
      }

      c = clamp(c * gain, 0.0, 1.0);

      // Punchier filmic S-curve: deeper shadows, grittier midtone separation.
      c = mix(c, c * c * (3.0 - 2.0 * c), curve);

      // Desaturated small-town midtones while letting strong accents survive slightly more.
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float chroma = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
      float sat = mix(saturation, min(1.0, saturation + 0.14), smoothstep(0.22, 0.65, chroma));
      c = mix(vec3(luma), c, sat);

      // Split tone: cool slate-teal shadows, subtle dusty warm highlights.
      float sh = 1.0 - smoothstep(0.0, 0.50, luma);
      float hi = smoothstep(0.42, 1.0, luma);
      c += shadowTint * sh + highlightTint * hi;

      // Tight, cool charcoal blacks.
      c = fadeColor * fade + c * (1.0 - fade);

      // Grounded dark vignette at the frame edges.
      vec2 q = vUv * 2.0 - 1.0;
      float v = smoothstep(1.58, 0.36, length(q * vec2(0.92, 1.0)));
      c *= mix(1.0 - vignette * 0.52, 1.0, v);

      // Tactile animated film/sensor grain, slightly stronger in shadows & midtones.
      if (grain > 0.0) {
        float n = hash(gl_FragCoord.xy + fract(time * 7.13) * 91.7) - 0.5;
        c += n * grain * (1.08 - luma * 0.65);
      }

      // strength 0 = the plain image, 1 = the full grade (Debug -> Display -> Film look).
      c = mix(clamp(src.rgb, 0.0, 1.0), clamp(c, 0.0, 1.0), strength);
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
  const size = new THREE.Vector2();
  if (typeof renderer.getSize === 'function') {
    renderer.getSize(size);
    if (size.x > 0 && size.y > 0) grade.uniforms.resolution.value.copy(size);
  }
  composer.addPass(grade);
  const start = performance.now();

  return {
    render() {
      grade.uniforms.time.value = (performance.now() - start) / 1000;
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
      grade.uniforms.resolution.value.set(Math.max(1, w), Math.max(1, h));
    },
    /** 0 = no grade, 1 = full grade. */
    setGradeStrength(v) {
      grade.uniforms.strength.value = Math.min(1, Math.max(0, Number(v) || 0));
    },
    setGrain(on) {
      grade.uniforms.grain.value = on ? G.grain : 0;
    },
    setPreset(cfg) {
      if (!cfg) return;
      if (cfg.gain != null) grade.uniforms.gain.value = cfg.gain;
      if (cfg.curve != null) grade.uniforms.curve.value = cfg.curve;
      if (cfg.saturation != null) grade.uniforms.saturation.value = cfg.saturation;
      if (cfg.shadowTint) grade.uniforms.shadowTint.value.set(...cfg.shadowTint);
      if (cfg.highlightTint) grade.uniforms.highlightTint.value.set(...cfg.highlightTint);
      if (cfg.vignette != null) grade.uniforms.vignette.value = cfg.vignette;
      if (cfg.bloom != null) grade.uniforms.bloom.value = cfg.bloom;
    }
  };
}
