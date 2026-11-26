/**
 * Plays Mixamo clips on the Quaternius skeleton.
 *
 * The clips are the baked JSON from the mixamo-handoff tools (mixamo_bake.py):
 * for each frame and each of 22 Mixamo bones, the world-space turn D away
 * from Mixamo's T-pose (game axes: Y up, character facing +Z), plus the hips
 * offset in hips-heights. The Quaternius bodies are also modelled in a
 * T-pose facing +Z, so each mapped bone's target world rotation is
 * D x (its bind-pose world rotation); the local rotation follows from its
 * parent's. Unmapped bones (root, fingers) keep their bind pose.
 */

import * as THREE from 'three';

/** Mixamo bone -> Quaternius (Universal Base Characters) bone. */
export const MIXAMO_TO_UBC = Object.freeze({
  Hips: 'pelvis',
  Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03',
  Neck: 'neck_01', Head: 'Head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r'
});

/**
 * Builds a THREE.AnimationClip for `root` (the character scene in its bind pose)
 * from one baked Mixamo JSON clip.
 * @param {object} data   parsed JSON: { fps, frames, bones: { Hips: [x,y,z,w,...] }, hips: [x,y,z,...] }
 * @param {THREE.Object3D} root
 * @param {string} name
 */
export const RELAXED_FINGERS = Object.freeze({ axis: [1, 0, 0], angle: 0.45, thumbAngle: 0.2 });

export function mixamoToClip(data, root, name = 'mixamo', { fingers = RELAXED_FINGERS } = {}) {
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();

  // Bind-pose world rotation (in root space) of every bone.
  const bindWorld = new Map();
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  for (const b of Object.values(bones)) {
    tmpM.multiplyMatrices(rootInv, b.matrixWorld).decompose(tmpP, tmpQ, tmpS);
    bindWorld.set(b, tmpQ.clone().normalize());
  }

  const mapped = new Map(); // ubc bone -> mixamo name
  for (const [mx, ubc] of Object.entries(MIXAMO_TO_UBC)) {
    if (bones[ubc] && data.bones && data.bones[mx]) mapped.set(bones[ubc], mx);
  }
  const pelvis = bones.pelvis;
  if (!pelvis || !mapped.size) return null;

  // Order bones parent-first so a parent's frame rotation is known before its children's.
  const order = [];
  root.traverse((o) => { if (o.isBone) order.push(o); });

  const n = data.frames;
  const times = new Float32Array(n);
  for (let i = 0; i < n; i++) times[i] = i / data.fps;
  const values = new Map(order.map((b) => [b, new Float32Array(n * 4)]));

  const world = new Map();
  const D = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const parentInv = new THREE.Quaternion();
  for (let f = 0; f < n; f++) {
    world.clear();
    for (const b of order) {
      const parentWorld = b.parent && b.parent.isBone ? world.get(b.parent) : null;
      let w;
      if (mapped.has(b)) {
        const a = data.bones[mapped.get(b)];
        D.set(a[f * 4], a[f * 4 + 1], a[f * 4 + 2], a[f * 4 + 3]).normalize();
        w = D.clone().multiply(bindWorld.get(b));
      } else {
        // Keep the bind-pose local rotation under the (possibly moved) parent.
        const parentBind = b.parent && b.parent.isBone ? bindWorld.get(b.parent) : null;
        const bindLocal = parentBind ? parentBind.clone().invert().multiply(bindWorld.get(b)) : bindWorld.get(b).clone();
        w = parentWorld ? parentWorld.clone().multiply(bindLocal) : bindWorld.get(b).clone();
      }
      world.set(b, w);
      if (!mapped.has(b)) continue; // unmapped bones keep their bind-pose local rotation
      if (parentWorld) local.copy(parentInv.copy(parentWorld).invert()).multiply(w);
      else local.copy(w);
      local.normalize().toArray(values.get(b), f * 4);
    }
  }

  const tracks = [];
  for (const b of order) {
    if (!mapped.has(b)) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, values.get(b)));
  }

  // The bake has no finger bones, so the hands would stay in the stiff, spread
  // T-pose. Curl each finger joint a little about its bend axis for a relaxed hand.
  if (fingers) {
    const axis = new THREE.Vector3().fromArray(fingers.axis).normalize();
    for (const b of order) {
      const m = /^(thumb|index|middle|ring|pinky)_0[123]_(l|r)$/i.exec(b.name);
      if (!m) continue;
      const angle = /thumb/i.test(m[1]) ? fingers.thumbAngle : fingers.angle;
      const q = b.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
      const v = new Float32Array(n * 4);
      for (let f = 0; f < n; f++) q.toArray(v, f * 4);
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, v));
    }
  }

  // Hips offset (hips-heights, root space) -> pelvis local position.
  if (Array.isArray(data.hips) && data.hips.length >= n * 3) {
    tmpM.multiplyMatrices(rootInv, pelvis.matrixWorld).decompose(tmpP, tmpQ, tmpS);
    const H = tmpP.y;
    const parentM = new THREE.Matrix4().multiplyMatrices(rootInv, pelvis.parent.matrixWorld);
    const parentInvM = parentM.clone().invert();
    const pos = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let f = 0; f < n; f++) {
      v.set(tmpP.x + data.hips[f * 3] * H, tmpP.y + data.hips[f * 3 + 1] * H, tmpP.z + data.hips[f * 3 + 2] * H)
        .applyMatrix4(parentInvM);
      v.toArray(pos, f * 3);
    }
    tracks.push(new THREE.VectorKeyframeTrack(pelvis.name + '.position', times, pos));
  }
  return new THREE.AnimationClip(name, -1, tracks);
}
