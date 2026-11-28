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

// Roadside deer animation state — GPU shoulder-pivot skinning keeps all 4 legs
// planted while only the neck, head, and antlers bend to graze, chew, and watch cars.
const DEER_SCALE = 1.72 / 6.78;
const DEER_PIVOT = { x: 0.15, y: 2.75, z: 1.35 };
const DEER_MUZZLE = { x: 0.46, y: 4.50, z: 3.78 };
let deerState = null;
let openingDeerBeat = null;

export function setOpeningDeerBeat(at) {
  openingDeerBeat = (typeof at === 'number' && Number.isFinite(at)) ? at : null;
}

function applyDeerSkinShader(material, uniforms) {
  if (!material || material.userData?.deerSkinned) return;
  material.userData = { ...(material.userData || {}), deerSkinned: true };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDeerPitch = uniforms.uDeerPitch;
    shader.uniforms.uDeerHeadYaw = uniforms.uDeerHeadYaw;
    shader.uniforms.uDeerTime = uniforms.uDeerTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uDeerPitch;
        uniform float uDeerHeadYaw;
        uniform float uDeerTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // Smooth neck/head mask: 0 on legs & torso (stays planted), 1 on neck, head & antlers.
          float neckW = smoothstep(0.95, 2.05, transformed.z) * smoothstep(2.05, 3.15, transformed.y);
          // Subtle chest breathing on the ribcage.
          float chestW = smoothstep(1.85, 2.8, transformed.y) * (1.0 - smoothstep(0.6, 1.8, transformed.z)) * smoothstep(-0.9, 0.2, transformed.z);
          transformed.x *= 1.0 + sin(uDeerTime * 2.1) * 0.018 * chestW;
          if (neckW > 0.001) {
            vec3 dp = transformed - vec3(0.15, 2.75, 1.35);
            float ax = uDeerPitch * neckW;
            float cx = cos(ax);
            float sx = sin(ax);
            vec3 p1 = vec3(dp.x, dp.y * cx - dp.z * sx, dp.y * sx + dp.z * cx);
            float ay = uDeerHeadYaw * neckW;
            float cy = cos(ay);
            float sy = sin(ay);
            vec3 p2 = vec3(p1.x * cy + p1.z * sy, p1.y, -p1.x * sy + p1.z * cy);
            transformed = vec3(0.15, 2.75, 1.35) + p2;
          }
        }`);
  };
  material.customProgramCacheKey = () => 'maple-deer-skin-v1';
  material.needsUpdate = true;
}

function updateDeer(delta, focusPos) {
  if (!deerState) return;
  const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
  deerState.time += dt;
  const { pivot, baseYaw, mouthBlade, grassTuft, uniforms } = deerState;

  let dist = Infinity;
  let desiredHeadYaw = 0;
  if (focusPos) {
    const dx = focusPos.x - pivot.position.x;
    const dz = focusPos.z - pivot.position.z;
    dist = Math.hypot(dx, dz);
    if (dist < 36) {
      let rel = Math.atan2(dx, dz) - baseYaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      // Natural neck swivel limit (±65°).
      desiredHeadYaw = THREE.MathUtils.clamp(rel, -1.12, 1.12);
    }
  }

  let graze = 0;
  let nibble = 0;
  let chew = 0;
  let bladeAmt = 0;
  let alert = 0;

  if (openingDeerBeat != null && openingDeerBeat >= 14.0 && openingDeerBeat <= 24.5) {
    // Choreographed beat: deer bends down & grazes as the driver glances over (14.5..17),
    // then grabs a mouthful, lifts its head chewing during the hero focus shot (17..24).
    const t = openingDeerBeat;
    const bendDown = THREE.MathUtils.smoothstep(t, 14.3, 15.6);
    const liftUp = THREE.MathUtils.smoothstep(t, 19.2, 20.4);
    graze = bendDown * (1 - liftUp);
    const inGrass = THREE.MathUtils.smoothstep(t, 15.4, 15.9) * (1 - THREE.MathUtils.smoothstep(t, 19.0, 19.3));
    nibble = Math.sin((t - 15.5) * 10.5) * 0.055 * inGrass;
    const grabbed = THREE.MathUtils.smoothstep(t, 18.55, 18.85);
    const eaten = THREE.MathUtils.smoothstep(t, 20.9, 21.8);
    bladeAmt = grabbed * (1 - eaten);
    chew = Math.sin(t * 11.5) * 0.032 * bladeAmt * liftUp;
    alert = THREE.MathUtils.smoothstep(t, 19.9, 21.2);
  } else {
    const alertTarget = dist < 28 ? 1 : 0;
    deerState.alert += (alertTarget - deerState.alert) * Math.min(1, dt * (alertTarget ? 5.5 : 1.6));
    alert = deerState.alert;
    const cycle = Math.sin(deerState.time * 0.42);
    const wantGraze = THREE.MathUtils.smoothstep(cycle, -0.35, 0.35);
    graze = wantGraze * (1 - alert);
    nibble = graze > 0.45 ? Math.sin(deerState.time * 7.2) * 0.045 * graze : 0;
    const justLifted = THREE.MathUtils.smoothstep(cycle, -0.55, -0.25) * (1 - wantGraze) * (1 - alert);
    bladeAmt = justLifted;
    chew = Math.sin(deerState.time * 10.5) * 0.025 * bladeAmt;
  }

  // Positive pitch bends ONLY the neck & head downward toward the grass tuft (+1.22 rad ≈ 70°).
  const targetPitch = graze * 1.22 + nibble + chew - alert * 0.08;
  const targetHeadYaw = desiredHeadYaw * alert;
  deerState.pitch += (targetPitch - deerState.pitch) * Math.min(1, dt * 8.0);
  deerState.headYaw += (targetHeadYaw - deerState.headYaw) * Math.min(1, dt * 5.0);

  uniforms.uDeerPitch.value = deerState.pitch;
  uniforms.uDeerHeadYaw.value = deerState.headYaw;
  uniforms.uDeerTime.value = deerState.time;

  if (mouthBlade) {
    mouthBlade.visible = bladeAmt > 0.04;
    if (mouthBlade.visible) {
      // Track the exact vertex-skinned muzzle position in pivot-local space.
      const rx = DEER_MUZZLE.x - DEER_PIVOT.x;
      const ry = DEER_MUZZLE.y - DEER_PIVOT.y;
      const rz = DEER_MUZZLE.z - DEER_PIVOT.z;
      const cx = Math.cos(deerState.pitch), sx = Math.sin(deerState.pitch);
      const y1 = ry * cx - rz * sx;
      const z1 = ry * sx + rz * cx;
      const cy = Math.cos(deerState.headYaw), sy = Math.sin(deerState.headYaw);
      const x2 = rx * cy + z1 * sy;
      const z2 = -rx * sy + z1 * cy;
      mouthBlade.position.set(
        (DEER_PIVOT.x + x2) * DEER_SCALE + (deerState.muzzleOffsetX || 0),
        (DEER_PIVOT.y + y1) * DEER_SCALE,
        (DEER_PIVOT.z + z2) * DEER_SCALE + (deerState.muzzleOffsetZ || 0)
      );
      mouthBlade.scale.set(1, 0.45 + bladeAmt * 0.65, 1);
      mouthBlade.rotation.set(0.25 + Math.cos(deerState.time * 8.2) * 0.12, deerState.headYaw, Math.sin(deerState.time * 9.5) * 0.16);
    }
  }
  if (grassTuft) {
    const rustle = graze > 0.6 ? Math.sin(deerState.time * 13.0) * 0.09 * graze : Math.sin(deerState.time * 1.6) * 0.02;
    grassTuft.rotation.z = rustle;
  }
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
      if (side === 1 && band === 0 && x > -176 && x < -162) continue;
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

export function buildApproachRoad(scene, quality, roadMaterial = null) {
  const root = new THREE.Group();
  root.name = 'route-9';
  scene.add(root);
  const center = STREET.roadCenterZ;
  (scene.userData.driveAreas ??= []).push(...routeDriveAreas(center));

  // Match the town road's dark asphalt colour & gritty surface so Route 9 blends seamlessly.
  const townAsphaltHex = (GROUND.road[0] << 16) | (GROUND.road[1] << 8) | GROUND.road[2];

  function ribbon(name, color, edge, y, ranges, { roughness = 0.92, grit = 0.85, material = null } = {}) {
    const vertices = [];
    const uvs = [];
    for (const [a, b] of ranges) {
      const [l, r] = edge(a);
      const [m, n] = edge(b);
      vertices.push(a,y,center+l, a,y,center+r, b,y,center+m, b,y,center+m, a,y,center+r, b,y,center+n);
      // Match the town road's exact UV tiling phase at x = -44 (u = 0) so there is zero seam line.
      const ua = (a + 44) / STREET.length;
      const ub = (b + 44) / STREET.length;
      uvs.push(ua, 1, ua, 0, ub, 1, ub, 1, ua, 0, ub, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    let mat = material;
    if (!mat) {
      const colors = [];
      const base = new THREE.Color(color);
      const verge = new THREE.Color(0x4b5642);
      const tint = new THREE.Color();
      for (let i = 0; i < vertices.length; i += 3) {
        const fade = THREE.MathUtils.smoothstep(vertices[i], ROUTE_9.minX, ROUTE_9.minX + 14);
        tint.copy(verge).lerp(base, fade);
        colors.push(tint.r, tint.g, tint.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      mat = useWorldGrit(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 }),
        { strength: grit, groundGrime: 0 }
      );
    }
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.receiveShadow = quality.shadows;
    root.add(mesh);
  }
  const spans = [[ROUTE_9.minX, ROUTE_9.minX + 14], [ROUTE_9.minX + 14, ROUTE_9.taper], [ROUTE_9.taper, ROUTE_9.maxX]];
  const surface = SURFACE_Y.road;
  ribbon('gravel-shoulders', 0x625d53, x => [-routeHalfWidth(x)-0.85, routeHalfWidth(x)+0.85], surface-0.007, spans, { roughness: 0.96, grit: 1.05 });
  ribbon('country-asphalt', townAsphaltHex, x => [-routeHalfWidth(x), routeHalfWidth(x)], surface, spans, { roughness: 0.90, grit: 0.95, material: roadMaterial });
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
    const baseYaw = Math.PI * 0.78;
    pivot.rotation.y = baseYaw;

    const uniforms = {
      uDeerPitch: { value: 0 },
      uDeerHeadYaw: { value: 0 },
      uDeerTime: { value: 0 }
    };
    // Measure actual loaded bounds (accounting for Sketchfab root node scale & offset)
    // so the stag stands a lifelike 1.72 m tall with hooves planted squarely on y = 0.
    model.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(model);
    const rawH = Math.max(0.01, rawBox.max.y - rawBox.min.y);
    const modelScale = 1.72 / rawH;
    model.scale.setScalar(modelScale);
    model.position.set(
      -((rawBox.min.x + rawBox.max.x) / 2) * modelScale,
      -rawBox.min.y * modelScale,
      -((rawBox.min.z + rawBox.max.z) / 2) * modelScale
    );
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !!quality.shadows;
      o.receiveShadow = !!quality.shadows;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) applyDeerSkinShader(m, uniforms);
    });
    pivot.add(model);

    // Lush 3D grass tuft on the ground right where the deer's dipped muzzle grazes.
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x5c8338, roughness: 0.85, side: THREE.DoubleSide });
    const brightBladeMat = new THREE.MeshStandardMaterial({ color: 0x769f44, roughness: 0.82, side: THREE.DoubleSide });
    const grassTuft = new THREE.Group();
    grassTuft.name = 'deer-grass-tuft';
    grassTuft.position.set(0.08, 0, 0.72);
    for (let i = 0; i < 13; i++) {
      const angle = (i / 13) * Math.PI * 2 + (i % 2) * 0.2;
      const h = 0.26 + (i % 3) * 0.08;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.026, h, 4),
        i % 3 === 0 ? brightBladeMat : bladeMat
      );
      blade.position.set(Math.cos(angle) * 0.16, h * 0.45, Math.sin(angle) * 0.16);
      blade.rotation.set(Math.sin(angle) * 0.32, angle, -Math.cos(angle) * 0.32);
      grassTuft.add(blade);
    }
    pivot.add(grassTuft);

    // Visible grass sprig positioned dynamically at the vertex-skinned muzzle tip.
    const mouthBlade = new THREE.Group();
    mouthBlade.name = 'deer-mouth-blade';
    mouthBlade.visible = false;
    for (const [ox, rz, len] of [[-0.016, 0.26, 0.22], [0.002, -0.08, 0.26], [0.018, -0.32, 0.20]]) {
      const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.014, len, 4), brightBladeMat);
      sprig.position.set(ox, -len * 0.45, 0.03);
      sprig.rotation.set(0.28, 0, rz + Math.PI);
      mouthBlade.add(sprig);
    }
    pivot.add(mouthBlade);

    root.add(pivot);
    deerState = {
      pivot, baseYaw, mouthBlade, grassTuft, uniforms,
      muzzleOffsetX: model.position.x,
      muzzleOffsetZ: model.position.z,
      pitch: 0, headYaw: 0, time: 0.9, alert: 0
    };
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
