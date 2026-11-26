/**
 * Small front-room TV: a stand-and-set prop facing the sofa, a generic
 * on/off interactable, a cheap animated screen, a desktop-only glow, and
 * a quiet looping tune. Registered from main.js (like Cook and the wall
 * switch) so older highlighter counts stay stable.
 */
import * as THREE from 'three';
import { TV_CENTER, TV_SIZE, TV_INTERACT, TV_COLLIDER, TV_YAW } from '../world/interior.js';

export { TV_CENTER, TV_SIZE, TV_INTERACT, TV_COLLIDER, TV_YAW };

export const TV_SCREEN_W = 48;
export const TV_SCREEN_H = 32;
/** Screen / flicker updates this often so the TV stays cheap on a phone. */
export const TV_UPDATE_HZ = 8;
export const TV_UPDATE_INTERVAL = 1 / TV_UPDATE_HZ;

const OFF_COLOR = 0x0b0c10;
const SCREEN_W = 0.62;
const SCREEN_H = 0.34;

export function tvPrompt(on, isMobile) {
  const v = on ? 'turn TV off' : 'turn TV on';
  return isMobile ? ('Tap to ' + v) : ('Press E to ' + v);
}

export function tvCollider(object) {
  const c = TV_COLLIDER;
  return { id: 'main-int-tv', minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, object };
}

function makeScreenCanvas() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = TV_SCREEN_W;
    canvas.height = TV_SCREEN_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
  } catch {
    return null;
  }
}

function paintScreen(ctx, canvas, t, on) {
  if (!ctx || !canvas) return;
  const w = canvas.width, h = canvas.height;
  if (!on) {
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // Cheap "broadcast": three shifting colour bars plus a soft flicker.
  const flicker = 0.85 + 0.15 * Math.sin(t * 7.2) + 0.05 * Math.sin(t * 23);
  const shift = (t * 18) % w;
  const bars = ['#3a6dd8', '#d4c24a', '#d45a4a', '#3cba7a'];
  const bw = w / bars.length;
  for (let i = 0; i < bars.length; i++) {
    ctx.fillStyle = bars[i];
    const x = ((i * bw + shift) % w);
    ctx.fillRect(x, 0, bw + 1, h);
    if (x + bw > w) ctx.fillRect(0, 0, (x + bw) - w, h);
  }
  ctx.fillStyle = 'rgba(255,255,255,' + (0.08 * flicker).toFixed(3) + ')';
  ctx.fillRect(0, 0, w, h);
  // A moving "scan" band so the texture clearly animates even at low res.
  const y = ((t * 22) % (h + 6)) - 3;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, y, w, 3);
}

