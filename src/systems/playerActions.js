import * as THREE from 'three';
import { bevelBox } from '../world/shapes.js';
import { getOptionColor, normalizeAppearance } from '../data/appearance.js';

/**
 * Player action animations. One place every system asks for "the player is
 * now opening a door / sitting / loading a washer / folding…".
 *
 * First person: a pair of low-poly arms (sleeve colour from your outfit)
 * rides on the camera and plays a short keyframed pose for each action,
 * plus an optional camera dip (bending down to a washer). Arms are hidden
 * when nothing is happening, so normal walking looks the same as before.
 *
 * Third person (later): every action also fires a `maple-action` event
 * whose `clip` is the matching Mixamo animation name, so a third-person
 * body can play the full-body version of the same action.
 */

// Hand poses in camera space: x right, y up, z forward is negative.
// r = wrist rotation (x pitch, y yaw, z roll).
const REST = { p: [0.3, -0.82, -0.22], r: [0.3, 0, 0] };
// Laundry basket: hands on the outside of the side walls, palms turned in (roll),
// so they grip the basket instead of sinking into it.
const CARRY = { p: [0.145, -0.29, -0.47], r: [0.05, 0, 1.2] };
// Moving box (two hands, lower and wider than the basket).
const BOX_CARRY = { p: [0.222, -0.43, -0.6], r: [0.05, 0, 1.25] };
/** Where each forearm runs back to (camera space, right side; left is mirrored). */
const SHOULDER = [0.32, -0.85, 0.02];
const SLEEVE_LENGTH = 0.42;
const mirror = (pose) => ({ p: [-pose.p[0], pose.p[1], pose.p[2]], r: [pose.r[0], -pose.r[1], -pose.r[2]] });
const P = (x, y, z, rx = 0, ry = 0, rz = 0) => ({ p: [x, y, z], r: [rx, ry, rz] });

/**
 * Each action: duration (s) or loop period, keyframes { t, R, L, dip }.
 * L defaults to the mirror of R when `both` is set, else to REST.
 */
