import * as THREE from 'three';
import { doorInteractPoint } from './doors.js';
import { INTERACT_RANGE } from '../ui/interactPrompt.js';

/**
 * Optional interactable highlighter. When enabled, every door (and any extra
 * entries in scene.userData.interactables) gets a glowing outline on the mesh
 * plus a flat ground ring of radius INTERACT_RANGE around its interact point.
 * The ring brightens when the player is in range. Built lazily, disposed when
 * off, and it never mutates shared materials (overlay meshes only).
 */

const RING_INNER = INTERACT_RANGE - 0.08;
const RING_OUTER = INTERACT_RANGE;
const RING_Y = 0.06;
const IDLE = new THREE.Color(0xffc94a);
const ACTIVE = new THREE.Color(0x7dff9a);
const GLOW_NAME = 'debug-highlight-glow';
const OUTLINE_NAME = 'debug-highlight-outline';

export { INTERACT_RANGE };

export function collectInteractables(scene) {
  const out = [];
  const seen = new Set();

  function add(item) {
    if (!item || !item.object || seen.has(item.object)) return;
    seen.add(item.object);
    out.push(item);
  }

  const doors = (scene && scene.userData && scene.userData.doors) || [];
  for (const d of doors) {
    add({
      kind: 'door',
      object: d,
      id: (d.userData && d.userData.doorId) || 'door',
      range: INTERACT_RANGE
    });
  }

  const extra = (scene && scene.userData && scene.userData.interactables) || [];
  for (const raw of extra) {
    const object = raw && (raw.object || raw);
    add({
      kind: (raw && raw.kind) || 'object',
      object,
      id: (raw && raw.id) || (object.userData && (object.userData.doorId || object.userData.id)) || 'item',
      range: (raw && raw.range) || INTERACT_RANGE,
      getPoint: raw && raw.getPoint
    });
  }
  return out;
}

export function interactablePoint(item, target = new THREE.Vector3()) {
  if (!item || !item.object) return target.set(0, 0, 0);
  if (typeof item.getPoint === 'function') {
    const p = item.getPoint();
    return target.set(p.x, p.y || 0, p.z);
  }
  if (item.object.userData && item.object.userData.interactLocal) {
    return doorInteractPoint(item.object, target);
  }
  if (typeof item.object.getWorldPosition === 'function') {
    return item.object.getWorldPosition(target);
  }
  const p = item.object.position;
  return target.set(p.x || 0, p.y || 0, p.z || 0);
}

function itemSignature(item, p) {
  interactablePoint(item, p);
  return `${item.id}|${p.x.toFixed(3)}|${p.z.toFixed(3)}|${item.range || INTERACT_RANGE}`;
}

export function interactablesSignature(list) {
  const p = new THREE.Vector3();
  return list.map((item) => itemSignature(item, p)).join(';');
}

function findHostMesh(object) {
  if (!object) return null;
  if (typeof object.getObjectByName === 'function') {
    const panel = object.getObjectByName('door-panel');
    if (panel && panel.isMesh) return panel;
  }
  if (object.isMesh) return object;
  if (object.children) {
    for (const c of object.children) {
      if (c.isMesh) return c;
    }
  }
  return null;
}

function makeGlow(mesh) {
  const mat = new THREE.MeshBasicMaterial({
    color: IDLE,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const glow = new THREE.Mesh(mesh.geometry, mat);
  glow.name = GLOW_NAME;
  glow.renderOrder = 20;
  glow.frustumCulled = false;
  glow.userData.debugHighlight = true;
  return glow;
}

function makeOutline(mesh) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const mat = new THREE.LineBasicMaterial({
    color: IDLE,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  const line = new THREE.LineSegments(edges, mat);
  line.name = OUTLINE_NAME;
  line.renderOrder = 21;
  line.frustumCulled = false;
  line.userData.debugHighlight = true;
  return line;
}

function makeRing(range) {
  const inner = Math.max(0.05, (range || INTERACT_RANGE) - 0.08);
  const outer = range || INTERACT_RANGE;
  const geo = new THREE.RingGeometry(inner, outer, 64);
  const mat = new THREE.MeshBasicMaterial({
    color: IDLE,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.name = 'debug-highlight-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = RING_Y;
  ring.renderOrder = 18;
  ring.frustumCulled = false;
  ring.userData.debugHighlight = true;
  return ring;
}

function setTint(entry, active) {
  const color = active ? ACTIVE : IDLE;
  const glowOp = active ? 0.55 : 0.32;
  const ringOp = active ? 0.95 : 0.55;
  if (entry.glow) {
    entry.glow.material.color.copy(color);
    entry.glow.material.opacity = glowOp;
  }
  if (entry.outline) {
    entry.outline.material.color.copy(color);
    entry.outline.material.opacity = active ? 1 : 0.95;
  }
  if (entry.ring) {
    entry.ring.material.color.copy(color);
    entry.ring.material.opacity = ringOp;
  }
  entry.active = active;
}

function disposeObj(obj) {
  if (!obj) return;
  if (obj.parent) obj.parent.remove(obj);
  if (obj.geometry && obj.geometry.type === 'EdgesGeometry') obj.geometry.dispose();
  else if (obj.geometry && obj.name === 'debug-highlight-ring') obj.geometry.dispose();
  if (obj.material) obj.material.dispose();
}

export function createInteractableHighlight({ scene, getPlayer } = {}) {
  let group = null;
  let entries = [];
  let signature = '';

  function disable() {
    for (const e of entries) {
      disposeObj(e.glow);
      disposeObj(e.outline);
      disposeObj(e.ring);
    }
    entries = [];
    signature = '';
    if (group) {
      scene.remove(group);
      group = null;
    }
  }

  function build() {
    if (!group) {
      group = new THREE.Group();
      group.name = 'interactable-highlight';
      group.userData.debug = true;
      scene.add(group);
    }
    for (const e of entries) {
      disposeObj(e.glow);
      disposeObj(e.outline);
      disposeObj(e.ring);
    }
    entries = [];
    const list = collectInteractables(scene);
    const p = new THREE.Vector3();
    for (const item of list) {
      const entry = { item, glow: null, outline: null, ring: null, active: false };
      const host = findHostMesh(item.object);
      if (host) {
        entry.glow = makeGlow(host);
        entry.outline = makeOutline(host);
        host.add(entry.glow);
        host.add(entry.outline);
      }
      entry.ring = makeRing(item.range || INTERACT_RANGE);
      interactablePoint(item, p);
      entry.ring.position.set(p.x, RING_Y, p.z);
      group.add(entry.ring);
      entries.push(entry);
    }
    signature = interactablesSignature(list);
    group.userData.count = entries.length;
  }

  function enable() {
    if (group) return;
    build();
  }

  function sync() {
    if (!group) return false;
    const list = collectInteractables(scene);
    if (interactablesSignature(list) === signature) return false;
    build();
    return true;
  }

  function update(position) {
    if (!group) return;
    const p = new THREE.Vector3();
    for (const e of entries) {
      const pt = interactablePoint(e.item, p);
      const range = e.item.range || INTERACT_RANGE;
      const active = !!(position && position.distanceTo(pt) < range);
      if (active !== e.active) setTint(e, active);
    }
  }

  return {
    enable,
    disable,
    sync,
    update,
    isEnabled: () => !!group,
    count: () => entries.length,
    get entries() { return entries; },
    get group() { return group; }
  };
}
