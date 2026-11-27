import * as THREE from 'three';
import { getOptionColor } from '../data/appearance.js';
import { createCharacterModel, WALK_CLIP_SPEED } from './characterModel.js';

/** First-person action name -> baked Mixamo clip (assets/characters/actions/<key>.json). */
const ACTION_CLIPS = {
  openDoor: { key: 'door', rate: 1.35 },
  closeDoor: { key: 'door', rate: 1.6 },
  press: { key: 'press', rate: 1.8 },
  knock: { key: 'press', rate: 1.6 },
  grab: { key: 'reach', rate: 1.8 },
  handOver: { key: 'reach', rate: 1.8 },
  pickUp: { key: 'pickup', rate: 2.4 },
  unload: { key: 'pickup', rate: 2.4 },
  load: { key: 'load', rate: 2.2 },
  eat: { key: 'eat', rate: 1.3 },
  fold: { key: 'fold', loop: true },
  restock: { key: 'restock', loop: true },
  typing: { key: 'typing', loop: true }
};
const ACTION_FILES = Object.fromEntries(
  ['door', 'press', 'reach', 'pickup', 'load', 'eat', 'fold', 'restock', 'typing', 'carry'].map((k) => [k, 'actions/' + k + '.json'])
);
/** Bones the Carrying pose owns when it is layered over the walk. */
const CARRY_BONES = new Set(['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r']);

/** Walk legs + a still Carrying pose on the arms, as one looping clip. */
function carryWalkClip(walk, carry) {
  if (!walk || !carry) return null;
  const tracks = walk.tracks.filter((t) => !CARRY_BONES.has(t.name.split('.')[0])).map((t) => t.clone());
  for (const t of carry.tracks) {
    const [bone, prop] = t.name.split('.');
    if (!CARRY_BONES.has(bone) || prop !== 'quaternion') continue;
    const v = Array.from(t.createInterpolant().evaluate(Math.min(1, carry.duration / 2)));
    tracks.push(new THREE.QuaternionKeyframeTrack(t.name, [0, walk.duration], [...v, ...v]));
  }
  return new THREE.AnimationClip('carry_walk', walk.duration, tracks);
}

