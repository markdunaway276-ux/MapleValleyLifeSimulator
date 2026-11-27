import * as THREE from 'three';
import { CONTACT } from './palette.js';

/**
 * Cheap fake ambient occlusion: soft dark blobs lying on the ground under
 * trees, houses, the car, props and NPCs. The sun shadow only darkens the
 * side away from the sun; these darken the foot of everything, in every
 * light, and they work on mobile (where there is no shadow map at all).
 *
 * Cost: every static blob is merged into ONE mesh (one draw call, a few
 * dozen triangles, no light, no shadow caster). Each moving NPC adds one tiny
 * mesh of its own. They all share one 64 px alpha texture and one material.
 */

let sharedMat = null;

function createBlobTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      const a = Math.pow(Math.max(0, 1 - r), 1.7);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // The green channel is the alpha (alphaMap); it is data, not a colour.
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** The one material every blob uses. Vertex colour = tint, vertex alpha = strength. */
export function contactMaterial() {
  if (!sharedMat) {
    sharedMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      alphaMap: createBlobTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    sharedMat.name = 'contact-shadow';
  }
  return sharedMat;
}

/** Forget the shared material (tests; a new renderer). */
export function resetContactMaterial() {
  if (sharedMat) {
    if (sharedMat.alphaMap) sharedMat.alphaMap.dispose();
    sharedMat.dispose();
  }
  sharedMat = null;
}

/** Peak strength multiplier for a quality tier. */
export function contactStrength(quality = {}) {
  return quality && quality.shadows ? CONTACT.desktop : CONTACT.mobile;
}

/**
 * Builds one BufferGeometry from a list of items:
 *   { kind: 'blob', x, z, y, rx, rz, rot?, strength? }       an ellipse of radii rx, rz
 *   { kind: 'rect', x, z, y, w, d, margin, rot?, strength? } a rounded soft-edged footprint:
 *                                                            w x d solid, fading over `margin`
 * `y` is the ground height there; the blob floats CONTACT.lift above it.
 * Rects are a 3 x 3 grid (the middle is solid, the margins carry the falloff),
 * so a long house footprint keeps a crisp, even edge instead of a stretched blob.
 */
export function buildContactGeometry(items, scale = 1) {
  const pos = [];
  const uv = [];
  const col = [];
  const t = new THREE.Color(CONTACT.tint);
  const idx = [];

  const pushQuad = (cx, cy, cz, c, s, corners, uvs, alpha) => {
    const base = pos.length / 3;
    for (let k = 0; k < 4; k++) {
      const [lx, lz] = corners[k];
      pos.push(cx + lx * c + lz * s, cy, cz - lx * s + lz * c);
      uv.push(uvs[k][0], uvs[k][1]);
      col.push(t.r, t.g, t.b, alpha);
    }
    // counter-clockwise seen from above (+y normal)
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };

  for (const it of items) {
    const rot = it.rot || 0;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const alpha = Math.min(1, (it.strength ?? 1) * scale);
    const y = (it.y || 0) + CONTACT.lift;
    if (it.kind === 'rect') {
      const hw = it.w / 2;
      const hd = it.d / 2;
      const m = it.margin;
      const xs = [-hw - m, -hw, hw, hw + m];
      const zs = [-hd - m, -hd, hd, hd + m];
      const us = [0, 0.5, 0.5, 1];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          pushQuad(it.x, y, it.z, c, s,
            [[xs[i], zs[j]], [xs[i + 1], zs[j]], [xs[i + 1], zs[j + 1]], [xs[i], zs[j + 1]]],
            [[us[i], us[j]], [us[i + 1], us[j]], [us[i + 1], us[j + 1]], [us[i], us[j + 1]]],
            alpha);
        }
      }
    } else {
      pushQuad(it.x, y, it.z, c, s,
        [[-it.rx, -it.rz], [it.rx, -it.rz], [it.rx, it.rz], [-it.rx, it.rz]],
        [[0, 0], [1, 0], [1, 1], [0, 1]], alpha);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function finish(mesh) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  return mesh;
}

/** All the static blobs as one mesh (one draw call). Positions are world space. */
export function createContactShadows(items, quality = {}) {
  const geo = buildContactGeometry(items, contactStrength(quality));
  const mesh = finish(new THREE.Mesh(geo, contactMaterial()));
  mesh.name = 'contact-shadows';
  mesh.userData.count = items.length;
  mesh.userData.triangles = geo.index.count / 3;
  return mesh;
}

/** One blob or soft-edged rect as its own mesh (a child of a moving thing, e.g. an NPC or car). */
export function createContactBlob({ kind = 'blob', rx = 0.4, rz = 0.4, w = 0, d = 0, margin = 0, y = 0, strength = 1 } = {}, quality = {}) {
  const item = kind === 'rect'
    ? { kind: 'rect', x: 0, z: 0, y, w, d, margin, strength }
    : { kind: 'blob', x: 0, z: 0, y, rx, rz, strength };
  const geo = buildContactGeometry([item], contactStrength(quality));
  const mesh = finish(new THREE.Mesh(geo, contactMaterial()));
  mesh.name = 'contact-blob';
  return mesh;
}
