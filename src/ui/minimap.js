import { ROUTE_9, routeHalfWidth } from '../world/route9.js';
/**
 * Neighborhood minimap. A fixed north-up 2D view of the street, houses,
 * trees and a few landmarks, with the player as a heading arrow. The
 * static layer is painted once to an offscreen canvas; the player and
 * any NPC dots are redrawn at about 10 Hz. The HUD chip sits in the bottom-left corner
 * (above the joystick on a phone). Preference is stored in localStorage.
 */
import { getHouseBounds } from '../world/buildings.js';
import { STREET } from '../world/street.js';
import { walkingRoute } from '../world/walkingRoute.js';
import { TREE_PLACEMENTS } from '../world/trees.js';
import { MAILBOX_SPAWN } from '../world/pickups.js';
import { CAR_SPAWN } from '../world/props.js';
import { VENDING_SPAWN } from '../world/vending.js';
import { DESK_CENTER } from '../world/interior.js';
import { houseBounds } from '../systems/collision.js';

export const MINIMAP_STORAGE_KEY = 'maple-minimap';
export const MINIMAP_HZ = 10;
export const MINIMAP_KEY = 'KeyM';
export const HUD_MINIMAP_SIZE = 132;

export const MINIMAP_COLORS = {
  grass: '#25352b',
  grid: 'rgba(255, 255, 255, 0.05)',
  park: '#314f38',
  pond: '#2a708c',
  pondRim: '#5ba2bd',
  road: '#3d4550',
  roadEdge: '#707d8e',
  roadLine: '#e6c45a',
  sidewalk: '#616d7a',
  gravel: '#736a5e',
  crossing: 'rgba(236, 240, 232, 0.72)',
  house: '#636d7a',
  houseStroke: '#96a2b2',
  houseShadow: 'rgba(0, 0, 0, 0.48)',
  mainHouse: '#c49647',
  mainHouseStroke: '#ffe18a',
  tree: 'rgba(54, 112, 66, 0.76)',
  treeCore: 'rgba(34, 78, 44, 0.88)',
  mailbox: '#f0c44d',
  vending: '#e55b65',
  market: '#46c484',
  laundromat: '#5bb2f2',
  desk: '#7eb2e8',
  car: '#607692',
  carActive: '#66a8f5',
  carNose: '#eef4fc',
  player: '#ffe156',
  playerStroke: '#101419',
  npc: '#ff965a',
  npcStroke: '#1d120c',
  north: '#f5ecd8',
  frame: 'rgba(0,0,0,0.45)'
};

export const NAV_MAP_COLORS = {
  grass: '#eef1ec',
  grid: 'rgba(0, 0, 0, 0)',
  park: '#cce8c7',
  pond: '#a4d3f6',
  pondRim: '#7ab4e6',
  road: '#ffffff',
  route9: '#fde293',
  route9Edge: '#e0bd59',
  roadEdge: '#cdd4dc',
  roadLine: '#e1e6ec',
  sidewalk: '#e3e6e2',
  gravel: '#e6dfd3',
  crossing: 'rgba(206, 212, 220, 0.75)',
  house: '#dce1e7',
  houseStroke: '#bfc7d1',
  houseShadow: 'rgba(28, 40, 56, 0.14)',
  mainHouse: '#f7e5be',
  mainHouseStroke: '#d4a246',
  tree: 'rgba(116, 186, 118, 0.45)',
  treeCore: 'rgba(84, 158, 88, 0.56)',
  mailbox: '#d97706',
  vending: '#dc2626',
  market: '#1e8e3e',
  laundromat: '#1a73e8',
  desk: '#1a73e8',
  car: '#5f6b7a',
  carActive: '#1a73e8',
  carNose: '#ffffff',
  player: '#1a73e8',
  playerStroke: '#ffffff',
  npc: '#e37400',
  npcStroke: '#ffffff',
  north: '#3c4043',
  frame: 'rgba(0,0,0,0.12)'
};

const STYLE_ID = 'hud-minimap-styles';

