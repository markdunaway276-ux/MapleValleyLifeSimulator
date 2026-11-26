/**
 * Maple Valley's look in one place: a cohesive, desaturated-but-rich palette,
 * the surface (roughness / metalness) presets, and the numbers behind the
 * rounded-edge and baked-AO passes.
 *
 * Mood: a darker autumn dusk-leaning neighbourhood. Umber, oxblood, slate,
 * sand, sage and ochre on the outside; walnut, plaster and deep teal inside.
 * Whites are warm and never pure, greens are muted, and nothing is neon.
 *
 * Day / night sky and light colours live in daynight.js (its 10:00 key is
 * pinned by the day/night suite); this file only holds the world's materials,
 * plus the renderer exposure and shadow settings so they are tuned together.
 */

// ------------------------------------------------------------- renderer ----

/** Renderer + shadow tuning. Exposure 0.95 is the value set by commit 83bc107. */
export const LOOK = {
  exposure: 0.95,
  /** Desktop sun shadow map: 2048 over ±38 m is ~3.7 cm a texel (was 1024 over ±44 m, ~8.6 cm). */
  shadow: { mapSize: 2048, extent: 38, near: 1, far: 110, bias: -0.0003, normalBias: 0.03 },
  /** Fog starts and ends this fraction of the camera far plane away (was 0.55 / 0.98). */
  fog: { near: 0.42, far: 0.96 }
};

// --------------------------------------------------------------- shapes ----

/** Rounded-edge sizes, in metres. The radius is absolute, never a % of the box. */
export const BEVEL = {
  /** Largest bevel on anything; walls and big furniture sit here. */
  max: 0.06,
  /** Bevel is at most this fraction of a box's thinnest side. */
  fraction: 0.35,
  /** Below this a bevel is invisible, so a plain (12 triangle) box is used. */
  min: 0.006
};

/** Baked vertex ambient occlusion (see Parts.box in buildings.js). */
export const AO = {
  /** How much the foot of a box darkens on its side faces. */
  side: 0.2,
  /** How much a box's underside darkens. */
  bottom: 0.4,
  /** Height of the darkening gradient up the side, in metres. */
  height: 0.5
};

// ------------------------------------------------------------- surfaces ----

/** roughness / metalness presets. Everything vertex-coloured shares one material per mesh. */
export const SURFACE = {
  plaster: { roughness: 0.94, metalness: 0 },
  brick: { roughness: 0.97, metalness: 0 },
  stone: { roughness: 0.88, metalness: 0 },
  roof: { roughness: 0.82, metalness: 0.04 },
  wood: { roughness: 0.72, metalness: 0 },
  woodRaw: { roughness: 0.86, metalness: 0 },
  trim: { roughness: 0.58, metalness: 0 },
  paint: { roughness: 0.5, metalness: 0 },
  fabric: { roughness: 0.98, metalness: 0 },
  metal: { roughness: 0.38, metalness: 0.55 },
  appliance: { roughness: 0.34, metalness: 0.35 },
  glass: { roughness: 0.16, metalness: 0.1 },
  rubber: { roughness: 0.95, metalness: 0 },
  carPaint: { roughness: 0.34, metalness: 0.35 },
  screen: { roughness: 0.25, metalness: 0 }
};

// ------------------------------------------------------------ the world ----

/** Ground, road and pavement base colours as 0-255 RGB (textures add the noise). */
export const GROUND = {
  grass: [46, 92, 50],
  grassDark: [-14, -20, -9],
  grassLight: [14, 20, 7],
  road: [40, 40, 44],
  line: [206, 182, 74],
  walk: [150, 146, 136]
};

/** Procedural street houses: walls, roofs, trims and accents. */
export const HOUSE = {
  walls: [0x8f9fa8, 0xc9b596, 0xb1aea2, 0xa88f66, 0xb7a58a, 0x9aa592, 0xa59a8c, 0x8d96a0],
  roofs: [0x5a3328, 0x3d4650, 0x4a362c, 0x6a2a2a, 0x3a463b, 0x4c4a52],
  trims: [0xe3dccb, 0xd9d0bb, 0xcfd4d2, 0xc2baa8],
  accents: [0x2c4a38, 0x25395a, 0x6e2230, 0x5a3b22, 0x33261a, 0x7a5028],
  brick: 0x7a4234,
  cap: 0x6a665f,
  deck: 0x74664f,
  garageDoor: 0xbab6aa,
  door: 0x4e3320,
  glass: 0x6f9ab4,
  /** The four lots, in scene.js order: sw, se, nw, ne. */
  lots: [
    { wall: 0x8f9fa8, roof: 0x5a3328 }, // slate blue / umber
    { wall: 0xc9b596, roof: 0x3d4650 }, // warm sand / slate
    { wall: 0xb1aea2, roof: 0x4a362c }, // stone / walnut
    { wall: 0xa88f66, roof: 0x6a2a2a } // ochre / oxblood
  ]
};

/** The Kenney main house (GLB). Keyed by the GLB's material names. */
export const MAIN_HOUSE = {
  _defaultMat: { color: 0x9c6a58, ...SURFACE.plaster }, // clay walls
  roof: { color: 0x34504a, ...SURFACE.roof }, // deep slate green
  border: { color: 0xc9c0ac, ...SURFACE.trim }, // posts, sills, eaves: warm off-white
  window: { color: 0x7fa2b6, roughness: SURFACE.glass.roughness, metalness: 0.0, emissive: 0x16222a },
  door: { color: 0x4e3320, ...SURFACE.wood }
};

/** Main house interior. */
export const INTERIOR = {
  wall: 0xd7cab0,
  wallShade: 0xc4b79b,
  floor: 0x70503a,
  ceil: 0xcbc3b2,
  trim: 0xb3a688,
  wood: 0x74502f,
  woodDark: 0x4a3220,
  fabric: 0x46606c,
  fabricDark: 0x37505b,
  bedLinen: 0xd6d1c4,
  blanket: 0x7a3434,
  pillow: 0xe2ddd0,
  rug: 0x7e3f35,
  rug2: 0x56667f,
  counter: 0xbab5ab,
  counterTop: 0x34363a,
  fridge: 0xb1b7ba,
  handle: 0x8a9094,
  glass: 0xa9cadd,
  lamp: 0xffe9c0,
  door: 0x553a22,
  laptop: 0x2a2e33,
  laptopLid: 0x1c1f24,
  laptopScreen: 0x2a5a78,
  frames: [0x587a58, 0xa27c4e, 0x93a066]
};

/** Street props. */
export const PROPS = {
  vendingBody: 0x822a33,
  vendingDark: 0x1a1a1e,
  mailPost: 0x44352a,
  mailBox: 0x34507a,
  mailLid: 0x2a4366,
  carBody: 0x2a5a5c,
  carCabin: 0x1a2a32,
  carWheel: 0x17171a,
  tvBody: 0x1a1c20,
  tvStand: 0x4a3220,
  switchPlate: 0xcfc8ba,
  switchPaddle: 0xe8e4da,
  doorWood: 0x4e3320
};

// -------------------------------------------------------------- helpers ----

/** Multiply a 0xRRGGBB colour's channels (sRGB, for authoring only). */
export function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

/** Linear mix of two 0xRRGGBB colours (sRGB, for authoring only). */
export function mixHex(a, b, t) {
  const m = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
