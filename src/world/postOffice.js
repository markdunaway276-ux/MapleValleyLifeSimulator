import * as THREE from 'three';
import { createHingedDoor } from '../systems/doors.js';
import { SURFACE_Y } from './street.js';

/**
 * Maple Lane Post Office — a brick civic building on the east-south frontage
 * (past the Laundromat, facing +Z toward Maple Lane), with a walkable interior:
 * brass PO box wall, full service counter with scales & sneeze-guards, visible
 * back-room mail sorting cubbies & parcel shelves, customer writing desk,
 * bulletin board, blue curbside collection box, and flagpole.
 */
export const POST_OFFICE = Object.freeze({
  x: 48.0,
  frontZ: -6.0,
  width: 11.6,
  depth: 7.6,
  height: 3.45
});

const HALF_W = POST_OFFICE.width / 2;
const DEPTH = POST_OFFICE.depth;
const HEIGHT = POST_OFFICE.height;
const HALF_DOOR = 0.82;
const DOOR_RECESS = 0.62;

function createBrickMaterial(quality) {
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({ color: 0x8a4838, roughness: 0.9, metalness: 0 });
  }
  const size = quality?.shadows ? 512 : 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const b = document.createElement('canvas');
  b.width = b.height = size;
  const bctx = b.getContext('2d');

  // Mortar bed.
  ctx.fillStyle = '#aba396';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#202020';
  bctx.fillRect(0, 0, size, size);

  const rows = 12;
  const cols = 6;
  const rowH = size / rows;
  const colW = size / cols;
  const mortar = Math.max(2, Math.round(size / 140));
  const palette = ['#8f4b3a', '#7e4032', '#9c5643', '#854535', '#763b2f', '#95503f'];
  let seed = 4129;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * colW + offset;
      const y = r * rowH;
      const tone = palette[Math.floor(rand() * palette.length)];
      ctx.fillStyle = tone;
      ctx.fillRect(x + mortar, y + mortar, colW - mortar * 2, rowH - mortar * 2);
      // Subtle kiln variation across each brick face.
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,220,190,0.08)' : 'rgba(25,12,8,0.12)';
      ctx.fillRect(x + mortar, y + mortar, colW - mortar * 2, (rowH - mortar * 2) * 0.45);
      const lum = Math.round(180 + rand() * 55);
      bctx.fillStyle = `rgb(${lum},${lum},${lum})`;
      bctx.fillRect(x + mortar, y + mortar, colW - mortar * 2, rowH - mortar * 2);
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4.5, 1.8);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = quality?.shadows ? 4 : 2;

  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4.5, 1.8);

  return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.032, roughness: 0.88, metalness: 0 });
}

function createTerrazzoMaterial(quality) {
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.58, metalness: 0.04 });
  }
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ccc6b8';
  ctx.fillRect(0, 0, size, size);
  // Tile grout lines (2x2 tiles per repeat).
  ctx.strokeStyle = '#a9a294';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
  ctx.stroke();

  let seed = 8841;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const flecks = ['#8f877b', '#dcd7cb', '#686259', '#b59d84', '#7a8a92'];
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = flecks[Math.floor(rand() * flecks.length)];
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3.5, 2 + rand() * 3.5);
  }
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 4);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = quality?.shadows ? 4 : 2;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.05 });
}

function makeSignMesh(lines, width, height, { bg = '#1b314d', border = '#d2b47c', fg = '#f4f0e4', fontScale = 0.72 } = {}) {
  if (typeof document === 'undefined') {
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x1b314d }));
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(128, Math.round(1024 * height / width));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const list = Array.isArray(lines) ? lines : [lines];
  const rowH = canvas.height / (list.length + 0.5);
  ctx.font = `bold ${Math.round(rowH * fontScale)}px Georgia, serif`;
  list.forEach((line, idx) => {
    ctx.fillText(line, 512, canvas.height / 2 + (idx - (list.length - 1) / 2) * rowH, 940);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map }));
}