export const ACTIONS = {
  openDoor: {
    clip: 'Opening Door Inwards', duration: 0.75,
    keys: [
      { t: 0, R: REST },
      { t: 0.3, R: P(0.15, -0.27, -0.44, 0.1, 0, 0) },
      { t: 0.45, R: P(0.15, -0.27, -0.44, 0.1, 0, -0.7) },
      { t: 0.7, R: P(0.11, -0.23, -0.64, 0.15, 0, -0.7) },
      { t: 1, R: REST }
    ]
  },
  closeDoor: {
    clip: 'Opening Door Inwards', duration: 0.7,
    keys: [
      { t: 0, R: REST },
      { t: 0.35, R: P(0.14, -0.25, -0.6, 0.15, 0, 0) },
      { t: 0.7, R: P(0.18, -0.3, -0.36, 0.05, 0, 0) },
      { t: 1, R: REST }
    ]
  },
  knock: {
    clip: 'Knocking', duration: 1.1,
    keys: [
      { t: 0, R: REST },
      { t: 0.22, R: P(0.1, -0.1, -0.4, 0.6, 0, 0) },
      { t: 0.33, R: P(0.1, -0.1, -0.5, 0.6, 0, 0) },
      { t: 0.44, R: P(0.1, -0.1, -0.4, 0.6, 0, 0) },
      { t: 0.55, R: P(0.1, -0.1, -0.5, 0.6, 0, 0) },
      { t: 0.66, R: P(0.1, -0.1, -0.4, 0.6, 0, 0) },
      { t: 0.77, R: P(0.1, -0.1, -0.5, 0.6, 0, 0) },
      { t: 1, R: REST }
    ]
  },
  press: {
    clip: 'Button Pushing', duration: 0.55,
    keys: [
      { t: 0, R: REST },
      { t: 0.45, R: P(0.09, -0.14, -0.52, 0.2, 0, 0) },
      { t: 0.6, R: P(0.09, -0.14, -0.56, 0.2, 0, 0) },
      { t: 1, R: REST }
    ]
  },
  grab: {
    clip: 'Picking Up Object', duration: 0.8,
    keys: [
      { t: 0, R: REST },
      { t: 0.45, R: P(0.1, -0.22, -0.58, 0.1, 0, -0.2) },
      { t: 0.65, R: P(0.12, -0.26, -0.5, 0.2, 0, -0.4) },
      { t: 1, R: REST }
    ]
  },
  pickUp: {
    clip: 'Picking Up', duration: 0.9, both: true,
    keys: [
      { t: 0, R: REST },
      { t: 0.45, R: P(0.17, -0.5, -0.5, 0.5, 0, 0.1), dip: -0.35 },
      { t: 1, R: CARRY }
    ]
  },
  load: {
    clip: 'Gathering Objects', duration: 1.2, both: true,
    keys: [
      { t: 0, R: CARRY },
      { t: 0.35, R: P(0.15, -0.36, -0.6, 0.3, 0, 0.1), dip: -0.3 },
      { t: 0.6, R: P(0.13, -0.33, -0.68, 0.4, 0, 0.3), dip: -0.3 },
      { t: 1, R: REST }
    ]
  },
  unload: {
    clip: 'Gathering Objects', duration: 1.1, both: true,
    keys: [
      { t: 0, R: REST },
      { t: 0.4, R: P(0.13, -0.33, -0.66, 0.4, 0, 0.3), dip: -0.3 },
      { t: 0.65, R: P(0.15, -0.36, -0.55, 0.3, 0, 0.1), dip: -0.2 },
      { t: 1, R: CARRY }
    ]
  },
  handOver: {
    clip: 'Picking Up Object', duration: 0.9, both: true,
    keys: [
      { t: 0, R: CARRY },
      { t: 0.5, R: P(0.15, -0.26, -0.62, 0, 0, 0.1) },
      { t: 1, R: REST }
    ]
  },
  fold: {
    clip: 'Folding Clothes', loop: 1.3, both: true,
    keys: [
      { t: 0, R: P(0.2, -0.4, -0.46, 0.7, 0, 0.2), dip: -0.08 },
      { t: 0.3, R: P(0.06, -0.33, -0.43, 0.7, 0, 0.6), dip: -0.08 },
      { t: 0.55, R: P(0.05, -0.4, -0.5, 0.9, 0, 0.4), dip: -0.08 },
      { t: 0.8, R: P(0.18, -0.42, -0.48, 0.7, 0, 0.1), dip: -0.08 },
      { t: 1, R: P(0.2, -0.4, -0.46, 0.7, 0, 0.2), dip: -0.08 }
    ]
  },
  restock: {
    clip: 'Picking Up Object', loop: 1.5, both: true,
    keys: [
      { t: 0, R: P(0.15, -0.46, -0.44, 0.5, 0, 0.1), dip: -0.15 },
      { t: 0.5, R: P(0.15, -0.06, -0.56, -0.2, 0, 0.1) },
      { t: 0.7, R: P(0.15, -0.06, -0.62, -0.2, 0, 0.1) },
      { t: 1, R: P(0.15, -0.46, -0.44, 0.5, 0, 0.1), dip: -0.15 }
    ]
  },
  typing: {
    clip: 'Typing', loop: 0.5,
    keys: [
      { t: 0, R: P(0.13, -0.4, -0.42, 1.2), L: P(-0.13, -0.38, -0.42, 1.2) },
      { t: 0.5, R: P(0.12, -0.37, -0.43, 1.2), L: P(-0.14, -0.41, -0.42, 1.2) },
      { t: 1, R: P(0.13, -0.4, -0.42, 1.2), L: P(-0.13, -0.38, -0.42, 1.2) }
    ]
  },
  sit: {
    clip: 'Sitting', duration: 0.55, both: true,
    keys: [
      { t: 0, R: REST },
      { t: 0.5, R: P(0.3, -0.48, -0.28, 1.0, 0, -0.3) },
      { t: 1, R: REST }
    ]
  },
  stand: {
    clip: 'Stand Up', duration: 0.6, both: true,
    keys: [
      { t: 0, R: REST },
      { t: 0.35, R: P(0.3, -0.48, -0.3, 1.0, 0, -0.3) },
      { t: 1, R: REST }
    ]
  },
  takeKeys: {
    // Reach out palm up, the keys are dropped in, then bring them in to look at them.
    clip: 'Picking Up Object', duration: 1.8, prop: { name: 'keys', from: 0.36, to: 0.92 },
    keys: [
      { t: 0, R: REST },
      // Palm tilted toward you (fingers up) so the keys landing in it can be seen.
      { t: 0.3, R: P(0.07, -0.16, -0.56, 0.55, 0, 0) },
      { t: 0.45, R: P(0.07, -0.17, -0.56, 0.55, 0, 0) },
      { t: 0.62, R: P(0.07, -0.16, -0.44, 0.95, 0.15, 0) },
      { t: 0.82, R: P(0.08, -0.17, -0.43, 0.95, 0.15, 0) },
      { t: 1, R: REST }
    ]
  },
  liftBox: {
    clip: 'Picking Up', duration: 1.0, both: true,
    keys: [
      { t: 0, R: REST },
      { t: 0.45, R: P(0.21, -0.5, -0.55, 0.3, 0, 1.25), dip: -0.4 },
      { t: 1, R: BOX_CARRY }
    ]
  },
  setBoxDown: {
    clip: 'Gathering Objects', duration: 1.0, both: true,
    keys: [
      { t: 0, R: BOX_CARRY },
      { t: 0.5, R: P(0.21, -0.5, -0.55, 0.3, 0, 1.25), dip: -0.4 },
      { t: 0.7, R: P(0.21, -0.5, -0.55, 0.3, 0, 1.25), dip: -0.4 },
      { t: 1, R: REST }
    ]
  },
  unpack: {
    // Lift things out of a box on the floor and set them aside.
    clip: 'Picking Up Object', loop: 1.4, both: true,
    keys: [
      { t: 0, R: P(0.12, -0.45, -0.5, 0.5, 0, 0.2), dip: -0.3 },
      { t: 0.35, R: P(0.16, -0.25, -0.5, 0.1, 0, 0.1), L: P(-0.12, -0.45, -0.5, 0.5, 0, -0.2), dip: -0.2 },
      { t: 0.65, R: P(0.32, -0.3, -0.5, 0.2, -0.3, 0.1), L: P(-0.14, -0.43, -0.5, 0.5, 0, -0.2), dip: -0.2 },
      { t: 1, R: P(0.12, -0.45, -0.5, 0.5, 0, 0.2), dip: -0.3 }
    ]
  },
  eat: {
    clip: 'Drinking', duration: 1.1,
    prop: { name: 'snack', from: 0.12, to: 0.86 },
    keys: [
      { t: 0, R: REST },
      { t: 0.35, R: P(0.05, -0.16, -0.24, -0.6, 0.3, 0) },
      { t: 0.55, R: P(0.04, -0.13, -0.2, -0.7, 0.3, 0) },
      { t: 0.75, R: P(0.05, -0.16, -0.24, -0.6, 0.3, 0) },
      { t: 1, R: REST }
    ]
  },
  drink: {
    clip: 'Drinking', duration: 1.15,
    prop: { name: 'cup', from: 0.1, to: 0.88 },
    keys: [
      { t: 0, R: REST },
      { t: 0.32, R: P(0.06, -0.18, -0.26, -0.35, 0.15, 0) },
      { t: 0.58, R: P(0.04, -0.12, -0.20, -0.82, 0.15, 0) },
      { t: 0.82, R: P(0.06, -0.19, -0.27, -0.25, 0.1, 0) },
      { t: 1, R: REST }
    ]
  },
  unlockDoor: {
    clip: 'Opening Door Inwards', duration: 0.95,
    prop: { name: 'keys', from: 0.08, to: 0.88 },
    keys: [
      { t: 0, R: REST },
      { t: 0.25, R: P(0.12, -0.22, -0.44, 0.15, 0, 0) },
      { t: 0.42, R: P(0.11, -0.22, -0.54, 0.15, 0, 0.05) },
      { t: 0.58, R: P(0.11, -0.22, -0.54, 0.15, 0, -0.85) },
      { t: 0.74, R: P(0.11, -0.22, -0.54, 0.15, 0, -0.1) },
      { t: 1, R: REST }
    ]
  },
  cook: {
    clip: 'Gathering Objects', duration: 1.45,
    prop: { name: 'spatula', from: 0.08, to: 0.9 },
    keys: [
      { t: 0, R: REST },
      { t: 0.22, R: P(0.14, -0.3, -0.48, 0.25, -0.2, 0.1) },
      { t: 0.44, R: P(0.05, -0.32, -0.54, 0.3, 0.25, -0.15) },
      { t: 0.66, R: P(0.16, -0.29, -0.50, 0.22, -0.25, 0.15) },
      { t: 0.84, R: P(0.08, -0.26, -0.46, 0.18, 0.1, -0.1) },
      { t: 1, R: REST }
    ]
  },
  wave: {
    clip: 'Waving', duration: 0.95,
    keys: [
      { t: 0, R: REST },
      { t: 0.25, R: P(0.18, -0.1, -0.38, 0.45, 0, -0.25) },
      { t: 0.45, R: P(0.24, -0.09, -0.38, 0.45, 0, -0.55) },
      { t: 0.65, R: P(0.16, -0.1, -0.38, 0.45, 0, -0.2) },
      { t: 1, R: REST }
    ]
  },
  exitCar: {
    // Reach for the door latch, push the truck door open, and step down onto the street.
    clip: 'Opening Door Inwards', duration: 0.95,
    keys: [
      { t: 0, R: P(0.24, -0.45, -0.34, 0.15, 0, 0), L: P(-0.24, -0.32, -0.36, 0.1, 0.2, 0.35), dip: -0.34 },
      { t: 0.26, R: P(0.26, -0.48, -0.32, 0.1, 0, 0), L: P(-0.28, -0.24, -0.54, 0.12, 0.35, 0.2), dip: -0.30 },
      { t: 0.54, R: P(0.24, -0.54, -0.30, 0.15, 0, 0), L: P(-0.34, -0.28, -0.60, 0.08, 0.45, 0.1), dip: -0.42 },
      { t: 0.78, R: REST, L: P(-0.26, -0.42, -0.40, 0.15, 0.15, 0), dip: -0.10 },
      { t: 1, R: REST, dip: 0 }
    ]
  },
  openTruckBed: {
    // Unlatch the rear truck-bed cover, lift it open, reach into the bed, and pull a box into your arms.
    clip: 'Picking Up', duration: 1.55, both: true, boxFrom: 0.66,
    keys: [
      { t: 0, R: REST, dip: 0 },
      // Reach right hand forward to unlatch the rear cover handle.
      { t: 0.14, R: P(0.06, -0.24, -0.54, 0.25, -0.1, -0.15), L: P(-0.22, -0.48, -0.36, 0.15, 0, 0), dip: -0.04 },
      { t: 0.22, R: P(0.08, -0.21, -0.52, 0.15, -0.15, 0.35), L: P(-0.18, -0.30, -0.48, 0.2, 0.1, 0), dip: -0.05 },
      // Lift the hinged bed cover up and out of the way.
      { t: 0.42, R: P(0.18, -0.04, -0.48, -0.28, -0.05, 0.1), L: P(-0.18, -0.04, -0.48, -0.28, 0.05, -0.1), dip: 0.03 },
      // Reach both hands forward and down into the open truck bed to grip the box.
      { t: 0.64, R: P(0.22, -0.36, -0.66, 0.34, 0.04, 1.15), L: P(-0.22, -0.36, -0.66, 0.34, -0.04, -1.15), dip: -0.14 },
      { t: 0.72, R: P(0.21, -0.34, -0.60, 0.28, 0.05, 1.25), L: P(-0.21, -0.34, -0.60, 0.28, -0.05, -1.25), dip: -0.12 },
      // Pull the box out of the bed and settle into carry pose.
      { t: 1, R: BOX_CARRY, dip: 0 }
    ]
  },
  reachTruckBox: {
    // Reach into the already-open truck bed, grip the next box, and pull it into your arms.
    clip: 'Picking Up', duration: 1.05, both: true, boxFrom: 0.46,
    keys: [
      { t: 0, R: REST, dip: 0 },
      { t: 0.44, R: P(0.22, -0.36, -0.66, 0.34, 0.04, 1.15), dip: -0.14 },
      { t: 0.56, R: P(0.21, -0.34, -0.58, 0.26, 0.05, 1.25), dip: -0.10 },
      { t: 1, R: BOX_CARRY, dip: 0 }
    ]
  }
};

