import * as THREE from 'three';
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
const CARRY = { p: [0.13, -0.29, -0.47], r: [-0.15, 0, 0.12] };
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
  eat: {
    clip: 'Drinking', duration: 1.1,
    keys: [
      { t: 0, R: REST },
      { t: 0.35, R: P(0.05, -0.16, -0.24, -0.6, 0.3, 0) },
      { t: 0.55, R: P(0.04, -0.13, -0.2, -0.7, 0.3, 0) },
      { t: 0.75, R: P(0.05, -0.16, -0.24, -0.6, 0.3, 0) },
      { t: 1, R: REST }
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
  if (ud.kind === 'cook') return 'grab';
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
  // Hand: palm block plus a thumb; the forearm runs back and down toward the shoulder.
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.095), skinMat);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.05), skinMat);
  thumb.position.set(side === 'R' ? -0.045 : 0.045, 0.004, -0.008);
  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.06), skinMat);
  wrist.position.set(0, -0.004, 0.07);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.42), sleeveMat);
  sleeve.position.set(0, -0.02, 0.3);
  sleeve.rotation.x = 0.12;
  for (const m of [hand, thumb, wrist, sleeve]) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; }
  arm.add(hand, thumb, wrist, sleeve);
  return arm;
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

export function createPlayerActions({ camera, appearance = null } = {}) {
  const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0b896 });
  const rig = new THREE.Group();
  rig.name = 'fp-arms';
  const armR = buildArm(sleeveMat, skinMat, 'R');
  const armL = buildArm(sleeveMat, skinMat, 'L');
  const basket = buildBasket();
  basket.scale.setScalar(0.62);
  basket.visible = false;
  rig.add(armR, armL, basket);
  // Poses are authored for a ~60° view; lift them so hands sit in the lower third of the screen.
  rig.position.set(0, 0.09, 0);
  rig.visible = false;
  if (camera) camera.add(rig);

  let current = null; // { name, def, t, elapsed, loop, duration }
  let carry = null;   // null or load kind ('dirty' | 'wet' | 'dry' | 'folded')
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
      duration: opts.duration != null ? opts.duration : (def.loop ? Infinity : def.duration)
    };
    emit(name, def, { duration: Number.isFinite(current.duration) ? current.duration : null });
    return true;
  }

  function stop(name) {
    if (!current || (name && current.name !== name)) return;
    current = null;
    emit('idle', null);
  }

  /** Show (or with null, hide) the laundry basket in your hands. */
  function setCarry(kind) {
    carry = kind || null;
    basket.visible = !!carry;
    if (carry) basket.userData.setLoad(carry);
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
    let R = carry ? CARRY : REST;
    let L = carry ? mirror(CARRY) : REST_L;
    let targetDip = 0;
    let active = !!carry;
    if (current) {
      current.elapsed += dt;
      const { def } = current;
      let t;
      if (current.loop) {
        t = (current.elapsed % def.loop) / def.loop;
        if (current.elapsed >= current.duration) { stop(); }
      } else {
        t = Math.min(1, current.elapsed / current.duration);
      }
      if (current) {
        const a = sample(def.keys, t, 'R', def.both);
        const b = sample(def.keys, t, 'L', def.both);
        R = a; L = b; targetDip = a.dip;
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
      // Folding needs both hands on the table, so the basket is set down meanwhile.
      basket.visible = !!carry && !(current && current.name === 'fold');
      if (basket.visible) {
        basket.position.set((armR.position.x + armL.position.x) / 2, (armR.position.y + armL.position.y) / 2 - 0.03, (armR.position.z + armL.position.z) / 2 - 0.04);
        basket.rotation.set(0.1, 0, 0);
      }
    }
    dip += (targetDip - dip) * Math.min(1, dt * 10);
    if (camera && Math.abs(dip) > 0.001) camera.position.y += dip;
  }

  return {
    play,
    stop,
    setCarry,
    update,
    get current() { return current ? current.name : null; },
    get carrying() { return carry; },
    rig
  };
}