function makeBulletinBoard(width, height) {
  if (typeof document === 'undefined') {
    return new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.04), new THREE.MeshStandardMaterial({ color: 0x9b744c }));
  }
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9b7349';
  ctx.fillRect(0, 0, 512, 320);
  // Cork texture speckles.
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(65,42,22,0.18)' : 'rgba(220,185,140,0.15)';
    ctx.fillRect((i * 73) % 512, (i * 131) % 320, 3, 3);
  }
  // Pinned flyers & notices.
  const flyers = [
    { x: 24, y: 24, w: 120, h: 125, bg: '#f5efe0', head: '#203b5c', title: 'POSTAL RATES' },
    { x: 168, y: 20, w: 145, h: 135, bg: '#fff4cc', head: '#8f3024', title: 'TOWN NOTICE' },
    { x: 336, y: 30, w: 150, h: 118, bg: '#e6f0eb', head: '#245240', title: 'ROUTE 9 MAIL' },
    { x: 40, y: 168, w: 145, h: 120, bg: '#f2e8dc', head: '#3d352e', title: 'LOST CAT' },
    { x: 215, y: 175, w: 130, h: 112, bg: '#e8eef7', head: '#1d3557', title: 'PO BOXES' },
    { x: 368, y: 166, w: 118, h: 124, bg: '#fae5d8', head: '#7a3322', title: 'YARD SALE' }
  ];
  for (const f of flyers) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(f.x + 3, f.y + 4, f.w, f.h);
    ctx.fillStyle = f.bg;
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = f.head;
    ctx.fillRect(f.x, f.y, f.w, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.title, f.x + f.w / 2, f.y + 15);
    ctx.fillStyle = '#555';
    for (let l = 0; l < 5; l++) {
      ctx.fillRect(f.x + 10, f.y + 34 + l * 14, f.w - 20 - (l % 2) * 18, 5);
    }
    // Red pushpin.
    ctx.fillStyle = '#c8332b';
    ctx.beginPath();
    ctx.arc(f.x + f.w / 2, f.y + 7, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map, roughness: 0.9 })
  );
}

