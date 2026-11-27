/**
 * Animated people (Quaternius Universal Base Characters + Universal Animation
 * Library, CC0; see assets/characters/CREDITS.md).
 *
 * The free bodies ship without clothes, so the shirt, trousers and shoes are
 * painted on in the shader by bind-pose height (the body is modelled in a
 * T-pose, so arms are easy to tell from the torso). Hair is a separate mesh
 * parented to the head bone. Every body shares one skeleton layout, so every
 * clip in anims.glb plays on every character.
 *
 * Files load once and are shared; each character is a SkeletonUtils clone.
 */

import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mixamoToClip } from './mixamoRetarget.js';

/** Relative to the page so it works under the GitHub Pages subpath. */
export const CHARACTER_BASE = './assets/characters/';

/**
 * Clip names: anims.glb (Universal Animation Library) and anims-extra.glb
 * (Universal Animation Library 2). The pack's own Idle_Loop is a fists-up,
 * ready-to-fight stance and the folded-arms one reads as stern, so standing
 * uses Mixamo's relaxed Breathing Idle (MIXAMO_IDLE, retargeted at load);
 * folded arms is only the fallback if that file cannot load.
 */
export const MIXAMO_IDLE = 'mixamo-breathing-idle.json';
export const CLIPS = Object.freeze({
  idle: 'Idle_FoldArms_Loop',
  phone: 'Idle_TalkingPhone_Loop',
  walk: 'Walk_Loop',
  talk: 'Idle_Talking_Loop',
  interact: 'Interact'
});

/** Ground speed (m/s) the walk clip was authored for; playback scales to match. */
export const WALK_CLIP_SPEED = 1.15;

/** Bind-pose heights (metres) where the painted clothes start and stop, per body. */
export const BODY_ZONES = Object.freeze({
  male: { neck: 1.585, waist: 0.98, ankle: 0.085, sleeve: 0.40 },
  female: { neck: 1.50, waist: 0.98, ankle: 0.085, sleeve: 0.40 }
});

/**
 * Bodies made in Blender (MakeHuman via the MPFB add-on), converted by
 * tools/convert_makehuman.py: T-posed, facing +Z, with the main bones renamed
 * to the names above. Their rest pose differs from the Quaternius bodies, so
 * they skip the Universal Animation Library clips and use Mixamo clips only
 * (retargeted in world space), including their own walk.
 */
export const CUSTOM_BODIES = Object.freeze({
  surviver: { file: 'surviver.glb', walk: 'actions/walk.json' },
  // Neighbours, made with the same MakeHuman rig (tools/convert_makehuman.py, own heights).
  sam: { file: 'npc-sam.glb', walk: 'actions/walk.json' },
  june: { file: 'npc-june.glb', walk: 'actions/walk.json' },
  dottie: { file: 'npc-dottie.glb', walk: 'actions/walk.json' },
  clerk: { file: 'npc-clerk.glb', walk: 'actions/walk.json' }
});

const cache = new Map();

