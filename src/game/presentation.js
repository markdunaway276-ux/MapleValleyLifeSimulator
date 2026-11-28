import * as THREE from 'three';
import { bevelBox } from '../world/shapes.js';
import { HIDDEN_FROM_FP_LAYER } from '../world/playerBody.js';
import { addPhoneGrip } from './phoneGrip.js';
import { attachPhoneHand } from './phoneHand.js';
import { loadGltf } from '../world/gltf.js';

const RAISE_SECONDS = 0.42;
const FOCUS_SECONDS = 0.28;
const SCREEN_HEIGHT = 0.145;
const SCREEN_WIDTH = 0.072;

function roundedPanel(width, height, radius) {
  const x = width / 2;
  const y = height / 2;
  const path = new THREE.Shape();
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
  return path;
}

function makeHandset() {
  const phone = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x414a52, metalness: 0.56, roughness: 0.31 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x232a31, metalness: 0.18, roughness: 0.46 });
  const glass = new THREE.MeshBasicMaterial({ color: 0x070b10 });
  const lensGlass = new THREE.MeshBasicMaterial({ color: 0x233b51 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x080a0e });

  const shellGeometry = new THREE.ExtrudeGeometry(roundedPanel(0.079, 0.155, 0.009), {
    depth: 0.009, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008,
    bevelSegments: 2, curveSegments: 6
  });
  shellGeometry.translate(0, 0, -0.0045);
  phone.add(new THREE.Mesh(shellGeometry, frame));

  const back = new THREE.Mesh(new THREE.ShapeGeometry(roundedPanel(0.077, 0.153, 0.008), 6), graphite);
  back.rotation.y = Math.PI;
  back.position.z = -0.0055;
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedPanel(0.077, 0.153, 0.008), 6), dark);
  bezel.position.z = 0.00555;
  const screen = new THREE.Mesh(new THREE.ShapeGeometry(roundedPanel(SCREEN_WIDTH, SCREEN_HEIGHT, 0.0043), 6), glass);
  screen.position.z = 0.006;
  const selfieLens = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), dark);
  selfieLens.position.set(0, 0.0645, 0.0062);
  phone.add(back, bezel, screen, selfieLens);

  const island = new THREE.Mesh(bevelBox(0.027, 0.035, 0.003, { radius: 0.0014 }), graphite);
  island.position.set(-0.021, 0.051, -0.0063);
  phone.add(island);
  for (const y of [0.043, 0.059]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0054, 0.0009, 6, 14), frame);
    ring.position.set(-0.025, y, -0.0082);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0048, 14), lensGlass);
    lens.rotation.y = Math.PI;
    lens.position.set(-0.025, y, -0.0084);
    phone.add(ring, lens);
  }
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.0024, 10), new THREE.MeshBasicMaterial({ color: 0xd7cfb5 }));
  flash.rotation.y = Math.PI;
  flash.position.set(-0.013, 0.059, -0.008);
  phone.add(flash);
  for (const [y, length] of [[0.019, 0.012], [0.043, 0.023]]) {
    const button = new THREE.Mesh(bevelBox(0.0022, length, 0.0034, { radius: 0.0008 }), frame);
    button.position.set(0.0403, y, -0.0006);
    phone.add(button);
  }
  return { phone, screen };
}

