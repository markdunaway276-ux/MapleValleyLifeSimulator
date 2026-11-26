import * as THREE from 'three';
import { Parts } from './parts.js';
import { DETAIL, HOUSE, MAIN_HOUSE, mixHex, shade } from './palette.js';
import { createVertexMaterial } from './surfaces.js';

/**
 * Fine detail for doors and windows, built from the same merged-parts
 * pipeline as the rest of the world: everything here ends up inside an
 * existing mesh (the hinged door panel, the house's glass mesh), so none of
 * it costs a draw call.
 */

/** The door's glass colour: the house glass tint pulled towards a dark interior. */
export function doorGlassColor(tint = HOUSE.glass) {
  return mixHex(tint, DETAIL.glassInterior, 0.6);
}

/**
 * A detailed door slab in hinge-origin space (x from 0 at the hinge to
 * `width`, y from 0 to `height`, centred on z = 0, +z faces the street):
 * a rounded slab, raised shaker panels (or a tinted three-light window up
 * top when `glazed`), brass lever sets with a thumb-turn on both faces, three
 * hinges, and a kick plate on the street face. Every vertex carries its own
 * colour and roughness, so one vertex-coloured material draws all of it.
 */
export function buildDoorGeometry({ width, height, depth, color, glazed = false, kick = true, tint = HOUSE.glass }) {
  const p = new Parts(true);
  p.bevelMax = 0.012;
  const W = width;
  const H = height;
  const half = depth / 2;
  const inset = Math.min(0.14, W * 0.15);
  const pw = W - inset * 2;
  const cx = W / 2;
  const lowerY0 = H * 0.08;
  const lowerY1 = H * 0.4;
  const upperY0 = H * 0.55;
  const upperY1 = H * 0.92;
  const panel = shade(color, 1.1);
  const edge = shade(color, 0.78);

  p.surface('wood');
  p.box(color, W, H, depth, cx, H / 2, 0);
  // Everything else on the door is a thin detail: plain 12-triangle boxes,
  // since a bevel under a centimetre or two is invisible.
  p.bevelMax = 0;

  for (const s of [1, -1]) {
    // Lower panel (always) and upper panel or glazing.
    p.surface('wood');
    p.box(panel, pw, lowerY1 - lowerY0, 0.014, cx, (lowerY0 + lowerY1) / 2, s * (half + 0.005));
    const uh = upperY1 - upperY0;
    const uy = (upperY0 + upperY1) / 2;
    if (glazed) {
      p.surface('trim');
      p.box(edge, pw, uh, 0.022, cx, uy, s * (half + 0.007));
      p.surface('glass');
      p.box(doorGlassColor(tint), pw - 0.1, uh - 0.1, 0.014, cx, uy, s * (half + 0.0145));
      p.surface('trim');
      p.box(edge, 0.022, uh - 0.1, 0.02, cx, uy, s * (half + 0.019));
      p.box(edge, pw - 0.1, 0.022, 0.02, cx, uy + (uh - 0.1) * 0.18, s * (half + 0.019));
      p.box(edge, pw - 0.1, 0.022, 0.02, cx, uy - (uh - 0.1) * 0.18, s * (half + 0.019));
    } else {
      p.surface('wood');
      p.box(panel, pw, uh, 0.014, cx, uy, s * (half + 0.005));
    }

    // Lever set: back plate, stem, lever and a thumb-turn above it.
    const hx = W - 0.1;
    const hy = H * 0.475;
    p.surface('metal');
    p.box(DETAIL.brass, 0.05, 0.2, 0.01, hx, hy, s * (half + 0.005));
    p.box(DETAIL.brass, 0.026, 0.026, 0.022, hx, hy, s * (half + 0.019));
    p.box(DETAIL.brass, 0.12, 0.02, 0.018, hx - 0.045, hy, s * (half + 0.031));
    p.box(DETAIL.brass, 0.04, 0.05, 0.01, hx, hy + 0.14, s * (half + 0.005));
    p.box(DETAIL.brass, 0.014, 0.034, 0.018, hx, hy + 0.14, s * (half + 0.017));

    // Hinges: three dark knuckles on the hinge edge.
    p.surface('metal');
    for (const hyy of [0.28, H / 2, H - 0.28]) {
      p.box(DETAIL.iron, 0.024, 0.1, 0.022, 0.012, hyy, s * half);
    }
  }

  if (kick) {
    p.surface('metal');
    p.box(DETAIL.brass, pw * 0.92, 0.13, 0.008, cx, 0.085, half + 0.004);
  }
  const geo = p.merge();
  return geo;
}