const CSS = `
#hud-nav-route {
  position: absolute; z-index: 34; pointer-events: none;
  left: max(12px, env(safe-area-inset-left));
  bottom: calc(max(16px, env(safe-area-inset-bottom)) + 142px);
  max-width: min(48vw, 240px); padding: 5px 9px; border-radius: 8px;
  border: 1px solid rgba(120, 210, 230, 0.35);
  background: rgba(14, 24, 32, 0.88); color: #c6fbff; font: 600 11px/1.3 system-ui, sans-serif;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
body.mobile #hud-nav-route { bottom: 268px; max-width: min(52vw, 200px); }
.phone-route-status { min-height: 1.3em; margin: 0 0 8px; font-size: 13px; color: #c6fbff; }

#hud-minimap {
  position: absolute;
  z-index: 34;
  display: none;
  box-sizing: border-box;
  left: max(12px, env(safe-area-inset-left));
  bottom: max(16px, env(safe-area-inset-bottom));
  width: ${HUD_MINIMAP_SIZE}px;
  height: ${HUD_MINIMAP_SIZE}px;
  padding: 3px;
  margin: 0;
  background: rgba(12, 15, 19, 0.84);
  border: 1.5px solid rgba(214, 182, 114, 0.48);
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}
#hud-minimap.is-visible { display: block; }
#hud-minimap canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  pointer-events: none;
}

#hud-minimap-toggle {
  position: absolute;
  z-index: 34;
  display: none;
  box-sizing: border-box;
  left: max(12px, env(safe-area-inset-left));
  bottom: max(16px, env(safe-area-inset-bottom));
  width: 42px; height: 42px; min-width: 42px; min-height: 42px;
  padding: 0; margin: 0;
  font: 19px/1 system-ui, sans-serif;
  color: #fff;
  background: rgba(12, 15, 19, 0.8);
  border: 1px solid rgba(214, 182, 114, 0.45);
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  align-items: center;
  justify-content: center;
  opacity: 0.92;
}
#hud-minimap-toggle.is-visible { display: flex; }
#hud-minimap-toggle:hover, #hud-minimap-toggle:focus {
  opacity: 1; background: rgba(18, 22, 28, 0.94); outline: none;
}

/* Portrait phone: sit cleanly above the on-screen joystick. */
body.mobile #hud-minimap {
  bottom: 152px;
  width: 108px;
  height: 108px;
}
body.mobile #hud-minimap-toggle {
  bottom: 152px;
}

/* Landscape phone (short height): dock minimap top-left beside Needs so it never overlaps joystick or Needs. */
@media (max-height: 500px) {
  body.mobile #hud-minimap {
    top: max(8px, env(safe-area-inset-top));
    bottom: auto;
    left: calc(max(10px, env(safe-area-inset-left)) + 138px);
    width: 90px;
    height: 90px;
    border-radius: 11px;
  }
  body.mobile #hud-minimap-toggle {
    top: max(8px, env(safe-area-inset-top));
    bottom: auto;
    left: calc(max(10px, env(safe-area-inset-left)) + 138px);
    width: 36px; height: 36px; min-width: 36px; min-height: 36px;
  }
  body.mobile #hud-nav-route {
    top: calc(max(8px, env(safe-area-inset-top)) + 96px);
    bottom: auto;
    left: calc(max(10px, env(safe-area-inset-left)) + 138px);
    max-width: 180px;
  }
}

.phone-map {
  flex: 1 1 auto;
  min-height: 180px;
  border-radius: 16px;
  overflow: hidden;
  background: #eef1ec;
  border: 1px solid rgba(255, 255, 255, 0.12);
  position: relative;
}
.phone-map canvas {
  display: block;
  width: 100%;
  height: 100%;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function readMinimapEnabled(storage) {
  if (!storage) return true;
  try {
    const v = storage.getItem(MINIMAP_STORAGE_KEY);
    if (v == null) return true;
    return v !== '0' && v !== 'false';
  } catch {
    return true;
  }
}

export function writeMinimapEnabled(storage, on) {
  if (!storage) return;
  try { storage.setItem(MINIMAP_STORAGE_KEY, on ? '1' : '0'); } catch { /* private mode, quota, … */ }
}

function unionBox(boxes) {
  if (!boxes || !boxes.length) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b) continue;
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, maxX, minZ, maxZ };
}

function isMainHouseCollider(id) {
  if (!id) return false;
  if (id === 'main-house') return true;
  return id.startsWith('main-house-');
}

function boundsForMainHouse(ud) {
  const cols = ud && ud.colliders && ud.colliders.colliders;
  if (Array.isArray(cols)) {
    const boxes = [];
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c && c.type === 'aabb' && isMainHouseCollider(c.id)) boxes.push(c);
    }
    const u = unionBox(boxes);
    if (u) return u;
  }
  return houseBounds(0, -10, 9.5, 10, 0);
}

function posOf(obj, fallback) {
  if (obj && obj.position) return { x: obj.position.x, z: obj.position.z };
  return { x: fallback.x, z: fallback.z };
}

/** Snapshot of static world geometry for the map. */
export function gatherMinimapWorld(scene) {
  const ud = (scene && scene.userData) || {};
  const street = ud.street || STREET;

  const houses = [];
  const list = ud.streetHouses || [];
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (!h || !h.position) continue;
    const rotY = h.rotation ? h.rotation.y : 0;
    const b = getHouseBounds(h, { x: h.position.x, z: h.position.z, rotY });
    if (b) houses.push({ id: h.name || ('house-' + i), ...b });
  }
  for (const b of ud.mapBuildings || []) houses.push({ ...b });
  const main = boundsForMainHouse(ud);
  if (main) houses.push({ id: 'main-house', main: true, ...main });

  const trees = [];
  if (ud.trees && ud.trees.length) {
    for (let i = 0; i < ud.trees.length; i++) {
      const t = ud.trees[i];
      if (!t || !t.position) continue;
      const udt = t.userData || {};
      const radius = Number(udt.radius) || (Number(udt.trunkRadius) ? Number(udt.trunkRadius) * 4 : 1.2);
      trees.push({ x: t.position.x, z: t.position.z, radius });
    }
  } else {
    for (let i = 0; i < TREE_PLACEMENTS.length; i++) {
      const p = TREE_PLACEMENTS[i];
      trees.push({ x: p.x, z: p.z, radius: 1.2 });
    }
  }

  const markers = [];
  const mailbox = posOf(ud.mailbox, MAILBOX_SPAWN);
  markers.push({ id: 'mailbox', kind: 'mailbox', x: mailbox.x, z: mailbox.z });
  if (ud.cornerShop) {
    const market = posOf(ud.cornerShop);
    markers.push({ id: 'market', kind: 'market', x: market.x, z: market.z });
  }
  if (ud.laundromat) {
    const l = posOf(ud.laundromat);
    markers.push({ id: 'laundromat', kind: 'laundromat', x: l.x + 1, z: l.z - 3 });
  }
  const vending = posOf(ud.vending, VENDING_SPAWN);
  markers.push({ id: 'vending', kind: 'vending', x: vending.x, z: vending.z });
  const car = ud.prop;
  if (car && car.position) {
    const size = (car.userData && car.userData.size) || { width: 4, depth: 1.85 };
    markers.push({
      id: 'car', kind: 'car',
      x: car.position.x, z: car.position.z,
      rotY: car.rotation ? car.rotation.y : 0,
      width: size.width, depth: size.depth,
      // A drivable car is drawn on the live layer instead of being baked.
      live: !!ud.car
    });
  } else {
    markers.push({ id: 'car', kind: 'car', ...CAR_SPAWN, width: 4, depth: 1.85 });
  }
  markers.push({ id: 'desk', kind: 'desk', x: DESK_CENTER.x, z: DESK_CENTER.z });

  return { street, houses, trees, markers };
}

function expand(b, x, z, pad) {
  const p = pad || 0;
  if (x - p < b.minX) b.minX = x - p;
  if (x + p > b.maxX) b.maxX = x + p;
  if (z - p < b.minZ) b.minZ = z - p;
  if (z + p > b.maxZ) b.maxZ = z + p;
}

export function worldBounds(world) {
  const s = (world && world.street) || STREET;
  const half = (s.length || STREET.length) / 2;
  const roadHalf = (s.roadWidth || STREET.roadWidth) / 2;
  const walk = s.sidewalkWidth || STREET.sidewalkWidth;
  const cz = s.roadCenterZ !== undefined ? s.roadCenterZ : STREET.roadCenterZ;
  const b = {
    minX: ROUTE_9.minX,
    maxX: half,
    minZ: cz - roadHalf - walk,
    maxZ: cz + roadHalf + walk
  };
  for (const road of s.expansion?.roads ?? []) {
    expand(b, road.minX, road.minZ);
    expand(b, road.maxX, road.maxZ);
  }
  const houses = (world && world.houses) || [];
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    if (h.minX < b.minX) b.minX = h.minX;
    if (h.maxX > b.maxX) b.maxX = h.maxX;
    if (h.minZ < b.minZ) b.minZ = h.minZ;
    if (h.maxZ > b.maxZ) b.maxZ = h.maxZ;
  }
  const trees = (world && world.trees) || [];
  for (let i = 0; i < trees.length; i++) expand(b, trees[i].x, trees[i].z, trees[i].radius || 1);
  const markers = (world && world.markers) || [];
  for (let i = 0; i < markers.length; i++) expand(b, markers[i].x, markers[i].z, 1);
  const pad = 2;
  b.minX -= pad; b.maxX += pad; b.minZ -= pad; b.maxZ += pad;
  return b;
}

/** Tight Maple Lane town bounds (excludes the 300m Route 9 west highway tail). */
export function townBounds(world) {
  const s = (world && world.street) || STREET;
  const half = (s.length || STREET.length) / 2;
  const cz = s.roadCenterZ !== undefined ? s.roadCenterZ : STREET.roadCenterZ;
  const b = { minX: -half - 4, maxX: half + 18, minZ: cz - 24, maxZ: cz + 26 };
  const houses = (world && world.houses) || [];
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    if (h.maxX < -60) continue;
    if (h.minX < b.minX) b.minX = h.minX;
    if (h.maxX > b.maxX) b.maxX = h.maxX;
    if (h.minZ < b.minZ) b.minZ = h.minZ;
    if (h.maxZ > b.maxZ) b.maxZ = h.maxZ;
  }
  b.minX -= 3; b.maxX += 3; b.minZ -= 3; b.maxZ += 3;
  return b;
}

/** North-up view: world +Z is up on the canvas, +X is right. */
export function makeMinimapView(bounds, width, height, pad = 8) {
  const bw = Math.max(0.001, bounds.maxX - bounds.minX);
  const bh = Math.max(0.001, bounds.maxZ - bounds.minZ);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const scale = Math.min(innerW / bw, innerH / bh);
  const usedW = bw * scale;
  const usedH = bh * scale;
  return {
    bounds,
    scale,
    ox: (width - usedW) / 2,
    oy: (height - usedH) / 2,
    width,
    height,
    pad
  };
}

export function toMap(view, x, z) {
  return {
    x: view.ox + (x - view.bounds.minX) * view.scale,
    y: view.oy + (view.bounds.maxZ - z) * view.scale
  };
}

/** Player looks along (0,0,-1) rotated by yaw (see player.js). */
export function playerForward(player) {
  const yaw = player && player.rotation ? Number(player.rotation.y) || 0 : 0;
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

function fillRectWorld(ctx, view, minX, maxX, minZ, maxZ) {
  const a = toMap(view, minX, maxZ);
  const c = toMap(view, maxX, minZ);
  ctx.fillRect(a.x, a.y, c.x - a.x, c.y - a.y);
}

function drawHaloLabel(ctx, text, x, y, { font = '600 10px system-ui, sans-serif', color = '#3c4043', halo = 'rgba(255,255,255,0.92)', align = 'center' } = {}) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = halo;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawNavPin(ctx, x, y, color, radius = 6.5, label = null) {
  ctx.save();
  ctx.translate(x, y);
  // Subtle pin ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 1, radius * 0.65, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // Teardrop pin body
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-radius * 1.05, -radius * 0.9, -radius * 1.15, -radius * 2.25, 0, -radius * 2.35);
  ctx.bezierCurveTo(radius * 1.15, -radius * 2.25, radius * 1.05, -radius * 0.9, 0, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Crisp white center dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -radius * 1.42, radius * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (label) {
    drawHaloLabel(ctx, label, x, y + 8, { font: '600 9.5px system-ui, sans-serif', color: '#202124' });
  }
}

export function drawStaticLayer(ctx, world, view, { theme = 'hud', pins = [], tilt3D = false } = {}) {
  const isNav = theme === 'nav';
  const C = isNav ? NAV_MAP_COLORS : MINIMAP_COLORS;
  const s = (world && world.street) || STREET;
  const half = (s.length || STREET.length) / 2;
  const roadHalf = (s.roadWidth || STREET.roadWidth) / 2;
  const walk = s.sidewalkWidth || STREET.sidewalkWidth;
  const cz = s.roadCenterZ !== undefined ? s.roadCenterZ : STREET.roadCenterZ;

  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, view.width, view.height);

  if (!isNav) {
    // Subtle tactical coordinate grid for spatial depth on the dark HUD minimap.
    const gridStep = Math.max(18, Math.round(view.width / 8));
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = gridStep; gx < view.width; gx += gridStep) {
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, view.height);
    }
    for (let gy = gridStep; gy < view.height; gy += gridStep) {
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(view.width, gy + 0.5);
    }
    ctx.stroke();
  }

  ctx.fillStyle = isNav ? C.route9 : C.road;
  ctx.beginPath();
  const roadPoints = [[ROUTE_9.minX, -4], [ROUTE_9.taper, -4], [-half, -routeHalfWidth(-half)],
    [-half, routeHalfWidth(-half)], [ROUTE_9.taper, 4], [ROUTE_9.minX, 4]];
  for (const [x, z] of roadPoints) { const point = toMap(view, x, cz + z); ctx.lineTo(point.x, point.y); }
  ctx.closePath();
  ctx.fill();
  if (isNav) {
    ctx.strokeStyle = C.route9Edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const expansion = s.expansion;
  if (expansion) {
    const fill = (rect) => fillRectWorld(ctx, view, rect.minX, rect.maxX, rect.minZ, rect.maxZ);
    ctx.fillStyle = C.park;
    fill(expansion.park);
    const { minX, minZ, maxX, maxZ } = expansion.pond;
    const pondCenter = toMap(view, (minX + maxX) / 2, (minZ + maxZ) / 2);
    const rx = (maxX - minX) * view.scale / 2;
    const ry = (maxZ - minZ) * view.scale / 2;
    ctx.fillStyle = C.pond;
    ctx.beginPath();
    ctx.ellipse(pondCenter.x, pondCenter.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.pondRim;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.fillStyle = C.road;
    for (const road of expansion.roads) fill(road);
    ctx.fillStyle = C.sidewalk;
    fill(expansion.southSidewalk);
    for (const path of expansion.paths) fill(path);
    ctx.fillStyle = C.gravel;
    for (const trail of expansion.gravel) fill(trail);
    ctx.fillStyle = C.crossing;
    fill(expansion.crossing);
  }

  ctx.fillStyle = C.sidewalk;
  fillRectWorld(ctx, view, -half, half, cz - roadHalf - walk, cz - roadHalf);
  fillRectWorld(ctx, view, -half, half, cz + roadHalf, cz + roadHalf + walk);

  ctx.fillStyle = C.road;
  fillRectWorld(ctx, view, -half, half, cz - roadHalf, cz + roadHalf);

  // Subtle road curb edges.
  ctx.fillStyle = C.roadEdge;
  const edgeW = Math.max(0.12, 0.8 / view.scale);
  fillRectWorld(ctx, view, -half, half, cz - roadHalf, cz - roadHalf + edgeW);
  fillRectWorld(ctx, view, -half, half, cz + roadHalf - edgeW, cz + roadHalf);

  // Dashed centre line along Maple Lane.
  const cLeft = toMap(view, -half, cz);
  const cRight = toMap(view, half, cz);
  ctx.save();
  ctx.strokeStyle = C.roadLine;
  ctx.lineWidth = Math.max(1, 0.28 * view.scale);
  ctx.setLineDash([Math.max(4, 3.2 * view.scale), Math.max(3, 2.6 * view.scale)]);
  ctx.beginPath();
  ctx.moveTo(cLeft.x, cLeft.y);
  ctx.lineTo(cRight.x, cRight.y);
  ctx.stroke();
  ctx.restore();

  if (s.parkingLaneWidth && !isNav) {
    ctx.fillStyle = 'rgba(180, 186, 194, 0.35)';
    const stripe = Math.max(0.08, 0.5 / view.scale);
    const parkingEdge = roadHalf - s.parkingLaneWidth;
    for (const z of [cz - parkingEdge, cz + parkingEdge]) {
      fillRectWorld(ctx, view, -half, half, z - stripe / 2, z + stripe / 2);
    }
  }

  ctx.fillStyle = C.crossing;
  for (const x of s.crossings ?? []) fillRectWorld(ctx, view, x - 1.1, x + 1.1, cz - roadHalf, cz + roadHalf);

  // Buildings: 3D extruded blocks with shaded walls & raised roofs in 3D map mode,
  // or crisp 2D roof footprints with drop shadows on the HUD minimap.
  const houses = ((world && world.houses) || []).slice();
  if (tilt3D) houses.sort((a, b) => (b.minZ || 0) - (a.minZ || 0));
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    const a = toMap(view, h.minX, h.maxZ);
    const c = toMap(view, h.maxX, h.minZ);
    const w = Math.max(2, c.x - a.x);
    const ht = Math.max(2, c.y - a.y);
    if (tilt3D) {
      const ext = Math.max(5, Math.min(18, (h.main ? 2.4 : 2.0) * view.scale));
      // Soft ground shadow
      ctx.fillStyle = 'rgba(24, 34, 48, 0.18)';
      ctx.fillRect(a.x + ext * 0.42, a.y + ext * 0.28, w, ht);
      // South-facing extruded front wall
      ctx.fillStyle = h.main ? '#cfa24e' : '#b4beca';
      ctx.fillRect(a.x, a.y + ht - ext, w, ext);
      // Subtle right-side depth bevel
      ctx.fillStyle = h.main ? '#dfba6e' : '#c6cfd9';
      ctx.beginPath();
      ctx.moveTo(a.x + w, a.y - ext);
      ctx.lineTo(a.x + w + ext * 0.22, a.y - ext * 0.72);
      ctx.lineTo(a.x + w + ext * 0.22, a.y + ht);
      ctx.lineTo(a.x + w, a.y + ht);
      ctx.closePath();
      ctx.fill();
      // Raised 3D roof face
      ctx.fillStyle = h.main ? '#fae9c5' : '#e6ebf0';
      ctx.fillRect(a.x, a.y - ext, w, ht);
      ctx.strokeStyle = h.main ? '#c9973b' : '#aeb8c4';
      ctx.lineWidth = h.main ? 1.5 : 1.1;
      ctx.strokeRect(a.x + 0.5, a.y - ext + 0.5, Math.max(1, w - 1), Math.max(1, ht - 1));
      // Subtle gable roof ridge line
      ctx.strokeStyle = h.main ? 'rgba(184, 134, 42, 0.45)' : 'rgba(120, 134, 150, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x + 3, a.y - ext + ht * 0.5);
      ctx.lineTo(a.x + w - 3, a.y - ext + ht * 0.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = C.houseShadow;
      ctx.fillRect(a.x + 1.5, a.y + 2, w, ht);
      ctx.fillStyle = h.main ? C.mainHouse : C.house;
      ctx.fillRect(a.x, a.y, w, ht);
      ctx.strokeStyle = h.main ? C.mainHouseStroke : C.houseStroke;
      ctx.lineWidth = h.main ? 1.4 : 1;
      ctx.strokeRect(a.x + 0.5, a.y + 0.5, Math.max(1, w - 1), Math.max(1, ht - 1));
    }
  }

  // Layered translucent tree canopies (with 3D lifted dome + ground shadow in 3D mode).
  const trees = (world && world.trees) || [];
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const p = toMap(view, t.x, t.z);
    const r = Math.max(2.2, (t.radius || 1.2) * view.scale);
    if (tilt3D) {
      ctx.fillStyle = 'rgba(24, 44, 28, 0.16)';
      ctx.beginPath();
      ctx.ellipse(p.x + 2.2, p.y + 2.2, r * 0.95, r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.tree;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 3, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.treeCore;
      ctx.beginPath();
      ctx.arc(p.x - r * 0.18, p.y - 3 - r * 0.18, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = C.tree;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.treeCore;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isNav) {
    // Street & park labels with clean white halos.
    const midStreet = toMap(view, 4, cz);
    drawHaloLabel(ctx, 'Maple Ln', midStreet.x, midStreet.y, {
      font: '700 10.5px system-ui, sans-serif', color: '#5f6368'
    });
    if (expansion?.park) {
      const pk = expansion.park;
      const pkPt = toMap(view, (pk.minX + pk.maxX) / 2, (pk.minZ + pk.maxZ) / 2);
      drawHaloLabel(ctx, 'Maple Park', pkPt.x, pkPt.y, {
        font: '600 9.5px system-ui, sans-serif', color: '#1e6e36'
      });
    }
    // Draw clean teardrop POI pins for major Maple Lane landmarks.
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      if (!pin || pin.x == null || pin.z == null) continue;
      const pt = toMap(view, pin.x, pin.z);
      drawNavPin(ctx, pt.x, pt.y, pin.color || '#1a73e8', 5.5, pin.label);
    }
  } else {
    const markers = (world && world.markers) || [];
    for (let i = 0; i < markers.length; i++) {
      if (markers[i].live) continue; // drawn each redraw (the drivable car)
      drawMarker(ctx, view, markers[i]);
    }
    // Sleek dark compass pill at top-center (HUD minimap only).
    ctx.fillStyle = 'rgba(10, 13, 16, 0.78)';
    ctx.beginPath();
    ctx.arc(view.width / 2, 9, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.north;
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', view.width / 2, 9.5);
  }
}

function drawMarker(ctx, view, m, palette = MINIMAP_COLORS) {
  const C = palette;
  const p = toMap(view, m.x, m.z);
  if (m.kind === 'car') {
    const w = (m.width || 4) * view.scale;
    const d = (m.depth || 1.85) * view.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Canvas y is down and map z is up, so a three.js heading maps to +rotY.
    ctx.rotate(m.rotY || 0);
    ctx.fillStyle = m.driving ? C.carActive : C.car;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    // A lighter nose shows which way it points.
    ctx.fillStyle = C.carNose;
    ctx.fillRect(w / 2 - Math.max(1.5, w * 0.18), -d / 2, Math.max(1.5, w * 0.18), d);
    ctx.restore();
    return;
  }
  const r = m.kind === 'desk' ? Math.max(2.6, 1.6 * (view.scale / 4)) : Math.max(2.8, 2 * (view.scale / 4) + 1.4);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = C[m.kind] ?? C.desk;
  ctx.fill();
  ctx.strokeStyle = 'rgba(12, 15, 18, 0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawPlayerArrow(ctx, player, view) {
  const C = MINIMAP_COLORS;
  if (!player || !player.position) return;
  const p = toMap(view, player.position.x, player.position.z);
  const fwd = playerForward(player);
  // Canvas angle: 0 is up (north). yaw 0 looks south (down the canvas).
  const angle = Math.atan2(fwd.x, fwd.z);
  const size = Math.max(9, Math.min(16, view.width * 0.085));
  const pulse = 0.5 + 0.5 * Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) * 0.005);
  ctx.save();
  ctx.translate(p.x, p.y);
  // Soft directional field-of-view cone so heading is instantly readable.
  ctx.save();
  ctx.rotate(angle);
  const coneGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, size * 2.6);
  coneGrad.addColorStop(0, 'rgba(102, 224, 255, 0.42)');
  coneGrad.addColorStop(1, 'rgba(102, 224, 255, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, size * 2.6, -Math.PI * 0.5 - 0.52, -Math.PI * 0.5 + 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Pulsing outer ring so you spot yourself on the HUD minimap in a split second.
  ctx.strokeStyle = `rgba(102, 224, 255, ${0.28 + pulse * 0.42})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, size * (1.05 + pulse * 0.45), 0, Math.PI * 2);
  ctx.stroke();
  // Crisp white-haloed golden directional arrow.
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.62, size * 0.7);
  ctx.lineTo(0, size * 0.32);
  ctx.lineTo(-size * 0.62, size * 0.7);
  ctx.closePath();
  ctx.fillStyle = C.player;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawNavPlayerDot(ctx, player, view) {
  if (!player || !player.position) return;
  const p = toMap(view, player.position.x, player.position.z);
  const fwd = playerForward(player);
  const angle = Math.atan2(fwd.x, fwd.z);
  const pulse = 0.5 + 0.5 * Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) * 0.005);
  ctx.save();
  ctx.translate(p.x, p.y);
  // Translucent blue directional heading cone
  ctx.save();
  ctx.rotate(angle);
  const coneGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
  coneGrad.addColorStop(0, 'rgba(26, 115, 232, 0.46)');
  coneGrad.addColorStop(1, 'rgba(26, 115, 232, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 36, -Math.PI * 0.5 - 0.55, -Math.PI * 0.5 + 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Animated pulsing accuracy halo
  ctx.fillStyle = `rgba(26, 115, 232, ${0.14 + pulse * 0.14})`;
  ctx.beginPath();
  ctx.arc(0, 0, 14 + pulse * 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(26, 115, 232, ${0.35 + pulse * 0.35})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Crisp white border + vivid blue GPS dot
  ctx.fillStyle = '#1a73e8';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Clean "You" halo label right below the blue dot so your location jumps right out.
  drawHaloLabel(ctx, 'You', p.x, p.y + 15, {
    font: '700 10.5px system-ui, sans-serif',
    color: '#1557b0',
    halo: 'rgba(255,255,255,0.96)'
  });
}

export function drawVehicles(ctx, vehicles, view) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  if (!view) return;
  for (let i = 0; i < list.length; i++) {
    if (list[i]) drawMarker(ctx, view, { ...list[i], kind: 'car' });
  }
}