export function createPresentation({ camera, scene, mode, playerBody, actionRig }) {
  const arm = playerBody.arm;
  const first = makeHandset();
  const third = makeHandset();
  const gripMaterial = arm.material.clone();
  gripMaterial.emissive.setHex(0x377794);
  gripMaterial.emissiveIntensity = 0;
  const fallbackGrip = new THREE.Group();
  third.phone.add(fallbackGrip);
  const simpleGripStart = first.phone.children.length;
  const poseThumbs = [addPhoneGrip(first.phone, gripMaterial, true), addPhoneGrip(fallbackGrip, gripMaterial, false)];
  const simpleGrip = first.phone.children.slice(simpleGripStart);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.037, 0.102, 10), arm.sleeve);
  sleeve.position.set(0.063, -0.142, -0.044);
  sleeve.rotation.z = 0.32;
  sleeve.rotation.x = 0.26;
  first.phone.add(sleeve);
  const wristSkin = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), gripMaterial);
  wristSkin.scale.set(0.025, 0.035, 0.020);
  wristSkin.position.set(0.045, -0.103, -0.030);
  wristSkin.rotation.copy(sleeve.rotation);
  first.phone.add(wristSkin);
  camera.add(first.phone);
  // The realistic hand replaces the simple-shape grip (and its wrist) once loaded.
  const phoneHand = attachPhoneHand(first.phone, { load: loadGltf, hide: [...simpleGrip, wristSkin] });

  // The handset stays attached to the wrist throughout the raise.
  const wrist = new THREE.Group();
  wrist.position.set(-0.022, -0.044, 0.024);
  arm.hand.add(wrist);
  third.phone.position.y = 0.049;
  wrist.add(third.phone);

  const style = document.createElement('style');
  style.textContent = `
#hud-camera-view {
  position: absolute; z-index: 36; right: max(12px, env(safe-area-inset-right));
  top: calc(max(12px, env(safe-area-inset-top)) + 208px);
  width: 44px; height: 44px; border-radius: 8px; color: #fff;
  background: rgba(0, 0, 0, 0.65); border: 1px solid rgba(255, 255, 255, 0.35);
  font: 600 13px system-ui, sans-serif; touch-action: manipulation; cursor: pointer;
}
#hud-camera-view[aria-pressed="true"] { background: #34534d; }
body.mobile #hud-camera-view {
  top: calc(max(10px, env(safe-area-inset-top)) + 138px);
  right: max(10px, env(safe-area-inset-right));
  width: 40px; height: 40px;
  font-size: 12px;
}
@media (max-height: 500px) {
  body.mobile #hud-camera-view {
    top: max(8px, env(safe-area-inset-top));
    right: calc(max(10px, env(safe-area-inset-right)) + 128px);
    width: 36px; height: 36px;
    font-size: 11px;
  }
}
`;
  document.head.append(style);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'hud-camera-view';
  toggle.className = 'hud-ui';
  toggle.textContent = '3P';
  toggle.title = 'Toggle third-person view (V)';
  toggle.setAttribute('aria-label', 'Third-person view');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.hidden = true;
  document.body.append(toggle);

  let thirdPerson = false;
  let raise = 0;
  let focus = 0;
  const phoneOverlay = document.getElementById('phone');
  const screenElement = phoneOverlay.querySelector('.phone-device');
  const touch = new THREE.Vector2();
  const thumbOffset = new THREE.Vector2();
  let heldPointer = null;
  function followPointer(event) {
    const rect = screenElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    touch.set(
      THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0.58, 1),
      THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height, 0.48, 0.92)
    );
  }
  phoneOverlay.addEventListener('pointerdown', (event) => {
    if (!screenElement.contains(event.target) || heldPointer !== null) return;
    heldPointer = event.pointerId;
    followPointer(event);
  });
  window.addEventListener('pointermove', (event) => {
    if (event.pointerId === heldPointer) followPointer(event);
  });
  function releasePointer(event) {
    if (event.pointerId === heldPointer) heldPointer = null;
  }
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  let stride = 0;
  let swing = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const dark = new THREE.Color(0x070b10);
  const lit = new THREE.Color(0x408b9e);
  const canUseThird = () => !mode.driving() && !mode.sitting() && !mode.busy();
  function switchView() {
    if (!mode.started() || mode.uiBlocked() || !canUseThird()) return;
    thirdPerson = !thirdPerson;
    toggle.setAttribute('aria-pressed', String(thirdPerson));
  }
  toggle.addEventListener('click', switchView);
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyV' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    switchView();
  });

  function setHudVisible(show) {
    toggle.hidden = !(show && canUseThird());
  }

  function update(delta, moved, minutes) {
    const open = mode.menu('phone');
    const target = open ? 1 : 0;
    const closing = !open && focus > 0;
    if (closing) focus = Math.max(0, focus - delta / 0.36);
    const step = reducedMotion.matches ? 1 : delta / (open ? RAISE_SECONDS : 0.52);
    if (!closing || reducedMotion.matches) raise += Math.sign(target - raise) * Math.min(Math.abs(target - raise), step);
    if (open && raise >= 1) focus = reducedMotion.matches ? 1 : Math.min(1, focus + delta / FOCUS_SECONDS);
    if (!open && reducedMotion.matches) focus = 0;
    const pose = THREE.MathUtils.smoothstep(raise, 0, 1);
    const glow = THREE.MathUtils.smoothstep(raise, 0.65, 1);
    if (!open) heldPointer = null;
    const pressing = heldPointer !== null && !reducedMotion.matches;
    const settle = 1 - Math.exp(-24 * delta);
    thumbOffset.x = THREE.MathUtils.lerp(thumbOffset.x, pressing ? (touch.x - 1) * SCREEN_WIDTH : 0, settle);
    thumbOffset.y = THREE.MathUtils.lerp(thumbOffset.y, pressing ? (0.78 - touch.y) * SCREEN_HEIGHT : 0, settle);
    for (const poseThumb of poseThumbs) poseThumb(thumbOffset.x, thumbOffset.y, pressing);
    if (raise > 0) phoneHand.pose(thumbOffset.x, thumbOffset.y, pressing);
    const evening = THREE.MathUtils.smoothstep(minutes, 18 * 60, 20 * 60);
    const morning = 1 - THREE.MathUtils.smoothstep(minutes, 5 * 60, 7 * 60);
    gripMaterial.color.copy(arm.material.color);
    gripMaterial.emissiveIntensity = glow * (evening + morning) * 0.42;
    phoneHand.setSkin(arm.material.color.getHex(), gripMaterial.emissiveIntensity);
    const walk = canUseThird() && !open && moved > 0.001;
    if (walk) stride += moved * 6;
    swing = THREE.MathUtils.lerp(swing, walk ? 0.38 : 0, 1 - Math.exp(-15 * delta));
    const stepAngle = Math.sin(stride) * swing;
    playerBody.legs[0].rotation.x = stepAngle;
    playerBody.legs[1].rotation.x = -stepAngle;
    arm.shoulder.rotation.x = 0.79 * pose + stepAngle * 0.65 * (1 - pose);
    arm.elbow.rotation.x = 1.38 * pose;
    wrist.rotation.set(-2.28 * pose, 0.14 * pose, -0.08 * pose);
    playerBody.updateRig(delta, walk ? moved : 0, pose, wrist, pressing ? 1 : 0);
    first.phone.position.set(0.21 - 0.105 * pose, -0.42 + 0.28 * pose, -0.42);
    first.phone.rotation.set(0.5 * (1 - pose), 0.16, -0.2 * (1 - pose));
    first.phone.scale.setScalar(1);
    if (focus > 0 || open) {
      const verticalFov = THREE.MathUtils.degToRad(camera.getEffectiveFOV());
      const focalPixels = window.innerHeight / (2 * Math.tan(verticalFov / 2));
      const focusedScale = 1.14;
      const maxVisibleHeight = SCREEN_HEIGHT * focusedScale * focalPixels / (camera.near + 0.025);
      const height = Math.min(window.innerHeight * 0.91, window.innerWidth * 0.90 * SCREEN_HEIGHT / SCREEN_WIDTH, 740, maxVisibleHeight);
      const width = height * SCREEN_WIDTH / SCREEN_HEIGHT;
      const depth = focusedScale * (SCREEN_HEIGHT * focalPixels / height + 0.006);
      const zoom = THREE.MathUtils.smoothstep(focus, 0, 1);
      first.phone.scale.setScalar(THREE.MathUtils.lerp(1, focusedScale, zoom));
      first.phone.position.x *= 1 - zoom;
      first.phone.position.y *= 1 - zoom;
      first.phone.position.z = THREE.MathUtils.lerp(-0.42, -depth, zoom);
      first.phone.rotation.y *= 1 - zoom;
      const visible = open && focus >= 1;
      phoneOverlay.classList.toggle('is-focused', visible);
      if (visible) {
        phoneOverlay.style.setProperty('--phone-screen-width', width + 'px');
        phoneOverlay.style.setProperty('--phone-screen-height', height + 'px');
      }
    }
    // Put the thumb over the interactive screen while preserving its touch target.
    if (open && focus >= 1 && (pressing || thumbOffset.lengthSq() > 0.000001)) {
      phoneOverlay.style.setProperty('--phone-thumb-x', (1 + thumbOffset.x / SCREEN_WIDTH) * 100 + '%');
      phoneOverlay.style.setProperty('--phone-thumb-y', (0.78 - thumbOffset.y / SCREEN_HEIGHT) * 100 + '%');
      phoneOverlay.style.setProperty('--phone-thumb-tint', '#' + gripMaterial.color.getHexString());
      phoneOverlay.classList.add('is-thumb-active');
    } else {
      phoneOverlay.classList.remove('is-thumb-active');
    }
    first.screen.material.color.copy(dark).lerp(lit, glow * (1 - focus));
    third.screen.material.color.copy(dark).lerp(lit, glow);
  }

  function draw(render) {
    eye.copy(camera.position);
    orientation.copy(camera.quaternion);
    const oldLayers = camera.layers.mask;
    const actionsVisible = actionRig?.visible;
    let inThird = false;

    if (thirdPerson && focus < 1 && mode.started() && canUseThird()) {
      const yaw = playerBody.group.rotation.y;
      offset.set(Math.sin(yaw) * 2.45 + Math.cos(yaw) * 0.54, 0.53,
        Math.cos(yaw) * 2.45 - Math.sin(yaw) * 0.54);
      const world = scene.userData.colliders;
      let clear = 0;
      for (let i = 1; i <= 18; i++) {
        const t = i / 18;
        if (world?.overlaps(eye.x + offset.x * t, eye.z + offset.z * t, 0.18)) break;
        clear = t;
      }
      if (clear >= 0.3) {
        inThird = true;
        aim.set(0, 0, -4).applyQuaternion(orientation).add(eye);
        camera.position.addScaledVector(offset, clear * (1 - THREE.MathUtils.smoothstep(focus, 0, 1)));
        camera.lookAt(aim);
        if (focus < 0.75) camera.layers.enable(HIDDEN_FROM_FP_LAYER);
      }
    }
    const isThirdActive = inThird && focus < 0.75;
    first.phone.visible = raise > 0 && (!inThird || focus >= 0.75);
    third.phone.visible = raise > 0 && isThirdActive;
    const usingRig = playerBody.showRig(true, { firstPerson: !isThirdActive });
    const mount = (usingRig && isThirdActive) ? playerBody.rigSocket : wrist;
    if (third.phone.parent !== mount) mount.add(third.phone);
    third.phone.position.set(usingRig && isThirdActive ? -0.024 : 0, usingRig && isThirdActive ? 0.089 : 0.049, usingRig && isThirdActive ? 0.018 : 0);
    fallbackGrip.visible = !(usingRig && isThirdActive);
    if (actionRig && (inThird || raise > 0)) actionRig.visible = false;

    try {
      render();
    } finally {
      playerBody.showRig(true, { firstPerson: true });
      if (actionRig) actionRig.visible = actionsVisible;
      camera.position.copy(eye);
      camera.quaternion.copy(orientation);
      camera.layers.mask = oldLayers;
      camera.updateMatrixWorld();
    }
  }

  function capture(render, source, { yaw = 0, pitch = 0, zoom = 1, filter = 'none' } = {}) {
    const firstVisible = first.phone.visible;
    const thirdVisible = third.phone.visible;
    const actionsVisible = actionRig?.visible;
    const saved = camera.quaternion.clone();
    const savedFov = camera.fov;
    const look = new THREE.Euler().setFromQuaternion(saved, 'YXZ');
    look.y += yaw;
    look.x = THREE.MathUtils.clamp(look.x + pitch, -1.45, 1.45);
    first.phone.visible = third.phone.visible = false;
    if (actionRig) actionRig.visible = false;
    camera.quaternion.setFromEuler(look);
    const z = Math.max(1, Math.min(2.5, Number(zoom) || 1));
    if (z !== 1) {
      camera.fov = savedFov / z;
      camera.updateProjectionMatrix();
    }
    try {
      render();
      const photo = document.createElement('canvas');
      const scale = Math.min(1, 560 / Math.max(source.width, source.height));
      photo.width = Math.max(1, Math.round(source.width * scale));
      photo.height = Math.max(1, Math.round(source.height * scale));
      const pctx = photo.getContext('2d');
      if (filter && filter !== 'none' && 'filter' in pctx) pctx.filter = filter;
      pctx.drawImage(source, 0, 0, photo.width, photo.height);
      return photo.toDataURL('image/jpeg', 0.80);
    } finally {
      if (camera.fov !== savedFov) {
        camera.fov = savedFov;
        camera.updateProjectionMatrix();
      }
      camera.quaternion.copy(saved);
      camera.updateMatrixWorld();
      if (actionRig) actionRig.visible = actionsVisible;
      first.phone.visible = firstVisible;
      third.phone.visible = thirdVisible;
    }
  }

  return { update, draw, capture, setHudVisible };
}
