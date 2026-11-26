import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AO, SURFACE } from './palette.js';
import { bevelBox } from './shapes.js';
import { ROUGH_ATTR } from './surfaces.js';

/**
 * Baked vertex ambient occlusion for a box in its own (untransformed) space:
 * the foot of each side face darkens and the underside is darker still, so
 * walls and furniture sit on the ground instead of floating. Tops are left
 * alone. Pure per-vertex colour: no lights, no textures, no draw calls.
 */
function boxAo(g, sy) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const n = pos.count;
  const out = new Float32Array(n);
  const span = Math.max(1e-4, Math.min(AO.height, sy));
  for (let i = 0; i < n; i++) {
    const ny = nor.getY(i);
    if (ny > 0.5) { out[i] = 1; continue; }
    if (ny < -0.5) { out[i] = 1 - AO.bottom; continue; }
    const t = Math.min(1, Math.max(0, (pos.getY(i) + sy / 2) / span));
    const s = t * t * (3 - 2 * t);
    out[i] = 1 - AO.side * (1 - s);
  }
  return out;
}

/** Collects transformed geometry pieces and merges them into one BufferGeometry. */
export class Parts {
  /**
   * `colored` writes per-vertex colour (and roughness) for a vertex-coloured
   * material. `ao` bakes the box ambient occlusion (default on for coloured
   * parts; turn it off for unlit / emissive parts).
   */
  constructor(colored, { ao = colored } = {}) {
    this.colored = colored;
    this.ao = !!(colored && ao);
    this.rough = SURFACE.plaster.roughness;
    /** Largest bevel for boxes added next (metres); null = the BEVEL.max default. */
    this.bevelMax = null;
    /** Rounding segments for boxes added next: 1 is a chamfer ring, 2 is rounder (3x the triangles). */
    this.bevelSegments = 1;
    this._boxes = new Map();
    this.list = [];
    this.frame = new THREE.Matrix4();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  setFrame(x = 0, y = 0, z = 0, ry = 0) {
    this.frame.makeRotationY(ry).setPosition(x, y, z);
  }

  resetFrame() {
    this.frame.identity();
  }

  /** Sets the roughness of everything added next: a SURFACE preset name or a number. */
  surface(kind) {
    this.rough = typeof kind === 'number' ? kind : (SURFACE[kind] || SURFACE.plaster).roughness;
  }

  addGeometry(geo, color, local, aoSy = null) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    // AO is read off the box's own normals and height, so it runs before the transform.
    const ao = this.ao && aoSy !== null ? boxAo(g, aoSy) : null;
    g.applyMatrix4(this._m.multiplyMatrices(this.frame, local));
    if (this.colored) {
      const c = new THREE.Color(color);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      const rough = new Float32Array(n).fill(this.rough);
      for (let i = 0; i < n; i++) {
        const f = ao ? ao[i] : 1;
        arr[i * 3] = c.r * f;
        arr[i * 3 + 1] = c.g * f;
        arr[i * 3 + 2] = c.b * f;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.setAttribute(ROUGH_ATTR, new THREE.BufferAttribute(rough, 1));
    }
    this.list.push(g);
  }

  /**
   * Adds a w x h x d box with absolute-radius rounded edges (see shapes.js).
   * The geometry is built at its real size, so the bevel stays the same on a
   * 9 m wall as on a 3 cm trim strip. Identical sizes are built once.
   */
  box(color, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
    this._p.set(x, y, z);
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._s.set(1, 1, 1);
    const local = new THREE.Matrix4().compose(this._p, this._q, this._s);
    const key = `${Math.round(sx * 1e4)}|${Math.round(sy * 1e4)}|${Math.round(sz * 1e4)}|${this.bevelMax ?? ''}|${this.bevelSegments}`;
    let geo = this._boxes.get(key);
    if (!geo) {
      geo = bevelBox(sx, sy, sz, { max: this.bevelMax ?? undefined, segments: this.bevelSegments });
      this._boxes.set(key, geo);
    }
    this.addGeometry(geo, color, local, sy);
  }

  /**
   * A cylinder (or cone) of the given radii and height, centred on x, y, z and
   * rotated by rx, ry, rz. Unlit by baked AO: it is for knobs, hubs and rods.
   */
  cylinder(color, rTop, rBottom, height, x, y, z, rx = 0, ry = 0, rz = 0, segments = 8) {
    this._p.set(x, y, z);
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._s.set(1, 1, 1);
    const local = new THREE.Matrix4().compose(this._p, this._q, this._s);
    const geo = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
    this.addGeometry(geo, color, local);
    geo.dispose();
  }

  /**
   * A flat polygon (a fan) with one colour per vertex, in the current frame.
   * `points` are [x, y, z] in counter-clockwise order seen from the front
   * (the side the normal faces); `colors` are 0xRRGGBB, one per point. Used
   * for glass: a vertical tint gradient and a reflection streak in 2-4 triangles.
   */
  poly(points, colors) {
    const n = points.length;
    const pos = [];
    const col = [];
    const tmp = new THREE.Color();
    const tri = (a, b, c) => {
      for (const k of [a, b, c]) {
        pos.push(points[k][0], points[k][1], points[k][2]);
        tmp.set(colors[k]);
        col.push(tmp.r, tmp.g, tmp.b);
      }
    };
    for (let i = 1; i < n - 1; i++) tri(0, i, i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.applyMatrix4(this.frame);
    if (this.colored) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute(ROUGH_ATTR, new THREE.BufferAttribute(new Float32Array(pos.length / 3).fill(this.rough), 1));
    }
    this.list.push(g);
  }

  geometry(geo, color, x = 0, y = 0, z = 0) {
    this.addGeometry(geo, color, new THREE.Matrix4().makeTranslation(x, y, z));
  }

  merge() {
    this._boxes.forEach((g) => g.dispose());
    this._boxes.clear();
    if (this.list.length === 0) return null;
    const merged = mergeGeometries(this.list, false);
    this.list.forEach((g) => g.dispose());
    this.list.length = 0;
    return merged;
  }
}
