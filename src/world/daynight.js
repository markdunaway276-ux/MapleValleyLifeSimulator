import * as THREE from 'three';
import { wrapMinutes, MINUTES_PER_DAY } from '../systems/time.js';

/** Lighting is refreshed this often (cheap enough for phones). */
export const LIGHT_UPDATE_HZ = 8;
export const LIGHT_UPDATE_INTERVAL = 1 / LIGHT_UPDATE_HZ;

// three r169 uses physical light units (no legacy x PI), so daytime intensities sit
// around 3x the old values; night keys are unchanged so nights stay dark.
// Midday: bright, slightly hazy small-town daylight with crisp sun-to-shadow contrast.
const DAY = {
  skyTop: 0x4a7ea4,
  skyBottom: 0xc2d2dc,
  fog: 0xc2d2dc,
  hemiSky: 0x90b4cc,
  hemiGround: 0x344632,
  hemiInt: 1.18,
  ambient: 0xe4dfd4,
  ambientInt: 0.38,
  sun: 0xffe4bc,
  sunInt: 3.35,
  sunPos: [22, 32, 16],
  exponent: 0.78,
  interior: 0
};

export const LIGHT_KEYS = [
  // Deep night — gritty blue-slate, low fill, cool moonlit shadows
  { m: 0, skyTop: 0x080d1a, skyBottom: 0x121b2c, fog: 0x121b2c, hemiSky: 0x2c3e5c, hemiGround: 0x141a16, hemiInt: 0.16, ambient: 0x182234, ambientInt: 0.08, sun: 0xa6bce4, sunInt: 0.09, sunPos: [-8, 22, -24], exponent: 1.15, interior: 1 },
  { m: 4 * 60, skyTop: 0x080d1a, skyBottom: 0x121b2c, fog: 0x121b2c, hemiSky: 0x2c3e5c, hemiGround: 0x141a16, hemiInt: 0.16, ambient: 0x182234, ambientInt: 0.08, sun: 0xa6bce4, sunInt: 0.09, sunPos: [-4, 20, -24], exponent: 1.15, interior: 1 },
  // Dawn — hazy slate-purple & dusty amber
  { m: 5 * 60 + 30, skyTop: 0x564668, skyBottom: 0xd49272, fog: 0xc4866a, hemiSky: 0xba968a, hemiGround: 0x303a28, hemiInt: 0.62, ambient: 0xe4be9e, ambientInt: 0.24, sun: 0xf28c5a, sunInt: 1.2, sunPos: [36, 6, 8], exponent: 0.85, interior: 0.7 },
  // Morning — bright, slightly hazy
  { m: 7 * 60, skyTop: 0x5c90b4, skyBottom: 0xd8d0bc, fog: 0xd0c8b4, hemiSky: 0xa4c4dc, hemiGround: 0x32462e, hemiInt: 1.05, ambient: 0xe6dcc8, ambientInt: 0.34, sun: 0xffd29c, sunInt: 2.7, sunPos: [30, 18, 14], exponent: 0.78, interior: 0.2 },
  // Midday
  { m: 10 * 60, ...DAY },
  // Early afternoon — bright hazy daylight with clean shadows
  { m: 13 * 60, skyTop: 0x528eb8, skyBottom: 0xc6d8e4, fog: 0xc6d8e4, hemiSky: 0x98bcd8, hemiGround: 0x485040, hemiInt: 1.25, ambient: 0xe8e4da, ambientInt: 0.42, sun: 0xffeacc, sunInt: 3.1, sunPos: [8, 40, 18], exponent: 0.74, interior: 0 },
  // Golden hour — warm sun against readable shadow fill
  { m: 17 * 60 + 30, skyTop: 0xa46c48, skyBottom: 0xd8a678, fog: 0xc8986e, hemiSky: 0xd0a888, hemiGround: 0x3a4428, hemiInt: 0.88, ambient: 0xe4c29c, ambientInt: 0.30, sun: 0xffb268, sunInt: 2.35, sunPos: [-26, 14, 14], exponent: 0.76, interior: 0.25 },
  // Dusk — moody blue-slate zenith, burnt horizon
  { m: 19 * 60 + 30, skyTop: 0x202e52, skyBottom: 0x9e604c, fog: 0x6e4a56, hemiSky: 0x9e766c, hemiGround: 0x222e1c, hemiInt: 0.46, ambient: 0xd49878, ambientInt: 0.18, sun: 0xee6a3c, sunInt: 0.68, sunPos: [-30, 4, 10], exponent: 0.9, interior: 0.7 },
  // Evening into night
  { m: 21 * 60, skyTop: 0x0b1222, skyBottom: 0x152034, fog: 0x152034, hemiSky: 0x2c3e5c, hemiGround: 0x141a16, hemiInt: 0.16, ambient: 0x182234, ambientInt: 0.08, sun: 0xa6bce4, sunInt: 0.10, sunPos: [-16, 20, -22], exponent: 1.1, interior: 1 },
  { m: MINUTES_PER_DAY, skyTop: 0x080d1a, skyBottom: 0x121b2c, fog: 0x121b2c, hemiSky: 0x2c3e5c, hemiGround: 0x141a16, hemiInt: 0.16, ambient: 0x182234, ambientInt: 0.08, sun: 0xa6bce4, sunInt: 0.09, sunPos: [-8, 22, -24], exponent: 1.15, interior: 1 }
];

// Raised once the roof cast a proper shadow (sun no longer leaks onto the floor).
export const INTERIOR_DAY_INTENSITY = 24;
export const INTERIOR_NIGHT_INTENSITY = 30;
/** Dim fill when the wall switch is off at night — dark but still readable. */
export const INTERIOR_OFF_DAY_INTENSITY = 0;
export const INTERIOR_OFF_NIGHT_INTENSITY = 5;
export const INTERIOR_EMISSIVE_DAY = new THREE.Color(0x3a342a);
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
    const u = sky.material.uniforms;
    u.topColor.value.setHex(sample.skyTop);
    u.bottomColor.value.setHex(sample.skyBottom);
    if (u.exponent) u.exponent.value = sample.exponent;
    if (u.sunDir && sample.sunPos) u.sunDir.value.set(sample.sunPos[0], sample.sunPos[1], sample.sunPos[2]).normalize();
    if (u.sunColor) u.sunColor.value.setHex(sample.sun);
    if (u.nightFactor) u.nightFactor.value = sample.interior;
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