/** What an interactable does to your hands when you use it. */
export function actionForTarget(target) {
  const ud = (target && target.userData) || {};
  if (ud.action) return typeof ud.action === 'function' ? ud.action() : ud.action;
  if (ud.isDoor) return ud.open ? 'closeDoor' : 'openDoor';
  if (ud.isSeat || ud.kind === 'sit' || ud.kind === 'npc' || ud.isNpc) return null;
  if (ud.isMailbox || ud.kind === 'mailbox' || ud.kind === 'pickup') return 'pickUp';
  if (ud.kind === 'cook') return 'cook';
  if (ud.kind === 'vending' || ud.kind === 'light-switch' || ud.kind === 'tv' || ud.isTv || ud.isSwitch) return 'press';
  return null;
}

const smooth = (t) => t * t * (3 - 2 * t);

function sideOf(k, side, both) {
  if (side === 'R') return k.R;
  if (k.L) return k.L;
  return both ? mirror(k.R) : REST_L;
}

function sample(keys, t, side, both) {
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const span = b.t - a.t;
  const k = span > 0 ? smooth((t - a.t) / span) : 1;
  const pa = sideOf(a, side, both);
  const pb = sideOf(b, side, both);
  return {
    p: pa.p.map((v, i) => v + (pb.p[i] - v) * k),
    r: pa.r.map((v, i) => v + (pb.r[i] - v) * k),
    dip: (a.dip || 0) + ((b.dip || 0) - (a.dip || 0)) * k
  };
}
const REST_L = mirror(REST);