function loadJson(file) {
  if (!cache.has(file)) {
    cache.set(file, fetch(CHARACTER_BASE + file).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(file);
}

function load(file) {
  if (!cache.has(file)) {
    cache.set(file, loadGltf(CHARACTER_BASE + file));
  }
  return cache.get(file);
}

function hipsHeight(root) {
  const pelvis = root.getObjectByName('pelvis');
  if (!pelvis) return 0.9;
  root.updateMatrixWorld(true);
  const p = new THREE.Vector3().setFromMatrixPosition(pelvis.matrixWorld);
  return root.worldToLocal(p).y;
}

/** Shader patch that paints clothes onto the bind-pose body. */
export function paintClothes(material, { shirt, pants, shoes, skin = null, longSleeve = false, zones }) {
  const z = zones || BODY_ZONES.male;
  const palette = {
    cShirt: { value: new THREE.Color(shirt) },
    cPants: { value: new THREE.Color(pants) },
    cSkin: { value: new THREE.Color(skin ?? 0xffffff) }
  };
  material.userData.clothes = palette;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      ...palette,
      skinOverride: { value: skin == null ? 0 : 1 },
      cShoes: { value: new THREE.Color(shoes) },
      zNeck: { value: z.neck },
      zWaist: { value: z.waist },
      zAnkle: { value: z.ankle },
      zSleeve: { value: longSleeve ? 0.68 : z.sleeve }
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;\nuniform vec3 cShirt, cPants, cShoes, cSkin;\nuniform float skinOverride;\nuniform float zNeck, zWaist, zAnkle, zSleeve;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float y = vBind.y;
        float ax = abs(vBind.x);
        float onArm = step(0.21, ax) * step(zNeck - 0.30, y);
        float shirt = step(zWaist, y) * step(y, zNeck) * (1.0 - onArm);
        shirt = max(shirt, onArm * step(ax, zSleeve));
        float pants = step(zAnkle, y) * step(y, zWaist + 0.015) * (1.0 - onArm);
        float shoes = step(y, zAnkle);
        // Faint weave so the cloth is not a flat fill.
        float n = fract(sin(dot(floor(vBind.xy * 220.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.05;
        vec3 c = mix(diffuseColor.rgb, cSkin * (0.82 + 0.18 * diffuseColor.r), skinOverride);
        c = mix(c, cShirt * (0.97 + n), shirt);
        c = mix(c, cPants * (0.97 + n), pants);
        c = mix(c, cShoes, shoes);
        diffuseColor.rgb = c;
      }`);
  };
  // Distinct cache key per outfit so three does not reuse another outfit's program.
  material.customProgramCacheKey = () => 'clothes';
  material.needsUpdate = true;
  return material;
}

function attachToHead(root, hairScene, color, shadows) {
  let head = null;
  root.traverse((b) => { if (!head && b.isBone && /^head$/i.test(b.name)) head = b; });
  if (!head) return;
  root.updateMatrixWorld(true);
  const toHead = head.matrixWorld.clone().invert();
  hairScene.updateMatrixWorld(true);
  hairScene.traverse((m) => {
    if (!m.isMesh) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld).applyMatrix4(toHead);
    const mat = m.material.clone();
    if (color != null) mat.color = new THREE.Color(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'hair';
    mesh.castShadow = !!shadows;
    head.add(mesh);
  });
}

/**
 * Builds one animated person. Resolves to null if the files cannot load,
 * so callers keep their placeholder body.
 * @param {{ body?: 'male'|'female', hair?: string, beard?: boolean, hairColor?: number,
 *   outfit?: { shirt: number, pants: number, shoes: number, longSleeve?: boolean }, shadows?: boolean }} look
 */
export async function createCharacterModel(look = {}) {
  const custom = CUSTOM_BODIES[look.body] || null;
  const bodyKind = custom ? look.body : (look.body === 'female' ? 'female' : 'male');
  const hairFile = look.hair ? `hair-${look.hair}.glb` : null;
  try {
    // Optional extra Mixamo clips ({ key: 'actions/file.json' }), baked like the idle.
    const extraEntries = Object.entries({ ...(look.mixamo || {}), ...(custom ? { walk: custom.walk } : {}) });
    const extraData = Promise.all(extraEntries.map(([, file]) => loadJson(file).catch(() => null)));
    const [bodyGltf, animGltf, extraGltf, idleData, hairGltf, beardGltf] = await Promise.all([
      load(custom ? custom.file : bodyKind + '.glb'),
      load('anims.glb'),
      load('anims-extra.glb').catch(() => ({ animations: [] })),
      loadJson(MIXAMO_IDLE),
      hairFile && !custom ? load(hairFile) : null,
      look.beard && !custom ? load('hair-beard.glb') : null
    ]);
    const root = SkeletonUtils.clone(bodyGltf.scene);
    const outfit = look.outfit || { shirt: 0x6f7f5a, pants: 0x3c4658, shoes: 0x2a211a };
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !!look.shadows;
      o.receiveShadow = false;
      if (/superhero/i.test(o.material.name || '')) {
        o.material = paintClothes(o.material.clone(), { ...outfit, zones: BODY_ZONES[bodyKind] });
      } else if (/hair/i.test(o.material.name || '') && look.hairColor != null) {
        // The eyebrow texture is pale grey, meant to be tinted; match it to the hair.
        o.material = o.material.clone();
        o.material.color = new THREE.Color(look.hairColor);
      }
    });
    if (hairGltf) attachToHead(root, hairGltf.scene, look.hairColor, look.shadows);
    if (beardGltf) attachToHead(root, beardGltf.scene, look.hairColor, look.shadows);

    // The models face +Z; game bodies face -Z at yaw 0.
    const holder = new THREE.Group();
    holder.name = 'character';
    root.rotation.y = Math.PI;
    holder.add(root);

    // Retarget the relaxed idle while the clone is still in its bind pose.
    const relaxedIdle = idleData ? mixamoToClip(idleData, root, 'Breathing_Idle') : null;
    const extraClips = {};
    let walkSpeed = WALK_CLIP_SPEED;
    (await extraData).forEach((data, i) => {
      const [key] = extraEntries[i];
      const clip = data ? mixamoToClip(data, root, key, custom ? { fingers: null } : undefined) : null;
      if (clip) extraClips[key] = clip;
      // A Mixamo walk stores its ground speed in hips-heights per second.
      if (clip && key === 'walk' && data.speedH) walkSpeed = data.speedH * hipsHeight(root);
    });

    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [key, name] of Object.entries(custom ? {} : CLIPS)) {
      const clip = animGltf.animations.find((a) => a.name === name)
        || extraGltf.animations.find((a) => a.name === name);
      if (clip) actions[key] = mixer.clipAction(clip);
    }
    if (relaxedIdle) actions.idle = mixer.clipAction(relaxedIdle);
    for (const [key, clip] of Object.entries(extraClips)) actions[key] = mixer.clipAction(clip);
    if (custom && !actions.interact && actions.reach) actions.interact = actions.reach;
    let current = null;

    function play(key, { fade = 0.3, timeScale = 1, restart = false } = {}) {
      const next = actions[key] || actions.idle || actions.talk;
      if (!next) return;
      next.timeScale = timeScale;
      if (next === current) {
        if (restart) next.reset().play();
        return;
      }
      next.reset().setEffectiveWeight(1).play();
      if (current) current.crossFadeTo(next, fade, false);
      current = next;
    }

    play('idle', { fade: 0 });

    return {
      object: holder,
      root,
      mixer,
      play,
      walkSpeed,
      has: (key) => !!actions[key],
      getClip: (key) => (actions[key] ? actions[key].getClip() : null),
      addClip(key, clip) { actions[key] = mixer.clipAction(clip); },
      setTimeScale(v) { if (current) current.timeScale = v; },
      update(dt) { mixer.update(dt); },
      dispose() {
        mixer.stopAllAction();
        holder.traverse((o) => {
          if (o.isMesh) {
            if (o.name === 'hair') o.geometry.dispose();
            o.material.dispose();
          }
        });
      }
    };
  } catch (e) {
    console.warn('Character model could not load; keeping the placeholder body.', e);
    return null;
  }
}
