import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { generateHouse } from './buildings.js';
import {
  buildMainHouseInterior, removePaintedFrontDoor,
  BED_CENTER, DESK_CENTER, COOK_CENTER, lightSwitchPose, TV_CENTER,
  HOUSE_SCALE_XZ, HOUSE_CENTER_Z
} from './interior.js';
import { createBed } from '../systems/sleep.js';
import { createDesk } from '../systems/work.js';
import { createCook } from '../systems/skills.js';
import { createLightSwitch } from '../systems/lights.js';
import { createTv, tvCollider } from '../systems/tv.js';
import { createSeats } from '../systems/sit.js';
import { createSnackPickup, SNACK_SPAWN } from './pickups.js';
import { createHingedDoor } from '../systems/doors.js';
import { MAIN_HOUSE, PROPS } from './palette.js';
import { buildMainHouseDetails, findGlassPanes, tintGlassPanes } from './details.js';
import { buildFrontYard, textureHouseExterior } from './frontYard.js';
import { useWorldGrit } from './surfaces.js';

const HOUSE_URL = './assets/models/house_type02.glb'; // relative to the page, so it works under the Pages subpath
const HOUSE_CENTER = new THREE.Vector3(0, 0, HOUSE_CENTER_Z);
// house_type02 door is 0.27 model-units tall. Scale so that door is 2 m and
// the porch underside (~0.326 model-units) sits at ~2.41 m, clear of a 1.6–1.7 m eye height.
const MODEL_FRONT_DOOR = { x: 0.004, y: 0.135, z: 0.535, w: 0.14, h: 0.27 };
const TARGET_DOOR_HEIGHT = 2.0;

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
      if (m.name !== 'window' && m.roughness >= 0.45) {
        useWorldGrit(m, { strength: 0.85, groundGrime: 0.24 });
      }
      m.needsUpdate = true;
    }
  });
  return model;
}

/**
 * Player's main house: places a fallback procedural house and standalone hinged
 * front door immediately, then swaps in the Kenney house GLB plus its interior,
 * front yard, and indoor interactables once loaded.
 */
export function buildMainHouse(scene, quality) {
  const colliders = scene.userData.colliders;

  // Fallback procedural house. The Kenney GLB is the main house; this group
  // stays only while the model loads, or if the load fails.
  const house = generateHouse({
    width: 9.5 * HOUSE_SCALE_XZ,
    height: 6,
    depth: 10 * HOUSE_SCALE_XZ,
    roofType: 'pyramid',
    wallColor: MAIN_HOUSE._defaultMat.color,
    roofColor: MAIN_HOUSE.roof.color,
    hasDoor: false,
    shadows: quality.shadows
  });
  house.position.set(0, 0, HOUSE_CENTER_Z);
  scene.add(house);
  // Temporary collider for the fallback house; replaced (not duplicated) when the GLB loads.
  colliders.addHouse({ id: 'main-house', x: 0, z: HOUSE_CENTER_Z, width: 9.5 * HOUSE_SCALE_XZ, depth: 10 * HOUSE_SCALE_XZ, rotY: 0 });

  // Standalone interactable door (kept independent of the fallback / GLB house).
  const initialDoorW = 1.04 * HOUSE_SCALE_XZ;
  const door = createHingedDoor({
    width: initialDoorW,
    height: 2.0,
    depth: 0.1,
    color: PROPS.doorWood,
    shadows: quality.shadows,
    id: 'main-door'
  });
  door.position.set(-initialDoorW / 2, 0, -4.94);
  scene.add(door);

  loadGltf(
    HOUSE_URL,
    (gltf) => {
      const pickups = scene.userData.pickups || scene;
      const model = gltf.scene;
      model.name = 'kenney-house';

      // Scale height so the front door is 2 m tall, and expand XZ by HOUSE_SCALE_XZ for a roomier floorplan.
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      const s = TARGET_DOOR_HEIGHT / MODEL_FRONT_DOOR.h;
      const sXZ = s * HOUSE_SCALE_XZ;
      model.scale.set(sXZ, s, sXZ);

      // Base on y = 0, centered on HOUSE_CENTER (the model's front already faces +z)
      model.position.set(
        HOUSE_CENTER.x - rawCenter.x * sXZ,
        -rawBox.min.y * s,
        HOUSE_CENTER.z - rawCenter.z * sXZ
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
      const doorW = Math.min(initialDoorW, Math.max(0.9, d.w * sXZ));
      const doorH = d.h * s;
      const doorZ = doorWorld.z + 0.06;
      const frontYard = buildFrontYard({ x: doorWorld.x, z: doorZ }, quality, scene.userData.lightPool);
      pickups.add(frontYard.group);
      scene.userData.frontYard = frontYard;
      // Pivot at the left jamb; the panel already matches the scaled opening.
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
        door: { x: doorWorld.x, z: doorZ, width: doorW, surroundZ: doorWorld.z + 0.223 * HOUSE_SCALE_XZ }
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
        door,
        doorWidth: doorW
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
    (err) => {
      console.warn('House model failed to load, keeping the placeholder house', err);
    }
  );

  return { house, door };
}
