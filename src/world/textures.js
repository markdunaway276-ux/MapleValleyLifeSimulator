import * as THREE from 'three';
import { STREET } from './street.js';
import { GROUND, TEXTURE } from './palette.js';

/**
 * Canvas-generated ground textures: grass, asphalt and pavement. They are
 * small, generated once at start-up, and every one of them tiles seamlessly:
 * the noise lattice wraps on the tile size (see tileNoise), joint lines sit on
 * the tile edge, and the road's dash period divides the tile exactly.
 * The colours come from GROUND in palette.js, so they stay in the same
 * darker, desaturated tone as the rest of the world.
 */

/** Integer hash -> [0, 1). Pixel-exact, so it tiles by construction. */
export function hash2(ix, iy, seed = 0) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Value noise whose lattice repeats every `px` x `py` cells. Sampling with
 * x in [0, px) and y in [0, py) therefore gives a texture that tiles.
 */
export function tileNoise(x, y, px, py = px, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ax = ((x0 % px) + px) % px;
  const ay = ((y0 % py) + py) % py;
  const bx = (ax + 1) % px;
  const by = (ay + 1) % py;
  const a = hash2(ax, ay, seed);
  const b = hash2(bx, ay, seed);
  const c = hash2(ax, by, seed);
  const d = hash2(bx, by, seed);
  return a + (b - a) * sx + (c - a) * sy + (d - a - b + c) * sx * sy;
}