function lerpPose(a, b, k) {
  return { p: a.p.map((v, i) => v + (b.p[i] - v) * k), r: a.r.map((v, i) => v + (b.r[i] - v) * k) };
}

function buildArm(sleeveMat, skinMat, side) {
  const arm = new THREE.Group();
  arm.name = 'fp-arm-' + side;
  const dir = side === 'R' ? 1 : -1;

  // Sculpted organic palm (tapered rounded palm + heel + knuckle ridge).
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), skinMat);
  palm.scale.set(0.92, 0.36, 1.05);
  palm.position.set(0, 0, 0.005);

  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skinMat);
  heel.scale.set(0.95, 0.52, 0.9);
  heel.position.set(dir * 0.004, -0.004, 0.034);

  const knuckles = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.056, 6, 10), skinMat);
  knuckles.rotation.z = Math.PI / 2;
  knuckles.position.set(0, 0.003, -0.036);

  arm.add(palm, heel, knuckles);

  // Four individually sculpted fingers (index, middle, ring, pinky) with gentle natural curl.
  const fingerSpecs = [
    { x: -dir * 0.027, len: 0.034, rad: 0.0085, curl: 0.24, splay: -dir * 0.06 },
    { x: -dir * 0.009, len: 0.039, rad: 0.0088, curl: 0.28, splay: -dir * 0.015 },
    { x:  dir * 0.010, len: 0.035, rad: 0.0082, curl: 0.32, splay:  dir * 0.03 },
    { x:  dir * 0.027, len: 0.027, rad: 0.0072, curl: 0.36, splay:  dir * 0.08 }
  ];
  for (const f of fingerSpecs) {
    const base = new THREE.Group();
    base.position.set(f.x, 0.002, -0.04);
    base.rotation.set(f.curl, f.splay, 0);
    const prox = new THREE.Mesh(new THREE.CapsuleGeometry(f.rad, f.len * 0.55, 6, 8), skinMat);
    prox.rotation.x = Math.PI / 2;
    prox.position.z = -f.len * 0.38;
    const tipPivot = new THREE.Group();
    tipPivot.position.set(0, 0, -f.len * 0.72);
    tipPivot.rotation.x = f.curl * 1.15;
    const dist = new THREE.Mesh(new THREE.CapsuleGeometry(f.rad * 0.86, f.len * 0.42, 6, 8), skinMat);
    dist.rotation.x = Math.PI / 2;
    dist.position.z = -f.len * 0.32;
    tipPivot.add(dist);
    base.add(prox, tipPivot);
    arm.add(base);
  }

  // Opposable two-segment thumb angled naturally at the side of the palm.
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-dir * 0.034, -0.004, 0.014);
  thumbBase.rotation.set(0.18, -dir * 0.58, dir * 0.32);
  const thumbProx = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.024, 6, 8), skinMat);
  thumbProx.rotation.x = Math.PI / 2;
  thumbProx.position.z = -0.018;
  const thumbTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.020, 6, 8), skinMat);
  thumbTip.rotation.x = Math.PI / 2 + 0.22;
  thumbTip.position.set(0, -0.004, -0.042);
  thumbBase.add(thumbProx, thumbTip);
  arm.add(thumbBase);

  // Smooth tapered wrist leading into the forearm cuff.
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.031, 0.068, 12), skinMat);
  wrist.rotation.x = Math.PI / 2;
  wrist.scale.set(1.06, 1, 0.82);
  wrist.position.set(0, -0.004, 0.072);
  arm.add(wrist);

  // Tapered cylindrical forearm sleeve with a folded cuff ring (no boxy slab).
  const sleeve = new THREE.Group();
  sleeve.name = 'fp-sleeve-' + side;
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.049, SLEEVE_LENGTH, 14), sleeveMat);
  forearm.rotation.x = Math.PI / 2;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.040, 0.048, 14), sleeveMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = -SLEEVE_LENGTH / 2 + 0.024;
  sleeve.add(forearm, cuff);

  arm.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; } });
  sleeve.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; } });
  arm.userData.sleeve = sleeve;
  arm.userData.shoulder = new THREE.Vector3(side === 'R' ? SHOULDER[0] : -SHOULDER[0], SHOULDER[1], SHOULDER[2]);
  return arm;
}

