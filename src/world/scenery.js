import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { STREET, SURFACE_Y } from './street.js';
import { ROUTE_9, routeHalfWidth, routeDriveAreas } from './route9.js';
import { GROUND } from './palette.js';
import { useWorldGrit } from './surfaces.js';

const directory = './assets/models/scenery/';
let treeLibrary;
const windTime = { value: 0 };
const windStrength = { value: 0.035 };

// Roadside deer animation state (grazes peacefully, then lifts head & watches passing cars).
let deerState = null;

function updateDeer(delta, focusPos) {
  if (!deerState) return;
  const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
  deerState.time += dt;
  const { pivot, body, baseYaw } = deerState;

  let dist = Infinity;
  let targetYaw = baseYaw;
  if (focusPos) {
    const dx = focusPos.x - pivot.position.x;
    const dz = focusPos.z - pivot.position.z;
    dist = Math.hypot(dx, dz);
    if (dist < 32) {
      targetYaw = Math.atan2(dx, dz);
    }
  }

  // Alert when a car/player passes within 28 m; otherwise graze peacefully in cycles.
  const alertTarget = dist < 28 ? 1 : 0;
  deerState.alert += (alertTarget - deerState.alert) * Math.min(1, dt * (alertTarget ? 5.5 : 1.6));

  // Periodic grazing dip when calm: leans forward to eat grass, nibbles, then occasionally glances up.
  const cycle = Math.sin(deerState.time * 0.42);
  const wantGraze = THREE.MathUtils.smoothstep(cycle, -0.35, 0.35);
  const graze = wantGraze * (1 - deerState.alert);
  const nibble = graze > 0.45 ? Math.sin(deerState.time * 7.2) * 0.038 * graze : 0;
  const alertLift = -0.07 * deerState.alert;

  body.rotation.x = graze * 0.46 + nibble + alertLift;
  body.position.y = -graze * 0.09 + Math.sin(deerState.time * 2.1) * 0.006;

  // Smoothly turn toward the passing car when alerted, or back toward the road when calm.
  let diff = targetYaw - pivot.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  pivot.rotation.y += diff * Math.min(1, dt * (alertTarget ? 4.2 : 1.4));
}

