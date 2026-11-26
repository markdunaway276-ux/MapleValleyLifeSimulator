import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BEVEL } from './palette.js';

/**
 * Bevel radius for a w x h x d box: a fraction of its thinnest side, capped
 * at BEVEL.max. Absolute, so a 3 m wall and a 3 cm trim strip both get a
 * crisp edge of the right size (the old unit-cube scaling made walls bulge
 * and trim flat).
 */
export function bevelRadius(w, h, d, max = BEVEL.max) {
  const thin = Math.min(Math.abs(w), Math.abs(h), Math.abs(d));
  return Math.min(max, thin * BEVEL.fraction);
}

/**
 * A box with softly rounded edges and corners, centred on the origin.
 * Falls back to a plain BoxGeometry when the bevel would be invisible.
 * `segments` 1 is a single chamfer ring with smooth normals (108 triangles);
 * 2 gives rounder corners for the bigger hero props (300 triangles).
 */
export function bevelBox(w, h, d, { radius, max, segments = 1 } = {}) {
  const r = radius !== undefined ? radius : bevelRadius(w, h, d, max);
  const thin = Math.min(Math.abs(w), Math.abs(h), Math.abs(d));
  if (!(r >= BEVEL.min) || !(thin > 2 * BEVEL.min)) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, thin / 2 - 1e-4));
}
