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
  grass: '#1b241e',
  grid: 'rgba(255, 255, 255, 0.04)',
  park: '#233426',
  pond: '#1d4856',
  pondRim: '#3a7284',
  road: '#2d333b',
  roadEdge: '#4a5360',
  roadLine: '#c8a64b',
  sidewalk: '#454d56',
  gravel: '#575046',
  crossing: 'rgba(220, 224, 214, 0.55)',
  house: '#4b525c',
  houseStroke: '#737d8a',
  houseShadow: 'rgba(0, 0, 0, 0.42)',
  mainHouse: '#9b7944',
  mainHouseStroke: '#e6c076',
  tree: 'rgba(42, 86, 52, 0.72)',
  treeCore: 'rgba(26, 58, 34, 0.85)',
  mailbox: '#d8b24c',
  vending: '#d4525c',
  market: '#46a674',
  laundromat: '#529ad6',
  desk: '#7eb2e8',
  car: '#4c5e74',
  carActive: '#6892c6',
  carNose: '#dce6f4',
  player: '#ffde59',
  playerStroke: '#121417',
  npc: '#ee8752',
  npcStroke: '#22140d',
  north: '#f2e8d2',
  frame: 'rgba(0,0,0,0.45)'
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
  background: #17201a;
  border: 1px solid rgba(214, 182, 114, 0.35);
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

export function drawStaticLayer(ctx, world, view) {
  const C = MINIMAP_COLORS;
  const s = (world && world.street) || STREET;
  const half = (s.length || STREET.length) / 2;
  const roadHalf = (s.roadWidth || STREET.roadWidth) / 2;
  const walk = s.sidewalkWidth || STREET.sidewalkWidth;
  const cz = s.roadCenterZ !== undefined ? s.roadCenterZ : STREET.roadCenterZ;

  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, view.width, view.height);

  // Subtle tactical coordinate grid for spatial depth.
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

  ctx.fillStyle = C.road;
  ctx.beginPath();
  const roadPoints = [[ROUTE_9.minX, -4], [ROUTE_9.taper, -4], [-half, -routeHalfWidth(-half)],
    [-half, routeHalfWidth(-half)], [ROUTE_9.taper, 4], [ROUTE_9.minX, 4]];
  for (const [x, z] of roadPoints) { const point = toMap(view, x, cz + z); ctx.lineTo(point.x, point.y); }
  ctx.closePath();
  ctx.fill();

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

  // Dashed amber centre line along Maple Lane.
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

  if (s.parkingLaneWidth) {
    ctx.fillStyle = 'rgba(180, 186, 194, 0.35)';
    const stripe = Math.max(0.08, 0.5 / view.scale);
    const parkingEdge = roadHalf - s.parkingLaneWidth;
    for (const z of [cz - parkingEdge, cz + parkingEdge]) {
      fillRectWorld(ctx, view, -half, half, z - stripe / 2, z + stripe / 2);
    }
  }

  ctx.fillStyle = C.crossing;
  for (const x of s.crossings ?? []) fillRectWorld(ctx, view, x - 1.1, x + 1.1, cz - roadHalf, cz + roadHalf);

  // Buildings with soft drop shadow and crisp roof outline.
  const houses = (world && world.houses) || [];
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    const a = toMap(view, h.minX, h.maxZ);
    const c = toMap(view, h.maxX, h.minZ);
    const w = Math.max(2, c.x - a.x);
    const ht = Math.max(2, c.y - a.y);
    ctx.fillStyle = C.houseShadow;
    ctx.fillRect(a.x + 1.5, a.y + 2, w, ht);
    ctx.fillStyle = h.main ? C.mainHouse : C.house;
    ctx.fillRect(a.x, a.y, w, ht);
    ctx.strokeStyle = h.main ? C.mainHouseStroke : C.houseStroke;
    ctx.lineWidth = h.main ? 1.4 : 1;
    ctx.strokeRect(a.x + 0.5, a.y + 0.5, Math.max(1, w - 1), Math.max(1, ht - 1));
  }

  // Layered translucent tree canopies.
  const trees = (world && world.trees) || [];
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const p = toMap(view, t.x, t.z);
    const r = Math.max(2.2, (t.radius || 1.2) * view.scale);
    ctx.fillStyle = C.tree;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.treeCore;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }

  const markers = (world && world.markers) || [];
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].live) continue; // drawn each redraw (the drivable car)
    drawMarker(ctx, view, markers[i]);
  }

  // Sleek dark compass pill at top-center.
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

function drawMarker(ctx, view, m) {
  const C = MINIMAP_COLORS;
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
  const size = Math.max(6, Math.min(14, view.width * 0.07));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.55, size * 0.65);
  ctx.lineTo(0, size * 0.3);
  ctx.lineTo(-size * 0.55, size * 0.65);
  ctx.closePath();
  ctx.fillStyle = C.player;
  ctx.strokeStyle = C.playerStroke;
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
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
  cssWidth,
  cssHeight,
  pixelRatio = 1
} = {}) {
  const dest = canvas || ((typeof document !== 'undefined') ? document.createElement('canvas') : null);
  let cssW = Math.max(1, cssWidth || (dest && dest.width) || HUD_MINIMAP_SIZE);
  let cssH = Math.max(1, cssHeight || (dest && dest.height) || HUD_MINIMAP_SIZE);
  let dpr = Math.max(1, Math.min(2, Number(pixelRatio) || 1));
  let staticCanvas = makeOffscreen(1, 1);
  let view = null;
  let world = null;
  let paints = 0;
  let staticPaints = 0;

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
    const pw = dest ? dest.width : Math.max(1, Math.round(cssW * dpr));
    const ph = dest ? dest.height : Math.max(1, Math.round(cssH * dpr));
    staticCanvas = makeOffscreen(pw, ph);
    view = makeMinimapView(worldBounds(world || {}), pw, ph, Math.max(6, 8 * dpr));
    const sctx = staticCanvas.getContext && staticCanvas.getContext('2d');
    if (sctx) drawStaticLayer(sctx, world, view);
    staticPaints++;
    redraw();
  }

  function redraw() {
    if (!dest || !view) return;
    const ctx = dest.getContext && dest.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dest.width, dest.height);
    if (staticCanvas) ctx.drawImage(staticCanvas, 0, 0);
    const player = typeof getPlayer === 'function' ? getPlayer() : getPlayer;
    const npcs = typeof getNpcs === 'function' ? getNpcs() : getNpcs;
    const vehicles = typeof getVehicles === 'function' ? getVehicles() : getVehicles;
    drawVehicles(ctx, vehicles, view);
    drawNpcDots(ctx, npcs, view);
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
        ctx.strokeStyle = '#15323a';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = '#6de8f1';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(goal.x, goal.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = route.arrived ? '#a8f0a2' : '#6de8f1';
      ctx.fill();
      ctx.strokeStyle = '#15323a';
      ctx.stroke();
      ctx.restore();
    }
    drawPlayerArrow(ctx, player, view);
    paints++;
  }

  resize(cssW, cssH, dpr);

  return {
    canvas: dest,
    resize,
    rebuild,
    redraw,
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

  function attachPhone(parent, size, onRoute = null) {
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
      cssWidth: fallbackW,
      cssHeight: fallbackH,
      pixelRatio
    });
    phoneSurface = surface;
    showPhoneRoute = onRoute;
    refreshRoute();

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

    return () => {
      if (ro) ro.disconnect();
      if (phoneSurface === surface) {
        phoneSurface = null;
        showPhoneRoute = null;
      }
      canvas.remove();
    };
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
    destinations() {
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
      return list;
    },
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
