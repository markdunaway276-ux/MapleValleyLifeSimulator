import * as THREE from 'three';
import { KENNEY_INNER } from './interior.js';

/**
 * Framed Gallery Photos mounted on the player's house walls.
 *
 * Players can hang any photo from their Phone Gallery via the Gallery app's
 * "Hang at home" button, or walk up to any wall frame indoors and press E / tap
 * to cycle through their saved photos.
 */

export const FRAME_SLOTS = Object.freeze([
  {
    id: 'living',
    label: 'Living Room',
    x: -2.15,
    y: 1.62,
    z: KENNEY_INNER.front - 0.04,
    rotY: Math.PI
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    x: KENNEY_INNER.east - 0.04,
    y: 1.58,
    z: -12.35,
    rotY: -Math.PI / 2
  },
  {
    id: 'bedroom',
    label: 'Bedroom',
    x: KENNEY_INNER.west + 0.04,
    y: 1.60,
    z: -12.55,
    rotY: Math.PI / 2
  }
]);

function makeEmptyMatTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 176;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#e8e2d5';
  ctx.fillRect(0, 0, 256, 176);
  ctx.strokeStyle = '#c5bba8';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 228, 148);
  ctx.fillStyle = '#8b8170';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Empty Photo Frame', 128, 82);
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillText('Hang a photo from Phone Gallery', 128, 104);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadPhotoTexture(dataUrl, onLoad) {
  if (typeof Image === 'undefined' || !dataUrl) return;
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    onLoad(tex);
  };
  img.src = dataUrl;
}

export function createFramedPhotos({
  scene = null,
  shadows = false,
  saved = null,
  getPhotos = () => [],
  sfx = null,
  toast = () => {},
  save = () => {}
} = {}) {
  const assignments = { living: null, kitchen: null, bedroom: null };
  if (saved && typeof saved === 'object') {
    for (const slot of FRAME_SLOTS) {
      if (typeof saved[slot.id] === 'string' && saved[slot.id]) {
        assignments[slot.id] = saved[slot.id];
      }
    }
  }

  const root = new THREE.Group();
  root.name = 'home-photo-frames';
  const emptyTex = makeEmptyMatTexture();
  const views = new Map();
  const cast = !!shadows;

  if (scene) {
    if (!scene.userData.interactables) scene.userData.interactables = [];
  }

  for (const slot of FRAME_SLOTS) {
    const group = new THREE.Group();
    group.name = `photo-frame-${slot.id}`;
    group.position.set(slot.x, slot.y, slot.z);
    group.rotation.y = slot.rotY;

    const border = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.54, 0.036),
      new THREE.MeshStandardMaterial({ color: 0x4e3624, roughness: 0.72 })
    );
    border.castShadow = cast;
    border.receiveShadow = cast;

    const matBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xf0eadc, roughness: 0.88 })
    );
    matBoard.position.z = 0.019;

    const photoMat = new THREE.MeshStandardMaterial({
      map: emptyTex,
      color: 0xffffff,
      roughness: 0.72
    });
    const photoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.38), photoMat);
    photoPlane.position.z = 0.022;

    group.add(border, matBoard, photoPlane);
    group.userData.kind = 'photo-frame';
    group.userData.id = `photo-frame-${slot.id}`;
    group.userData.frameSlot = slot.id;
    group.userData.interactLocal = new THREE.Vector3(0, 0, 0.04);
    group.userData.getPrompt = (isMobile) => {
      const prefix = isMobile ? 'Tap to ' : 'Press E to ';
      return assignments[slot.id]
        ? `${prefix}swap ${slot.label} photo`
        : `${prefix}hang photo (${slot.label})`;
    };
    group.userData.interact = () => cycleFrame(slot.id);

    root.add(group);
    views.set(slot.id, { group, photoMat, activeTex: null, renderedId: null });

    if (scene) {
      scene.userData.interactables = scene.userData.interactables.filter((e) => e.id !== group.userData.id);
      scene.userData.interactables.push({
        id: group.userData.id,
        kind: 'photo-frame',
        object: group,
        range: 2.35
      });
    }
  }

  if (scene) {
    scene.add(root);
    scene.userData.framedPhotos = root;
  }

  function findPhoto(photoId) {
    if (!photoId) return null;
    const list = getPhotos() || [];
    return list.find((p) => p && p.id === photoId) || null;
  }

  function refreshSlot(slotId) {
    const view = views.get(slotId);
    if (!view) return;
    const photoId = assignments[slotId];
    if (view.renderedId === photoId) return;
    view.renderedId = photoId;

    const photo = findPhoto(photoId);
    if (!photo || !photo.image) {
      if (view.activeTex) { view.activeTex.dispose(); view.activeTex = null; }
      view.photoMat.map = emptyTex;
      view.photoMat.needsUpdate = true;
      return;
    }

    loadPhotoTexture(photo.image, (tex) => {
      if (assignments[slotId] !== photoId) { tex.dispose(); return; }
      if (view.activeTex) view.activeTex.dispose();
      view.activeTex = tex;
      view.photoMat.map = tex;
      view.photoMat.needsUpdate = true;
    });
  }

  function refreshAll() {
    for (const slot of FRAME_SLOTS) refreshSlot(slot.id);
  }

  function hangPhoto(photoId, slotId = null) {
    if (!photoId) return null;
    let targetId = slotId;
    if (!targetId || !(targetId in assignments)) {
      const empty = FRAME_SLOTS.find((s) => !assignments[s.id]);
      targetId = empty ? empty.id : FRAME_SLOTS[0].id;
    }
    assignments[targetId] = photoId;
    refreshSlot(targetId);
    const slot = FRAME_SLOTS.find((s) => s.id === targetId);
    sfx?.play?.('pickup');
    toast(`Hung photo in ${slot ? slot.label : targetId} frame!`);
    save?.();
    return { slotId: targetId, label: slot ? slot.label : targetId };
  }

  function clearSlot(slotId) {
    if (!(slotId in assignments)) return false;
    assignments[slotId] = null;
    refreshSlot(slotId);
    save?.();
    return true;
  }

  function cycleFrame(slotId) {
    if (!(slotId in assignments)) return false;
    const photos = getPhotos() || [];
    if (!photos.length) {
      toast('Take a photo with your Phone Camera first to hang it here!');
      sfx?.play?.('click');
      return false;
    }
    const cur = assignments[slotId];
    const idx = cur ? photos.findIndex((p) => p && p.id === cur) : -1;
    const slot = FRAME_SLOTS.find((s) => s.id === slotId);
    if (idx === photos.length - 1) {
      assignments[slotId] = null;
      refreshSlot(slotId);
      sfx?.play?.('click');
      toast(`Cleared ${slot ? slot.label : slotId} frame.`);
      save?.();
      return true;
    }
    const next = photos[idx + 1] || photos[0];
    hangPhoto(next.id, slotId);
    return true;
  }

  function serialize() {
    return { ...assignments };
  }

  function apply(data) {
    const src = data?.framedPhotos;
    if (!src || typeof src !== 'object') return;
    for (const slot of FRAME_SLOTS) {
      assignments[slot.id] = typeof src[slot.id] === 'string' && src[slot.id] ? src[slot.id] : null;
    }
    refreshAll();
  }

  refreshAll();

  return {
    slots: FRAME_SLOTS,
    hangPhoto,
    clearSlot,
    cycleFrame,
    refreshAll,
    getAssignments: () => ({ ...assignments }),
    serialize,
    apply,
    group: root
  };
}
