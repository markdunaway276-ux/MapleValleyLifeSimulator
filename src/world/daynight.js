import * as THREE from 'three';
import { wrapMinutes, MINUTES_PER_DAY } from '../systems/time.js';

/** Lighting is refreshed this often (cheap enough for phones). */
export const LIGHT_UPDATE_HZ = 8;
export const LIGHT_UPDATE_INTERVAL = 1 / LIGHT_UPDATE_HZ;

// 10:00 matches the scene's original daylight (sky, hemi, ambient, sun).
const DAY = {
  skyTop: 0x4e9ad8,
  skyBottom: 0xd4ecfa,
  fog: 0xd4ecfa,
  hemiSky: 0x9ecbff,
  hemiGround: 0x3d6b32,
  hemiInt: 0.5,
  ambient: 0xfff4e8,
  ambientInt: 0.2,
  sun: 0xffe2b8,
  sunInt: 1.25,
  sunPos: [22, 32, 16],
  exponent: 0.7,
  interior: 0
};

export const LIGHT_KEYS = [
  { m: 0, skyTop: 0x0b1020, skyBottom: 0x151a2c, fog: 0x151a2c, hemiSky: 0x3a4a70, hemiGround: 0x1a2418, hemiInt: 0.16, ambient: 0x1c2438, ambientInt: 0.08, sun: 0xc8d4ff, sunInt: 0.08, sunPos: [-8, 22, -24], exponent: 1.1, interior: 1 },
  { m: 4 * 60, skyTop: 0x0b1020, skyBottom: 0x151a2c, fog: 0x151a2c, hemiSky: 0x3a4a70, hemiGround: 0x1a2418, hemiInt: 0.16, ambient: 0x1c2438, ambientInt: 0.08, sun: 0xc8d4ff, sunInt: 0.08, sunPos: [-4, 20, -24], exponent: 1.1, interior: 1 },
  { m: 5 * 60 + 30, skyTop: 0x6a4a7a, skyBottom: 0xf0a078, fog: 0xe89870, hemiSky: 0xd8a090, hemiGround: 0x3a4a28, hemiInt: 0.28, ambient: 0xffd0b0, ambientInt: 0.12, sun: 0xff9060, sunInt: 0.35, sunPos: [36, 6, 8], exponent: 0.8, interior: 0.7 },
  { m: 7 * 60, skyTop: 0x6aa8d8, skyBottom: 0xf0d8b8, fog: 0xe8d4b8, hemiSky: 0xb8d8ff, hemiGround: 0x3d6b32, hemiInt: 0.42, ambient: 0xfff0d8, ambientInt: 0.16, sun: 0xffd0a0, sunInt: 0.85, sunPos: [30, 18, 14], exponent: 0.7, interior: 0.2 },
  { m: 10 * 60, ...DAY },
  { m: 13 * 60, skyTop: 0x5aa8e6, skyBottom: 0xcfe8fa, fog: 0xcfe8fa, hemiSky: 0xa8d4ff, hemiGround: 0x3d6b32, hemiInt: 0.58, ambient: 0xfff6ee, ambientInt: 0.22, sun: 0xfff0d0, sunInt: 1.4, sunPos: [8, 40, 18], exponent: 0.65, interior: 0 },
  { m: 17 * 60 + 30, skyTop: 0xe08a4a, skyBottom: 0xf0c08a, fog: 0xe8b878, hemiSky: 0xf0c090, hemiGround: 0x4a5a28, hemiInt: 0.38, ambient: 0xffd8b0, ambientInt: 0.16, sun: 0xffb060, sunInt: 0.9, sunPos: [-26, 14, 14], exponent: 0.7, interior: 0.25 },
  { m: 19 * 60 + 30, skyTop: 0x2a3a6a, skyBottom: 0xc07050, fog: 0x8a5060, hemiSky: 0xc08070, hemiGround: 0x2a3a20, hemiInt: 0.22, ambient: 0xffb090, ambientInt: 0.1, sun: 0xff7040, sunInt: 0.22, sunPos: [-30, 4, 10], exponent: 0.85, interior: 0.7 },
  { m: 21 * 60, skyTop: 0x101628, skyBottom: 0x1a2238, fog: 0x1a2238, hemiSky: 0x3a4a70, hemiGround: 0x1a2418, hemiInt: 0.16, ambient: 0x1c2438, ambientInt: 0.08, sun: 0xc8d4ff, sunInt: 0.1, sunPos: [-16, 20, -22], exponent: 1.05, interior: 1 },
  { m: MINUTES_PER_DAY, skyTop: 0x0b1020, skyBottom: 0x151a2c, fog: 0x151a2c, hemiSky: 0x3a4a70, hemiGround: 0x1a2418, hemiInt: 0.16, ambient: 0x1c2438, ambientInt: 0.08, sun: 0xc8d4ff, sunInt: 0.08, sunPos: [-8, 22, -24], exponent: 1.1, interior: 1 }
];

const INTERIOR_DAY_INTENSITY = 14;
const INTERIOR_NIGHT_INTENSITY = 26;
const INTERIOR_EMISSIVE_DAY = new THREE.Color(0x2a251d);
const INTERIOR_EMISSIVE_NIGHT = new THREE.Color(0x5a4e3c);

const _a = new THREE.Color();
const _b = new THREE.Color();

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(out, a, b, t) {
  return out.set(a).lerp(_b.set(b), t);
}

