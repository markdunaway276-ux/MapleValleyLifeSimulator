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
  /**
   * Desktop sun shadow map: 2048 over ±38 m is ~3.7 cm a texel (was 1024 over ±44 m, ~8.6 cm).
   * `type` is the soft 3x3 bilinear PCF. In three r169 that kernel is fixed (it ignores
   * `radius`), so softness comes from the texel size plus the contact blobs (contact.js);
   * `radius` is still set so it takes effect if the type is ever switched to plain PCF.
   * bias / normalBias: checked with a no-bias control and grazing dawn sun on the lawn; at 3.7 cm
   * a texel, -0.0003 (about 3 cm of depth) plus a 0.03 normal offset shows no acne and no peter-panning.
   */
  shadow: { type: 'PCFSoft', mapSize: 2048, extent: 38, near: 1, far: 110, bias: -0.0003, normalBias: 0.03, radius: 2.5 },
  /** Fog starts and ends this fraction of the camera far plane away (was 0.55 / 0.98). */
  fog: { near: 0.42, far: 0.96 },
  /**
   * Rustic film grade, applied after tone mapping (post.js). It darkens and earths the
   * colour tone only; light levels stay in daynight.js. Desktop runs it as a shader pass;
   * phones (no post) get the `mobile` CSS approximation plus a vignette overlay (display.js).
   * The Debug menu's Display section scales its strength and the brightness (display.js).
   */
  grade: {
    gain: 0.92,          // overall darkening of the image
    curve: 0.35,         // filmic S-curve strength (0 = none)
    saturation: 0.82,    // below 1 = earthier, less "video game" colour
    shadowTint: [-0.012, 0.006, 0.018],   // cool olive-teal in the shadows
    highlightTint: [0.045, 0.018, -0.035], // warm amber in the highlights
    fade: 0.035,         // lifted, warm film blacks
    fadeColor: [0.10, 0.075, 0.05],
    vignette: 0.75,      // corner darkening
    grain: 0.035,        // animated film grain (0 = off)
    // Phone approximation at full strength (CSS filter values + vignette edge opacity).
    mobile: { sepia: 0.24, saturate: 0.78, contrast: 1.08, brightness: 0.9, vignette: 0.55 }
  }
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
  /** Autumn leaf litter flecks scattered on the lawn (0-255 RGB). */
  leaf: [122, 92, 44],
  /** Bare, dry patches of lawn. */
  dry: [86, 96, 52],
  road: [40, 40, 44],
  /** Tyre-worn lanes are darker and smoother; the kerb edges are paler grit. */
  roadWear: -7,
  roadGrit: 9,
  line: [206, 182, 74],
  walk: [150, 146, 136],
  /** Slab joint darkening (multiplier) and the pale lip beside it. */
  walkJoint: 0.7,
  walkLip: 1.07
};

/** Canvas texture sizes (px) per tier. All of them tile seamlessly. */
export const TEXTURE = {
  grass: { desktop: 512, mobile: 256, anisotropy: 8, repeat: 20 },
  /** [along the street, across it]. One tile spans 8 m along the street. */
  road: { desktop: [256, 64], mobile: [128, 64], tileMetres: 8, dashes: 4 },
  /** One slab per tile, so the joints land on the tile edge. */
  walk: { size: 128, slabMetres: 1.5 }
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

/** Trees: bark and foliage. Darker autumn greens with a touch of olive and ochre. */
export const TREE = {
  trunks: [0x4f3523, 0x5d4129],
  canopies: [0x2a5a2e, 0x35703a, 0x24542a, 0x4a6b2c],
  /** Foliage gets darker towards the bottom (baked AO) and speckled per vertex. */
  canopyFoot: 0.52,
  canopyJitter: 0.14,
  trunkFoot: 0.5
};

/** Fine detail on windows, doors and props (metres unless noted). */
export const DETAIL = {
  /** Window glass: top and bottom tint multipliers on the glass colour (a cheap sky reflection). */
  glassTop: 1.18,
  glassBottom: 0.5,
  /** Pale diagonal reflection streak, as a mix towards white. */
  glassStreak: 0.34,
  /** Dark interior seen through the lower glass (mix towards this colour). */
  glassInterior: 0x14202a,
  frame: 0.06,
  sill: 0.07,
  header: 0.05,
  doorCasing: 0.07,
  brass: 0xb08d57,
  iron: 0x23201e,
  /** Door lever and plate stand this far off the slab face. */
  handleOut: 0.035
};

/** Fake ambient occlusion: soft dark blobs on the ground under things. */
export const CONTACT = {
  /** Peak opacity of a blob; mobile has no sun shadows so it carries a little more. */
  desktop: 0.5,
  mobile: 0.62,
  /** Metres above the surface the blob sits (it cannot z-fight the ground). */
  lift: 0.012,
  tint: 0x0a0806
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
