import * as THREE from 'three';
import { loadFpHands, makeHand, skinTint } from '../systems/fpHands.js';

/**
 * The realistic right hand (fp-hands.glb) holding the first-person phone:
 * palm on the back of the case, fingers wrapped behind, thumb on the glass.
 * Phone space: screen faces +z, x across (0.079 m), y up (0.155 m).
 *
 * attachPhoneHand(phone, { load, hide }) loads the hand, adds it to `phone`
 * and hides the `hide` objects (the old simple-shape grip) once it is ready.
 * Returns pose(x, y, pressing) with the same meaning as phoneGrip's pose.
 */

// Grip layout in phone space: the wrist sits below the bottom-right corner,
// the fingers run up-left across the back (palm toward the case), and the
// thumb lies along the right edge.
export const PHONE_HAND = {
  wrist: new THREE.Vector3(0.062, -0.1, -0.02),
  fingers: new THREE.Vector3(-1, 0.85, 0),
  roll: -0.3 // turns the thumb side out past the right edge so the thumb can reach the glass
};
const WRIST_IN_HAND = 0.084; // HAND_WRIST.z: wrist sits this far behind the palm origin

function placeMount(mount) {
  const d = PHONE_HAND.fingers.clone().normalize();
  const zh = d.clone().negate();
  // Back of the hand faces away from the phone (-z), rolled about the finger axis.
  const yh = new THREE.Vector3(0, 0, -1).applyAxisAngle(d, PHONE_HAND.roll);
  yh.addScaledVector(zh, -yh.dot(zh)).normalize();
  const xh = new THREE.Vector3().crossVectors(yh, zh).normalize();
  const m = new THREE.Matrix4().makeBasis(xh, yh, zh);
  const origin = PHONE_HAND.wrist.clone().addScaledVector(d, WRIST_IN_HAND);
  m.setPosition(origin);
  mount.matrix.copy(m);
  mount.matrixWorldNeedsUpdate = true;
}
export const PHONE_GRIP = { index: 0.42, middle: 0.46, ring: 0.5, pinky: 0.52, thumb: 0.2, spread: -0.1 };

export function attachPhoneHand(phone, { load, hide = [] } = {}) {
  let hand = null;
  const mount = new THREE.Group();
  mount.name = 'phone-hand';
  mount.matrixAutoUpdate = false;
  placeMount(mount);
  const frame = mount;
  const target = new THREE.Vector3();
  let last = null;

  function pose(x = 0, y = 0, pressing = false) {
    if (!hand) return;
    const key = `${x.toFixed(4)},${y.toFixed(4)},${pressing}`;
    if (key === last) return;
    last = key;
    hand.setPose(PHONE_GRIP);
    // Same reach limits as the simple grip: thumb rests low on the right of the screen.
    const endX = 0.03 + Math.max(-0.05, Math.min(0, x));
    const endY = -0.035 + Math.max(-0.015, Math.min(0.06, y));
    target.set(endX, endY, pressing ? 0.0085 : 0.014);
    phone.updateMatrixWorld(true);
    hand.thumbTo(phone.localToWorld(target));
  }

  if (typeof window !== 'undefined') {
    loadFpHands(load).then(() => {
      hand = makeHand('R');
      if (!hand) return;
      frame.add(hand.object);
      phone.add(mount);
      for (const o of hide) if (o) o.visible = false;
      last = null;
      pose();
    }).catch(() => { /* keep the simple grip */ });
  }

  /** Skin tint (multiplies the baked texture) and the screen's evening glow on the hand. */
  function setSkin(hex, glow = 0) {
    if (!hand) return;
    hand.object.traverse((o) => {
      if (!o.isMesh || !o.material || o.material.name !== 'hands-skin') return;
      skinTint(o.material.color, hex);
      o.material.emissive.setHex(0x377794);
      o.material.emissiveIntensity = glow;
    });
  }

  return {
    pose,
    setSkin,
    relayout() { placeMount(mount); last = null; },
    get ready() { return !!hand; },
    get object() { return hand ? hand.object : null; }
  };
}
