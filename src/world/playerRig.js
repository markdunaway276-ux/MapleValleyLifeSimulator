import * as THREE from 'three';
import { getOptionColor } from '../data/appearance.js';
import { createCharacterModel, WALK_CLIP_SPEED } from './characterModel.js';

// Bone directions are solved from the same shoulder and elbow pose as the
// first-person raise. The handset follows the skinned wrist's real position.
export function attachPlayerRig(body, { shadows, appearance }) {
  const socket = new THREE.Group();
  body.group.add(socket);
  let model = null;
  let right = null;
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

  // Third-person view of first-person actions (systems/playerActions.js): until full-body
  // Mixamo clips are added, any hand action plays the rig's Interact clip, and a laundry
  // basket is held in front of the chest while carrying.
  let acting = null; // { until, loop }
  let carrying = null;
  let rigShown = false;
  const basket = new THREE.Group();
  basket.name = 'player-basket';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.7 });
  const clothes = new THREE.MeshStandardMaterial({ color: 0x8a6d52, roughness: 0.95 });
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.22, 0.34), plastic);
  const pile = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), clothes);
  pile.scale.set(1.7, 0.55, 0.95);
  pile.position.y = 0.1;
  basket.add(tub, pile);
  basket.position.set(0, 1.04, -0.36);
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
      if (d.name === 'idle' || d.name === 'carry') { if (d.name === 'idle') acting = null; return; }
      if (['sit', 'stand', 'eat'].includes(d.name)) return;
      acting = { loop: !!d.loop && !d.duration, until: performance.now() + (d.duration || 1) * 1000 };
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

  createCharacterModel({ body: 'male', hair: 'simpleparted', hairColor: 0x3b3027, shadows, outfit: {
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

  function updateRig(seconds, moved, lift, wrist, thumbPress) {
    if (!model) return;
    const speed = moved / Math.max(seconds, 0.001);
    moving = lift < 0.05 && speed > (moving ? 0.12 : 0.22);
    const busy = acting && (acting.loop || performance.now() < acting.until) && lift < 0.05;
    if (!busy) acting = null;
    model.play(busy ? 'interact' : moving ? 'walk' : 'idle', {
      fade: 0.18,
      timeScale: !busy && moving ? THREE.MathUtils.clamp(speed / WALK_CLIP_SPEED, 0.38, 2.8) : 1
    });
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