/** Three octaves of tileNoise; each octave doubles the lattice, so it still tiles. */
export function tileFbm(x, y, px, py = px, seed = 0) {
  return (
    tileNoise(x, y, px, py, seed) * 0.55 +
    tileNoise(x * 2, y * 2, px * 2, py * 2, seed + 1) * 0.3 +
    tileNoise(x * 4, y * 4, px * 4, py * 4, seed + 2) * 0.15
  );
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function finishTexture(canvas, { repeat = null, anisotropy = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A deterministic wandering crack that wraps at the tile edge. */
function walkCrack(mask, w, h, x, y, steps, seed, bias = [0, 1]) {
  let dx = bias[0];
  let dy = bias[1];
  for (let i = 0; i < steps; i++) {
    mask[((y % h + h) % h) * w + ((x % w + w) % w)] = 1;
    const r = hash2(i, seed, 9);
    if (r < 0.34) dx = Math.max(-1, dx - 1);
    else if (r > 0.66) dx = Math.min(1, dx + 1);
    if (hash2(i, seed, 10) < 0.5) x += dx;
    else y += dy;
  }
}

/**
 * Muted forest lawn: low-frequency patches, vertical blade streaks, dry
 * patches and a few autumn leaves. 512 px on desktop, 256 px on mobile.
 */
export function createGrassTexture(quality = {}) {
  const hi = !!quality.shadows;
  const size = hi ? TEXTURE.grass.desktop : TEXTURE.grass.mobile;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const cells = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells;
      const v = (y / size) * cells;
      const patch = tileFbm(u, v, cells, cells, 3);
      const dry = smooth(0.6, 0.84, tileNoise(u * 0.5, v * 0.5, cells / 2, cells / 2, 17));
      // Streaks: 4 px wide, 16 px tall lattice cells (both divide the tile).
      const blade = tileNoise(x / 4, y / 16, size / 4, size / 16, 23);
      const speck = hash2(x, y, 5);
      let r = GROUND.grass[0] + (patch - 0.5) * 30 + (blade - 0.5) * 12;
      let g = GROUND.grass[1] + (patch - 0.5) * 34 + (blade - 0.5) * 18;
      let b = GROUND.grass[2] + (patch - 0.5) * 18 + (blade - 0.5) * 6;
      r += (GROUND.dry[0] - r) * dry * 0.5;
      g += (GROUND.dry[1] - g) * dry * 0.5;
      b += (GROUND.dry[2] - b) * dry * 0.5;
      if (speck > 0.84) {
        r += GROUND.grassLight[0]; g += GROUND.grassLight[1]; b += GROUND.grassLight[2];
      } else if (speck < 0.07) {
        r += GROUND.grassDark[0]; g += GROUND.grassDark[1]; b += GROUND.grassDark[2];
      }
      // A few 2x2 leaves, ochre to umber.
      const leaf = hash2(x >> 1, y >> 1, 91);
      if (leaf > 0.9972) {
        const k = 0.7 + hash2(x >> 1, y >> 1, 92) * 0.5;
        r = GROUND.leaf[0] * k; g = GROUND.leaf[1] * k; b = GROUND.leaf[2] * k;
      }
      const i = (y * size + x) * 4;
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, { repeat: [TEXTURE.grass.repeat, TEXTURE.grass.repeat], anisotropy: hi ? TEXTURE.grass.anisotropy : 1 });
}

/**
 * Worn asphalt with aggregate, darker tyre lanes, paler kerb grit, hairline
 * cracks and a worn dashed centre line. U runs along the street. The tile
 * holds a whole number of dashes, so the line never breaks at the seam.
 */
export function createRoadTexture(quality = {}) {
  const hi = !!quality.shadows;
  const [along, across] = hi ? TEXTURE.road.desktop : TEXTURE.road.mobile;
  const canvas = makeCanvas(along, across);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(along, across);
  const data = img.data;
  const parkingPaint = [174, 174, 163];
  const parkingEdge = STREET.parkingLaneWidth / STREET.roadWidth;
  const laneCenter = (parkingEdge + 0.5) / 2;
  const period = along / TEXTURE.road.dashes;
  const dash = period * 0.4;

  const crack = new Uint8Array(along * across);
  walkCrack(crack, along, across, Math.floor(along * 0.22), 2, Math.floor(across * 0.8), 31, [0, 1]);
  if (hi) walkCrack(crack, along, across, Math.floor(along * 0.71), Math.floor(across * 0.55), Math.floor(across * 0.7), 47, [1, 0]);

  for (let y = 0; y < across; y++) {
    const fy = y / across;
    const lane = Math.exp(-(((fy - laneCenter) / 0.07) ** 2))
      + Math.exp(-(((fy - (1 - laneCenter)) / 0.07) ** 2));
    const centerLine = Math.abs(fy - 0.5) <= 0.85 / across;
    const parkingLine = Math.min(Math.abs(fy - parkingEdge), Math.abs(fy - (1 - parkingEdge))) <= 0.65 / across;
    const kerb = smooth(0.1, 0, fy) + smooth(0.9, 1, fy);
    for (let x = 0; x < along; x++) {
      const n = tileNoise(x / 16, y / 8, along / 16, across / 8, 41) * 0.55 + hash2(x, y, 6) * 0.45;
      const grit = hash2(x, y, 8);
      let tone = n * 16 + lane * GROUND.roadWear + kerb * GROUND.roadGrit;
      if (grit > 0.94) tone += 11;
      else if (grit < 0.04) tone -= 8;
      if (crack[y * along + x]) tone -= 20;
      let r = GROUND.road[0] + tone;
      let g = GROUND.road[1] + tone;
      let b = GROUND.road[2] + tone * 0.94;
      if (parkingLine || (centerLine && (x % period) < dash)) {
        const wear = 0.74 + tileNoise(x / 4, y / 4, along / 4, across / 4, 53) * 0.26;
        const paint = parkingLine ? parkingPaint : GROUND.line;
        r = paint[0] * wear;
        g = paint[1] * wear;
        b = paint[2] * wear;
      }
      const i = (y * along + x) * 4;
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, { anisotropy: hi ? 4 : 1 });
}

/**
 * One concrete pavement slab per tile: a dark joint with a pale lip on the
 * tile edge, damp darkening towards the joints, stains, grit and a hairline
 * crack. Set `repeat` so one tile is one slab (see TEXTURE.walk.slabMetres).
 */
export function createSidewalkTexture(quality = {}) {
  const size = TEXTURE.walk.size;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const crack = new Uint8Array(size * size);
  walkCrack(crack, size, size, Math.floor(size * 0.68), 3, Math.floor(size * 0.55), 61, [0, 1]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = tileNoise(x / 16, y / 16, size / 16, size / 16, 71) * 0.55 + hash2(x, y, 12) * 0.3 + tileNoise(x / 4, y / 4, size / 4, size / 4, 73) * 0.15;
      const stain = tileNoise(x / 32, y / 32, size / 32, size / 32, 79);
      let f = 1 - 0.1 * stain * stain;
      const d = Math.min(x, y, size - 1 - x, size - 1 - y);
      f *= 1 - 0.07 * Math.exp(-d / 9);
      if (x < 2 || y < 2) f *= GROUND.walkJoint;
      else if (x === 2 || y === 2) f *= GROUND.walkLip;
      if (crack[y * size + x]) f *= 0.72;
      const grit = hash2(x, y, 14);
      if (grit > 0.95) f *= 1.06;
      else if (grit < 0.03) f *= 0.9;
      const i = (y * size + x) * 4;
      data[i] = clamp255((GROUND.walk[0] + n * 16) * f);
      data[i + 1] = clamp255((GROUND.walk[1] + n * 15) * f);
      data[i + 2] = clamp255((GROUND.walk[2] + n * 13) * f);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, { anisotropy: quality && quality.shadows ? 4 : 1 });
}