const WRIST_LOCAL = new THREE.Vector3(0, -0.006, 0.095);
const _wrist = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _back = new THREE.Vector3(0, 0, 1);
function layForearm(arm) {
  const sleeve = arm.userData.sleeve;
  arm.updateMatrix();
  _wrist.copy(WRIST_LOCAL).applyMatrix4(arm.matrix);
  _dir.copy(arm.userData.shoulder).sub(_wrist).normalize();
  sleeve.position.copy(_wrist).addScaledVector(_dir, SLEEVE_LENGTH / 2);
  sleeve.quaternion.setFromUnitVectors(_back, _dir);
}

function buildKeys() {
  const g = new THREE.Group();
  g.name = 'fp-keys';
  const metal = new THREE.MeshLambertMaterial({ color: 0xc9c2a8 });
  const brass = new THREE.MeshLambertMaterial({ color: 0xc8a24a });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 14), metal);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  [[brass, 0.4], [metal, -0.5]].forEach(([mat, angle]) => {
    const key = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.018), mat);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.003, 0.04), mat);
    head.position.z = -0.024;
    blade.position.z = -0.05;
    key.add(head, blade);
    key.rotation.y = angle;
    g.add(key);
  });
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.03), new THREE.MeshLambertMaterial({ color: 0xb8433a }));
  tag.position.set(0.02, 0, 0.022);
  g.add(tag);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