export function createTv({ on = false, shadows = false } = {}) {
  const group = new THREE.Group();
  group.name = 'tv';
  group.rotation.y = TV_YAW;

  const standMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.2), standMat);
  stand.name = 'tv-stand';
  stand.position.set(0, 0.21, 0);
  stand.castShadow = false;
  stand.receiveShadow = false;
  group.add(stand);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), standMat);
  neck.position.set(0, 0.48, 0);
  neck.castShadow = false;
  neck.receiveShadow = false;
  group.add(neck);

  const body = new THREE.Mesh(new THREE.BoxGeometry(TV_SIZE.width, 0.4, 0.08), bodyMat);
  body.name = 'tv-body';
  body.position.set(0, 0.7, 0);
  body.castShadow = false;
  body.receiveShadow = false;
  group.add(body);

  const surface = makeScreenCanvas();
  let tex = null;
  if (surface) {
    paintScreen(surface.ctx, surface.canvas, 0, on);
    tex = new THREE.CanvasTexture(surface.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
  }
  const screenMat = new THREE.MeshBasicMaterial({
    color: on ? 0xffffff : OFF_COLOR,
    map: on && tex ? tex : null
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W, SCREEN_H, 0.012), screenMat);
  screen.name = 'tv-screen';
  screen.position.set(0, 0.7, 0.046);
  screen.castShadow = false;
  screen.receiveShadow = false;
  group.add(screen);

  let glow = null;
  if (shadows) {
    glow = new THREE.PointLight(0x8fb4ff, 0, 3.4, 2);
    glow.name = 'tv-light';
    glow.castShadow = false;
    glow.position.set(0, 0.7, 0.35);
    group.add(glow);
  }

  let lit = !!on;
  let acc = TV_UPDATE_INTERVAL;
  let clock = 0;

  function paint(force) {
    clock += 0;
    if (surface) paintScreen(surface.ctx, surface.canvas, clock, lit);
    if (tex) {
      tex.needsUpdate = true;
      screenMat.map = lit ? tex : null;
    }
    if (lit) {
      const flick = 0.88 + 0.12 * Math.sin(clock * 7.2);
      const hue = (clock * 0.07) % 1;
      const col = new THREE.Color().setHSL(0.55 + 0.15 * Math.sin(clock * 0.9), 0.45, 0.55 * flick);
      screenMat.color.copy(col);
      if (glow) {
        glow.color.copy(col);
        glow.intensity = 0.55 * flick;
        glow.visible = true;
      }
    } else {
      screenMat.color.setHex(OFF_COLOR);
      if (glow) {
        glow.intensity = 0;
        glow.visible = false;
      }
    }
    void force;
  }

  function setOn(value) {
    lit = !!value;
    acc = TV_UPDATE_INTERVAL;
    paint(true);
    return lit;
  }

  function update(delta) {
    if (!lit) return;
    const dt = Math.max(0, Number(delta) || 0);
    clock += dt;
    acc += dt;
    if (acc < TV_UPDATE_INTERVAL) return;
    acc = 0;
    paint();
  }

  paint(true);

  group.userData.kind = 'tv';
  group.userData.id = 'tv';
  group.userData.isTv = true;
  group.userData.highlightMesh = body;
  group.userData.screen = screen;
  group.userData.glow = glow;
  group.userData.canvas = surface && surface.canvas;
  // Local +z is the screen front; after yaw -90° that faces the sofa (-x).
  group.userData.interactLocal = new THREE.Vector3(0, TV_INTERACT.y - TV_CENTER.y, 0.22);
  group.userData.getPrompt = (isMobile) => {
    const sc = group.userData.scene || (group.parent && group.parent.parent) || null;
    const api = sc && sc.userData && sc.userData.tvSet;
    const isOn = api && typeof api.isOn === 'function' ? api.isOn() : lit;
    return tvPrompt(isOn, isMobile);
  };
  group.userData.setOn = setOn;
  group.userData.updateScreen = update;
  group.userData.isScreenOn = () => lit;
  group.userData.interact = (ctx = {}) => {
    const sc = ctx.scene || group.userData.scene || (group.parent && group.parent.parent) || null;
    const api = ctx.tv || (sc && sc.userData && sc.userData.tvSet);
    let next;
    if (api && typeof api.toggle === 'function') next = api.toggle();
    else next = setOn(!lit);
    if (typeof ctx.save === 'function') ctx.save();
    return next;
  };
  return group;
}

/** Attach the TV to scene.userData.interactables once the interior exists. */
export function registerTvInteractable(scene) {
  if (!scene || !scene.userData) return null;
  const tv = scene.userData.tv;
  if (!tv) return null;
  const list = scene.userData.interactables || (scene.userData.interactables = []);
  if (!list.some((e) => e && (e.id === 'tv' || e.object === tv))) {
    list.push({ id: 'tv', kind: 'tv', object: tv });
  }
  return tv;
}

/**
 * On/off state for the front-room TV. The looping tune lives on sfx.setTv.
 */
export function createTvSet({
  scene,
  sfx = null,
  save = null,
  getPosition = null
} = {}) {
  let on = !!(scene && scene.userData && scene.userData.tvOn);

  function source() {
    return scene && scene.userData && scene.userData.tv;
  }

  function applyVisual() {
    const obj = source();
    if (obj && obj.userData && typeof obj.userData.setOn === 'function') obj.userData.setOn(on);
    if (scene && scene.userData) scene.userData.tvOn = on;
  }

  function applySound(opts = {}) {
    if (!sfx || typeof sfx.setTv !== 'function') return;
    const pos = opts.position || (typeof getPosition === 'function' ? getPosition() : null);
    sfx.setTv(on, {
      x: TV_CENTER.x,
      z: TV_CENTER.z,
      listenerX: pos && pos.x,
      listenerZ: pos && pos.z,
      indoor: opts.indoor
    });
  }

  function refresh(opts = {}) {
    applyVisual();
    applySound(opts);
    return on;
  }

  function isOn() { return on; }

  function setOn(value, opts = {}) {
    on = !!value;
    refresh(opts);
    return on;
  }

  function toggle(opts = {}) {
    return setOn(!on, opts);
  }

  function update(delta, opts = {}) {
    const obj = source();
    if (obj && obj.userData && typeof obj.userData.updateScreen === 'function') {
      obj.userData.updateScreen(delta);
    }
    applySound(opts);
  }

  function serialize() {
    return { on };
  }

  function apply(data) {
    if (data == null) return refresh();
    if (typeof data === 'boolean') on = data;
    else if (typeof data.on === 'boolean') on = data.on;
    else if (data.tv != null) {
      const raw = data.tv;
      on = typeof raw === 'boolean' ? raw : !!(raw && raw.on);
    }
    return refresh();
  }

  const api = { isOn, setOn, toggle, update, serialize, apply, refresh };
  if (scene) {
    if (!scene.userData) scene.userData = {};
    scene.userData.tvSet = api;
    scene.userData.tvOn = on;
  }
  refresh();
  return api;
}
