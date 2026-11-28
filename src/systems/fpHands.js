import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Realistic first-person hands (fp-hands.glb, CC BY 4.0 DavidFischer, re-textured
 * for Maple Lane). The file holds both arms on one skeleton; each side keeps only
 * its hand plus a short wrist stub that tucks into the game's sleeve.
 *
 * makeHand(side) returns { object, setPose(pose), wristZ } where `object` sits in
 * the same frame as the old procedural hand: palm at the origin, fingers toward
 * -z, back of the hand +y, wrist toward +z.
 *
 * Finger poses are curls 0 (straight) .. 1 (fist) per finger, plus `spread`.
 * The bend axis of every finger bone is found by testing, so it works for both
 * hands without hand-tuned signs.
 */

export const HANDS_URL = './assets/characters/fp-hands.glb';

/** Wrist joint position in the arm frame (just in front of where the sleeve starts). */
export const HAND_WRIST = new THREE.Vector3(0, -0.004, 0.084);
/** Wrist to middle fingertip, metres (matches the old hand's size). */
const HAND_LENGTH = 0.178;
/** How much of the forearm skin to keep past the wrist, as a share of hand length. */
const STUB = 0.15;

const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];
// Bend split over the three joints of each finger (thumb: base, middle, tip).
const SEGMENT_BEND = { finger: [1.05, 1.35, 0.85], thumb: [0.45, 0.7, 0.75] };

// Hand presets: curls for index, middle, ring, pinky, thumb; spread -1..1.
export const HAND_POSES = Object.freeze({
  relaxed: { index: 0.16, middle: 0.2, ring: 0.24, pinky: 0.28, thumb: 0.12, spread: 0.1 },
  open: { index: 0.02, middle: 0.02, ring: 0.03, pinky: 0.04, thumb: 0.0, spread: 0.55 },
  flat: { index: 0.05, middle: 0.05, ring: 0.06, pinky: 0.08, thumb: 0.05, spread: 0.05 },
  cupped: { index: 0.3, middle: 0.32, ring: 0.34, pinky: 0.36, thumb: 0.25, spread: 0.15 },
  hold: { index: 0.58, middle: 0.64, ring: 0.68, pinky: 0.72, thumb: 0.5, spread: 0 },
  grip: { index: 0.74, middle: 0.8, ring: 0.82, pinky: 0.84, thumb: 0.62, spread: -0.1 },
  fist: { index: 0.98, middle: 1, ring: 1, pinky: 1, thumb: 0.8, spread: -0.2 },
  point: { index: 0.04, middle: 0.92, ring: 0.95, pinky: 0.95, thumb: 0.62, spread: 0 },
  carryBox: { index: 0.22, middle: 0.24, ring: 0.26, pinky: 0.28, thumb: 0.05, spread: 0.25 }
});

export function blendHandPose(a, b, k) {
  const out = {};
  for (const f of [...FINGERS, 'spread']) out[f] = (a[f] ?? 0) + ((b[f] ?? 0) - (a[f] ?? 0)) * k;
  return out;
}

const plain = (name) => String(name || '').replace(/[^A-Za-z0-9_]/g, '');

function findBone(root, pattern) {
  let hit = null;
  root.traverse((o) => { if (!hit && o.isBone && pattern.test(plain(o.name))) hit = o; });
  return hit;
}

let template = null;
let loading = null;

