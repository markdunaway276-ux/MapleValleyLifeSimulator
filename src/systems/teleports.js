import * as THREE from 'three';
import { doorInteractPoint, doorOutwardNormal } from './doors.js';
import { INTERACT_RANGE } from './interactables.js';

/**
 * Debug teleport presets. Positions are resolved against the live collision
 * world so they stay outside houses, trees and the parked car. Door presets
 * stand just outside the doorway, facing it, within INTERACT_RANGE.
 */

export const DEFAULT_SPAWN = { x: 0, y: 1.6, z: -1.15 };

/** Standoff distances (metres) tried, in order, along a door's outward normal. */
export const DOOR_STANDOFFS = [2.0, 1.7, 1.5, 2.3, 1.3, 2.6, 2.8];

export const TELEPORT_PRESETS = [
  { id: 'street-start', label: 'Street start', key: 'F8', kind: 'spawn' },
  { id: 'main-door', label: 'Front of my house', kind: 'door', doorId: 'main-door' },
  { id: 'inside-house', label: 'Inside my house', kind: 'interior' },
  { id: 'house-sw', label: 'SW neighbor door', kind: 'door', doorId: 'house-sw' },
  { id: 'house-se', label: 'SE neighbor door', kind: 'door', doorId: 'house-se' },
  { id: 'house-nw', label: 'NW neighbor door', kind: 'door', doorId: 'house-nw' },
  { id: 'house-ne', label: 'NE neighbor door', kind: 'door', doorId: 'house-ne' },
  { id: 'street-west', label: 'West end of street', kind: 'street-end', side: 'west' },
  { id: 'street-east', label: 'East end of street', kind: 'street-end', side: 'east' },
  { id: 'parked-car', label: 'By the parked car', kind: 'car' },
  { id: 'laundromat', label: 'Laundromat door', kind: 'point', x: 29.5, z: -3.6, yaw: 0 },
  { id: 'laundromat-inside', label: 'Laundromat counter', kind: 'point', x: 31.0, z: -8.3, yaw: Math.PI / 2 },
  { id: 'laundromat-back', label: 'Laundromat back room', kind: 'point', x: 24.5, z: -11.5, yaw: Math.PI / 2 },
  { id: 'trailer-park', label: 'Trailer park', kind: 'point', x: -24.6, z: -3.6, yaw: Math.PI / 4 },
  { id: 'clinic', label: 'Clinic door', kind: 'point', x: -34, z: 12.4, yaw: Math.PI },
  { id: 'clinic-inside', label: 'Clinic waiting room', kind: 'point', x: -34, z: 17.0, yaw: Math.PI },
  { id: 'gas-station', label: 'Gas station pumps', kind: 'point', x: -0.8, z: 12.2, yaw: Math.PI },
  { id: 'gas-station-inside', label: 'Gas station register', kind: 'point', x: -1.6, z: 34.5, yaw: Math.PI / 2 }
];

export function findDoor(scene, doorId) {
  const doors = (scene && scene.userData && scene.userData.doors) || [];
  return doors.find((d) => d && d.userData && d.userData.doorId === doorId) || null;
}

/** Yaw that makes the player look along a world-space XZ direction. */
export function yawToward(dx, dz) {
  // forward = (-sin y, 0, -cos y). Want that = normalize(dx, dz).
  const len = Math.hypot(dx, dz) || 1;
  return Math.atan2(-dx / len, -dz / len);
}

function isClear(world, x, z, radius) {
  if (!world) return true;
  if (typeof world.overlaps === 'function' && world.overlaps(x, z, radius)) return false;
  return true;
}

function settle(world, x, z, radius) {
  if (world && typeof world.resolvePosition === 'function') {
    const r = world.resolvePosition(x, z, radius);
    return { x: r.x, z: r.z };
  }
  return { x, z };
}

/**
 * Stand along the door's outward normal, just outside collision, within range,
 * facing the doorway.
 */
export function approachDoor(door, world, radius, eyeY = 1.6) {
  const point = doorInteractPoint(door, new THREE.Vector3());
  const out = doorOutwardNormal(door, new THREE.Vector3());
  let best = null;
  for (const dist of DOOR_STANDOFFS) {
    const rawX = point.x + out.x * dist;
    const rawZ = point.z + out.z * dist;
    const s = settle(world, rawX, rawZ, radius);
    const d = Math.hypot(s.x - point.x, s.z - point.z);
    if (!isClear(world, s.x, s.z, radius)) continue;
    if (d >= INTERACT_RANGE) continue;
    const yaw = yawToward(point.x - s.x, point.z - s.z);
    const pose = { x: s.x, y: eyeY, z: s.z, yaw, door, interact: point, distance: d };
    // Prefer a standoff close to 2 m that didn't have to be pushed far.
    const pushed = Math.hypot(s.x - rawX, s.z - rawZ);
    if (pushed < 0.05) return pose;
    if (!best || pushed < best._pushed) best = { ...pose, _pushed: pushed };
  }
  if (best) {
    delete best._pushed;
    return best;
  }
  return null;
}