function buildBox() {
  const g = new THREE.Group();
  g.name = 'fp-box';
  const card = new THREE.MeshLambertMaterial({ color: 0xb98d5b });
  const tape = new THREE.MeshLambertMaterial({ color: 0xd9c9a3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.3), card);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.302), tape);
  strip.position.y = 0.131;
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.362, 0.003, 0.004), new THREE.MeshLambertMaterial({ color: 0x8a6640 }));
  seam.position.y = 0.131;
  g.add(body, strip, seam);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

function buildBasket() {
  const g = new THREE.Group();
  g.name = 'fp-basket';
  const plastic = new THREE.MeshLambertMaterial({ color: 0xe8e4d8 });
  const parts = [
    [0.38, 0.02, 0.26, 0, -0.08, 0],
    [0.38, 0.16, 0.02, 0, 0, 0.12], [0.38, 0.16, 0.02, 0, 0, -0.12],
    [0.02, 0.16, 0.26, 0.18, 0, 0], [0.02, 0.16, 0.26, -0.18, 0, 0]
  ];
  for (const [w, h, d, x, y, z] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plastic);
    m.position.set(x, y, z);
    g.add(m);
  }
  const load = new THREE.MeshLambertMaterial({ color: 0x8a6d52 });
  const clothes = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), load);
  clothes.scale.set(1.15, 0.5, 0.8);
  clothes.position.y = 0.06;
  g.add(clothes);
  const stack = new THREE.Group();
  const stackColors = [0x4a7fb8, 0xd8d2c4, 0xb85a4a, 0x5d8a5a];
  stackColors.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3 - i * 0.02, 0.035, 0.2), new THREE.MeshLambertMaterial({ color: c }));
    m.position.y = -0.05 + i * 0.037;
    stack.add(m);
  });
  g.add(stack);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.userData.setLoad = (kind) => {
    clothes.visible = kind !== 'folded';
    stack.visible = kind === 'folded';
    load.color.setHex(kind === 'wet' ? 0x3d4f66 : kind === 'dry' ? 0xc9b8e0 : 0x8a6d52);
  };
  return g;
}