/** Load the hands once; resolves with the GLTF scene (or rejects). */
export function loadFpHands(load) {
  if (template) return Promise.resolve(template);
  if (!loading) {
    loading = Promise.resolve(load(HANDS_URL)).then((gltf) => {
      template = gltf.scene || gltf;
      return template;
    });
  }
  return loading;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Build one side ('R' or 'L') from the loaded template. */
export function makeHand(side) {
  if (!template) return null;
  const S = side === 'L' ? 'L' : 'R';
  const root = cloneSkinned(template);
  root.updateMatrixWorld(true);

  const bone = (re) => findBone(root, re);
  const hand = bone(new RegExp(`^hand${S}_`));
  const forearm = bone(new RegExp(`^forearm${S}_`));
  if (!hand) return null;

  // --- keep only this hand (+ a short wrist stub) -------------------------
  const keep = new Set();
  hand.traverse((o) => { if (o.isBone) keep.add(o); });
  const handHead = hand.getWorldPosition(new THREE.Vector3());
  const midTipBone = bone(new RegExp(`^f_middle03${S}_end`)) || bone(new RegExp(`^f_middle03${S}_`));
  const midTip = midTipBone.getWorldPosition(new THREE.Vector3());
  const lengthModel = handHead.distanceTo(midTip);

  const meshes = [];
  root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const geo = mesh.geometry.clone();
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const bones = mesh.skeleton.bones;
    const keepVert = new Uint8Array(pos.count);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      let best = 0, bestW = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bestW) { bestW = w; best = si.getComponent(i, k); }
      }
      const b = bones[best];
      if (keep.has(b)) { keepVert[i] = 1; continue; }
      if (b === forearm) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
        if (v.distanceTo(handHead) <= lengthModel * STUB) keepVert[i] = 1;
      }
    }
    const index = geo.index;
    const kept = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
      if (keepVert[a] && keepVert[b] && keepVert[c]) kept.push(a, b, c);
    }
    geo.setIndex(kept);
    mesh.geometry = geo;
    mesh.visible = kept.length > 0;
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    if (mesh.material) {
      mesh.material = mesh.material.clone();
      // Nothing ever stands between the camera and your hands: keep them crisp.
      mesh.material.fog = false;
    }
  }

  // --- frame: palm at origin, fingers -z, back of hand +y -----------------
  const idx = bone(new RegExp(`^f_index01${S}_`)).getWorldPosition(new THREE.Vector3());
  const pinky = bone(new RegExp(`^f_pinky01${S}_`)).getWorldPosition(new THREE.Vector3());
  const fwd = _a.copy(midTip).sub(handHead).normalize();
  const across = _b.copy(idx).sub(pinky).normalize();
  const z = fwd.clone().negate();
  const x = S === 'R' ? across.clone().negate() : across.clone();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  x.crossVectors(y, z).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, y, z).setPosition(handHead);
  const scale = HAND_LENGTH / lengthModel;
  const holder = new THREE.Group();
  holder.name = 'fp-hand-model-' + S;
  holder.matrixAutoUpdate = false;
  holder.matrix
    .makeTranslation(HAND_WRIST.x, HAND_WRIST.y, HAND_WRIST.z)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(basis.clone().invert());
  holder.add(root);
  holder.updateMatrixWorld(true);

  // --- fingers: find each joint's bend axis by testing -------------------
  // holder has no parent here, so "world" positions are already in the arm frame.
  const local = (o) => o.getWorldPosition(new THREE.Vector3());
  const palmCentre = local(hand).lerp(local(midTipBone), 0.35);
  const chains = {};
  for (const f of FINGERS) {
    const joints = f === 'thumb'
      ? [1, 2, 3].map((n) => bone(new RegExp(`^thumb0${n}${S}_`)))
      : [1, 2, 3].map((n) => bone(new RegExp(`^f_${f}0${n}${S}_`)));
    const tip = bone(new RegExp(`^${f === 'thumb' ? 'thumb' : 'f_' + f}03${S}_end`)) || joints[2];
    const base = f === 'thumb' ? null : bone(new RegExp(`^palm_${f}${S}_`));
    const axes = joints.map((j) => {
      if (!j) return null;
      const rest = j.quaternion.clone();
      const before = local(tip);
      let best = null, bestScore = -Infinity;
      for (const ax of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
        for (const sign of [1, -1]) {
          j.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(ax, 0.4 * sign));
          j.updateMatrixWorld(true);
          const after = local(tip);
          // A curl moves the tip toward the palm side (-y) and back toward the wrist.
          const score = f === 'thumb'
            ? before.distanceTo(palmCentre) - after.distanceTo(palmCentre) + (before.y - after.y) * 0.5
            : (before.y - after.y) + (after.z - before.z) * 0.5;
          if (score > bestScore) { bestScore = score; best = ax.clone().multiplyScalar(sign); }
        }
      }
      j.quaternion.copy(rest);
      j.updateMatrixWorld(true);
      return { bone: j, rest, axis: best };
    });
    // Spread swings the knuckle sideways (around the hand's up axis).
    chains[f] = { joints: axes.filter(Boolean), base, spreadSign: { index: -1, middle: 0, ring: 0.6, pinky: 1, thumb: -0.6 }[f] };
  }

  const q = new THREE.Quaternion();
  const sideAxis = new THREE.Vector3();
  function setPose(pose) {
    const p = pose || HAND_POSES.relaxed;
    for (const f of FINGERS) {
      const c = chains[f];
      const curl = Math.max(-0.2, Math.min(1.1, p[f] ?? 0));
      const bend = f === 'thumb' ? SEGMENT_BEND.thumb : SEGMENT_BEND.finger;
      c.joints.forEach((jt, n) => {
        jt.bone.quaternion.copy(jt.rest).multiply(q.setFromAxisAngle(jt.axis, curl * bend[n]));
      });
      const first = c.joints[0];
      if (first && c.spreadSign) {
        // Spread around the axis perpendicular to the bend axis and the bone (local y = along the bone).
        sideAxis.copy(first.axis).cross(new THREE.Vector3(0, 1, 0)).normalize();
        const amt = (p.spread ?? 0) * 0.16 * c.spreadSign * (S === 'R' ? 1 : -1);
        if (sideAxis.lengthSq() > 0.5) first.bone.quaternion.multiply(q.setFromAxisAngle(sideAxis, amt));
      }
    }
  }
  setPose(HAND_POSES.relaxed);

  return { object: holder, setPose, side: S };
}
