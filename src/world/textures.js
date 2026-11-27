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

function finishTexture(canvas, { repeat = null, anisotropy = 1, colorSpace = THREE.SRGBColorSpace } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = colorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A deterministic wandering crack that wraps at the tile edge. */
function walkCrack(mask, w, h, x, y, steps, seed, bias = [0, 1], width = 1) {
  let dx = bias[0];
  let dy = bias[1];
  for (let i = 0; i < steps; i++) {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    mask[cy * w + cx] = 2;
    if (width > 1) {
      mask[cy * w + ((cx + 1) % w)] = Math.max(mask[cy * w + ((cx + 1) % w)], 1);
      mask[((cy + 1) % h) * w + cx] = Math.max(mask[((cy + 1) % h) * w + cx], 1);
    }
    const r = hash2(i, seed, 9);
    if (r < 0.34) dx = Math.max(-1, dx - 1);
    else if (r > 0.66) dx = Math.min(1, dx + 1);
    if (hash2(i, seed, 10) < 0.5) x += dx;
    else y += dy;
  }
}

/**
 * Gritty, lived-in lawn: coarse grass tufts, bare soil/weed patches, leaf
 * litter, and a companion bump map on desktop. 512 px on desktop, 256 px on mobile.
 */
export function createGrassTexture(quality = {}) {
  const hi = !!quality.shadows;
  const size = hi ? TEXTURE.grass.desktop : TEXTURE.grass.mobile;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const bumpCanvas = hi ? makeCanvas(size, size) : null;
  const bumpCtx = bumpCanvas ? bumpCanvas.getContext('2d') : null;
  const bumpImg = bumpCtx ? bumpCtx.createImageData(size, size) : null;
  const bumpData = bumpImg ? bumpImg.data : null;
  const cells = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells;
      const v = (y / size) * cells;
      const patch = tileFbm(u, v, cells, cells, 3);
      const dry = smooth(0.54, 0.82, tileNoise(u * 0.5, v * 0.5, cells / 2, cells / 2, 17));
      // Streaks: 4 px wide, 16 px tall lattice cells (both divide the tile).
      const blade = tileNoise(x / 4, y / 16, size / 4, size / 16, 23);
      const tuft = tileNoise(x / 8, y / 8, size / 8, size / 8, 29);
      const speck = hash2(x, y, 5);
      let r = GROUND.grass[0] + (patch - 0.5) * 32 + (blade - 0.5) * 14 + (tuft - 0.5) * 10;
      let g = GROUND.grass[1] + (patch - 0.5) * 36 + (blade - 0.5) * 20 + (tuft - 0.5) * 12;
      let b = GROUND.grass[2] + (patch - 0.5) * 18 + (blade - 0.5) * 8 + (tuft - 0.5) * 6;
      r += (GROUND.dry[0] - r) * dry * 0.62;
      g += (GROUND.dry[1] - g) * dry * 0.62;
      b += (GROUND.dry[2] - b) * dry * 0.62;
      if (speck > 0.82) {
        r += GROUND.grassLight[0]; g += GROUND.grassLight[1]; b += GROUND.grassLight[2];
      } else if (speck < 0.09) {
        r += GROUND.grassDark[0]; g += GROUND.grassDark[1]; b += GROUND.grassDark[2];
      }
      // A few 2x2 leaves, ochre to umber.
      const leaf = hash2(x >> 1, y >> 1, 91);
      if (leaf > 0.9965) {
        const k = 0.7 + hash2(x >> 1, y >> 1, 92) * 0.5;
        r = GROUND.leaf[0] * k; g = GROUND.leaf[1] * k; b = GROUND.leaf[2] * k;
      }
      const i = (y * size + x) * 4;
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
      data[i + 3] = 255;
      if (bumpData) {
        const h = clamp255(115 + (blade - 0.5) * 90 + (tuft - 0.5) * 55 + (speck - 0.5) * 45 - dry * 30);
        bumpData[i] = h;
        bumpData[i + 1] = h;
        bumpData[i + 2] = h;
        bumpData[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const repeat = [TEXTURE.grass.repeat, TEXTURE.grass.repeat];
  const anisotropy = hi ? TEXTURE.grass.anisotropy : 1;
  const tex = finishTexture(canvas, { repeat, anisotropy });
  if (bumpCtx && bumpImg) {
    bumpCtx.putImageData(bumpImg, 0, 0);
    tex.userData.bumpMap = finishTexture(bumpCanvas, { repeat, anisotropy, colorSpace: THREE.NoColorSpace });
  }
  return tex;
}

/**
 * Rough, worn asphalt with coarse aggregate, darker tyre lanes, oil stains,
 * dirty kerb grit, tar-patched cracks, chipped lane paint, and a companion
 * bump map. U runs along the street. The tile holds a whole number of dashes,
 * so the line never breaks at the seam.
 */
export function createRoadTexture(quality = {}) {
  const hi = !!quality.shadows;
  const [along, across] = hi ? TEXTURE.road.desktop : TEXTURE.road.mobile;
  const canvas = makeCanvas(along, across);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(along, across);
  const data = img.data;
  const bumpCanvas = hi ? makeCanvas(along, across) : null;
  const bumpCtx = bumpCanvas ? bumpCanvas.getContext('2d') : null;
  const bumpImg = bumpCtx ? bumpCtx.createImageData(along, across) : null;
  const bumpData = bumpImg ? bumpImg.data : null;
  const parkingPaint = [166, 164, 152];
  const parkingEdge = STREET.parkingLaneWidth / STREET.roadWidth;
  const laneCenter = (parkingEdge + 0.5) / 2;
  const period = along / TEXTURE.road.dashes;
  const dash = period * 0.4;

  const crack = new Uint8Array(along * across);
  walkCrack(crack, along, across, Math.floor(along * 0.22), 2, Math.floor(across * 0.85), 31, [0, 1], hi ? 2 : 1);
  if (hi) {
    walkCrack(crack, along, across, Math.floor(along * 0.71), Math.floor(across * 0.55), Math.floor(across * 0.75), 47, [1, 0], 2);
    walkCrack(crack, along, across, Math.floor(along * 0.48), Math.floor(across * 0.18), Math.floor(across * 0.5), 83, [0, 1], 1);
  }

  for (let y = 0; y < across; y++) {
    const fy = y / across;
    const lane = Math.exp(-(((fy - laneCenter) / 0.075) ** 2))
      + Math.exp(-(((fy - (1 - laneCenter)) / 0.075) ** 2));
    const centerLine = Math.abs(fy - 0.5) <= 0.014;
    const parkingLine = Math.min(Math.abs(fy - parkingEdge), Math.abs(fy - (1 - parkingEdge))) <= 0.010;
    const kerb = smooth(0.11, 0, fy) + smooth(0.89, 1, fy);
    for (let x = 0; x < along; x++) {
      const coarse = tileNoise(x / 16, y / 8, along / 16, across / 8, 41);
      const med = tileNoise(x / 6, y / 6, along / 6, across / 6, 43);
      const fine = hash2(x, y, 6);
      const n = coarse * 0.45 + med * 0.2 + fine * 0.35;
      const grit = hash2(x, y, 8);
      // Subtle dark oil/tar blotches concentrated in driving lanes.
      const oilPatch = smooth(0.68, 0.86, tileNoise(x / 24, y / 16, along / 24, across / 16, 59)) * (0.35 + lane * 0.65);
      let tone = (n - 0.5) * 16 + lane * GROUND.roadWear + kerb * GROUND.roadGrit - oilPatch * 10;
      if (grit > 0.91) tone += 9;
      else if (grit < 0.06) tone -= 7;
      const cVal = crack[y * along + x];
      if (cVal === 2) tone -= 16;
      else if (cVal === 1) tone -= 8;
      let r = GROUND.road[0] + tone;
      let g = GROUND.road[1] + tone;
      let b = GROUND.road[2] + tone * 0.93;
      // Dusty brownish gutter dirt right beside the kerb.
      if (kerb > 0.15) {
        r += kerb * 5;
        g += kerb * 3.5;
        b -= kerb * 1.5;
      }
      if (parkingLine || (centerLine && (x % period) < dash)) {
        const wear = 0.64 + tileNoise(x / 4, y / 4, along / 4, across / 4, 53) * 0.34;
        const paint = parkingLine ? parkingPaint : GROUND.line;
        const chipped = grit < 0.11 || (med < 0.24 && grit < 0.45);
        const coverage = chipped ? 0.32 : 0.88;
        r += (paint[0] * wear - r) * coverage;
        g += (paint[1] * wear - g) * coverage;
        b += (paint[2] * wear - b) * coverage;
      }
      const i = (y * along + x) * 4;
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
      data[i + 3] = 255;
      if (bumpData) {
        let h = 132 + (fine - 0.5) * 85 + (med - 0.5) * 40 - lane * 14;
        if (grit > 0.91) h += 30;
        if (cVal === 2) h -= 95;
        else if (cVal === 1) h -= 40;
        const bh = clamp255(h);
        bumpData[i] = bh;
        bumpData[i + 1] = bh;
        bumpData[i + 2] = bh;
        bumpData[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const anisotropy = hi ? 8 : 4;
  const tex = finishTexture(canvas, { anisotropy });
  if (bumpCtx && bumpImg) {
    bumpCtx.putImageData(bumpImg, 0, 0);
    tex.userData.bumpMap = finishTexture(bumpCanvas, { anisotropy, colorSpace: THREE.NoColorSpace });
  }
  return tex;
}

/**
 * One weathered concrete pavement slab per tile: a deep dark joint with a pale
 * chipped lip on the tile edge, grime & moss darkening towards the joints,
 * stains, coarse grit, cracks, and a companion bump map. Set `repeat` so one
 * tile is one slab (see TEXTURE.walk.slabMetres).
 */
export function createSidewalkTexture(quality = {}) {
  const hi = !!(quality && quality.shadows);
  const size = TEXTURE.walk.size;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const bumpCanvas = hi ? makeCanvas(size, size) : null;
  const bumpCtx = bumpCanvas ? bumpCanvas.getContext('2d') : null;
  const bumpImg = bumpCtx ? bumpCtx.createImageData(size, size) : null;
  const bumpData = bumpImg ? bumpImg.data : null;
  const crack = new Uint8Array(size * size);
  walkCrack(crack, size, size, Math.floor(size * 0.68), 3, Math.floor(size * 0.62), 61, [0, 1], 1);
  if (hi) walkCrack(crack, size, size, Math.floor(size * 0.24), Math.floor(size * 0.42), Math.floor(size * 0.4), 77, [1, 0], 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = tileNoise(x / 16, y / 16, size / 16, size / 16, 71) * 0.48 + hash2(x, y, 12) * 0.34 + tileNoise(x / 4, y / 4, size / 4, size / 4, 73) * 0.18;
      const stain = tileNoise(x / 32, y / 32, size / 32, size / 32, 79);
      let f = 1 - 0.15 * stain * stain;
      const d = Math.min(x, y, size - 1 - x, size - 1 - y);
      const edgeGrime = Math.exp(-d / 8);
      f *= 1 - 0.12 * edgeGrime;
      let bumpH = 148 + (n - 0.5) * 65;
      if (x < 2 || y < 2) {
        f *= GROUND.walkJoint;
        bumpH = 38;
      } else if (x === 2 || y === 2) {
        f *= GROUND.walkLip;
        bumpH += 26;
      }
      if (crack[y * size + x]) {
        f *= 0.64;
        bumpH = 52;
      }
      const grit = hash2(x, y, 14);
      if (grit > 0.93) { f *= 1.07; bumpH += 20; }
      else if (grit < 0.05) { f *= 0.87; bumpH -= 18; }
      const i = (y * size + x) * 4;
      data[i] = clamp255((GROUND.walk[0] + (n - 0.5) * 22) * f);
      data[i + 1] = clamp255((GROUND.walk[1] + (n - 0.5) * 21) * f + edgeGrime * 2);
      data[i + 2] = clamp255((GROUND.walk[2] + (n - 0.5) * 19) * f - edgeGrime * 4);
      data[i + 3] = 255;
      if (bumpData) {
        const bh = clamp255(bumpH);
        bumpData[i] = bh;
        bumpData[i + 1] = bh;
        bumpData[i + 2] = bh;
        bumpData[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const anisotropy = hi ? 4 : 1;
  const tex = finishTexture(canvas, { anisotropy });
  if (bumpCtx && bumpImg) {
    bumpCtx.putImageData(bumpImg, 0, 0);
    tex.userData.bumpMap = finishTexture(bumpCanvas, { anisotropy, colorSpace: THREE.NoColorSpace });
  }
  return tex;
}