function streetEnds(scene) {
  const street = (scene.userData && scene.userData.street) || { length: 44, roadCenterZ: -1.15 };
  const pad = 1.5;
  const half = (street.length || 44) / 2;
  const z = street.roadCenterZ !== undefined ? street.roadCenterZ : -1.15;
  return {
    west: { x: -half + pad, z, yaw: -Math.PI / 2 },
    east: { x: half - pad, z, yaw: Math.PI / 2 }
  };
}

function approachCar(scene, world, radius, eyeY) {
  const car = scene.userData && scene.userData.prop;
  const worldCol = world;
  const box = (worldCol && worldCol.colliders || []).find((c) => c.id === 'parked-car' && (c.type === 'aabb' || c.type === 'obb'));
  const size = (car && car.userData && car.userData.size) || { width: 4, depth: 1.85 };
  const cx = (car && car.position && car.position.x) || 6.8;
  const cz = (car && car.position && car.position.z) || -0.2;
  const minX = box ? box.minX : cx - size.width / 2;
  const maxX = box ? box.maxX : cx + size.width / 2;
  const minZ = box ? box.minZ : cz - size.depth / 2;
  const maxZ = box ? box.maxZ : cz + size.depth / 2;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const pad = radius + 0.7;
  const candidates = [
    { x: midX, z: minZ - pad, lookX: midX, lookZ: midZ }, // south, look at the car
    { x: minX - pad, z: midZ, lookX: midX, lookZ: midZ },
    { x: maxX + pad, z: midZ, lookX: midX, lookZ: midZ },
    { x: midX, z: maxZ + pad, lookX: midX, lookZ: midZ }
  ];
  for (const c of candidates) {
    const s = settle(world, c.x, c.z, radius);
    if (!isClear(world, s.x, s.z, radius)) continue;
    return { x: s.x, y: eyeY, z: s.z, yaw: yawToward(c.lookX - s.x, c.lookZ - s.z) };
  }
  return null;
}

function eyeHeight(scene) {
  const spawn = (scene.userData && scene.userData.spawn) || DEFAULT_SPAWN;
  return spawn.y !== undefined ? spawn.y : DEFAULT_SPAWN.y;
}

/**
 * Resolve one preset against the live scene. Returns { id, label, x, y, z, yaw }
 * or null if the target is missing.
 */
export function resolveTeleport(preset, scene, world, radius = 0.32) {
  if (typeof preset === 'string') {
    preset = TELEPORT_PRESETS.find((p) => p.id === preset);
  }
  if (!preset) return null;
  const y = eyeHeight(scene);
  const spawn = (scene.userData && scene.userData.spawn) || DEFAULT_SPAWN;

  if (preset.kind === 'spawn') {
    const s = settle(world, spawn.x, spawn.z, radius);
    return { id: preset.id, label: preset.label, x: s.x, y, z: s.z, yaw: 0 };
  }

  if (preset.kind === 'door') {
    const door = findDoor(scene, preset.doorId);
    if (!door) return null;
    const pose = approachDoor(door, world, radius, y);
    if (!pose) return null;
    return { id: preset.id, label: preset.label, x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, door: pose.door, distance: pose.distance };
  }

  if (preset.kind === 'street-end') {
    const ends = streetEnds(scene);
    const end = ends[preset.side];
    if (!end) return null;
    const s = settle(world, end.x, end.z, radius);
    if (!isClear(world, s.x, s.z, radius)) return null;
    return { id: preset.id, label: preset.label, x: s.x, y, z: s.z, yaw: end.yaw };
  }

  if (preset.kind === 'point') {
    const s = settle(world, preset.x, preset.z, radius);
    return { id: preset.id, label: preset.label, x: s.x, y, z: s.z, yaw: preset.yaw || 0 };
  }

  if (preset.kind === 'interior') {
    const spot = scene.userData && scene.userData.interior && scene.userData.interior.spawn;
    if (!spot) return null; // the Kenney model (and its interior) has not loaded
    if (!isClear(world, spot.x, spot.z, radius)) return null;
    return { id: preset.id, label: preset.label, x: spot.x, y, z: spot.z, yaw: spot.yaw || 0 };
  }

  if (preset.kind === 'car') {
    const pose = approachCar(scene, world, radius, y);
    if (!pose) return null;
    return { id: preset.id, label: preset.label, x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw };
  }

  return null;
}

export function resolveAllTeleports(scene, world, radius = 0.32) {
  return TELEPORT_PRESETS.map((p) => resolveTeleport(p, scene, world, radius));
}
