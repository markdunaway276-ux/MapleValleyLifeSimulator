/**
 * A single recycled LineSegments rain field that follows the player.
 * Lower count on a phone; hidden inside the main house.
 */

import * as THREE from 'three';

export const RAIN_COUNT_DESKTOP = 420;
export const RAIN_COUNT_MOBILE = 140;
export const RAIN_BOX = { x: 8, y: 10, z: 8 };
const STREAK = 0.42;
const SLANT = 0.08;

/** True when the player is inside the main-house interior bounds. */
export function isInsideMainHouse(scene, position) {
  const interior = scene && scene.userData && scene.userData.interior;
  const b = interior && interior.bounds;
  if (!b || !position) return false;
  const x = position.x, z = position.z;
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/** Inside the main house or any walk-in building that registered an indoor zone. */
export function isIndoors(scene, position) {
  if (isInsideMainHouse(scene, position)) return true;
  const zones = (scene && scene.userData && scene.userData.indoorZones) || [];
  if (!position) return false;
  const x = position.x, z = position.z;
  return zones.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
}

export function createRain({ scene, isMobile = false } = {}) {
  const count = isMobile ? RAIN_COUNT_MOBILE : RAIN_COUNT_DESKTOP;
  const positions = new Float32Array(count * 6);
  const seeds = new Float32Array(count * 4); // x, y, z, speed in box space

  function place(i, x, y, z) {
    seeds[i * 4] = x;
    seeds[i * 4 + 1] = y;
    seeds[i * 4 + 2] = z;
    writeStreak(i, x, y, z);
  }

  function writeStreak(i, x, y, z) {
    const o = i * 6;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
    positions[o + 3] = x + SLANT;
    positions[o + 4] = y - STREAK;
    positions[o + 5] = z;
  }

  for (let i = 0; i < count; i++) {
    seeds[i * 4 + 3] = 7 + (i % 11) * 0.35;
    place(
      i,
      (Math.random() * 2 - 1) * RAIN_BOX.x,
      (Math.random() * 2 - 1) * RAIN_BOX.y,
      (Math.random() * 2 - 1) * RAIN_BOX.z
    );
  }

  const geom = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', attr);
  const mat = new THREE.LineBasicMaterial({
    color: 0xc5d0dc,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(geom, mat);
  lines.name = 'rain';
  lines.frustumCulled = false;
  lines.castShadow = false;
  lines.receiveShadow = false;
  lines.renderOrder = 3;
  lines.visible = false;
  if (scene) scene.add(lines);

  function update(dt, { position, intensity = 0, indoor = false } = {}) {
    const amount = Math.max(0, Number(intensity) || 0);
    const show = amount > 0.02 && !indoor;
    lines.visible = show;
    if (position) lines.position.set(position.x, position.y, position.z);
    if (!show) {
      mat.opacity = 0;
      return;
    }
    mat.opacity = 0.18 + 0.22 * Math.min(1, amount);
    // Drizzle draws a few streaks; a downpour draws them all.
    const drawn = Math.max(12, Math.round(count * Math.min(1, 0.15 + amount * 0.85)));
    geom.setDrawRange(0, drawn * 2);
    const step = Math.max(0, Number(dt) || 0);
    const hx = RAIN_BOX.x, hy = RAIN_BOX.y, hz = RAIN_BOX.z;
    for (let i = 0; i < drawn; i++) {
      let x = seeds[i * 4];
      let y = seeds[i * 4 + 1] - seeds[i * 4 + 3] * step;
      let z = seeds[i * 4 + 2];
      if (y < -hy) {
        y += hy * 2;
        x = (Math.random() * 2 - 1) * hx;
        z = (Math.random() * 2 - 1) * hz;
      }
      seeds[i * 4] = x;
      seeds[i * 4 + 1] = y;
      seeds[i * 4 + 2] = z;
      writeStreak(i, x, y, z);
    }
    attr.needsUpdate = true;
  }

  function dispose() {
    if (scene) scene.remove(lines);
    geom.dispose();
    mat.dispose();
  }

  return {
    mesh: lines,
    count,
    update,
    dispose
  };
}
