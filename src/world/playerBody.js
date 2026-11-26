/**
 * A simple low-poly stand-in body for the first-person player: a few
 * merged boxes for the torso (shirt), legs (pants), arms and a head.
 * Visual only — it does not add colliders.
 *
 * The group sits at the player's feet (eye height minus EYE_HEIGHT) and
 * follows yaw only, so looking down does not swing the torso into the
 * lens. The head is on HIDDEN_FROM_FP_LAYER so the first-person camera
 * never draws it, while the desktop shadow camera is asked to include
 * that layer so the head can still cast a shadow.
 */

import * as THREE from 'three';
import { attachPlayerRig } from './playerRig.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getOptionColor, normalizeAppearance } from '../data/appearance.js';

export const EYE_HEIGHT = 1.6;
export const FP_VISIBLE_LAYER = 0;
/** Hidden from the first-person camera; still included in desktop shadows. */
export const HIDDEN_FROM_FP_LAYER = 2;
/** Top of the shirt, metres above the feet — stays below the eye. */
export const TORSO_TOP = 1.36;

function boxAt(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function sphereAt(r, x, y, z, widthSegs = 8, heightSegs = 6) {
  const g = new THREE.SphereGeometry(r, widthSegs, heightSegs);
  g.translate(x, y, z);
  return g;
}

function merge(parts) {
  const geo = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return geo;
}

function skinMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

/**
 * Ask every shadow camera on `root` to include the hidden-from-FP layer
 * so the head can cast a desktop shadow without appearing in the view.
 */
export function enableBodyShadowLayers(root, layer = HIDDEN_FROM_FP_LAYER) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((obj) => {
    if (obj.isLight && obj.shadow && obj.shadow.camera) {
      obj.shadow.camera.layers.enable(layer);
    }
  });
}

/**
 * Shared low-poly stand-in (torso, legs, arms, head) used by the first-person
 * player and by NPCs. Pass hideHead to keep the head out of the FP camera.
 */
export function createPlaceholderBody({
  scene,
  shadows = false,
  appearance,
  name = 'body',
  prefix = 'body',
  hideHead = false
} = {}) {
  const articulated = hideHead;
  const shirtGeo = merge([
    boxAt(0.26, 0.38, 0.15, 0, 1.17, 0),
    ...(!articulated ? [boxAt(0.07, 0.32, 0.07, 0.165, 1.18, 0)] : []),
    boxAt(0.07, 0.32, 0.07, -0.165, 1.18, 0)
  ]);
  const pantsGeo = articulated ? boxAt(0.24, 0.18, 0.135, 0, 0.92, 0) : merge([
    boxAt(0.09, 0.82, 0.10, 0.065, 0.49, 0),
    boxAt(0.09, 0.82, 0.10, -0.065, 0.49, 0),
    boxAt(0.10, 0.08, 0.16, 0.065, 0.04, 0),
    boxAt(0.10, 0.08, 0.16, -0.065, 0.04, 0)
  ]);
  const skinGeo = merge([
    boxAt(0.09, 0.12, 0.09, 0, 1.42, 0.01),
    ...(!articulated ? [boxAt(0.065, 0.26, 0.065, 0.165, 0.88, 0)] : []),
    boxAt(0.065, 0.26, 0.065, -0.165, 0.88, 0)
  ]);
  const headGeo = sphereAt(0.11, 0, 1.58, 0.03);

  const shirtMat = skinMat('#4a90d9');
  const pantsMat = skinMat('#24324d');
  const armsMat = skinMat('#e0b896');
  const headMat = skinMat('#e0b896');

  const shirt = new THREE.Mesh(shirtGeo, shirtMat);
  shirt.name = prefix + '-shirt';
  const pants = new THREE.Mesh(pantsGeo, pantsMat);
  pants.name = prefix + '-pants';
  const skin = new THREE.Mesh(skinGeo, armsMat);
  skin.name = prefix + '-skin';
  const head = new THREE.Mesh(headGeo, headMat);
  head.name = prefix + '-head';
  if (hideHead) head.layers.set(HIDDEN_FROM_FP_LAYER);

  const cast = !!shadows;
  shirt.castShadow = cast;
  pants.castShadow = cast;
  skin.castShadow = cast;
  head.castShadow = cast;
  shirt.receiveShadow = false;
  pants.receiveShadow = false;
  skin.receiveShadow = false;
  head.receiveShadow = false;

  const group = new THREE.Group();
  group.name = name;
  group.add(shirt, pants, skin, head);

  const shoulder = new THREE.Group();
  const elbow = new THREE.Group();
  const hand = new THREE.Group();
  const armMeshes = [];
  const legs = [];
  if (articulated) {
    shoulder.position.set(0.165, 1.34, 0);
    elbow.position.y = -0.30;
    hand.position.y = -0.24;
    for (const [joint, material, width, length] of [
      [shoulder, shirtMat, 0.075, 0.30],
      [elbow, armsMat, 0.062, 0.25],
      [hand, armsMat, 0.065, 0.08]
    ]) {
      const segment = new THREE.Mesh(boxAt(width, length, width, 0, -length / 2, 0), material);
      segment.castShadow = cast;
      joint.add(segment);
      armMeshes.push(segment);
    }
    group.add(shoulder);
    shoulder.add(elbow);
    elbow.add(hand);
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.065, 0.90, 0);
      const leg = new THREE.Mesh(merge([
        boxAt(0.09, 0.82, 0.10, 0, -0.41, 0),
        boxAt(0.10, 0.08, 0.16, 0, -0.86, -0.015)
      ]), pantsMat);
      leg.castShadow = cast;
      hip.add(leg);
      group.add(hip);
      legs.push(hip);
    }
  }

  if (scene) scene.add(group);
  if (shadows && scene && hideHead) enableBodyShadowLayers(scene);

  function apply(data) {
    const state = normalizeAppearance(data);
    shirtMat.color.set(getOptionColor('shirt', state.shirt));
    pantsMat.color.set(getOptionColor('pants', state.pants));
    const skinColor = getOptionColor('skin', state.skin);
    armsMat.color.set(skinColor);
    headMat.color.set(skinColor);
    return state;
  }

  if (appearance) apply(appearance);

  function update(player) {
    if (!player || !player.position) return;
    group.position.set(
      player.position.x,
      player.position.y - EYE_HEIGHT,
      player.position.z
    );
    const yaw = player.rotation ? player.rotation.y : 0;
    group.rotation.set(0, yaw, 0);
  }

  function dispose() {
    if (scene) scene.remove(group);
    for (const segment of armMeshes) segment.geometry.dispose();
    for (const leg of legs) leg.children[0].geometry.dispose();
    shirtGeo.dispose();
    pantsGeo.dispose();
    skinGeo.dispose();
    headGeo.dispose();
    shirtMat.dispose();
    pantsMat.dispose();
    armsMat.dispose();
    headMat.dispose();
  }

  return {
    group,
    head,
    legs,
    arm: articulated ? { shoulder, elbow, hand, segments: armMeshes, material: armsMat, sleeve: shirtMat } : null,
    shirt,
    pants,
    skin,
    update,
    apply,
    dispose
  };
}

export function createPlayerBody({
  scene,
  camera,
  shadows = false,
  appearance
} = {}) {
  return attachPlayerRig(createPlaceholderBody({
    scene,
    shadows,
    appearance,
    name: 'player-body',
    prefix: 'player',
    hideHead: true
  }), { shadows, appearance });
}