export function sampleLighting(minutes) {
  const m = wrapMinutes(minutes);
  let i = 0;
  while (i < LIGHT_KEYS.length - 1 && LIGHT_KEYS[i + 1].m < m) i++;
  const a = LIGHT_KEYS[i];
  const b = LIGHT_KEYS[i + 1];
  const span = b.m - a.m || 1;
  const t = (m - a.m) / span;
  const sunPos = [
    lerp(a.sunPos[0], b.sunPos[0], t),
    lerp(a.sunPos[1], b.sunPos[1], t),
    lerp(a.sunPos[2], b.sunPos[2], t)
  ];
  return {
    skyTop: lerpColor(_a, a.skyTop, b.skyTop, t).getHex(),
    skyBottom: lerpColor(_a, a.skyBottom, b.skyBottom, t).getHex(),
    fog: lerpColor(_a, a.fog, b.fog, t).getHex(),
    hemiSky: lerpColor(_a, a.hemiSky, b.hemiSky, t).getHex(),
    hemiGround: lerpColor(_a, a.hemiGround, b.hemiGround, t).getHex(),
    hemiInt: lerp(a.hemiInt, b.hemiInt, t),
    ambient: lerpColor(_a, a.ambient, b.ambient, t).getHex(),
    ambientInt: lerp(a.ambientInt, b.ambientInt, t),
    sun: lerpColor(_a, a.sun, b.sun, t).getHex(),
    sunInt: lerp(a.sunInt, b.sunInt, t),
    sunPos,
    exponent: lerp(a.exponent, b.exponent, t),
    interior: lerp(a.interior, b.interior, t)
  };
}

function applySample(scene, sample, quality = {}) {
  if (!scene) return sample;
  const sky = scene.getObjectByName('sky');
  if (sky && sky.material && sky.material.uniforms) {
    sky.material.uniforms.topColor.value.setHex(sample.skyTop);
    sky.material.uniforms.bottomColor.value.setHex(sample.skyBottom);
    if (sky.material.uniforms.exponent) sky.material.uniforms.exponent.value = sample.exponent;
  }
  if (scene.background && scene.background.isColor) scene.background.setHex(sample.fog);
  else scene.background = new THREE.Color(sample.fog);
  if (scene.fog) scene.fog.color.setHex(sample.fog);

  const hemi = scene.getObjectByName('hemi');
  if (hemi) {
    hemi.color.setHex(sample.hemiSky);
    hemi.groundColor.setHex(sample.hemiGround);
    hemi.intensity = sample.hemiInt;
  }
  const ambient = scene.getObjectByName('ambient');
  if (ambient) {
    ambient.color.setHex(sample.ambient);
    ambient.intensity = sample.ambientInt;
  }
  const sun = scene.getObjectByName('sun');
  if (sun) {
    sun.color.setHex(sample.sun);
    sun.intensity = sample.sunInt;
    sun.position.set(sample.sunPos[0], sample.sunPos[1], sample.sunPos[2]);
    // Shadows stay desktop-only; never flip this on a phone mid-cycle.
    sun.castShadow = !!quality.shadows;
    if (sun.target) sun.target.updateMatrixWorld();
  }

  const night = sample.interior;
  const lamp = scene.getObjectByName('interior-light');
  if (lamp) {
    if (lamp.userData.baseIntensity == null) lamp.userData.baseIntensity = lamp.intensity || INTERIOR_DAY_INTENSITY;
    lamp.intensity = lerp(INTERIOR_DAY_INTENSITY, INTERIOR_NIGHT_INTENSITY, night);
  }
  const wall = scene.getObjectByName('interior-static');
  if (wall && wall.material && wall.material.emissive) {
    wall.material.emissive.copy(INTERIOR_EMISSIVE_DAY).lerp(INTERIOR_EMISSIVE_NIGHT, night);
  }
  return sample;
}

/**
 * Applies day/night colours to the sky, fog, lights and interior. Updates are
 * throttled to LIGHT_UPDATE_HZ; call apply() to force a sample (debug slider).
 */
export function createDayNight({ scene, quality = {} } = {}) {
  let acc = LIGHT_UPDATE_INTERVAL;
  let lastMinutes = null;
  let lastSample = null;
  let applies = 0;

  function apply(timeOrMinutes) {
    const minutes = (timeOrMinutes && typeof timeOrMinutes === 'object')
      ? timeOrMinutes.minutes
      : timeOrMinutes;
    const sample = sampleLighting(minutes);
    applySample(scene, sample, quality);
    lastMinutes = wrapMinutes(minutes);
    lastSample = sample;
    applies += 1;
    acc = 0;
    return sample;
  }

  function update(deltaSeconds, timeOrMinutes) {
    const minutes = (timeOrMinutes && typeof timeOrMinutes === 'object')
      ? timeOrMinutes.minutes
      : timeOrMinutes;
    acc += Math.max(0, Number(deltaSeconds) || 0);
    let jumped = false;
    if (lastMinutes != null) {
      let d = wrapMinutes(minutes) - lastMinutes;
      if (d > MINUTES_PER_DAY / 2) d -= MINUTES_PER_DAY;
      if (d < -MINUTES_PER_DAY / 2) d += MINUTES_PER_DAY;
      jumped = Math.abs(d) > 1;
    }
    if (acc < LIGHT_UPDATE_INTERVAL && !jumped) return lastSample;
    return apply(minutes);
  }

  return {
    apply,
    update,
    get lastSample() { return lastSample; },
    get applyCount() { return applies }
  };
}
