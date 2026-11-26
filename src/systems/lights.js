/**
 * Interior wall-switch: a small plate just inside the main house's front
 * door that toggles the interior lamps. Registered from main.js (like Cook
 * and the chairs) so older highlighter counts stay stable.
 */
import * as THREE from 'three';
import { lightSwitchPose } from '../world/interior.js';
import { isInteriorLightsOn, setInteriorLightsOn } from '../world/daynight.js';
import { PROPS } from '../world/palette.js';
import { bevelBox } from '../world/shapes.js';

export { lightSwitchPose, isInteriorLightsOn, setInteriorLightsOn };

const PLATE_W = 0.08;
const PLATE_H = 0.12;
const PLATE_D = 0.02;
const PADDLE_W = 0.025;
const PADDLE_H = 0.05;
const PADDLE_D = 0.018;

function verb(on) {
  return on ? 'turn lights off' : 'turn lights on';
}

export function lightSwitchPrompt(on, isMobile) {
  const v = verb(!!on);
  return isMobile ? ('Tap to ' + v) : ('Press E to ' + v);
}

function applyPaddle(paddle, on) {
  if (!paddle) return;
  // On: paddle tipped up; off: tipped down.
  paddle.rotation.x = on ? -0.28 : 0.28;
}

export function createLightSwitch({ on = true } = {}) {
  const group = new THREE.Group();
  group.name = 'light-switch';

  const plateMat = new THREE.MeshLambertMaterial({ color: PROPS.switchPlate });
  const plate = new THREE.Mesh(bevelBox(PLATE_W, PLATE_H, PLATE_D, { max: 0.008 }), plateMat);
  plate.name = 'light-switch-plate';
  plate.castShadow = false;
  plate.receiveShadow = false;
  // Plate sits on the inward (-z) face of the front wall, facing into the room.
  plate.position.set(0, 0, 0);
  group.add(plate);

  const paddleMat = new THREE.MeshLambertMaterial({ color: PROPS.switchPaddle });
  const paddle = new THREE.Mesh(bevelBox(PADDLE_W, PADDLE_H, PADDLE_D, { max: 0.006 }), paddleMat);
  paddle.name = 'light-switch-paddle';
  paddle.castShadow = false;
  paddle.receiveShadow = false;
  paddle.position.set(0, 0, PLATE_D / 2 + PADDLE_D / 2 - 0.002);
  group.add(paddle);
  applyPaddle(paddle, on);

  group.userData.kind = 'light-switch';
  group.userData.id = 'light-switch';
  group.userData.isLightSwitch = true;
  group.userData.highlightMesh = plate;
  group.userData.paddle = paddle;
  group.userData.interactLocal = new THREE.Vector3(0, 0, 0.08);
  group.userData.getPrompt = (isMobile) => {
    const sc = group.userData.scene || (group.parent && group.parent.parent) || null;
    const lights = sc && sc.userData && sc.userData.interiorLights;
    const isOn = lights && typeof lights.isOn === 'function' ? lights.isOn() : isInteriorLightsOn(sc);
    return lightSwitchPrompt(isOn, isMobile);
  };
  group.userData.setPaddle = (value) => applyPaddle(paddle, value);
  group.userData.interact = (ctx = {}) => {
    const sc = ctx.scene || (group.parent && group.parent.parent) || null;
    const api = ctx.lights || (sc && sc.userData && sc.userData.interiorLights);
    let next;
    if (api && typeof api.toggle === 'function') next = api.toggle();
    else {
      next = !isInteriorLightsOn(sc);
      setInteriorLightsOn(sc, next);
      if (ctx.dayNight && typeof ctx.dayNight.refresh === 'function') ctx.dayNight.refresh();
      else if (ctx.dayNight && typeof ctx.dayNight.apply === 'function' && ctx.getTime) ctx.dayNight.apply(ctx.getTime());
    }
    applyPaddle(paddle, next);
    const sfx = ctx.sfx;
    if (sfx && typeof sfx.play === 'function') sfx.play('click');
    if (typeof ctx.save === 'function') ctx.save();
    return next;
  };
  return group;
}

/** Attach the wall switch to scene.userData.interactables once the interior exists. */
export function registerLightSwitchInteractable(scene) {
  if (!scene || !scene.userData) return null;
  const sw = scene.userData.lightSwitch;
  if (!sw) return null;
  const list = scene.userData.interactables || (scene.userData.interactables = []);
  if (!list.some((e) => e && (e.id === 'light-switch' || e.object === sw))) {
    list.push({ id: 'light-switch', kind: 'light-switch', object: sw });
  }
  return sw;
}

/**
 * On/off state for the interior lamps. daynight.js reads
 * scene.userData.interiorLightsOn each time it applies a sample.
 */
export function createInteriorLights({
  scene,
  dayNight = null,
  getTime = null,
  save = null
} = {}) {
  let on = isInteriorLightsOn(scene);

  function syncPaddle() {
    const sw = scene && scene.userData && scene.userData.lightSwitch;
    if (sw && sw.userData && typeof sw.userData.setPaddle === 'function') sw.userData.setPaddle(on);
  }

  function refresh() {
    setInteriorLightsOn(scene, on);
    syncPaddle();
    if (dayNight) {
      if (typeof dayNight.refresh === 'function' && dayNight.lastSample) dayNight.refresh();
      else if (typeof dayNight.apply === 'function' && typeof getTime === 'function') dayNight.apply(getTime());
    }
    return on;
  }

  function isOn() { return on; }

  function setOn(value) {
    on = !!value;
    refresh();
    return on;
  }

  function toggle() {
    return setOn(!on);
  }

  function serialize() {
    return { on };
  }

  function apply(data) {
    if (data == null) return refresh();
    if (typeof data === 'boolean') on = data;
    else if (typeof data.on === 'boolean') on = data.on;
    else if (data.interiorLights != null) {
      const raw = data.interiorLights;
      on = typeof raw === 'boolean' ? raw : !!(raw && raw.on);
    }
    return refresh();
  }

  const api = { isOn, setOn, toggle, serialize, apply, refresh };
  if (scene) {
    if (!scene.userData) scene.userData = {};
    scene.userData.interiorLights = api;
  }
  refresh();
  return api;
}