export function drawNpcDots(ctx, npcs, view) {
  const C = MINIMAP_COLORS;
  const list = Array.isArray(npcs) ? npcs : [];
  if (!list.length || !view) return;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    const pos = n && (n.position || n);
    if (!pos || pos.x == null || pos.z == null) continue;
    const p = toMap(view, pos.x, pos.z);
    const r = Math.max(2.6, 2.2 * (view.scale / 4) + 1.2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = C.npc;
    ctx.strokeStyle = C.npcStroke;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }
}

function makeOffscreen(w, h) {
  const c = (typeof document !== 'undefined')
    ? document.createElement('canvas')
    : { width: 0, height: 0, getContext: () => null };
  c.width = w;
  c.height = h;
  return c;
}

export function createMinimapSurface({
  canvas,
  getWorld,
  getPlayer,
  getNpcs = null,
  getVehicles = null,
  getRoute = null,
  getPins = null,
  theme = 'hud',
  followPlayer = false,
  viewRadius = 32,
  cssWidth,
  cssHeight,
  pixelRatio = 1
} = {}) {
  const isNav = theme === 'nav';
  const palette = isNav ? NAV_MAP_COLORS : MINIMAP_COLORS;
  const dest = canvas || ((typeof document !== 'undefined') ? document.createElement('canvas') : null);
  let cssW = Math.max(1, cssWidth || (dest && dest.width) || HUD_MINIMAP_SIZE);
  let cssH = Math.max(1, cssHeight || (dest && dest.height) || HUD_MINIMAP_SIZE);
  let dpr = Math.max(1, Math.min(2, Number(pixelRatio) || 1));
  let staticCanvas = makeOffscreen(1, 1);
  let view = null;
  let world = null;
  let zoom = isNav ? 1.35 : 1.0;
  let tilt3D = isNav;
  let customCenter = null; // { x, z } when user pans or recenters on phone map
  let paints = 0;
  let staticPaints = 0;

  function activeBounds() {
    const player = typeof getPlayer === 'function' ? getPlayer() : getPlayer;
    if (followPlayer && player && player.position) {
      const r = Math.max(14, viewRadius / zoom);
      const px = player.position.x;
      const pz = player.position.z;
      return { minX: px - r, maxX: px + r, minZ: pz - r, maxZ: pz + r };
    }
    const base = townBounds(world || {});
    if (zoom <= 1.02 && !customCenter) return base;
    const cx = customCenter ? customCenter.x : (player?.position ? player.position.x * 0.45 : (base.minX + base.maxX) * 0.5);
    const cz = customCenter ? customCenter.z : (player?.position ? player.position.z * 0.45 : (base.minZ + base.maxZ) * 0.5);
    const hw = ((base.maxX - base.minX) * 0.5) / zoom;
    const hh = ((base.maxZ - base.minZ) * 0.5) / zoom;
    return { minX: cx - hw, maxX: cx + hw, minZ: cz - hh, maxZ: cz + hh };
  }

  function resize(width, height, ratio) {
    cssW = Math.max(1, width || cssW);
    cssH = Math.max(1, height || cssH);
    if (ratio) dpr = Math.max(1, Math.min(2, Number(ratio) || 1));
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (dest) {
      dest.width = pw;
      dest.height = ph;
    }
    rebuild();
  }

  function rebuild() {
    world = typeof getWorld === 'function' ? getWorld() : getWorld;
    const pins = typeof getPins === 'function' ? getPins() : (Array.isArray(getPins) ? getPins : []);
    const pw = dest ? dest.width : Math.max(1, Math.round(cssW * dpr));
    const ph = dest ? dest.height : Math.max(1, Math.round(cssH * dpr));
    staticCanvas = makeOffscreen(pw, ph);
    view = makeMinimapView(activeBounds(), pw, ph, followPlayer ? 2 : Math.max(6, 8 * dpr));
    const sctx = staticCanvas.getContext && staticCanvas.getContext('2d');
    if (sctx && !followPlayer) drawStaticLayer(sctx, world, view, { theme, pins, tilt3D });
    staticPaints++;
    redraw();
  }

  function redraw() {
    if (!dest) return;
    const ctx = dest.getContext && dest.getContext('2d');
    if (!ctx) return;
    const pw = dest.width || Math.max(1, Math.round(cssW * dpr));
    const ph = dest.height || Math.max(1, Math.round(cssH * dpr));
    if (followPlayer) {
      if (!world) world = typeof getWorld === 'function' ? getWorld() : getWorld;
      view = makeMinimapView(activeBounds(), pw, ph, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      drawStaticLayer(ctx, world, view, { theme, pins: [] });
    } else {
      if (!view) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      if (staticCanvas) ctx.drawImage(staticCanvas, 0, 0);
    }
    const player = typeof getPlayer === 'function' ? getPlayer() : getPlayer;
    const npcs = typeof getNpcs === 'function' ? getNpcs() : getNpcs;
    const vehicles = typeof getVehicles === 'function' ? getVehicles() : getVehicles;
    if (Array.isArray(vehicles)) {
      for (let i = 0; i < vehicles.length; i++) {
        if (vehicles[i]) drawMarker(ctx, view, { ...vehicles[i], kind: 'car' }, palette);
      }
    }
    if (Array.isArray(npcs) && npcs.length) {
      for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        const pos = n && (n.position || n);
        if (!pos || pos.x == null || pos.z == null) continue;
        const p = toMap(view, pos.x, pos.z);
        const r = isNav ? 4.2 : Math.max(3.2, 2.2 * (view.scale / 4) + 1.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = palette.npc;
        ctx.strokeStyle = palette.npcStroke;
        ctx.lineWidth = isNav ? 1.5 : 1.2;
        ctx.fill();
        ctx.stroke();
      }
    }
    const route = getRoute?.();
    if (route) {
      const goal = toMap(view, route.goal.x, route.goal.z);
      ctx.save();
      if (!route.arrived) {
        ctx.beginPath();
        for (let i = 0; i < route.points.length; i++) {
          const point = toMap(view, route.points[i].x, route.points[i].z);
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = isNav ? '#1557b0' : '#102a33';
        ctx.lineWidth = isNav ? 7 : 5;
        ctx.stroke();
        ctx.strokeStyle = isNav ? '#4285f4' : '#6de8f1';
        ctx.lineWidth = isNav ? 4.5 : 2.6;
        ctx.stroke();
      }
      if (isNav) {
        drawNavPin(ctx, goal.x, goal.y, route.arrived ? '#1e8e3e' : '#ea4335', 8);
      } else {
        ctx.beginPath();
        ctx.arc(goal.x, goal.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = route.arrived ? '#a8f0a2' : '#6de8f1';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (isNav) drawNavPlayerDot(ctx, player, view);
    else drawPlayerArrow(ctx, player, view);
    paints++;
  }

  function setZoom(next) {
    zoom = Math.max(0.85, Math.min(3.6, Number(next) || 1));
    rebuild();
  }
  function zoomIn() { setZoom(zoom * 1.35); }
  function zoomOut() { setZoom(zoom / 1.35); }
  function panBy(dxCanvasPx, dyCanvasPx) {
    if (!view || !view.scale) return;
    const base = townBounds(world || {});
    if (!customCenter) {
      const b = activeBounds();
      customCenter = { x: (b.minX + b.maxX) * 0.5, z: (b.minZ + b.maxZ) * 0.5 };
    }
    customCenter.x = Math.max(base.minX - 18, Math.min(base.maxX + 18, customCenter.x - dxCanvasPx / view.scale));
    customCenter.z = Math.max(base.minZ - 14, Math.min(base.maxZ + 14, customCenter.z + dyCanvasPx / view.scale));
    rebuild();
  }
  function toggle3D() {
    tilt3D = !tilt3D;
    rebuild();
    return tilt3D;
  }
  function recenterOnPlayer() {
    const player = typeof getPlayer === 'function' ? getPlayer() : getPlayer;
    if (player?.position) {
      customCenter = { x: player.position.x, z: player.position.z };
      zoom = Math.max(zoom, 1.85);
      rebuild();
    }
  }

  resize(cssW, cssH, dpr);

  return {
    canvas: dest,
    resize,
    rebuild,
    redraw,
    setZoom,
    zoomIn,
    zoomOut,
    panBy,
    toggle3D,
    is3D: () => tilt3D,
    recenterOnPlayer,
    getZoom: () => zoom,
    getView: () => view,
    getWorldSnap: () => world,
    paintCount: () => paints,
    staticPaintCount: () => staticPaints
  };
}

export function createHudMinimap({
  scene = null,
  player = null,
  container = (typeof document !== 'undefined' ? document.body : null),
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  isMobile = false,
  isStarted = null,
  bindKey = true,
  pixelRatio = (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
} = {}) {
  ensureStyles();

  let enabled = readMinimapEnabled(storage);
  let hudShown = false;
  let acc = 0;
  let bakedInterior = false;
  const listeners = [];
  let phoneSurface = null;
  let waypoint = null;
  let route = null;
  let showPhoneRoute = null;
  const getRoute = () => route;
  const routeChip = document.createElement('div');
  routeChip.id = 'hud-nav-route';
  routeChip.hidden = true;
  routeChip.setAttribute('role', 'status');

  function refreshRoute() {
    const goal = waypoint?.position();
    if (!goal) route = null;
    else if (!route?.arrived) {
      const walk = walkingRoute(player?.position, goal, scene?.userData?.street ?? STREET);
      route = walk ? { ...walk, goal } : null;
    }
    const label = route ? (route.arrived ? 'Arrived · ' : Math.ceil(route.metres) + ' m · ') + waypoint.name : '';
    if (routeChip.textContent !== label) routeChip.textContent = label;
    routeChip.hidden = !hudShown || !label;
    showPhoneRoute?.(label);
  }

  const getWorld = () => gatherMinimapWorld(scene);
  const getPlayer = () => player;
  const getNpcs = () => (scene && scene.userData && scene.userData.npcs) || [];
  const getVehicles = () => {
    const car = scene && scene.userData && scene.userData.car;
    return car && typeof car.getMarker === 'function' ? [car.getMarker()] : [];
  };

  const wrap = document.createElement('div');
  wrap.id = 'hud-minimap';
  wrap.className = 'hud-ui';
  wrap.setAttribute('role', 'button');
  wrap.setAttribute('aria-label', 'Hide minimap');
  wrap.title = bindKey && !isMobile ? 'Minimap (M) — tap to hide' : 'Minimap — tap to hide';
  const hudCanvas = document.createElement('canvas');
  wrap.appendChild(hudCanvas);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.id = 'hud-minimap-toggle';
  toggleBtn.className = 'hud-ui';
  toggleBtn.textContent = '🗺️';
  toggleBtn.setAttribute('aria-label', 'Show minimap');
  toggleBtn.title = bindKey && !isMobile ? 'Minimap (M)' : 'Minimap';

  const hud = createMinimapSurface({
    canvas: hudCanvas,
    getWorld,
    getPlayer,
    getNpcs,
    getVehicles,
    getRoute,
    followPlayer: true,
    viewRadius: 30,
    cssWidth: HUD_MINIMAP_SIZE,
    cssHeight: HUD_MINIMAP_SIZE,
    pixelRatio
  });

  if (container) container.append(wrap, toggleBtn, routeChip);

  function emit() {
    for (let i = 0; i < listeners.length; i++) listeners[i](enabled);
  }

  function syncChrome() {
    routeChip.hidden = !hudShown || !route;
    wrap.classList.toggle('is-visible', !!(hudShown && enabled));
    toggleBtn.classList.toggle('is-visible', !!(hudShown && !enabled));
  }

  function isEnabled() { return enabled; }

  function setEnabled(on) {
    const next = !!on;
    if (next === enabled) {
      syncChrome();
      return enabled;
    }
    enabled = next;
    writeMinimapEnabled(storage, enabled);
    if (enabled) {
      maybeRebuild();
      hud.redraw();
      acc = 0;
    }
    syncChrome();
    emit();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function setHudVisible(v) {
    hudShown = !!v;
    if (hudShown && enabled) {
      maybeRebuild();
      hud.redraw();
    }
    syncChrome();
  }

  function maybeRebuild() {
    const hasInterior = !!(scene && scene.userData && scene.userData.interior);
    if (hasInterior && !bakedInterior) {
      bakedInterior = true;
      hud.rebuild();
      if (phoneSurface) phoneSurface.rebuild();
    }
  }

  function update(dt) {
    maybeRebuild();
    const need = (hudShown && enabled) || !!phoneSurface || !!waypoint;
    if (!need) return;
    acc += Math.max(0, Number(dt) || 0);
    if (acc < 1 / MINIMAP_HZ) return;
    acc = 0;
    refreshRoute();
    if (hudShown && enabled) hud.redraw();
    if (phoneSurface) phoneSurface.redraw();
  }

  function getNavPins() {
    const pinColors = {
      mailbox: '#d97706',
      market: '#1e8e3e',
      laundromat: '#1a73e8',
      'post-office': '#1967d2',
      'trailer-park': '#8e44ad',
      park: '#1e8e3e',
      'gas-station': '#ea4335'
    };
    const shortLabels = {
      mailbox: 'Home',
      market: 'Market',
      laundromat: 'Laundry',
      'post-office': 'Post',
      'trailer-park': 'Trailers',
      park: 'Park',
      'gas-station': 'Fuel'
    };
    const dests = buildDestinations();
    const pins = [];
    for (let i = 0; i < dests.length; i++) {
      const d = dests[i];
      if (!shortLabels[d.id]) continue;
      const p = typeof d.position === 'function' ? d.position() : d.position;
      if (!p || p.x == null || p.z == null) continue;
      pins.push({ id: d.id, label: shortLabels[d.id], name: d.name, x: p.x, z: p.z, color: pinColors[d.id] || '#1a73e8' });
    }
    return pins;
  }

  function buildDestinations() {
    const names = { mailbox: 'Home', market: 'Corner Market', desk: 'Home office' };
    const list = getWorld().markers.filter(marker => Object.hasOwn(names, marker.id)).map(marker => ({
      id: marker.id, name: names[marker.id], position: () => marker
    }));
    // Buildings at the street ends: route to the sidewalk in front of them, not inside.
    const ud = scene?.userData || {};
    if (ud.laundromat) {
      const p = ud.laundromat.position;
      list.push({ id: 'laundromat', name: 'Laundromat', position: () => ({ x: p.x, z: p.z + 2.0 }) });
    }
    if (ud.postOffice) {
      const p = ud.postOffice.position;
      list.push({ id: 'post-office', name: 'Post Office', position: () => ({ x: p.x, z: p.z + 2.0 }) });
    }
    if (ud.trailerPark) list.push({ id: 'trailer-park', name: 'Trailer Park', position: () => ({ x: -30.5, z: -4.3 }) });
    if (ud.street?.expansion?.park || STREET.expansion?.park) {
      const pk = (ud.street?.expansion || STREET.expansion).park;
      list.push({
        id: 'park',
        name: 'Maple Lane Park',
        position: () => ({ x: (pk.minX + pk.maxX) / 2, z: (pk.minZ + pk.maxZ) / 2 })
      });
    }
    if (ud.gasStation?.position) {
      const p = ud.gasStation.position;
      list.push({ id: 'gas-station', name: 'Fuel & Go', position: () => ({ x: p.x, z: p.z }) });
    }
    return list;
  }

  function attachPhone(parent, size, onRoute = null, onPickPin = null) {
    if (!parent) return () => {};
    ensureStyles();
    parent.classList.add('phone-map');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Neighborhood map');
    parent.appendChild(canvas);
    const fallbackW = (size && size.width) || 260;
    const fallbackH = (size && size.height) || 320;
    const surface = createMinimapSurface({
      canvas,
      getWorld,
      getPlayer,
      getNpcs,
      getVehicles,
      getRoute,
      getPins: getNavPins,
      theme: 'nav',
      cssWidth: fallbackW,
      cssHeight: fallbackH,
      pixelRatio
    });
    phoneSurface = surface;
    showPhoneRoute = onRoute;
    refreshRoute();

    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';

    const pointers = new Map();
    let dragDist = 0;
    let lastPinchDist = 0;
    let lastPos = null;

    const pickPinAt = (clientX, clientY) => {
      if (typeof onPickPin !== 'function') return;
      const v = surface.getView();
      if (!v) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = (clientX - rect.left) * (canvas.width / rect.width);
      const cy = (clientY - rect.top) * (canvas.height / rect.height);
      const pins = getNavPins();
      let best = null;
      let bestD = 36 * (canvas.width / Math.max(1, rect.width));
      for (let i = 0; i < pins.length; i++) {
        const pt = toMap(v, pins[i].x, pins[i].z);
        const d = Math.hypot(pt.x - cx, (pt.y - 6) - cy);
        if (d < bestD) { bestD = d; best = pins[i]; }
      }
      if (best) onPickPin(best.id);
    };

    const onPointerDown = (e) => {
      e.stopPropagation();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (typeof canvas.setPointerCapture === 'function') {
        try { canvas.setPointerCapture(e.pointerId); } catch {}
      }
      if (pointers.size === 1) {
        dragDist = 0;
        lastPos = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        dragDist = 99;
      }
    };

    const onPointerMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      e.stopPropagation();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinchDist > 8 && dist > 8) {
          surface.setZoom(surface.getZoom() * (dist / lastPinchDist));
        }
        lastPinchDist = dist;
        return;
      }
      if (pointers.size === 1 && lastPos) {
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        dragDist += Math.hypot(dx, dy);
        lastPos = { x: e.clientX, y: e.clientY };
        const rect = canvas.getBoundingClientRect();
        const sx = rect.width ? (canvas.width / rect.width) : 1;
        const sy = rect.height ? (canvas.height / rect.height) : 1;
        surface.panBy(dx * sx, dy * sy);
      }
    };

    const onPointerUp = (e) => {
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        canvas.style.cursor = 'grab';
        lastPos = null;
        lastPinchDist = 0;
        if (wasSingle && dragDist < 8) pickPinAt(e.clientX, e.clientY);
      } else if (pointers.size === 1) {
        const [remaining] = pointers.values();
        lastPos = { x: remaining.x, y: remaining.y };
        lastPinchDist = 0;
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      surface.setZoom(surface.getZoom() * factor);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    function fit() {
      const w = Math.max(parent.clientWidth || 0, fallbackW);
      const h = Math.max(parent.clientHeight || 0, fallbackH);
      surface.resize(w, h, pixelRatio);
    }
    fit();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fit());
      ro.observe(parent);
    }
    surface.redraw();

    const cleanup = () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      if (ro) ro.disconnect();
      if (phoneSurface === surface) {
        phoneSurface = null;
        showPhoneRoute = null;
      }
      canvas.remove();
    };
    cleanup.zoomIn = () => surface.zoomIn();
    cleanup.zoomOut = () => surface.zoomOut();
    cleanup.recenter = () => surface.recenterOnPlayer();
    cleanup.toggle3D = () => surface.toggle3D();
    cleanup.is3D = () => surface.is3D();
    return cleanup;
  }

  function started() {
    return typeof isStarted === 'function' ? !!isStarted() : true;
  }

  function onKey(e) {
    if (!bindKey || isMobile) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.code !== MINIMAP_KEY || e.repeat) return;
    if (!started()) return;
    e.preventDefault();
    toggle();
  }
  if (typeof document !== 'undefined') document.addEventListener('keydown', onKey);

  function stop(e) { e.stopPropagation(); }
  wrap.addEventListener('pointerdown', stop);
  wrap.addEventListener('touchstart', stop, { passive: true });
  wrap.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEnabled(false);
  });
  toggleBtn.addEventListener('pointerdown', stop);
  toggleBtn.addEventListener('touchstart', stop, { passive: true });
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEnabled(true);
  });

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function dispose() {
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKey);
    wrap.remove();
    toggleBtn.remove();
    routeChip.remove();
  }

  syncChrome();

  return {
    element: wrap,
    button: toggleBtn,
    isEnabled,
    setEnabled,
    toggle,
    setHudVisible,
    update,
    attachPhone,
    destinations: buildDestinations,
    getWaypointId: () => waypoint?.id ?? '',
    setWaypoint(next) {
      waypoint = next ?? null;
      route = null;
      refreshRoute();
      hud.redraw();
      phoneSurface?.redraw();
    },
    onChange,
    rebuild: () => { hud.rebuild(); if (phoneSurface) phoneSurface.rebuild(); },
    redraw: () => { hud.redraw(); if (phoneSurface) phoneSurface.redraw(); },
    getSurface: () => hud,
    getPhoneSurface: () => phoneSurface,
    dispose
  };
}
