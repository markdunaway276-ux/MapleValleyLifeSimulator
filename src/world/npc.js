/**
 * Neighbourhood NPCs. Each one walks a sidewalk patrol, idles at the ends,
 * and stops to face you when you get close. A moving circle collider keeps
 * them from walking through the player.
 *
 * The body is an animated character (characterModel.js: walk / idle / talk
 * clips) once its files load; until then, or if they fail, the merged-box
 * placeholder body stands in.
 */

import { PLAYER_RADIUS } from '../systems/collision.js';
import { createPlaceholderBody } from './playerBody.js';
import { createContactBlob } from './contact.js';
import { surfaceHeightAt } from './street.js';
import { createCharacterModel, WALK_CLIP_SPEED } from './characterModel.js';
import { NPC_DEFS, getNpc as lookupNpc, NPC_NOTICE_RANGE, NPC_TALK_RANGE, NPC_RADIUS } from '../data/npcs.js';

function talkPrompt(name, isMobile) {
  const verb = 'talk to ' + name;
  return isMobile ? ('Tap to ' + verb) : ('Press E to ' + verb);
}

function yawToward(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

function walkYaw(dir) {
  // dir > 0 walks +x; yaw 0 looks south (-Z).
  return dir > 0 ? -Math.PI / 2 : Math.PI / 2;
}

function separateFromCircle(x, z, radius, otherX, otherZ, otherR) {
  const dx = x - otherX;
  const dz = z - otherZ;
  const min = radius + otherR;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return { x, z };
  if (d2 < 1e-12) return { x: x + min, z };
  const d = Math.sqrt(d2);
  const push = (min + 1e-6 - d) / d;
  return { x: x + dx * push, z: z + dz * push };
}

export function createNpc(def, { scene, shadows = false } = {}) {
  const patrol = def.patrol || {};
  const radius = def.radius || NPC_RADIUS;
  const noticeRange = def.noticeRange || NPC_NOTICE_RANGE;
  const name = def.name || def.id;
  const x0 = patrol.x0;
  const x1 = patrol.x1;
  let z = patrol.z;
  let x = patrol.startX != null ? patrol.startX : (x0 + x1) / 2;
  let dir = 1;
  let mode = 'walk';
  let idle = 0;
  let phase = 0;
  let yaw = walkYaw(dir);
  // What they do while paused at the end of the route ('idle' or 'phone').
  let restPose = 'idle';

  const body = createPlaceholderBody({
    scene,
    shadows,
    appearance: def.appearance,
    name: 'npc-' + def.id,
    prefix: 'npc-' + def.id,
    hideHead: false
  });
  const group = body.group;
  group.position.set(x, 0, z);
  group.rotation.y = yaw;

  // Swap in the animated character when it has loaded.
  let model = null;
  let disposed = false;
  if (def.look) {
    createCharacterModel({ ...def.look, shadows }).then((m) => {
      if (!m) return;
      if (disposed) { m.dispose(); return; }
      model = m;
      [body.shirt, body.pants, body.skin, body.head].forEach((mesh) => { if (mesh) mesh.visible = false; });
      group.add(m.object);
    });
  }

  function animate(state, seconds, timeScale = 1) {
    if (!model) return;
    model.play(state, { timeScale });
    model.update(seconds);
  }

  // A soft contact shadow under the feet (fake ambient occlusion). It is a
  // child of the body group, so it walks with the NPC; it works on mobile too.
  const blob = createContactBlob({ rx: radius * 1.1, rz: radius * 1.1, strength: 0.9 }, { shadows });
  blob.userData.baseY = 0;
  group.add(blob);

  const world = scene && scene.userData && scene.userData.colliders;
  let collider = null;
  if (world && typeof world.addTree === 'function') {
    collider = world.addTree({ id: 'npc-' + def.id, x, z, radius });
  }

  group.userData.npcId = def.id;
  group.userData.kind = 'npc';
  group.userData.getPrompt = (isMobile) => talkPrompt(name, !!isMobile);
  group.userData.interact = (ctx) => {
    if (ctx && typeof ctx.talk === 'function') return ctx.talk(def);
    if (ctx && ctx.dialogue && typeof ctx.dialogue.open === 'function') return ctx.dialogue.open(def.id);
    return false;
  };

  const entry = {
    id: 'npc-' + def.id,
    kind: 'npc',
    object: group,
    range: def.talkRange || NPC_TALK_RANGE,
    getPoint: () => ({ x, y: 1.6, z })
  };

  if (scene) {
    if (!scene.userData) scene.userData = {};
    if (!Array.isArray(scene.userData.interactables)) scene.userData.interactables = [];
    scene.userData.interactables.push(entry);
  }

  function applyPose(bob) {
    group.position.set(x, bob, z);
    group.rotation.y = yaw;
    // Keep the blob on the pavement / road / grass, not bobbing with the walk.
    blob.position.y = surfaceHeightAt(x, z) - bob;
    if (collider) {
      collider.x = x;
      collider.z = z;
    }
  }

  function moveTo(nextX, nextZ, player) {
    let nx = nextX;
    let nz = nextZ;
    if (world && typeof world.resolveMove === 'function') {
      const step = world.resolveMove(x, z, nx - x, nz - z, radius, {
        skipId: collider && collider.id,
        record: false
      });
      nx = step.x;
      nz = step.z;
    }
    if (player && player.position) {
      const sep = separateFromCircle(
        nx, nz, radius,
        player.position.x, player.position.z,
        player.radius || PLAYER_RADIUS
      );
      nx = sep.x;
      nz = sep.z;
    }
    x = nx;
    z = nz;
  }

  function update(dt, ctx = {}) {
    const player = ctx.player;
    const talking = ctx.talkingId === def.id;
    const seconds = Math.max(0, Number(dt) || 0);
    const px = player && player.position ? player.position.x : null;
    const pz = player && player.position ? player.position.z : null;
    const close = talking || (px != null && Math.hypot(px - x, pz - z) <= noticeRange);

    if (close && px != null) {
      mode = 'notice';
      yaw = yawToward(x, z, px, pz);
      phase = 0;
      moveTo(x, z, player);
      applyPose(0);
      animate(talking ? 'talk' : 'idle', seconds);
      return;
    }

    if (mode === 'notice') mode = 'walk';

    if (mode === 'idle') {
      idle -= seconds;
      if (idle <= 0) mode = 'walk';
    }

    if (mode === 'walk') {
      const targetX = dir > 0 ? x1 : x0;
      const speed = patrol.speed || 0.8;
      const step = speed * seconds;
      const remain = targetX - x;
      yaw = walkYaw(dir);
      if (Math.abs(remain) <= Math.max(step, 0.02)) {
        moveTo(targetX, z, player);
        if (Math.abs(x - targetX) <= 0.04) {
          x = targetX;
          mode = 'idle';
          idle = patrol.idle || 2.5;
          dir = -dir;
          restPose = Math.random() < 0.25 ? 'phone' : 'idle';
        }
        phase = 0;
      } else {
        moveTo(x + Math.sign(remain) * step, z, player);
        phase += seconds * (speed * 10);
      }
    }

    // The walk clip has its own bob; only the placeholder body needs the fake one.
    const bob = !model && mode === 'walk' ? Math.abs(Math.sin(phase)) * 0.04 : 0;
    applyPose(bob);
    const walking = mode === 'walk';
    animate(walking ? 'walk' : restPose, seconds, walking ? (patrol.speed || 0.8) / WALK_CLIP_SPEED : 1);
  }

  function dispose() {
    disposed = true;
    if (model) { group.remove(model.object); model.dispose(); model = null; }
    if (world && collider && typeof world.remove === 'function') world.remove(collider.id);
    if (scene && Array.isArray(scene.userData.interactables)) {
      scene.userData.interactables = scene.userData.interactables.filter((e) => e !== entry);
    }
    group.remove(blob);
    blob.geometry.dispose();
    body.dispose();
  }

  applyPose(0);

  return {
    def,
    body,
    group,
    entry,
    collider,
    update,
    dispose,
    get id() { return def.id; },
    get name() { return name; },
    get mode() { return mode; },
    get hasModel() { return !!model; },
    get position() { return { x, y: group.position.y, z }; },
    get yaw() { return yaw; },
    get radius() { return radius; }
  };
}

export function createNpcs({ scene, shadows = false, defs = NPC_DEFS } = {}) {
  const list = [];
  const source = defs || NPC_DEFS;
  for (let i = 0; i < source.length; i++) {
    if (source[i]) list.push(createNpc(source[i], { scene, shadows }));
  }
  if (scene) {
    if (!scene.userData) scene.userData = {};
    scene.userData.npcs = list;
  }
  function update(dt, ctx) {
    for (let i = 0; i < list.length; i++) list[i].update(dt, ctx);
  }
  function get(id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function dispose() {
    for (let i = 0; i < list.length; i++) list[i].dispose();
    list.length = 0;
    if (scene && scene.userData && scene.userData.npcs === list) scene.userData.npcs = [];
  }
  return { list, update, get, dispose };
}

export { lookupNpc as getNpc };