/**
 * A window's glass into a vertex-coloured Parts (the house's glass mesh):
 * the pane sits in the current frame, facing +z, `z` in front of the wall
 * plane. A lighter top and a darker interior band across the lower third
 * fake a sky reflection and a dim room behind, and a pale diagonal streak
 * crosses wider panes. 4-6 triangles per window, all per-vertex colour.
 */
export function addGlassPane(glass, w, h, tint = HOUSE.glass, { z = 0.036, streak = true } = {}) {
  const top = shade(tint, DETAIL.glassTop);
  const mid = shade(tint, 0.82);
  const bottom = mixHex(shade(tint, DETAIL.glassBottom), DETAIL.glassInterior, 0.55);
  const y1 = -h / 2 + h * 0.3;
  const hw = w / 2;
  const hh = h / 2;
  glass.surface('glass');
  glass.poly([[-hw, y1, z], [hw, y1, z], [hw, hh, z], [-hw, hh, z]], [mid, mid, top, top]);
  glass.poly([[-hw, -hh, z], [hw, -hh, z], [hw, y1, z], [-hw, y1, z]], [bottom, bottom, mid, mid]);
  if (streak && w > 0.5) {
    const lo = mixHex(bottom, 0xffffff, DETAIL.glassStreak * 0.5);
    const hi = mixHex(top, 0xffffff, DETAIL.glassStreak);
    const zz = z + 0.002;
    glass.poly(
      [[-0.3 * w, -hh, zz], [-0.2 * w, -hh, zz], [0.12 * w, hh, zz], [0.02 * w, hh, zz]],
      [lo, lo, hi, hi]
    );
  }
}

// ------------------------------------------------------------ main house ----

/**
 * Finds every flat glass pane (one connected quad) of the GLB's meshes that
 * use the named material, in world space. Only triangles still referenced by
 * the index count, so panes cut out earlier (the painted front door's window)
 * are skipped. Returns { mesh, triangles[], axis: 'x' | 'z', sign, min, max }.
 */
export function findGlassPanes(root, materialName = 'window') {
  root.updateMatrixWorld(true);
  const panes = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => m && m.name === materialName)) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const triCount = (idx ? idx.count : pos.count) / 3;
    const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
    // Union triangles that share a vertex position (quantised to 2 mm).
    const parent = Array.from({ length: triCount }, (_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const seen = new Map();
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        a.fromBufferAttribute(pos, vi(t, k)).applyMatrix4(o.matrixWorld);
        const key = `${Math.round(a.x * 500)}|${Math.round(a.y * 500)}|${Math.round(a.z * 500)}`;
        const other = seen.get(key);
        if (other === undefined) seen.set(key, t);
        else parent[find(t)] = find(other);
      }
    }
    const groups = new Map();
    for (let t = 0; t < triCount; t++) {
      const r = find(t);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(t);
    }
    for (const tris of groups.values()) {
      const box = new THREE.Box3();
      const n = new THREE.Vector3();
      for (const t of tris) {
        a.fromBufferAttribute(pos, vi(t, 0)).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(pos, vi(t, 1)).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(pos, vi(t, 2)).applyMatrix4(o.matrixWorld);
        box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        n.add(new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)));
      }
      n.normalize();
      const axis = Math.abs(n.x) > 0.9 ? 'x' : Math.abs(n.z) > 0.9 ? 'z' : null;
      if (!axis) continue;
      panes.push({ mesh: o, triangles: tris, axis, sign: Math.sign(n[axis]), min: box.min.clone(), max: box.max.clone() });
    }
  });
  return panes;
}

/**
 * Tints each pane's vertices with a vertical gradient (a bright sky-facing top
 * to a dim room at the bottom) and turns on vertex colours for the glass
 * material. The material colour still multiplies it, so the palette stays in
 * MAIN_HOUSE.window. No new materials, no new draw calls.
 */
