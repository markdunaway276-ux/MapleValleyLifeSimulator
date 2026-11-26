import * as THREE from 'three';
import { bevelBox } from '../world/shapes.js';
import { HIDDEN_FROM_FP_LAYER } from '../world/playerBody.js';

const RAISE_SECONDS = 0.42;
const FOCUS_SECONDS = 0.28;
const SCREEN_HEIGHT = 0.145;
const SCREEN_WIDTH = 0.072;

function makeHandset() {
  const phone = new THREE.Group();
  const shell = new THREE.Mesh(bevelBox(0.081, 0.157, 0.011, { radius: 0.004 }),
    new THREE.MeshStandardMaterial({ color: 0x262d33, metalness: 0.35, roughness: 0.38 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x070b10 }));
  screen.position.z = 0.006;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.003, 10),
    new THREE.MeshBasicMaterial({ color: 0x080b10 }));
  lens.position.set(0, 0.062, 0.0062);
  const rearCamera = new THREE.Mesh(bevelBox(0.024, 0.026, 0.004),
    new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 0.4 }));
  rearCamera.position.set(-0.021, 0.054, -0.006);
  phone.add(shell, screen, lens, rearCamera);
  return { phone, screen };
}

export function createPresentation({ camera, scene, mode, playerBody }) {
  const arm = playerBody.arm;
  const first = makeHandset();
  const third = makeHandset();
  const grip = new THREE.Mesh(bevelBox(0.042, 0.10, 0.044), arm.material);
  grip.position.set(0.035, -0.069, -0.013);
  first.phone.add(grip);
  camera.add(first.phone);

  // The handset stays attached to the wrist throughout the raise.
  const wrist = new THREE.Group();
  wrist.position.set(0.012, -0.057, 0.018);
  arm.hand.add(wrist);
  third.phone.position.y = 0.054;
  wrist.add(third.phone);

  const style = document.createElement('style');
  style.textContent = `
#hud-camera-view {
  position: absolute; z-index: 45; right: max(12px, env(safe-area-inset-right));
  top: calc(max(12px, env(safe-area-inset-top)) + 208px);
  width: 44px; height: 44px; border-radius: 8px; color: #fff;
  background: rgba(0, 0, 0, 0.65); border: 1px solid rgba(255, 255, 255, 0.35);
  font: 600 13px system-ui, sans-serif; touch-action: manipulation; cursor: pointer;
}
#hud-camera-view[aria-pressed="true"] { background: #34534d; }
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

  function update(delta, moved) {
    toggle.hidden = !mode.started() || mode.uiBlocked() || !canUseThird();
    const open = mode.menu('phone');
    const target = open ? 1 : 0;
    const closing = !open && focus > 0;
    if (closing) focus = Math.max(0, focus - delta / FOCUS_SECONDS);
    const step = reducedMotion.matches ? 1 : delta / RAISE_SECONDS;
    if (!closing || reducedMotion.matches) raise += Math.sign(target - raise) * Math.min(Math.abs(target - raise), step);
    if (open && raise >= 1) focus = reducedMotion.matches ? 1 : Math.min(1, focus + delta / FOCUS_SECONDS);
    if (!open && reducedMotion.matches) focus = 0;
    const pose = THREE.MathUtils.smoothstep(raise, 0, 1);
    const glow = THREE.MathUtils.smoothstep(raise, 0.65, 1);
    const walk = canUseThird() && !open && moved > 0.001;
    if (walk) stride += moved * 6;
    swing = THREE.MathUtils.lerp(swing, walk ? 0.38 : 0, 1 - Math.exp(-15 * delta));
    const stepAngle = Math.sin(stride) * swing;
    playerBody.legs[0].rotation.x = stepAngle;
    playerBody.legs[1].rotation.x = -stepAngle;
    arm.shoulder.rotation.x = 0.79 * pose + stepAngle * 0.65 * (1 - pose);
    arm.elbow.rotation.x = 1.38 * pose;
    wrist.rotation.x = -2.28 * pose;
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
    first.screen.material.color.copy(dark).lerp(lit, glow * (1 - focus));
    third.screen.material.color.copy(dark).lerp(lit, glow);
  }

  function draw(render) {
    eye.copy(camera.position);
    orientation.copy(camera.quaternion);
    const oldLayers = camera.layers.mask;
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
    first.phone.visible = raise > 0 && (!inThird || focus >= 0.75);
    third.phone.visible = raise > 0 && inThird && focus < 0.75;

    try {
      render();
    } finally {
      camera.position.copy(eye);
      camera.quaternion.copy(orientation);
      camera.layers.mask = oldLayers;
      camera.updateMatrixWorld();
    }
  }

  return { update, draw };
}