export function buildPostOffice(scene, quality) {
  const data = scene.userData;
  const cast = !!quality?.shadows;
  const root = new THREE.Group();
  root.name = 'maple-lane-post-office';
  // Local +Z faces the street (Maple Lane), local -Z goes deeper into the building.
  root.position.set(POST_OFFICE.x, 0, POST_OFFICE.frontZ);
  scene.add(root);
  data.postOffice = root;

  const brickMat = createBrickMaterial(quality);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc9c0ae, roughness: 0.86, metalness: 0 });
  const navyMetal = new THREE.MeshStandardMaterial({ color: 0x1e3552, roughness: 0.34, metalness: 0.48 });
  const brushedSteel = new THREE.MeshStandardMaterial({ color: 0xaab4bc, roughness: 0.28, metalness: 0.78 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.30, metalness: 0.74 });
  const darkOak = new THREE.MeshStandardMaterial({ color: 0x5c3e26, roughness: 0.74, metalness: 0.04 });
  const counterTopMat = new THREE.MeshStandardMaterial({ color: 0xd9d3c6, roughness: 0.44, metalness: 0.06 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.92, metalness: 0 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xebe8df, roughness: 0.94, metalness: 0 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9ab8c8, transparent: true, opacity: 0.26, roughness: 0.16, metalness: 0.12,
    side: THREE.DoubleSide, depthWrite: false
  });
  const terrazzoMat = createTerrazzoMaterial(quality);

  function addBox(mat, w, h, d, x, y, z, { rx = 0, ry = 0, rz = 0, collide = false, id = null } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = cast;
    m.receiveShadow = cast;
    root.add(m);
    if (collide && data.colliders) {
      data.colliders.addHouse({
        id: 'post-office-' + (id || Math.round(x * 10) + '-' + Math.round(z * 10)),
        x: POST_OFFICE.x + x,
        z: POST_OFFICE.frontZ + z,
        width: w,
        depth: d,
        rotY: 0
      });
    }
    return m;
  }

  // --- Front entry apron connecting seamlessly to the south sidewalk (z = -4.65) ---
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(POST_OFFICE.width + 1.2, 0.08, 1.85),
    new THREE.MeshStandardMaterial({ color: 0xb6afa0, roughness: 0.92 })
  );
  apron.position.set(0, 0.04, 0.72);
  apron.receiveShadow = cast;
  root.add(apron);

  // --- Interior terrazzo floor & acoustic ceiling ---
  const floor = new THREE.Mesh(new THREE.BoxGeometry(POST_OFFICE.width - 0.3, 0.09, DEPTH - 0.3), terrazzoMat);
  floor.position.set(0, 0.045, -DEPTH / 2);
  floor.receiveShadow = cast;
  root.add(floor);
  addBox(ceilingMat, POST_OFFICE.width - 0.2, 0.16, DEPTH - 0.2, 0, HEIGHT - 0.08, -DEPTH / 2);
  // Roof parapet & stepped stone cornice so the silhouette reads as classic civic architecture.
  addBox(brickMat, POST_OFFICE.width + 0.16, 0.56, DEPTH + 0.16, 0, HEIGHT + 0.28, -DEPTH / 2);
  addBox(stoneMat, POST_OFFICE.width + 0.36, 0.14, DEPTH + 0.36, 0, HEIGHT + 0.58, -DEPTH / 2);
  addBox(stoneMat, POST_OFFICE.width + 0.26, 0.10, DEPTH + 0.26, 0, HEIGHT + 0.04, -DEPTH / 2);

  // --- Exterior Brick Walls (West, East, Back) + Interior Plaster Liners ---
  addBox(brickMat, 0.26, HEIGHT, DEPTH, -HALF_W + 0.13, HEIGHT / 2, -DEPTH / 2, { collide: true, id: 'west' });
  addBox(brickMat, 0.26, HEIGHT, DEPTH, HALF_W - 0.13, HEIGHT / 2, -DEPTH / 2, { collide: true, id: 'east' });
  addBox(brickMat, POST_OFFICE.width, HEIGHT, 0.26, 0, HEIGHT / 2, -DEPTH + 0.13, { collide: true, id: 'back' });
  // Interior plaster liners so inside walls are bright warm civic plaster.
  addBox(plasterMat, 0.04, HEIGHT - 0.1, DEPTH - 0.36, -HALF_W + 0.28, HEIGHT / 2, -DEPTH / 2);
  addBox(plasterMat, 0.04, HEIGHT - 0.1, DEPTH - 0.36, HALF_W - 0.28, HEIGHT / 2, -DEPTH / 2);
  addBox(plasterMat, POST_OFFICE.width - 0.56, HEIGHT - 0.1, 0.04, 0, HEIGHT / 2, -DEPTH + 0.28);

  // Limestone foundation plinth around sides.
  addBox(stoneMat, 0.32, 0.52, DEPTH + 0.06, -HALF_W + 0.12, 0.26, -DEPTH / 2);
  addBox(stoneMat, 0.32, 0.52, DEPTH + 0.06, HALF_W - 0.12, 0.26, -DEPTH / 2);

  // --- Front Facade: Recessed Glazed Entrance + Storefront Windows + Stone Pilasters ---
  for (const side of [-1, 1]) {
    const segW = HALF_W - HALF_DOOR - 0.12;
    const cx = side * (HALF_DOOR + 0.12 + segW / 2);
    // Lower brick knee wall + limestone window sill.
    addBox(brickMat, segW, 0.88, 0.26, cx, 0.44, -0.13, { collide: true, id: 'front-' + side });
    addBox(stoneMat, segW + 0.1, 0.10, 0.36, cx, 0.90, -0.11);
    // Upper brick transom frieze above the storefront windows.
    addBox(brickMat, segW, 0.95, 0.26, cx, HEIGHT - 0.475, -0.13);
    // Stone pilasters framing the building corners and entrance.
    addBox(stoneMat, 0.38, HEIGHT, 0.34, side * (HALF_W - 0.16), HEIGHT / 2, -0.12);
    addBox(stoneMat, 0.32, HEIGHT, 0.32, side * (HALF_DOOR + 0.22), HEIGHT / 2, -0.12);
    // Brushed aluminum window mullions & reflective glass pane.
    const winW = segW - 0.72;
    const winH = 1.54;
    const winY = 0.95 + winH / 2;
    addBox(navyMetal, winW + 0.08, 0.07, 0.12, cx, 0.96, -0.12);
    addBox(navyMetal, winW + 0.08, 0.07, 0.12, cx, 2.48, -0.12);
    for (const mOff of [-winW / 2, -winW / 6, winW / 6, winW / 2]) {
      addBox(navyMetal, 0.055, winH, 0.10, cx + mOff, winY, -0.12);
    }
    addBox(navyMetal, winW, 0.045, 0.08, cx, winY + 0.32, -0.12);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
    pane.position.set(cx, winY, -0.12);
    root.add(pane);
    // Recessed entry return walls.
    addBox(navyMetal, 0.14, 2.55, DOOR_RECESS, side * (HALF_DOOR + 0.07), 1.275, -DOOR_RECESS / 2, { collide: true, id: 'return-' + side });
  }
  // Entrance lintel & navy metal canopy with steel tie-rods.
  addBox(brickMat, HALF_DOOR * 2 + 0.3, 0.92, 0.28, 0, HEIGHT - 0.46, -0.14);
  addBox(navyMetal, HALF_DOOR * 2 + 0.12, 0.14, DOOR_RECESS + 0.1, 0, 2.48, -DOOR_RECESS / 2);
  addBox(navyMetal, 5.4, 0.16, 1.15, 0, 2.72, 0.48);
  addBox(brushedSteel, 5.44, 0.04, 0.05, 0, 2.66, 1.05);
  for (const side of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.25, 8), brushedSteel);
    rod.position.set(side * 2.35, 3.08, 0.50);
    rod.rotation.x = 0.85;
    root.add(rod);
  }

  // Main civic header sign + hours plaque.
  const mainSign = makeSignMesh(['MAPLE LANE POST OFFICE', 'U.S. MAIL  ·  ZIP 97402'], 6.4, 0.72, { fontScale: 0.68 });
  mainSign.position.set(0, 3.22, 0.05);
  root.add(mainSign);
  const hoursSign = makeSignMesh(['POST OFFICE HOURS', 'MON–SAT  8 AM – 5 PM'], 0.68, 0.34, { fontScale: 0.66 });
  hoursSign.position.set(-1.35, 1.62, 0.055);
  root.add(hoursSign);

  // --- Walkable Hinged Glass Entrance Door ---
  const door = createHingedDoor({
    width: HALF_DOOR * 2, height: 2.36, glazed: true, color: 0x1e3552,
    shadows: cast, id: 'post-office-door'
  });
  door.position.set(-HALF_DOOR, 0.08, -DOOR_RECESS);
  root.add(door);
  data.doors?.push(door);
  if (data.colliders) {
    const gate = data.colliders.addHouse({
      id: 'post-office-doorway',
      x: POST_OFFICE.x,
      z: POST_OFFICE.frontZ - DOOR_RECESS,
      width: HALF_DOOR * 2,
      depth: 0.22
    });
    Object.defineProperty(gate, 'disabled', {
      get: () => door.userData.open || Math.abs(door.rotation.y) > 0.05
    });
  }

  // --- Classic Curved-Top Blue Curbside Collection Box (Interactable!) ---
  const blueBox = new THREE.Group();
  blueBox.name = 'post-office-collection-box';
  blueBox.position.set(-3.75, 0.08, 0.86);
  const boxBlue = new THREE.MeshStandardMaterial({ color: 0x1b457a, roughness: 0.36, metalness: 0.42 });
  const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.82, 0.56), boxBlue);
  boxBody.position.y = 0.62;
  boxBody.castShadow = boxBody.receiveShadow = cast;
  const boxDome = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.56, 14, 1, false, 0, Math.PI), boxBlue);
  boxDome.rotation.z = Math.PI / 2;
  boxDome.position.y = 1.03;
  boxDome.castShadow = cast;
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.10), brushedSteel);
  chute.position.set(0, 0.94, 0.29);
  chute.rotation.x = -0.25;
  blueBox.add(boxBody, boxDome, chute);
  for (const sx of [-0.22, 0.22]) {
    for (const sz of [-0.22, 0.22]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), boxBlue);
      leg.position.set(sx, 0.12, sz);
      blueBox.add(leg);
    }
  }
  root.add(blueBox);
  if (data.colliders) {
    data.colliders.addHouse({ id: 'post-office-bluebox', x: POST_OFFICE.x - 3.75, z: POST_OFFICE.frontZ + 0.86, width: 0.62, depth: 0.62 });
  }
  blueBox.userData.interactLocal = new THREE.Vector3(0, 1.0, 0.32);
  blueBox.userData.getPrompt = (isMobile) => (isMobile ? 'Tap to check mail drop box' : 'Press E to check mail drop box');
  blueBox.userData.interact = (ctx) => {
    ctx?.toast?.('Blue Collection Box — Daily pickup at 4:30 PM. Drop outgoing letters here.');
    ctx?.sfx?.play?.('click');
    return 'press';
  };
  data.interactables?.push({ id: 'post-office-dropbox', kind: 'mailbox', object: blueBox, range: 2.0 });

  // --- Brushed-Steel Flagpole & Planter ---
  addBox(brickMat, 1.05, 0.34, 1.05, 4.75, 0.17, 0.82, { collide: true, id: 'flag-planter' });
  addBox(stoneMat, 1.15, 0.06, 1.15, 4.75, 0.36, 0.82);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 5.2, 10), brushedSteel);
  pole.position.set(4.75, 2.95, 0.82);
  pole.castShadow = cast;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), brassMat);
  finial.position.set(4.75, 5.58, 0.82);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.68, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x264b75, roughness: 0.8 })
  );
  flag.position.set(4.75 + 0.58, 5.05, 0.82);
  const flagStripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.18, 0.022),
    new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.78 })
  );
  flagStripe.position.set(4.75 + 0.58, 5.05, 0.82);
  root.add(pole, finial, flag, flagStripe);

  // --- INTERIOR 1: Full Wall of 48 Brass PO Boxes (West Wall) ---
  addBox(darkOak, 0.42, 2.48, 4.45, -HALF_W + 0.50, 1.28, -3.55, { collide: true, id: 'po-box-wall' });
  const boxDoorGeo = new THREE.BoxGeometry(0.03, 0.22, 0.38);
  const dialGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.025, 8);
  const poDoors = new THREE.InstancedMesh(boxDoorGeo, brassMat, 48);
  const poDials = new THREE.InstancedMesh(dialGeo, navyMetal, 48);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const py = 0.52 + row * 0.27;
      const pz = -5.05 + col * 0.44;
      dummy.position.set(-HALF_W + 0.72, py, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poDoors.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(-HALF_W + 0.74, py, pz + 0.10);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.updateMatrix();
      poDials.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
  }
  poDoors.instanceMatrix.needsUpdate = true;
  poDials.instanceMatrix.needsUpdate = true;
  root.add(poDoors, poDials);
  const poSign = makeSignMesh('P.O. BOXES  1 – 48', 2.4, 0.28, { fontScale: 0.65 });
  poSign.position.set(-HALF_W + 0.73, 2.34, -3.55);
  poSign.rotation.y = Math.PI / 2;
  root.add(poSign);

  // Interactable PO Box #14 (Kyle's / Your unclaimed postal rebate).
  const poBox14 = new THREE.Object3D();
  poBox14.name = 'post-office-pobox-14';
  poBox14.position.set(-HALF_W + 0.78, 1.35, -3.55);
  root.add(poBox14);
  let rebateClaimed = false;
  poBox14.userData.getPrompt = (isMobile) => (isMobile ? 'Tap to check PO Box #14' : 'Press E to check PO Box #14');
  poBox14.userData.interact = (ctx) => {
    if (!rebateClaimed) {
      rebateClaimed = true;
      ctx?.money?.add?.(12, { category: 'Mail', label: 'PO Box #14 postal rebate' });
      ctx?.toast?.('Checked PO Box #14 — found an unclaimed $12 postal money order!');
      ctx?.sfx?.play?.('cash');
      return 'pickUp';
    }
    ctx?.toast?.('PO Box #14 is empty. Check back after new mail arrives.');
    ctx?.sfx?.play?.('click');
    return 'press';
  };
  data.interactables?.push({
    id: 'post-office-pobox14',
    kind: 'mailbox',
    object: poBox14,
    range: 1.9,
    getPoint: () => ({ x: POST_OFFICE.x - HALF_W + 0.78, y: 1.35, z: POST_OFFICE.frontZ - 3.55 })
  });

  // --- INTERIOR 2: Main Service Counter, Scales, Sneeze-Guards & POS Monitors ---
  const counterZ = -4.55;
  addBox(darkOak, 6.2, 1.02, 0.76, 0.65, 0.55, counterZ, { collide: true, id: 'counter' });
  addBox(counterTopMat, 6.32, 0.07, 0.88, 0.65, 1.09, counterZ);
  // Two teller stations: glass sneeze-guards, digital postal scales, monitors.
  const lcdMat = new THREE.MeshStandardMaterial({ color: 0x3bd47a, emissive: 0x1d8a4b, emissiveIntensity: 0.7 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x26384d, emissive: 0x1b3a5c, emissiveIntensity: 0.45 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.55 });
  for (const tx of [-0.95, 1.75]) {
    // Glass teller shield + brushed steel posts.
    const guard = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 0.025), glassMat);
    guard.position.set(tx, 1.56, counterZ + 0.34);
    root.add(guard);
    for (const px of [-0.75, 0.75]) {
      addBox(brushedSteel, 0.035, 0.82, 0.035, tx + px, 1.52, counterZ + 0.34);
    }
    // Digital parcel scale.
    addBox(brushedSteel, 0.44, 0.05, 0.40, tx - 0.38, 1.15, counterZ + 0.08);
    addBox(darkPlastic, 0.22, 0.06, 0.12, tx - 0.38, 1.18, counterZ - 0.16);
    addBox(lcdMat, 0.14, 0.03, 0.02, tx - 0.38, 1.19, counterZ - 0.09);
    // Clerk POS monitor + keyboard.
    addBox(darkPlastic, 0.46, 0.32, 0.05, tx + 0.32, 1.38, counterZ - 0.18);
    addBox(screenMat, 0.41, 0.26, 0.02, tx + 0.32, 1.38, counterZ - 0.21);
    addBox(darkPlastic, 0.08, 0.16, 0.08, tx + 0.32, 1.18, counterZ - 0.18);
  }
  // Hanging overhead department signs above the counter.
  for (const [sx, label] of [[-0.95, 'STAMPS & MAIL'], [1.75, 'PARCEL PICKUP']]) {
    const hang = makeSignMesh(label, 1.9, 0.34, { fontScale: 0.64 });
    hang.position.set(sx, 2.68, counterZ + 0.1);
    root.add(hang);
    for (const rx of [-0.75, 0.75]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.65, 6), brushedSteel);
      wire.position.set(sx + rx, 3.10, counterZ + 0.1);
      root.add(wire);
    }
  }

  // --- INTERIOR 3: Back-Room Sorting Cubbies, Parcel Shelves & Mail Hampers ---
  addBox(darkOak, 3.2, 1.65, 0.44, -0.8, 1.72, -DEPTH + 0.56);
  // Pigeonhole grid dividers + envelopes inside.
  const envMat = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.85 });
  for (let c = 0; c <= 6; c++) addBox(darkOak, 0.03, 1.55, 0.42, -2.35 + c * 0.51, 1.72, -DEPTH + 0.56);
  for (let r = 0; r <= 4; r++) addBox(darkOak, 3.15, 0.03, 0.42, -0.8, 0.94 + r * 0.38, -DEPTH + 0.56);
  for (let i = 0; i < 14; i++) {
    addBox(envMat, 0.22, 0.12, 0.16, -2.08 + (i % 6) * 0.51, 1.06 + Math.floor(i / 6) * 0.38, -DEPTH + 0.62);
  }
  // Steel parcel shelving on back-east wall loaded with cardboard shipping boxes & blue totes.
  addBox(brushedSteel, 2.4, 2.1, 0.55, 2.8, 1.10, -DEPTH + 0.62);
  const cardA = new THREE.MeshStandardMaterial({ color: 0xb78b59, roughness: 0.9 });
  const cardB = new THREE.MeshStandardMaterial({ color: 0x9f7548, roughness: 0.92 });
  const toteMat = new THREE.MeshStandardMaterial({ color: 0x265896, roughness: 0.45 });
  const parcelBoxes = [
    [2.05, 0.45, 0.42, 0.32, 0.38, cardA],
    [2.65, 0.42, 0.38, 0.28, 0.36, cardB],
    [3.35, 0.48, 0.48, 0.38, 0.40, toteMat],
    [2.15, 1.15, 0.50, 0.34, 0.38, cardB],
    [2.85, 1.12, 0.38, 0.30, 0.36, cardA],
    [3.45, 1.16, 0.44, 0.34, 0.36, cardA],
    [2.45, 1.82, 0.46, 0.32, 0.36, toteMat],
    [3.20, 1.82, 0.42, 0.30, 0.36, cardB]
  ];
  for (const [bx, by, bw, bh, bd, mat] of parcelBoxes) {
    addBox(mat, bw, bh, bd, bx, by, -DEPTH + 0.66);
  }

  // --- INTERIOR 4: East Lobby Customer Writing Desk & Community Bulletin Board ---
  addBox(darkOak, 0.62, 0.96, 1.85, HALF_W - 0.68, 0.52, -2.55, { collide: true, id: 'writing-desk' });
  addBox(counterTopMat, 0.68, 0.05, 1.92, HALF_W - 0.68, 1.02, -2.55);
  // Stacks of shipping forms & priority envelopes on the writing desk.
  addBox(envMat, 0.24, 0.04, 0.30, HALF_W - 0.68, 1.07, -2.15);
  addBox(new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.6 }), 0.26, 0.03, 0.34, HALF_W - 0.68, 1.06, -2.85);
  // Community cork bulletin board on the east wall above the writing desk.
  addBox(darkOak, 0.06, 1.12, 1.72, HALF_W - 0.34, 1.90, -2.55);
  const cork = makeBulletinBoard(1.62, 1.02);
  cork.position.set(HALF_W - 0.375, 1.90, -2.55);
  cork.rotation.y = -Math.PI / 2;
  root.add(cork);

  // --- Warm Ceiling Fluorescent Troffer Panels & Interior Lighting ---
  const trofferMat = new THREE.MeshStandardMaterial({
    color: 0xf7f2e4, emissive: 0xfff0d4, emissiveIntensity: 0.85, roughness: 0.3
  });
  for (const [lx, lz] of [[-2.0, -2.4], [2.0, -2.4], [0, -5.2]]) {
    addBox(trofferMat, 1.35, 0.05, 0.55, lx, HEIGHT - 0.16, lz);
  }
  if (quality?.shadows) {
    const l1 = new THREE.PointLight(0xffeed0, 14, 11, 1.8);
    l1.position.set(0, HEIGHT - 0.45, -2.5);
    const l2 = new THREE.PointLight(0xffeed0, 12, 10, 1.8);
    l2.position.set(0.5, HEIGHT - 0.45, -5.4);
    root.add(l1, l2);
  }

  return root;
}
