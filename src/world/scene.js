import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { generateHouse, getHouseColliders, getHouseBounds } from './buildings.js';
import { buildMainHouseInterior, removePaintedFrontDoor, BED_CENTER, DESK_CENTER, COOK_CENTER, lightSwitchPose, TV_CENTER } from './interior.js';
import { createBed } from '../systems/sleep.js';
import { createDesk } from '../systems/work.js';
import { createCook } from '../systems/skills.js';
import { createLightSwitch } from '../systems/lights.js';
import { createTv, tvCollider } from '../systems/tv.js';
import { createSeats } from '../systems/sit.js';
import { scatterTrees, TREE_PLACEMENTS } from './trees.js';
import { CAR_SPAWN, createParkedCar } from './props.js';
import { createSnackPickup, createMailbox, MAILBOX_SPAWN, SNACK_SPAWN, mailboxCollider } from './pickups.js';
import { createVendingMachine, VENDING_SPAWN, vendingCollider } from './vending.js';
import { createColliderWorld } from '../systems/collision.js';
import { createHingedDoor } from '../systems/doors.js';
import { buildStreetlights } from './streetlights.js';
import { buildCornerShop } from './cornerShop.js';
import { buildLaundromat } from './laundromat.js';
import { buildTrailerPark } from './trailerPark.js';
import { createWorldState } from '../systems/interactables.js';
import { sampleLighting } from './daynight.js';
import { HOUSE, LOOK, MAIN_HOUSE, PROPS, TEXTURE } from './palette.js';
import { createGrassTexture, createRoadTexture, createSidewalkTexture } from './textures.js';
import { createContactShadows } from './contact.js';
import { buildMainHouseDetails, findGlassPanes, tintGlassPanes } from './details.js';
import { CURB_WIDTH, DRIVEWAY, GARAGE_LOT, NORTH_FRONTAGE_OFFSET, STREET, SURFACE_Y, drivewayWalkHeight, surfaceHeightAt } from './street.js';
import { buildFrontYard, textureHouseExterior } from './frontYard.js';

function disposeGroup(group) {
  const materials = new Set();
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mat) => materials.add(mat));
  });
  materials.forEach((m) => m.dispose());
}

export { STREET };