function treeModels() {
  return treeLibrary ??= loadGltf(directory + 'trees.glb').then(({scene}) => {
    const materials = new Set();
    scene.traverse(o => {
      if (o.isMesh) for (const m of [o.material].flat()) materials.add(m);
    });
    for (const material of materials) {
      if (!material.alphaTest && !material.transparent) continue;
      material.onBeforeCompile = shader => {
        shader.uniforms.mapleWindTime = windTime;
        shader.uniforms.mapleWindStrength = windStrength;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float mapleWindTime;\nuniform float mapleWindStrength;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float phase = position.y * 0.35;
            #ifdef USE_INSTANCING
              phase += instanceMatrix[3].x * 0.27;
            #endif
            transformed.x += sin(mapleWindTime * 1.1 + phase) * mapleWindStrength * smoothstep(0.0, 7.0, position.y);`);
      };
    }
    return scene;
  });
}

export function updateScenery(delta, rain, focusPos = null) {
  windTime.value += delta;
  windStrength.value = 0.035 + rain * 0.035;
  updateDeer(delta, focusPos);
}

export function replaceTownTrees(trees, placements) {
  treeModels().then(model => {
    const kinds = ['shade-tree-large', 'pine-tall', 'leafy-small', 'sapling'];
    trees.forEach((tree, i) => {
      const placement = placements[i];
      const kind = placement.z < -13 || (placement.z > 24 && placement.x < 60) ? kinds[i % 2] : kinds[2 + i % 2];
      const source = model.getObjectByName(kind);
      if (!source) return;
      const replacement = source.clone();
      replacement.position.set(0, 0, 0);
      replacement.scale.setScalar((kind === kinds[0] ? 0.57 : kind === kinds[1] ? 0.73 : 0.68) * (placement.scale ?? 1));
      replacement.rotation.y = placement.seed * 2.4;
      replacement.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      for (const child of tree.children) child.visible = false;
      tree.add(replacement);
    });
  }).catch(() => {});
}

function addForest(root, quality) {
  const types = ['pine-tall', 'pine-slender', 'spruce-a', 'spruce-b', 'leafy-small', 'sapling'];
  let seed = 173;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const placements = new Map(types.map(name => [name, []]));
  const center = STREET.roadCenterZ;
  for (const side of [-1, 1]) for (let band = 0; band < (quality.shadows ? 3 : 2); band++) {
    for (let x = -298; x < -60; x += 4 + random() * 3) {
      if (side === -1 && x > -194 && x < -147) continue;
      const type = types[Math.floor(random() * (band ? 4 : types.length))];
      const placement = new THREE.Object3D();
      placement.position.set(x, 0, center + side * (routeHalfWidth(x) + 4 + random() * 3 + band * 7));
      placement.rotation.y = random() * Math.PI * 2;
      placement.scale.setScalar(0.6 + random() * 0.5);
      placement.updateMatrix();
      placements.get(type).push(placement.matrix.clone());
    }
  }
  treeModels().then(model => {
    model.updateMatrixWorld(true);
    for (const [name, locations] of placements) {
      const node = model.getObjectByName(name);
      if (!node || !locations.length) continue;
      const inverse = node.matrixWorld.clone().invert();
      node.traverse(part => {
        if (!part.isMesh) return;
        const offset = inverse.clone().multiply(part.matrixWorld);
        const batch = new THREE.InstancedMesh(part.geometry, part.material, locations.length);
        locations.forEach((matrix, i) => batch.setMatrixAt(i, matrix.clone().multiply(offset)));
        root.add(batch);
      });
    }
  }).catch(() => {});
}

function welcomeSign(root, z) {
  const wood = new THREE.MeshStandardMaterial({color: 0x694932});
  const board = new THREE.Group();
  board.position.set(-75, 0, z);
  board.rotation.y = -Math.PI / 2;
  for (const x of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), wood);
    post.position.set(x, 1.3, 0);
    board.add(post);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#324b39';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#e1c690';
  ctx.lineWidth = 5;
  ctx.strokeRect(13, 13, 486, 230);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e6c6';
  ctx.font = '28px Georgia';
  ctx.fillText('WELCOME TO', 256, 84);
  ctx.font = 'bold 65px Georgia';
  ctx.fillText('Maple Lane', 256, 156);
  ctx.font = '27px Georgia';
  ctx.fillText('Est. 1952', 256, 212);
  ctx.fillStyle = '#bd6844';
  ctx.beginPath();
  for (const [x,y] of [[256,25],[263,38],[275,33],[270,45],[280,49],[259,53],[256,63],[253,53],[232,49],[242,45],[237,33],[249,38]]) ctx.lineTo(x,y);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.65, 0.14), [
    wood, wood, wood, wood, new THREE.MeshStandardMaterial({map:texture}), wood
  ]);
  face.position.y = 2.07;
  board.add(face);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.13, 0.9), new THREE.MeshStandardMaterial({color:0x564132}));
  bed.position.y = 0.07;
  board.add(bed);
  const blooms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09), new THREE.MeshStandardMaterial({color:0xe1ad63}), 15);
  for (let i = 0; i < 15; i++) blooms.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-1.65 + i * 0.235, 0.19, 0.28 + Math.sin(i * 4) * 0.13));
  board.add(blooms);
  root.add(board);
}

export function buildApproachRoad(scene, quality) {
  const root = new THREE.Group();
  root.name = 'route-9';
  scene.add(root);
  const center = STREET.roadCenterZ;
  (scene.userData.driveAreas ??= []).push(...routeDriveAreas(center));

  // Match the town road's dark asphalt colour & gritty surface so Route 9 blends seamlessly.
  const townAsphaltHex = (GROUND.road[0] << 16) | (GROUND.road[1] << 8) | GROUND.road[2];
  const townLineHex = (GROUND.line[0] << 16) | (GROUND.line[1] << 8) | GROUND.line[2];

  function ribbon(name, color, edge, y, ranges, { roughness = 0.92, grit = 0.85 } = {}) {
    const vertices = [];
    for (const [a, b] of ranges) {
      const [l, r] = edge(a);
      const [m, n] = edge(b);
      vertices.push(a,y,center+l, a,y,center+r, b,y,center+m, b,y,center+m, a,y,center+r, b,y,center+n);
    }
    const geometry = new THREE.BufferGeometry();
    const colors = [];
    const base = new THREE.Color(color);
    const verge = new THREE.Color(0x4b5642);
    const tint = new THREE.Color();
    for (let i = 0; i < vertices.length; i += 3) {
      const fade = THREE.MathUtils.smoothstep(vertices[i], ROUTE_9.minX, ROUTE_9.minX + 14);
      tint.copy(verge).lerp(base,fade);
      colors.push(tint.r,tint.g,tint.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    const mat = useWorldGrit(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 }),
      { strength: grit, groundGrime: 0 }
    );
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.receiveShadow = quality.shadows;
    root.add(mesh);
  }
  const spans = [[ROUTE_9.minX, ROUTE_9.minX + 14], [ROUTE_9.minX + 14, ROUTE_9.taper], [ROUTE_9.taper, ROUTE_9.maxX]];
  const surface = SURFACE_Y.road;
  ribbon('gravel-shoulders', 0x625d53, x => [-routeHalfWidth(x)-0.85, routeHalfWidth(x)+0.85], surface-0.007, spans, { roughness: 0.96, grit: 1.05 });
  ribbon('country-asphalt', townAsphaltHex, x => [-routeHalfWidth(x), routeHalfWidth(x)], surface, spans, { roughness: 0.90, grit: 0.95 });
  for (const side of [-1,1]) ribbon('white-edge-lines', 0xbab8aa, x => {
    const edge = side*(routeHalfWidth(x)-0.29);
    return [edge-0.065,edge+0.065];
  }, surface+0.002, spans, { roughness: 0.92, grit: 0.7 });
  const dashes = [];
  for(let x = -297; x < -45; x += 7) dashes.push([x,Math.min(x+3,-44)]);
  ribbon('yellow-center-line', townLineHex, ()=>[-0.075,0.075], surface+0.002, dashes, { roughness: 0.92, grit: 0.7 });
  welcomeSign(root,center+8);
  addForest(root, quality);
  loadGltf(directory+'road-signs.glb').then(({scene:model})=>{
    for(const [name,x] of [['narrow-road',-260],['speed-limit',-230],['two-way',-200],['slow-down',-90],['pedestrian-ahead',-60]]) {
      const sign = model.getObjectByName(name)?.clone();
      if (!sign) continue;
      sign.position.set(x,0,center+routeHalfWidth(x)+3);
      sign.scale.setScalar(0.65);
      sign.rotation.y=-Math.PI/2;
      root.add(sign);
    }
  }).catch(()=>{});
  loadGltf(directory+'deer.glb').then(({scene:model})=>{
    const pivot = new THREE.Group();
    pivot.name = 'route9-deer';
    pivot.position.set(-170, 0, center + 10.5);
    pivot.rotation.y = Math.PI;
    const body = new THREE.Group();
    model.scale.setScalar(1.6);
    body.add(model);
    pivot.add(body);
    root.add(pivot);
    deerState = { pivot, body, baseYaw: Math.PI, time: 0.9, alert: 0 };
  }).catch(()=>{});
  loadGltf(directory+'kenney-fence-wide.glb').then(({scene:model})=>{
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const step = Math.max(size.x, size.z, 1);
    for(let x=-192;x<-150;x+=step) {
      const fence=model.clone();
      fence.position.set(x,0,center-11);
      if(size.z>size.x) fence.rotation.y=Math.PI/2;
      root.add(fence);
    }
  }).catch(()=>{});
}
