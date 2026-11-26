import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Maple Lane Trailer Park — three mobile homes from Elbolilloduro's
 * "Trailer Park" scene (CC0) on a gravel lot at the west end of the street.
 * The model is baked with its long side along z, the porch on -x and the
 * street end at +z. Homes are exterior only (the floor sits 0.8 m up), but
 * you can knock on each door.
 */
const URL = './assets/models/trailer.glb';
const FRONT_Z = -6.3;          // street end of each trailer lines up with the laundromat
const HALF_LENGTH = 7.6;
export const TRAILERS = [
  { id: 'trailer-1', x: -26.5, siding: 0xffffff, name: 'Rosa' },
  { id: 'trailer-2', x: -34.5, siding: 0xd9e4e6, name: 'Walt' },
  { id: 'trailer-3', x: -42.5, siding: 0xeadfc4, name: 'the Tran family' }
];
const LOT = { minX: -47.5, maxX: -22.6, minZ: -22.5, maxZ: -4.75 };

const KNOCK_LINES = [
  (n) => `Nobody answers. ${n} must be out.`,
  (n) => `"Just a minute!" — ${n} sounds busy.`,
  (n) => `A dog barks inside. No sign of ${n}.`
];

function gravelTexture(quality) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8b8273';
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = 95 + Math.floor(rnd() * 90);
    ctx.fillStyle = `rgb(${v + 8},${v + 2},${v - 8})`;
    const r = 0.6 + rnd() * 1.6;
    ctx.fillRect(rnd() * size, rnd() * size, r, r);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set((LOT.maxX - LOT.minX) / 4, (LOT.maxZ - LOT.minZ) / 4);
  tex.anisotropy = quality.shadows ? 4 : 1;
  return tex;
}

function signMesh() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#3c2a19';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = '#f1e4c6';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Maple Lane', 256, 44);
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('TRAILER PARK', 256, 92);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.48, 0.06),
    [0, 0, 0, 0, 1, 1].map((i) => i
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
      : new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 }))
  );
  board.position.y = 1.35;
  group.add(board);
  for (const x of [-0.8, 0.8]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 1.6, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 })
    );
    post.position.set(x, 0.8, 0);
    group.add(post);
  }
  return group;
}

export function buildTrailerPark(scene, quality) {
  const ud = scene.userData;
  const park = new THREE.Group();
  park.name = 'trailer-park';
  scene.add(park);
  ud.trailerPark = park;
  ud.mapBuildings = ud.mapBuildings || [];

  const gravel = new THREE.Mesh(
    new THREE.PlaneGeometry(LOT.maxX - LOT.minX, LOT.maxZ - LOT.minZ),
    new THREE.MeshStandardMaterial({ map: gravelTexture(quality), roughness: 0.97 })
  );
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set((LOT.minX + LOT.maxX) / 2, 0.006, (LOT.minZ + LOT.maxZ) / 2);
  gravel.receiveShadow = !!quality.shadows;
  park.add(gravel);

  const sign = signMesh();
  sign.position.set(-23.6, 0, -5.6);
  sign.rotation.y = 0;
  park.add(sign);
  ud.colliders.addHouse({ id: 'trailer-park-sign', minX: -24.5, maxX: -22.7, minZ: -5.7, maxZ: -5.5 });

  const cz = FRONT_Z - HALF_LENGTH;
  const slots = TRAILERS.map((t) => {
    const slot = new THREE.Group();
    slot.name = t.id;
    slot.position.set(t.x, 0, cz);
    park.add(slot);
    // Shell, then the porch and steps on the west side.
    ud.colliders.addHouse({ id: t.id, minX: t.x - 1.9, maxX: t.x + 1.9, minZ: cz - 7.6, maxZ: cz + 7.6 });
    ud.colliders.addHouse({ id: t.id + '-porch', minX: t.x - 4.1, maxX: t.x - 1.75, minZ: cz - 0.6, maxZ: cz + 4.0 });
    ud.mapBuildings.push({ id: t.id, minX: t.x - 1.9, maxX: t.x + 1.9, minZ: cz - 7.6, maxZ: cz + 7.6 });

    // Knock at the foot of the porch steps.
    let knocks = 0;
    const door = new THREE.Group();
    door.name = t.id + '-door';
    door.position.set(-2.9, 1.1, 4.5);
    door.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + 'knock';
    door.userData.action = 'knock';
    door.userData.interact = (ctx) => {
      ctx.sfx?.play?.('knock');
      const line = KNOCK_LINES[knocks++ % KNOCK_LINES.length](t.name);
      setTimeout(() => ctx.toast?.(line), 900);
      return true;
    };
    slot.add(door);
    ud.interactables.push({
      id: t.id + '-door', object: door, range: 1.3,
      getPoint: () => ({ x: t.x - 2.9, y: 1.1, z: cz + 4.5 })
    });
    return { slot, t };
  });

  new GLTFLoader().load(URL, (gltf) => {
    const base = gltf.scene;
    base.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !!quality.shadows && !(o.material && o.material.transparent);
      o.receiveShadow = !!quality.shadows;
      if (o.material) o.material.shadowSide = THREE.DoubleSide;
    });
    for (const { slot, t } of slots) {
      const home = base.clone(true);
      if (t.siding !== 0xffffff) {
        // A different siding colour per home; other materials stay shared.
        const tinted = new Map();
        home.traverse((o) => {
          if (!o.isMesh || !/^PlasterWhite/.test(o.material?.name || '')) return;
          if (!tinted.has(o.material)) {
            const m = o.material.clone();
            m.color.setHex(t.siding);
            tinted.set(o.material, m);
          }
          o.material = tinted.get(o.material);
        });
      }
      slot.add(home);
    }
  }, undefined, (err) => console.warn('Trailer model failed to load', err));

  return park;
}