/** Large inverted dome, fog disabled, drawn behind the world. */
function createSkyDome(quality, look) {
  const radius = quality.far * 0.85;
  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  const uniforms = {
    topColor: { value: new THREE.Color(look.skyTop) },
    bottomColor: { value: new THREE.Color(look.skyBottom) },
    exponent: { value: look.exponent }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying float vSky;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vSky = normalize(w.xyz).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      varying float vSky;
      void main() {
        float t = pow(max(vSky, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

/**
 * The Kenney GLB ships every material with metalness 1 / roughness 1 (the glTF
 * default). With no environment map a fully metallic surface has almost no
 * diffuse light, which is why the house read as flat, muddy red. Give each
 * material (matched by the GLB's own names) a palette colour and a real
 * roughness / metalness. Names are kept: other code finds doors and windows by them.
 */
export function gradeMainHouse(model) {
  const seen = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      const spec = MAIN_HOUSE[m.name];
      m.metalness = spec ? spec.metalness : 0;
      m.roughness = spec ? spec.roughness : 0.9;
      if (spec) {
        m.color.setHex(spec.color);
        if (spec.emissive !== undefined && m.emissive) m.emissive.setHex(spec.emissive);
      }
      m.needsUpdate = true;
    }
  });
  return model;
}

export function createScene(quality) {
  const scene = new THREE.Scene();
  const colliders = createColliderWorld();
  scene.userData.colliders = colliders;
  // Start from the 10:00 key (the same palette daynight.js applies), so the
  // first frame and the first day/night update agree: no flash of the old sky.
  const look = sampleLighting(10 * 60);
  const horizon = new THREE.Color(look.fog);
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, quality.far * LOOK.fog.near, quality.far * LOOK.fog.far);
  scene.add(createSkyDome(quality, look));

  // Ground with a repeating grass canvas texture
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({
    map: createGrassTexture(quality),
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality.shadows;
  scene.add(ground);

  // East–west road with sidewalks, running in front of the Kenney house
  const { length: streetLen, roadWidth, sidewalkWidth, roadCenterZ } = STREET;
  const roadTex = createRoadTexture(quality);
  roadTex.repeat.set(streetLen / TEXTURE.road.tileMetres, 1);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(streetLen, roadWidth),
    new THREE.MeshStandardMaterial({
      map: roadTex,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0
    })
  );
  road.name = 'road';
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, SURFACE_Y.road, roadCenterZ);
  road.receiveShadow = quality.shadows;
  scene.add(road);

  const stripeCount = 20;
  const stripe = new THREE.PlaneGeometry(2.2, 0.26);
  stripe.rotateX(-Math.PI / 2);
  const paint = new THREE.MeshStandardMaterial({ color: 0xd8d6c7, roughness: 0.91 });
  const crossings = new THREE.InstancedMesh(stripe, paint, STREET.crossings.length * stripeCount);
  crossings.name = 'pedestrian-crossings';
  crossings.receiveShadow = quality.shadows;
  const matrix = new THREE.Matrix4();
  let stripeIndex = 0;
  for (const x of STREET.crossings) {
    for (let i = 0; i < stripeCount; i++) {
      const z = roadCenterZ + ((i + 0.5) / stripeCount - 0.5) * roadWidth;
      crossings.setMatrixAt(stripeIndex++, matrix.makeTranslation(x, SURFACE_Y.road + 0.002, z));
    }
  }
  scene.add(crossings);

  const walkTex = createSidewalkTexture(quality);
  // One tile is one pavement slab, so the joints line up with the tile edge.
  walkTex.repeat.set(Math.round(streetLen / TEXTURE.walk.slabMetres), 1);
  const walkMat = new THREE.MeshStandardMaterial({
    map: walkTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xa6a092, roughness: 0.95 });
  const halfStreet = streetLen / 2;
  const southEdge = roadCenterZ - roadWidth / 2;
  const northEdge = roadCenterZ + roadWidth / 2;
  const { x: driveX, width: driveWidth, flare, endZ, rampDepth } = DRIVEWAY;
  const left = driveX - driveWidth / 2;
  const right = driveX + driveWidth / 2;
  const cutStart = left - flare;
  const cutEnd = right + flare;

  function paving(name, geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = quality.shadows;
    scene.add(mesh);
    return mesh;
  }

  function curb(name, x0, x1, z) {
    const height = SURFACE_Y.walk - 0.003;
    const mesh = paving(name, new THREE.BoxGeometry(x1 - x0, height, CURB_WIDTH), curbMat);
    mesh.position.set((x0 + x1) / 2, height / 2, z);
  }

  const northWalk = paving('sidewalk-north', new THREE.PlaneGeometry(streetLen, sidewalkWidth), walkMat);
  northWalk.rotation.x = -Math.PI / 2;
  northWalk.position.set(0, SURFACE_Y.walk, northEdge + sidewalkWidth / 2);
  curb('sidewalk-north-curb', -halfStreet, halfStreet, northEdge + CURB_WIDTH / 2);
  curb('sidewalk-south-curb-west', -halfStreet, cutStart, southEdge - CURB_WIDTH / 2);
  curb('sidewalk-south-curb-east', cutEnd, halfStreet, southEdge - CURB_WIDTH / 2);

  // Keep the sidewalk texture continuous across the ramp and its two flares.
  const columns = [-halfStreet, cutStart, left, right, cutEnd, halfStreet];
  const rows = [0, CURB_WIDTH, CURB_WIDTH + rampDepth, sidewalkWidth];
  const positions = [];
  const uv = [];
  const indices = [];
  for (const offset of rows) {
    for (const x of columns) {
      positions.push(x, drivewayWalkHeight(x, offset), southEdge - offset);
      uv.push((x + halfStreet) / streetLen, offset / sidewalkWidth);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let col = 0; col < columns.length - 1; col++) {
      const i = row * columns.length + col;
      const j = i + columns.length;
      if (col === 3) indices.push(i, i + 1, j, i + 1, j + 1, j);
      else indices.push(i, i + 1, j + 1, i, j + 1, j);
    }
  }
  const southWalk = new THREE.BufferGeometry();
  southWalk.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  southWalk.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  southWalk.setIndex(indices);
  southWalk.computeVertexNormals();
  paving('sidewalk-south', southWalk, walkMat);

  const driveStart = southEdge - sidewalkWidth;
  const driveCenter = (driveStart + endZ) / 2;
  const driveway = new THREE.PlaneGeometry(driveWidth, driveStart - endZ);
  driveway.rotateX(-Math.PI / 2);
  driveway.translate(driveX, 0, driveCenter);
  const vertices = driveway.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    vertices.setY(i, vertices.getZ(i) > driveCenter ? SURFACE_Y.walk : SURFACE_Y.road);
  }
  driveway.computeVertexNormals();
  const driveMap = walkTex.clone();
  driveMap.repeat.set(2, 1);
  paving('garage-driveway', driveway, new THREE.MeshStandardMaterial({
    map: driveMap, color: 0xc3b8a6, roughness: 0.96
  }));

  // Fallback procedural house. The Kenney GLB is the main house; this group
  // stays only while the model loads, or if the load fails.
  const house = generateHouse({
    width: 9.5,
    height: 6,
    depth: 10,
    roofType: 'pyramid',
    wallColor: MAIN_HOUSE._defaultMat.color,
    roofColor: MAIN_HOUSE.roof.color,
    hasDoor: false,
    shadows: quality.shadows
  });
  house.position.set(0, 0, -10);
  scene.add(house);
  // Temporary collider for the fallback house; replaced (not duplicated) when the GLB loads.
  colliders.addHouse({ id: 'main-house', x: 0, z: -10, width: 9.5, depth: 10, rotY: 0 });

  // Standalone interactable door (kept independent of the fallback / GLB house).
  // Hinged 1 × 2 m door; pivot sits at the left jamb of the fallback's front face.
  const door = createHingedDoor({
    width: 1.04, // matches the 1.04 m opening in the Kenney model
    height: 2.0,
    depth: 0.1,
    color: PROPS.doorWood,
    shadows: quality.shadows,
    id: 'main-door'
  });
  door.position.set(-0.52, 0, -4.94);
  scene.add(door);

  // Four generated houses on both sides of the street, facing the road.
  // The Kenney house (above) is the fifth house, on the south side at x=0.
  // Each lot has its own seeded combination of roof, porch, chimney, window
  // layout and extension. Porched houses sit back by the porch depth so the
  // porch front lines up with the other houses and clears the sidewalk.
  // Extensions (garage / wing) face away from the Kenney house so the
  // walking gaps between lots stay open.
  const lots = [
    { name: 'house-sw', x: -13, z: -10.8, rotY: 0, width: 7.5, depth: 9, height: 3.5, roofType: 'gable', wallColor: HOUSE.lots[0].wall, roofColor: HOUSE.lots[0].roof, windowCount: 4,
      seed: 11, windowLayout: 'shutters', chimney: true, porch: { depth: 1.4, width: 3.2, roof: 'shed' } },
    { name: 'house-se', x: GARAGE_LOT.x, z: GARAGE_LOT.z, rotY: 0, width: GARAGE_LOT.width, depth: GARAGE_LOT.depth, height: 3.8, roofType: 'hip', wallColor: HOUSE.lots[1].wall, roofColor: HOUSE.lots[1].roof, windowCount: 3,
      seed: 22, windowLayout: 'bay', extension: { side: 1, type: 'garage', width: GARAGE_LOT.garageWidth } },
    { name: 'house-nw', x: -13, z: 6.85 + NORTH_FRONTAGE_OFFSET, rotY: Math.PI, width: 7.5, depth: 8.7, height: 3.6, roofType: 'shed', wallColor: HOUSE.lots[2].wall, roofColor: HOUSE.lots[2].roof, windowCount: 3,
      seed: 33, windowLayout: 'ribbon', chimney: true, extension: { side: 1, type: 'wing', width: 3.0 } },
    { name: 'house-ne', x: 13.2, z: 8.3 + NORTH_FRONTAGE_OFFSET, rotY: Math.PI, width: 7.8, depth: 9, height: 3.7, roofType: 'gable', wallColor: HOUSE.lots[3].wall, roofColor: HOUSE.lots[3].roof, windowCount: 4,
      seed: 44, windowLayout: 'grid', chimney: true, porch: { depth: 1.2, width: 3.0, roof: 'gable' } }
  ];
  const streetHouses = lots.map((lot) => {
    const h = generateHouse({
      width: lot.width,
      depth: lot.depth,
      height: lot.height,
      roofType: lot.roofType,
      wallColor: lot.wallColor,
      roofColor: lot.roofColor,
      windowCount: lot.windowCount,
      hasDoor: true,
      shadows: quality.shadows,
      merge: true,
      seed: lot.seed,
      windowLayout: lot.windowLayout,
      porch: lot.porch,
      chimney: lot.chimney,
      extension: lot.extension
    });
    h.name = lot.name;
    h.position.set(lot.x, 0, lot.z);
    h.rotation.y = lot.rotY;
    scene.add(h);
    colliders.addHouse({
      id: lot.name,
      x: lot.x,
      z: lot.z,
      width: lot.width,
      depth: lot.depth,
      rotY: lot.rotY
    });
    // Extension / bay boxes and porch-post circles. The porch deck itself
    // has no collider, so it stays walkable.
    const extra = getHouseColliders(h, { x: lot.x, z: lot.z, rotY: lot.rotY, id: lot.name });
    extra.boxes.forEach((b) => colliders.addHouse(b));
    extra.posts.forEach((p) => colliders.addTree(p));
    if (h.userData.door) h.userData.door.userData.doorId = lot.name;
    return h;
  });
  scene.userData.streetHouses = streetHouses;

  // Lighting: a sky/ground hemisphere, a soft ambient and a warm sun, all
  // starting from the 10:00 key (daynight.js then takes over).
  const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, look.hemiInt);
  hemi.name = 'hemi';
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(look.ambient, look.ambientInt);
  ambient.name = 'ambient';
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(look.sun, look.sunInt);
  sun.name = 'sun';
  sun.position.set(look.sunPos[0], look.sunPos[1], look.sunPos[2]);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    // Desktop only. 2048 over ±38 m is ~3.7 cm a texel (was 1024 over ±44 m),
    // which tightens the contact shadows under the rounded props and eaves.
    // PCFSoft + tuned bias / normalBias keep it soft without acne or floating
    // shadows; contact blobs (contact.js) add the soft foot shadow on top.
    const sh = LOOK.shadow;
    sun.shadow.radius = sh.radius;
    sun.shadow.mapSize.width = sh.mapSize;
    sun.shadow.mapSize.height = sh.mapSize;
    sun.shadow.camera.near = sh.near;
    sun.shadow.camera.far = sh.far;
    sun.shadow.camera.left = -sh.extent;
    sun.shadow.camera.right = sh.extent;
    sun.shadow.camera.top = sh.extent;
    sun.shadow.camera.bottom = -sh.extent;
    sun.shadow.bias = sh.bias;
    sun.shadow.normalBias = sh.normalBias;
  }
  scene.add(sun);
  scene.add(sun.target);

  const trees = scatterTrees(scene, TREE_PLACEMENTS, quality);
  scene.userData.trees = trees;
  trees.forEach((tree, i) => {
    colliders.addTree({
      id: `tree-${i}`,
      x: tree.position.x,
      z: tree.position.z,
      radius: tree.userData.trunkRadius
    });
  });

  // Parked car on the north side of the road, east of spawn, clear of the
  // Kenney walking path (x=0) and of the neighbour lots / door approaches.
  const car = createParkedCar({ shadows: quality.shadows });
  car.position.set(CAR_SPAWN.x, 0, CAR_SPAWN.z);
  scene.add(car);
  colliders.addHouse({
    id: 'parked-car',
    x: car.position.x,
    z: car.position.z,
    width: car.userData.size.width,
    depth: car.userData.size.depth,
    rotY: car.rotation.y
  });
  scene.userData.prop = car;

  const doors = [door, ...streetHouses.map((h) => h.userData.door).filter(Boolean)];
  scene.userData.door = door;
  scene.userData.doors = doors;
  scene.userData.streetlights = buildStreetlights(scene, quality);
  scene.userData.street = STREET;
  scene.userData.spawn = STREET.spawn;

  // Pickups live in one group so adding the snack later (after the interior
  // loads) does not change the scene's top-level child count.
  const pickups = new THREE.Group();
  pickups.name = 'pickups';
  scene.add(pickups);
  scene.userData.pickups = pickups;
  scene.userData.interactables = [];
  buildCornerShop(scene, quality);
  buildLaundromat(scene, quality);
  buildTrailerPark(scene, quality);
  scene.userData.world = createWorldState(scene);

  const mailbox = createMailbox({ shadows: quality.shadows });
  mailbox.position.set(MAILBOX_SPAWN.x, 0, MAILBOX_SPAWN.z);
  pickups.add(mailbox);
  colliders.addHouse(mailboxCollider(mailbox));
  scene.userData.interactables.push({
    id: 'mailbox',
    kind: 'mailbox',
    object: mailbox,
    getPoint: () => {
      mailbox.updateMatrixWorld(true);
      return mailbox.localToWorld(mailbox.userData.interactLocal.clone());
    }
  });
  scene.userData.mailbox = mailbox;

  const vending = createVendingMachine({ shadows: quality.shadows });
  vending.position.set(VENDING_SPAWN.x, 0, VENDING_SPAWN.z);
  pickups.add(vending);
  colliders.addHouse(vendingCollider(vending));
  scene.userData.interactables.push({
    id: 'vending',
    kind: 'vending',
    object: vending,
    getPoint: () => {
      vending.updateMatrixWorld(true);
      return vending.localToWorld(vending.userData.interactLocal.clone());
    }
  });
  scene.userData.vending = vending;

  // Fake ambient occlusion: soft blobs under the trees, houses, car and props,
  // merged into ONE mesh (one draw call, no light, no shadow caster). It sits
  // on whatever surface is underneath (grass, road or pavement).
  const surfaceY = surfaceHeightAt;
  const contactItems = [];
  trees.forEach((tree) => {
    const r = tree.userData.radius || 1.2;
    contactItems.push({ kind: 'blob', x: tree.position.x, z: tree.position.z, y: 0, rx: r * 1.15, rz: r * 1.15, strength: 0.5 });
    contactItems.push({ kind: 'blob', x: tree.position.x, z: tree.position.z, y: 0, rx: tree.userData.trunkRadius * 3.4, rz: tree.userData.trunkRadius * 3.4, strength: 0.9 });
  });
  lots.forEach((lot, i) => {
    const b = getHouseBounds(streetHouses[i], { x: lot.x, z: lot.z, rotY: lot.rotY });
    if (!b) return;
    const fp = streetHouses[i].userData.footprint.bounds;
    const lcx = (fp.minX + fp.maxX) / 2;
    const lcz = (fp.minZ + fp.maxZ) / 2;
    const cos = Math.cos(lot.rotY);
    const sin = Math.sin(lot.rotY);
    contactItems.push({
      kind: 'rect',
      x: lot.x + lcx * cos + lcz * sin,
      z: lot.z - lcx * sin + lcz * cos,
      y: 0, w: fp.maxX - fp.minX, d: fp.maxZ - fp.minZ, margin: 0.85, rot: lot.rotY, strength: 0.7
    });
  });
  // The main house (the placeholder and the Kenney model share this footprint).
  contactItems.push({ kind: 'rect', x: 0, z: -10, y: 0, w: 8.9, d: 9.4, margin: 0.9, strength: 0.7 });
  contactItems.push({
    kind: 'rect', x: car.position.x, z: car.position.z, y: surfaceY(car.position.x, car.position.z),
    w: car.userData.size.width - 0.5, d: car.userData.size.depth - 0.2, margin: 0.4, rot: car.rotation.y, strength: 0.85
  });
  contactItems.push({ kind: 'blob', x: MAILBOX_SPAWN.x, z: MAILBOX_SPAWN.z, y: surfaceY(MAILBOX_SPAWN.x, MAILBOX_SPAWN.z), rx: 0.34, rz: 0.34, strength: 0.8 });
  contactItems.push({ kind: 'blob', x: VENDING_SPAWN.x, z: VENDING_SPAWN.z, y: surfaceY(VENDING_SPAWN.x, VENDING_SPAWN.z), rx: 0.62, rz: 0.55, strength: 0.85 });
  const contact = createContactShadows(contactItems, quality);
  scene.add(contact);
  scene.userData.contactShadows = contact;

  // Real house model (Kenney City Kit Suburban, CC0). The procedural house
  // and the standalone door above stay as a fallback until the model has loaded.
  const HOUSE_URL = './assets/models/house_type02.glb'; // relative to the page, so it works under the Pages subpath
  const HOUSE_CENTER = new THREE.Vector3(0, 0, -10);    // same spot as the old box house
  // house_type02 door is 0.27 model-units tall. Scale so that door is 2 m and
  // the porch underside (~0.326 model-units) sits at ~2.41 m, clear of a 1.6–1.7 m eye height.
  const MODEL_FRONT_DOOR = { x: 0.004, y: 0.135, z: 0.535, w: 0.14, h: 0.27 };
  const TARGET_DOOR_HEIGHT = 2.0;

  new GLTFLoader().load(
    HOUSE_URL,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'kenney-house';

      // Uniform scale so the model's front door is 2 m tall
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      const s = TARGET_DOOR_HEIGHT / MODEL_FRONT_DOOR.h;
      model.scale.setScalar(s);

      // Base on y = 0, centered on HOUSE_CENTER (the model's front already faces +z)
      model.position.set(
        HOUSE_CENTER.x - rawCenter.x * s,
        -rawBox.min.y * s,
        HOUSE_CENTER.z - rawCenter.z * s
      );

      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = quality.shadows;
          o.receiveShadow = quality.shadows;
          // The roof and walls are single-sided. By default three only puts a mesh's
          // back faces into the shadow map, so a single-sided roof cast no shadow and
          // the sun shone straight through it onto the interior floor.
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m) m.shadowSide = THREE.DoubleSide; });
        }
      });
      gradeMainHouse(model);
      textureHouseExterior(model, quality);
      scene.add(model);

      // Swap out the placeholder procedural house
      scene.remove(house);
      disposeGroup(house);

      // Fit the interactable door over the model's own front door
      model.updateMatrixWorld(true);
      const d = MODEL_FRONT_DOOR;
      const doorWorld = model.localToWorld(new THREE.Vector3(d.x, d.y, d.z));
      // Realign a ~0.9–1.0 × 2.0 m slab over the model's front door
      const doorW = Math.min(1.04, Math.max(0.9, d.w * s)); // fills the 1.04 m painted opening
      const doorH = d.h * s;
      const doorZ = doorWorld.z + 0.06;
      const frontYard = buildFrontYard({ x: doorWorld.x, z: doorZ }, quality);
      pickups.add(frontYard.group);
      scene.userData.frontYard = frontYard;
      // Pivot at the left jamb; the panel already matches the 1 × 2 m target size.
      door.position.set(doorWorld.x - doorW / 2, 0, doorZ);
      door.userData.interactLocal.set(doorW / 2, doorH / 2, 0);

      // The Kenney footprint, as before: front (maxZ) inset to the door slab so the
      // porch stays walkable and the door is in range. The exterior outline of the
      // colliders is unchanged; the interior is carved out of it below.
      const kenneyBox = new THREE.Box3().setFromObject(model);
      const outer = { minX: kenneyBox.min.x, maxX: kenneyBox.max.x, minZ: kenneyBox.min.z, maxZ: doorZ };

      // Interior: drop the painted-on front door (the hinged door replaces it),
      // add the inward-facing room shell + furniture, and swap the single house
      // box for wall colliders with a doorway that is only open with the door.
      removePaintedFrontDoor(model, { x: doorWorld.x, z: doorWorld.z });
      // More detailed windows and door: tinted glass (vertex gradient) plus one
      // merged detail mesh (muntins, sash lines, threshold, house number).
      // It joins the pickups group so the swap still adds one scene child.
      const glassPanes = findGlassPanes(model);
      tintGlassPanes(glassPanes);
      const houseDetails = buildMainHouseDetails(model, {
        panes: glassPanes,
        shadows: quality.shadows,
        door: { x: doorWorld.x, z: doorZ, width: doorW, surroundZ: doorWorld.z + 0.223 }
      });
      if (houseDetails) {
        pickups.add(houseDetails);
        scene.userData.mainHouseDetails = houseDetails;
      }
      const interior = buildMainHouseInterior({
        shadows: quality.shadows,
        outer,
        doorX: doorWorld.x,
        doorZ,
        door
      });
      scene.add(interior.group);
      // Parent lamp/ceiling glow to pickups (already a scene child) so the
      // Kenney swap still adds exactly one new scene child (the interior group).
      if (interior.lamps) pickups.add(interior.lamps);
      colliders.remove('main-house');
      interior.colliders.forEach((c) => {
        const added = colliders.addHouse(c);
        if (c.gate) {
          // Blocks the doorway only while the door is closed (and nobody is standing in it).
          Object.defineProperty(added, 'disabled', { get: () => interior.gateDisabled(colliders), enumerable: true });
        }
      });
      scene.userData.interior = {
        spawn: interior.spawn,
        bounds: interior.bounds,
        doorway: interior.doorway,
        door,
        group: interior.group
      };

      const snack = createSnackPickup({ shadows: quality.shadows });
      snack.position.set(SNACK_SPAWN.x, SNACK_SPAWN.y, SNACK_SPAWN.z);
      pickups.add(snack);
      scene.userData.interactables = (scene.userData.interactables || []).filter((e) => e.id !== 'snack');
      scene.userData.interactables.push({
        id: 'snack',
        kind: 'pickup',
        object: snack
      });
      scene.userData.snack = snack;

      const bed = createBed();
      bed.position.set(BED_CENTER.x, BED_CENTER.y, BED_CENTER.z);
      // Sit with the other interactables, not in the merged interior mesh
      // (that group stays at 2 draw calls).
      pickups.add(bed);
      scene.userData.interactables = (scene.userData.interactables || []).filter((e) => e.id !== 'bed');
      scene.userData.interactables.push({
        id: 'bed',
        kind: 'sleep',
        object: bed
      });
      scene.userData.bed = bed;

      const desk = createDesk();
      desk.position.set(DESK_CENTER.x, DESK_CENTER.y, DESK_CENTER.z);
      pickups.add(desk);
      scene.userData.interactables = (scene.userData.interactables || []).filter((e) => e.id !== 'desk');
      scene.userData.interactables.push({
        id: 'desk',
        kind: 'work',
        object: desk
      });
      scene.userData.desk = desk;

      const cook = createCook();
      cook.position.set(COOK_CENTER.x, COOK_CENTER.y, COOK_CENTER.z);
      pickups.add(cook);
      scene.userData.cook = cook;

      // Wall switch sits in the pickups group (not the 2-draw-call interior
      // mesh). It is registered as an interactable from main.js, like Cook.
      const lightSwitch = createLightSwitch({ on: scene.userData.interiorLightsOn !== false });
      const swPose = lightSwitchPose(interior.doorway);
      lightSwitch.position.set(swPose.x, swPose.y, swPose.z);
      lightSwitch.userData.scene = scene;
      pickups.add(lightSwitch);
      scene.userData.lightSwitch = lightSwitch;

      // TV sits in the pickups group (not the 2-draw-call interior mesh) and
      // is registered as an interactable from main.js, like Cook.
      const tv = createTv({ on: !!scene.userData.tvOn, shadows: quality.shadows });
      tv.position.set(TV_CENTER.x, TV_CENTER.y, TV_CENTER.z);
      tv.userData.scene = scene;
      pickups.add(tv);
      scene.userData.tv = tv;
      colliders.addHouse(tvCollider(tv));

      const seats = createSeats();
      for (let i = 0; i < seats.length; i++) pickups.add(seats[i]);
      // Keep seats from other buildings (laundromat benches) alongside the house's.
      scene.userData.seats = [...(scene.userData.seats || []), ...seats];
      // Cook and seats are registered as interactables from main.js (the same
      // way the car is) so older highlighter counts stay stable.
      if (typeof scene.userData.onInteriorReady === 'function') scene.userData.onInteriorReady(scene);

      if (scene.userData.world) scene.userData.world.apply({ pickups: { ...scene.userData.world.taken } });
    },
    undefined,
    (err) => {
      console.warn('House model failed to load, keeping the placeholder house', err);
    }
  );

  return scene;
}
