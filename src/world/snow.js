/**
 * Falling snow: one recycled Points field that follows the player, drifting
 * and swaying. The number of flakes drawn scales with intensity, so flurries
 * are a few lazy flakes and full snow is a thick, slow fall.
 * Lower count on a phone; hidden indoors.
 */

import * as THREE from 'three';

export const SNOW_COUNT_DESKTOP = 1400;
export const SNOW_COUNT_MOBILE = 520;
export const SNOW_BOX = { x: 8, y: 7, z: 8 };

function flakeTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSnow({ scene, isMobile = false } = {}) {
  const count = isMobile ? SNOW_COUNT_MOBILE : SNOW_COUNT_DESKTOP;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4); // base x, base z, fall speed, sway phase
  const hx = SNOW_BOX.x, hy = SNOW_BOX.y, hz = SNOW_BOX.z;
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = (Math.random() * 2 - 1) * hx;
    seeds[i * 4 + 1] = (Math.random() * 2 - 1) * hz;
    seeds[i * 4 + 2] = 0.7 + Math.random() * 0.7;
    seeds[i * 4 + 3] = Math.random() * Math.PI * 2;
    positions[i * 3] = seeds[i * 4];
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * hy;
    positions[i * 3 + 2] = seeds[i * 4 + 1];
  }
  const geom = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', attr);
  geom.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: isMobile ? 0.09 : 0.07,
    map: flakeTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geom, mat);
  points.name = 'snowfall';
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.visible = false;
  if (scene) scene.add(points);
  let t = 0;

  function update(dt, { position, intensity = 0, indoor = false } = {}) {
    const amount = Math.max(0, Math.min(1, Number(intensity) || 0));
    const show = amount > 0.02 && !indoor;
    points.visible = show;
    if (position) points.position.set(position.x, position.y, position.z);
    if (!show) { mat.opacity = 0; return; }
    const step = Math.max(0, Math.min(0.1, Number(dt) || 0));
    t += step;
    const drawn = Math.max(8, Math.round(count * Math.pow(amount, 1.3)));
    geom.setDrawRange(0, drawn);
    mat.opacity = 0.55 + 0.4 * amount;
    const wind = 0.25 + amount * 0.35;
    for (let i = 0; i < drawn; i++) {
      const o = i * 3;
      let y = positions[o + 1] - seeds[i * 4 + 2] * step;
      seeds[i * 4] += wind * step * 0.5;
      if (y < -hy) {
        y += hy * 2;
        seeds[i * 4] = (Math.random() * 2 - 1) * hx;
        seeds[i * 4 + 1] = (Math.random() * 2 - 1) * hz;
      }
      if (seeds[i * 4] > hx) seeds[i * 4] -= hx * 2;
      const ph = seeds[i * 4 + 3];
      positions[o] = seeds[i * 4] + Math.sin(t * 0.9 + ph) * 0.35;
      positions[o + 1] = y;
      positions[o + 2] = seeds[i * 4 + 1] + Math.cos(t * 0.7 + ph * 1.3) * 0.3;
    }
    attr.needsUpdate = true;
  }

  function dispose() {
    if (scene) scene.remove(points);
    geom.dispose();
    mat.map?.dispose();
    mat.dispose();
  }

  return { mesh: points, count, update, dispose };
}