function buildSnack() {
  const g = new THREE.Group();
  g.name = 'fp-snack';
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.095), new THREE.MeshLambertMaterial({ color: 0x9b3b2c }));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.024, 0.026), new THREE.MeshLambertMaterial({ color: 0xe2c37c }));
  g.add(wrap, stripe);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

function buildCup() {
  const g = new THREE.Group();
  g.name = 'fp-cup';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.105, 10), new THREE.MeshLambertMaterial({ color: 0xd8cfc0 }));
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.042, 10), new THREE.MeshLambertMaterial({ color: 0x8d6744 }));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 10), new THREE.MeshLambertMaterial({ color: 0x26282b }));
  lid.position.y = 0.056;
  g.add(body, sleeve, lid);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

function buildSpatula() {
  const g = new THREE.Group();
  g.name = 'fp-spatula';
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.14), new THREE.MeshLambertMaterial({ color: 0x3b2a1d }));
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.004, 0.09), new THREE.MeshLambertMaterial({ color: 0x9ba2a8 }));
  neck.position.z = -0.105;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.004, 0.075), new THREE.MeshLambertMaterial({ color: 0x878f96 }));
  blade.position.set(0, -0.006, -0.18);
  blade.rotation.x = 0.14;
  g.add(handle, neck, blade);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