// Bone directions are solved from the same shoulder and elbow pose as the
// first-person raise. The handset follows the skinned wrist's real position.
export function attachPlayerRig(body, { shadows, appearance }) {
  const socket = new THREE.Group();
  body.group.add(socket);
  let model = null;
  let right = null;
  let leftHand = null;
  const midHands = new THREE.Vector3();
  let look = body.apply(appearance);
  let disposed = false;
  let moving = false;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const reference = new THREE.Vector3();
  const current = new THREE.Quaternion();
  const parent = new THREE.Quaternion();
  const delta = new THREE.Quaternion();
  const target = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const axisX = new THREE.Vector3();
  const axisY = new THREE.Vector3();
  const axisZ = new THREE.Vector3();
  const curlAxis = new THREE.Vector3(1, 0, 0);
  const oldApply = body.apply;
  const oldDispose = body.dispose;
  const placeholder = [body.shirt, body.pants, body.skin, body.head, ...body.arm.segments, ...body.legs];

  // Third-person view of first-person actions (systems/playerActions.js listens nowhere else):
  // each hand action plays a baked Mixamo clip from assets/characters/actions (Interact if a
  // clip is missing), and while carrying laundry the arms hold the Carrying pose, also when
  // walking (walk legs + carry arms), with a basket between the hands.
  let acting = null; // { key, rate, loop, left (seconds of game time), fresh }
  let carrying = null;
  let rigShown = false;
  const basket = new THREE.Group();
  basket.name = 'player-basket';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.7 });
  const clothes = new THREE.MeshStandardMaterial({ color: 0x8a6d52, roughness: 0.95 });
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.32), plastic);
  const pile = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), clothes);
  pile.scale.set(1.35, 0.55, 0.85);
  pile.position.y = 0.1;
  basket.add(tub, pile);
  basket.position.set(0, 1.0, -0.36);
  basket.visible = false;
  for (const m of [tub, pile]) m.castShadow = !!shadows;
  body.group.add(basket);
  const loadColors = { dirty: 0x8a6d52, wet: 0x3d4f66, dry: 0xc9b8e0, folded: 0x4a7fb8 };
  if (typeof window !== 'undefined') {
    window.addEventListener('maple-action', (event) => {
      const d = event.detail || {};
      carrying = d.carrying || null;
      if (carrying) clothes.color.setHex(loadColors[carrying] || loadColors.dirty);
      basket.visible = rigShown && !!carrying;
      if (d.name === 'idle') { acting = null; return; }
      if (d.name === 'carry' || ['sit', 'stand'].includes(d.name)) return;
      const spec = ACTION_CLIPS[d.name];
      const key = spec && model?.has(spec.key) ? spec.key : 'interact';
      const rate = spec ? spec.rate || 1 : 1;
      const loop = !!(spec && spec.loop);
      const clip = model?.getClip(key);
      const seconds = loop ? (d.duration || Infinity) : (clip ? clip.duration / rate : (d.duration || 1));
      acting = { key, rate, loop, left: seconds, fresh: true };
    });
  }

  function applyPalette() {
    model?.root.traverse(mesh => {
      const colors = mesh.isMesh && mesh.material.userData?.clothes;
      if (!colors) return;
      colors.cShirt.value.set(getOptionColor('shirt', look.shirt));
      colors.cPants.value.set(getOptionColor('pants', look.pants));
      colors.cSkin.value.set(getOptionColor('skin', look.skin));
    });
  }

  createCharacterModel({ body: 'male', hair: 'simpleparted', hairColor: 0x3b3027, shadows, mixamo: ACTION_FILES, outfit: {
    shirt: getOptionColor('shirt', look.shirt),
    pants: getOptionColor('pants', look.pants),
    skin: getOptionColor('skin', look.skin),
    shoes: 0x272c31
  } }).then(loaded => {
    if (!loaded) return;
    const upper = loaded.root.getObjectByName('upperarm_r');
    const lower = loaded.root.getObjectByName('lowerarm_r');
    const hand = loaded.root.getObjectByName('hand_r');
    if (disposed || !upper?.isBone || !lower?.isBone || !hand?.isBone) { loaded.dispose(); return; }
    const fingers = [];
    hand.traverse(bone => {
      const match = /^(thumb|index|middle|ring|pinky)_0[123]_r$/i.exec(bone.name);
      if (match && bone.isBone) fingers.push({ bone, thumb: match[1] === 'thumb' });
    });
    const animatedPose = [upper, lower, hand, ...fingers.map(entry => entry.bone)]
      .map(bone => ({ bone, rotation: bone.quaternion.clone() }));
    right = { upper, lower, hand, fingers, animatedPose };
    leftHand = loaded.root.getObjectByName('hand_l') || null;
    const carryWalk = carryWalkClip(loaded.getClip('walk'), loaded.getClip('carry'));
    if (carryWalk) loaded.addClip('carryWalk', carryWalk);
    model = loaded;
    model.object.visible = false;
    body.group.add(model.object);
    applyPalette();
  });

  function aimBone(bone, child, start, end, weight) {
    bone.getWorldPosition(origin);
    child.getWorldPosition(from).sub(origin).normalize();
    start.getWorldPosition(reference);
    end.getWorldPosition(to).sub(reference).normalize();
    delta.setFromUnitVectors(from, to);
    bone.getWorldQuaternion(current);
    bone.parent.getWorldQuaternion(parent).invert();
    target.copy(parent).multiply(delta).multiply(current);
    bone.quaternion.slerp(target, weight);
    bone.updateWorldMatrix(false, true);
  }

  const busyHands = () => !!acting;

  function updateRig(seconds, moved, lift, wrist, thumbPress) {
    if (!model) return;
    const speed = moved / Math.max(seconds, 0.001);
    moving = lift < 0.05 && speed > (moving ? 0.12 : 0.22);
    // Walking away ends a one-off action; jobs keep you in place anyway.
    if (acting) acting.left -= seconds;
    const busy = acting && acting.left > 0 && lift < 0.05 && !(moving && !acting.loop);
    if (!busy) acting = null;
    const walkScale = THREE.MathUtils.clamp(speed / WALK_CLIP_SPEED, 0.38, 2.8);
    if (busy) {
      model.play(acting.key, { fade: 0.2, timeScale: acting.rate, restart: acting.fresh });
      acting.fresh = false;
    } else if (carrying && lift < 0.05 && model.has('carry')) {
      model.play(moving && model.has('carryWalk') ? 'carryWalk' : 'carry', { fade: 0.2, timeScale: moving ? walkScale : 1 });
    } else {
      model.play(moving ? 'walk' : 'idle', { fade: 0.18, timeScale: moving ? walkScale : 1 });
    }
    for (const { bone, rotation } of right.animatedPose) bone.quaternion.copy(rotation);
    model.update(seconds);
    for (const { bone, rotation } of right.animatedPose) rotation.copy(bone.quaternion);
    if (lift > 0) {
      aimBone(right.upper, right.lower, body.arm.shoulder, body.arm.elbow, lift);
      aimBone(right.lower, right.hand, body.arm.elbow, body.arm.hand, lift);
      wrist.getWorldQuaternion(current);
      axisX.set(0, 0, -1).applyQuaternion(current);
      axisY.set(0, 1, 0).applyQuaternion(current);
      axisZ.set(1, 0, 0).applyQuaternion(current);
      basis.makeBasis(axisX, axisY, axisZ);
      target.setFromRotationMatrix(basis);
      right.hand.parent.getWorldQuaternion(parent).invert();
      right.hand.quaternion.slerp(target.premultiply(parent), lift);
      for (const { bone, thumb } of right.fingers) {
        const angle = thumb ? 0.10 + thumbPress * 0.30 : 0.24;
        delta.setFromAxisAngle(curlAxis, lift * angle);
        bone.quaternion.multiply(delta);
      }
    }
    if (carrying && leftHand && !busyHands()) {
      right.hand.getWorldPosition(origin);
      leftHand.getWorldPosition(midHands);
      midHands.add(origin).multiplyScalar(0.5);
      body.group.worldToLocal(midHands);
      basket.position.set(midHands.x, midHands.y - 0.06, midHands.z);
    }
    right.hand.getWorldPosition(origin);
    body.group.worldToLocal(origin);
    socket.position.copy(origin);
    wrist.getWorldQuaternion(current);
    body.group.getWorldQuaternion(parent).invert();
    socket.quaternion.copy(parent.multiply(current));
  }

  return Object.assign(body, {
    apply(state) {
      look = oldApply(state);
      applyPalette();
      return look;
    },
    updateRig,
    showRig(show) {
      if (!model) return false;
      model.object.visible = !!show;
      for (const part of placeholder) part.visible = !show;
      rigShown = !!show;
      basket.visible = rigShown && !!carrying;
      return !!show;
    },
    rigSocket: socket,
    dispose() {
      disposed = true;
      if (model) { model.object.removeFromParent(); model.dispose(); }
      oldDispose();
    }
  });
}