export function tintGlassPanes(panes) {
  const done = new Set();
  const col = new THREE.Color();
  const top = new THREE.Color(1, 1, 1);
  const mid = new THREE.Color(0.78, 0.8, 0.82);
  const low = new THREE.Color(0.3, 0.36, 0.42);
  const a = new THREE.Vector3();
  for (const pane of panes) {
    const geo = pane.mesh.geometry;
    const pos = geo.attributes.position;
    let attr = geo.attributes.color;
    if (!attr || attr.itemSize !== 3) {
      attr = new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3);
      geo.setAttribute('color', attr);
    }
    const idx = geo.index;
    const h = Math.max(1e-4, pane.max.y - pane.min.y);
    for (const t of pane.triangles) {
      for (let k = 0; k < 3; k++) {
        const v = idx ? idx.getX(t * 3 + k) : t * 3 + k;
        a.fromBufferAttribute(pos, v).applyMatrix4(pane.mesh.matrixWorld);
        const u = Math.min(1, Math.max(0, (a.y - pane.min.y) / h));
        if (u < 0.3) col.copy(low).lerp(mid, u / 0.3);
        else col.copy(mid).lerp(top, (u - 0.3) / 0.7);
        attr.setXYZ(v, col.r, col.g, col.b);
      }
    }
    attr.needsUpdate = true;
    const mats = Array.isArray(pane.mesh.material) ? pane.mesh.material : [pane.mesh.material];
    for (const m of mats) {
      if (m && !done.has(m) && m.name === 'window') {
        m.vertexColors = true;
        m.needsUpdate = true;
        done.add(m);
      }
    }
  }
}

/**
 * Detail for the Kenney main house, built into ONE merged mesh in world
 * space: muntins (a cross, or two verticals on wide panes) and a thin sash
 * ring over every glass pane, plus a worn threshold and a brass house number
 * at the front door. The GLB already has the outer frames, so these sit
 * inside the recess. Returns the mesh (null if there is nothing to add).
 *   door: { x, z, width, surroundX, surroundZ } world position of the hinged
 *         door's centre line and the plane of the door surround.
 */
export function buildMainHouseDetails(model, { door = null, panes = null, shadows = false } = {}) {
  const found = panes || findGlassPanes(model);
  const trim = shade(MAIN_HOUSE.border.color, 0.92);
  const sash = shade(MAIN_HOUSE.border.color, 0.78);
  const p = new Parts(true);
  p.bevelMax = 0; // sash lines and muntins are thin: plain boxes (12 triangles each)
  p.surface('trim');
  let count = 0;
  for (const pane of found) {
    const w = pane.axis === 'z' ? pane.max.x - pane.min.x : pane.max.z - pane.min.z;
    const h = pane.max.y - pane.min.y;
    if (w < 0.12 || h < 0.12) continue;
    const ry = pane.axis === 'z' ? (pane.sign > 0 ? 0 : Math.PI) : (pane.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
    p.setFrame((pane.min.x + pane.max.x) / 2, (pane.min.y + pane.max.y) / 2, (pane.min.z + pane.max.z) / 2, ry);
    const z = 0.014;
    // Sash ring.
    p.box(sash, w, 0.035, 0.03, 0, h / 2 - 0.0175, z);
    p.box(sash, w, 0.035, 0.03, 0, -h / 2 + 0.0175, z);
    p.box(sash, 0.035, h - 0.07, 0.03, -w / 2 + 0.0175, 0, z);
    p.box(sash, 0.035, h - 0.07, 0.03, w / 2 - 0.0175, 0, z);
    // Muntins.
    if (w > 0.45) {
      const nV = w > 1.2 ? 2 : 1;
      for (let i = 1; i <= nV; i++) p.box(trim, 0.03, h - 0.07, 0.034, -w / 2 + (w * i) / (nV + 1), 0, z + 0.002);
      p.box(trim, w - 0.07, 0.03, 0.034, 0, 0, z + 0.002);
    }
    count++;
  }
  p.resetFrame();
  if (door) {
    p.surface('stone');
    p.box(shade(MAIN_HOUSE.border.color, 0.7), door.width + 0.2, 0.05, 0.26, door.x, 0.025, door.z + 0.1);
    p.surface('metal');
    const px = door.x + door.width / 2 + 0.28;
    const pz = door.surroundZ;
    p.box(DETAIL.brass, 0.16, 0.1, 0.014, px, 1.5, pz + 0.007);
    p.box(DETAIL.iron, 0.13, 0.07, 0.018, px, 1.5, pz + 0.009);
    p.box(DETAIL.brass, 0.02, 0.048, 0.022, px - 0.03, 1.5, pz + 0.011);
    p.box(DETAIL.brass, 0.02, 0.048, 0.022, px + 0.03, 1.5, pz + 0.011);
    count++;
  }
  const geo = p.merge();
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, createVertexMaterial({ metalness: 0.03 }));
  mesh.name = 'main-house-details';
  mesh.castShadow = !!shadows;
  mesh.receiveShadow = !!shadows;
  mesh.userData.details = count;
  return mesh;
}
