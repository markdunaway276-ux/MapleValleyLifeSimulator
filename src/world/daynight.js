import * as THREE from 'three';
import { wrapMinutes, MINUTES_PER_DAY } from '../systems/time.js';

/** Lighting is refreshed this often (cheap enough for phones). */
export const LIGHT_UPDATE_HZ = 8;
export const LIGHT_UPDATE_INTERVAL = 1 / LIGHT_UPDATE_HZ;

// Midday: slightly cooler sky, warmer but less blown-out sun, richer ground bounce.
const DAY = {
  skyTop: 0x3a7ab0,
  skyBottom: 0xb8d4e8,
  fog: 0xb8d4e8,
  hemiSky: 0x7eb0d8,
  hemiGround: 0x2a4a28,
  hemiInt: 0.42,
  ambient: 0xe8dcc8,
  ambientInt: 0.14,
  sun: 0xffd8a0,
  sunInt: 1.05,
  sunPos: [22, 32, 16],
  exponent: 0.75,
  interior: 0
};

export const LIGHT_KEYS = [
  // Deep night — cool blue-grey, low fill, soft moon-like sun
  { m: 0, skyTop: 0x080c18, skyBottom: 0x10182a, fog: 0x10182a, hemiSky: 0x2a3a58, hemiGround: 0x121810, hemiInt: 0.12, ambient: 0x141c2c, ambientInt: 0.06, sun: 0xa8b8e0, sunInt: 0.06, sunPos: [-8, 22, -24], exponent: 1.15, interior: 1 },
  { m: 4 * 60, skyTop: 0x080c18, skyBottom: 0x10182a, fog: 0x10182a, hemiSky: 0x2a3a58, hemiGround: 0x121810, hemiInt: 0.12, ambient: 0x141c2c, ambientInt: 0.06, sun: 0xa8b8e0, sunInt: 0.06, sunPos: [-4, 20, -24], exponent: 1.15, interior: 1 },
  // Dawn — muted purple/orange, restrained intensity
  { m: 5 * 60 + 30, skyTop: 0x5a3a68, skyBottom: 0xd88860, fog: 0xc87858, hemiSky: 0xc09080, hemiGround: 0x2e3a22, hemiInt: 0.24, ambient: 0xe8b898, ambientInt: 0.1, sun: 0xee8050, sunInt: 0.3, sunPos: [36, 6, 8], exponent: 0.85, interior: 0.7 },
  // Morning
  { m: 7 * 60, skyTop: 0x5a98c0, skyBottom: 0xd8c8a8, fog: 0xd0c0a0, hemiSky: 0xa0c8e8, hemiGround: 0x2a4a28, hemiInt: 0.36, ambient: 0xe8d8c0, ambientInt: 0.12, sun: 0xffc890, sunInt: 0.75, sunPos: [30, 18, 14], exponent: 0.75, interior: 0.2 },
  // Midday
  { m: 10 * 60, ...DAY },
  // Early afternoon — slightly brighter but still controlled
  { m: 13 * 60, skyTop: 0x4a98d0, skyBottom: 0xb8d8ec, fog: 0xb8d8ec, hemiSky: 0x90c0e8, hemiGround: 0x2a4a28, hemiInt: 0.48, ambient: 0xeee4d4, ambientInt: 0.16, sun: 0xffe8c0, sunInt: 1.15, sunPos: [8, 40, 18], exponent: 0.7, interior: 0 },
  // Golden hour — warmer, deeper
  { m: 17 * 60 + 30, skyTop: 0xc07038, skyBottom: 0xd8a068, fog: 0xc89058, hemiSky: 0xd8a878, hemiGround: 0x3a4820, hemiInt: 0.32, ambient: 0xe8c090, ambientInt: 0.12, sun: 0xffa048, sunInt: 0.75, sunPos: [-26, 14, 14], exponent: 0.75, interior: 0.25 },
  // Dusk
  { m: 19 * 60 + 30, skyTop: 0x1e2a52, skyBottom: 0xa05840, fog: 0x704050, hemiSky: 0x8f9bbc, hemiGround: 0x41483a, hemiInt: 0.34, ambient: 0xb3b1c5, ambientInt: 0.16, sun: 0xee6030, sunInt: 0.18, sunPos: [-30, 4, 10], exponent: 0.9, interior: 0.7 },
  // Evening into night
  { m: 21 * 60, skyTop: 0x0c1220, skyBottom: 0x141c30, fog: 0x141c30, hemiSky: 0x2a3a58, hemiGround: 0x121810, hemiInt: 0.12, ambient: 0x141c2c, ambientInt: 0.06, sun: 0xa8b8e0, sunInt: 0.08, sunPos: [-16, 20, -22], exponent: 1.1, interior: 1 },
  { m: MINUTES_PER_DAY, skyTop: 0x080c18, skyBottom: 0x10182a, fog: 0x10182a, hemiSky: 0x2a3a58, hemiGround: 0x121810, hemiInt: 0.12, ambient: 0x141c2c, ambientInt: 0.06, sun: 0xa8b8e0, sunInt: 0.06, sunPos: [-8, 22, -24], exponent: 1.15, interior: 1 }
];