export function createPlayerActions({ camera, appearance = null } = {}) {
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.88, metalness: 0 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b896, roughness: 0.65, metalness: 0 });
  const rig = new THREE.Group();
  rig.name = 'fp-arms';
  const armR = buildArm(sleeveMat, skinMat, 'R');
  const armL = buildArm(sleeveMat, skinMat, 'L');
  const basket = buildBasket();
  basket.scale.setScalar(0.62);
  basket.visible = false;
  const box = buildBox();
  box.visible = false;
  const keys = buildKeys();
  keys.position.set(0, 0.02, -0.012);
  keys.scale.setScalar(1.5);
  keys.visible = false;
  const snack = buildSnack();
  snack.position.set(0, 0.024, -0.025);
  snack.visible = false;
  const cup = buildCup();
  cup.position.set(0, 0.038, -0.03);
  cup.visible = false;
  const spatula = buildSpatula();
  spatula.position.set(0, 0.015, -0.04);
  spatula.visible = false;
  const handProps = { keys, snack, cup, spatula };
  armR.add(keys, snack, cup, spatula);
  rig.add(armR, armL, armR.userData.sleeve, armL.userData.sleeve, basket, box);
  // Poses are authored for a ~60° view; lift them so hands sit in the lower third of the screen.
  rig.position.set(0, 0.09, 0);
  rig.visible = false;
  if (camera) camera.add(rig);

  let current = null; // { name, def, t, elapsed, loop, duration }
  let carry = null;   // null, a laundry load kind ('dirty' | 'wet' | 'dry' | 'folded') or 'box'
  let shown = 0;      // 0..1 fade of the arms rig
  let dip = 0;

  function applyLook(data) {
    const s = normalizeAppearance(data);
    sleeveMat.color.set(getOptionColor('shirt', s.shirt));
    skinMat.color.set(getOptionColor('skin', s.skin));
  }
  if (appearance) {
    applyLook(appearance.get());
    if (typeof appearance.onChange === 'function') appearance.onChange(applyLook);
  }

  function emit(name, def, extra = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('maple-action', {
      detail: { name, clip: def ? def.clip : null, duration: def ? (def.duration || null) : null, loop: !!(def && def.loop), carrying: carry, ...extra }
    }));
  }

  /** Play a named action. Looping actions run until stop() (or `duration` seconds if given). */
  function play(name, opts = {}) {
    const def = ACTIONS[name];
    if (!def) return false;
    current = {
      name, def,
      elapsed: 0,
      loop: !!def.loop,
      duration: opts.duration != null ? opts.duration : (def.loop ? Infinity : def.duration),
      hold: opts.hold != null ? opts.hold : null // development: freeze at this 0..1 point
    };
    emit(name, def, { duration: Number.isFinite(current.duration) ? current.duration : null });
    return true;
  }

  function stop(name) {
    if (!current || (name && current.name !== name)) return;
    current = null;
    emit('idle', null);
  }

  /** Show (or with null, hide) the laundry basket, or with 'box' a moving box, in your hands. */
  function setCarry(kind) {
    carry = kind || null;
    basket.visible = !!carry && carry !== 'box';
    box.visible = carry === 'box';
    if (carry && carry !== 'box') basket.userData.setLoad(carry);
    emit('carry', carry ? { clip: 'Carrying', loop: true } : null);
  }

  const tmp = new THREE.Euler();
  function pose(arm, s) {
    arm.position.set(s.p[0], s.p[1], s.p[2]);
    tmp.set(s.r[0], s.r[1], s.r[2]);
    arm.rotation.copy(tmp);
  }

  function update(delta) {
    const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
    const hold = carry === 'box' ? BOX_CARRY : CARRY;
    let R = carry ? hold : REST;
    let L = carry ? mirror(hold) : REST_L;
    let propT = -1;
    let targetDip = 0;
    let active = !!carry;
    if (current) {
      current.elapsed += dt;
      const { def } = current;
      let t;
      if (current.hold != null) {
        t = current.hold;
      } else if (current.loop) {
        t = (current.elapsed % def.loop) / def.loop;
        if (current.elapsed >= current.duration) { stop(); }
      } else {
        t = Math.min(1, current.elapsed / current.duration);
      }
      if (current) {
        const a = sample(def.keys, t, 'R', def.both);
        const b = sample(def.keys, t, 'L', def.both);
        R = a; L = b; targetDip = a.dip;
        propT = t;
        active = true;
        // A one-off ending on its own is not a cancel: the third-person clip may run longer.
        if (!current.loop && t >= 1) current = null;
      }
    }
    shown += ((active ? 1 : 0) - shown) * Math.min(1, dt * 12);
    rig.visible = shown > 0.02;
    if (rig.visible) {
      // Fade in/out by sliding from the rest pose, so arms rise into view.
      pose(armR, lerpPose(REST, R, shown));
      pose(armL, lerpPose(REST_L, L, shown));
      layForearm(armR);
      layForearm(armL);
      const midX = (armR.position.x + armL.position.x) / 2;
      const midY = (armR.position.y + armL.position.y) / 2;
      const midZ = (armR.position.z + armL.position.z) / 2;
      // Folding needs both hands on the table, so the basket is set down meanwhile.
      basket.visible = !!carry && carry !== 'box' && !(current && current.name === 'fold');
      if (basket.visible) {
        basket.position.set(midX, midY + 0.005, midZ);
        basket.rotation.set(0.1, 0, 0);
      }
      // The box sits between the palms (it shows only once grabbed, or until set down).
      const boxFrom = current && current.def.boxFrom != null ? current.def.boxFrom : 0;
      box.visible = (carry === 'box' && (!current || propT >= boxFrom)) ||
        !!(current && current.name === 'setBoxDown' && propT < 0.7);
      if (box.visible) {
        box.position.set(midX, midY + 0.02, midZ);
        box.rotation.set(0.05, 0, 0);
      }
      const prop = current && current.def.prop;
      for (const [name, mesh] of Object.entries(handProps)) {
        mesh.visible = !!(prop && prop.name === name && propT >= prop.from && propT <= prop.to);
      }
    }
    dip += (targetDip - dip) * Math.min(1, dt * 10);
    if (camera && Math.abs(dip) > 0.001) camera.position.y += dip;
  }

  const gripRotation = new THREE.Quaternion();
  const cameraInverse = new THREE.Quaternion();
  function drive(grips) {
    rig.visible = true;
    basket.visible = box.visible = false;
    for (const mesh of Object.values(handProps)) mesh.visible = false;
    rig.updateWorldMatrix(true, false);
    camera.getWorldQuaternion(cameraInverse).invert();
    for (const [index, arm] of [armL, armR].entries()) {
      const grip = grips[index];
      grip.getWorldPosition(arm.position);
      rig.worldToLocal(arm.position);
      grip.getWorldQuaternion(gripRotation);
      arm.quaternion.copy(cameraInverse).multiply(gripRotation);
      arm.rotateZ(index ? -0.54 : 0.54);
      layForearm(arm);
    }
  }

  return {
    drive,
    play,
    stop,
    setCarry,
    update,
    get current() { return current ? current.name : null; },
    get carrying() { return carry; },
    rig
  };
}