export const INTERIOR_DAY_INTENSITY = 12;
export const INTERIOR_NIGHT_INTENSITY = 22;
/** Dim fill when the wall switch is off at night — dark but still readable. */
export const INTERIOR_OFF_DAY_INTENSITY = 0;
export const INTERIOR_OFF_NIGHT_INTENSITY = 5;
export const INTERIOR_EMISSIVE_DAY = new THREE.Color(0x221e18);
export const INTERIOR_EMISSIVE_NIGHT = new THREE.Color(0x4a4030);
export const INTERIOR_EMISSIVE_OFF_NIGHT = new THREE.Color(0x1c1a16);

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
  const lightsOn = isInteriorLightsOn(scene);
  const lamp = scene.getObjectByName('interior-light');
  if (lamp) {
    if (lamp.userData.baseIntensity == null) lamp.userData.baseIntensity = lamp.intensity || INTERIOR_DAY_INTENSITY;
    lamp.intensity = lightsOn
      ? lerp(INTERIOR_DAY_INTENSITY, INTERIOR_NIGHT_INTENSITY, night)
      : lerp(INTERIOR_OFF_DAY_INTENSITY, INTERIOR_OFF_NIGHT_INTENSITY, night);
  }
  const wall = scene.getObjectByName('interior-static');
  if (wall && wall.material && wall.material.emissive) {
    if (lightsOn) wall.material.emissive.copy(INTERIOR_EMISSIVE_DAY).lerp(INTERIOR_EMISSIVE_NIGHT, night);
    else wall.material.emissive.copy(INTERIOR_EMISSIVE_DAY).lerp(INTERIOR_EMISSIVE_OFF_NIGHT, night);
  }
  // Mobile (and the fixture glow on desktop) uses this unlit ceiling + lamps mesh.
  const fixtures = scene.getObjectByName('interior-lamps');
  if (fixtures && fixtures.material && fixtures.material.color) {
    fixtures.material.color.setHex(lightsOn ? 0xffffff : 0x000000);
  }
  return sample;
}

/** Interior lamps default to on when the save has no value yet. */
export function isInteriorLightsOn(scene) {
  if (!scene || !scene.userData) return true;
  return scene.userData.interiorLightsOn !== false;
}

export function setInteriorLightsOn(scene, on) {
  if (!scene) return isInteriorLightsOn(scene);
  if (!scene.userData) scene.userData = {};
  scene.userData.interiorLightsOn = !!on;
  return scene.userData.interiorLightsOn;
}

/**
 * Applies day/night colours to the sky, fog, lights and interior. Updates are
 * throttled to LIGHT_UPDATE_HZ; call apply() to force a sample (debug slider).
 */
export function createDayNight({ scene, quality = {}, modulate = null } = {}) {
  let acc = LIGHT_UPDATE_INTERVAL;
  let lastMinutes = null;
  let lastSample = null;
  let applies = 0;

  function apply(timeOrMinutes) {
    const minutes = (timeOrMinutes && typeof timeOrMinutes === 'object')
      ? timeOrMinutes.minutes
      : timeOrMinutes;
    const base = sampleLighting(minutes);
    const sample = (typeof modulate === 'function') ? (modulate(base) || base) : base;
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

  function refresh() {
    if (lastMinutes == null) return lastSample;
    return apply(lastMinutes);
  }

  return {
    apply,
    update,
    refresh,
    get lastSample() { return lastSample; },
    get applyCount() { return applies }
  };
}
