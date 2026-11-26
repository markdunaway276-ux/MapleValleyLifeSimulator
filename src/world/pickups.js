import * as THREE from 'three';
import { hidePickup } from '../systems/interactables.js';

/** Front-room dining table (matches interior.js). Snack sits on the top face. */
export const SNACK_SPAWN = { x: -1.55, y: 0.78, z: -7.7 };
/** On the south sidewalk, east of the front-door path, clear of the porch. */
export const MAILBOX_SPAWN = { x: 2, z: -4.4 };

export const MAILBOX_OPEN_ANGLE = -2.05;
export const MAILBOX_ANIM_SPEED = Math.abs(MAILBOX_OPEN_ANGLE) / 0.25;
export const MAILBOX_SIZE = { width: 0.4, depth: 0.36 };

const _tmp = new THREE.Vector3();

function promptFor(verb, isMobile) {
  return isMobile ? `Tap to ${verb}` : `Press E to ${verb}`;
}

function mat(color, shadows, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.8,
    metalness: extras.metalness ?? 0.05,
    ...extras
  });
}

function mesh(geo, material, name, shadows) {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = !!shadows;
  m.receiveShadow = !!shadows;
  return m;
}

/**
 * A small wrapped snack (two boxes) sitting on a table. No collider of its
 * own — the table already blocks the player. E / tap stacks it onto Snack.
 */
export function createSnackPickup({ shadows = false, onPick } = {}) {
  const group = new THREE.Group();
  group.name = 'snack-pickup';

  const bar = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.09), mat(0x6b3a1f, shadows), 'snack-bar', shadows);
  const wrap = mesh(new THREE.BoxGeometry(0.06, 0.042, 0.092), mat(0xd4a72c, shadows, { roughness: 0.55 }), 'snack-wrap', shadows);
  group.add(bar, wrap);

  group.userData.kind = 'pickup';
  group.userData.id = 'snack';
  group.userData.itemId = 'snack';
  group.userData.interactLocal = new THREE.Vector3(0, 0, 0);
  group.userData.getPrompt = (isMobile) => promptFor('pick up Snack', isMobile);
  group.userData.interact = (ctx) => {
    if (group.userData.picked) return false;
    if (!ctx || !ctx.inventory || typeof ctx.inventory.addItem !== 'function') return false;
    const added = ctx.inventory.addItem('snack', 1);
    if (!added) return false;
    hidePickup(group);
    if (ctx.scene && ctx.scene.userData && ctx.scene.userData.world) {
      ctx.scene.userData.world.take('snack');
    }
    if (typeof onPick === 'function') onPick(ctx);
    return true;
  };
  return group;
}

function applyMailboxPose(mailbox, immediate = true) {
  const lid = mailbox.getObjectByName('mailbox-lid');
  if (!lid) return;
  const target = mailbox.userData.open ? MAILBOX_OPEN_ANGLE : 0;
  if (immediate) lid.rotation.x = target;
}

/**
 * A street mailbox: post, box, and a top lid that flips back. Interacting
 * toggles the lid. The first open gives a one-time Letter. userData.mail
 * is the extension point for later daily mail (pending[], onOpen).
 */
export function createMailbox({ shadows = false, onOpen } = {}) {
  const group = new THREE.Group();
  group.name = 'mailbox';

  const postMat = mat(0x4a3a2a, shadows, { roughness: 0.9 });
  const boxMat = mat(0x3d5a8a, shadows, { roughness: 0.55, metalness: 0.2 });
  const lidMat = mat(0x314a72, shadows, { roughness: 0.5, metalness: 0.22 });

  const post = mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), postMat, 'mailbox-post', shadows);
  post.position.y = 0.51;
  group.add(post);

  const bodyW = 0.36, bodyH = 0.26, bodyD = 0.22;
  const bodyY = 1.14;
  const body = mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), boxMat, 'mailbox-body', shadows);
  body.position.y = bodyY;
  group.add(body);

  // Lid hinged at the back (-z) top edge so it flips away from the street.
  const lid = new THREE.Group();
  lid.name = 'mailbox-lid';
  lid.position.set(0, bodyY + bodyH / 2, -bodyD / 2);
  const lidSlab = mesh(new THREE.BoxGeometry(bodyW + 0.02, 0.04, bodyD + 0.02), lidMat, 'mailbox-lid-slab', shadows);
  lidSlab.position.set(0, 0.02, bodyD / 2);
  lid.add(lidSlab);
  group.add(lid);

  group.userData.kind = 'mailbox';
  group.userData.id = 'mailbox';
  group.userData.open = false;
  group.userData.isMailbox = true;
  group.userData.highlightMesh = body;
  group.userData.interactLocal = new THREE.Vector3(0, bodyY, bodyD / 2);
  group.userData.mail = { letterTaken: false, pending: [] };
  group.userData.applyPose = (immediate) => applyMailboxPose(group, immediate);
  group.userData.getPrompt = (isMobile) => promptFor(group.userData.open ? 'close mailbox' : 'open mailbox', isMobile);
  group.userData.interact = (ctx) => {
    group.userData.open = !group.userData.open;
    const mail = group.userData.mail;
    if (group.userData.open && mail && !mail.letterTaken) {
      if (ctx && ctx.inventory && typeof ctx.inventory.addItem === 'function') {
        const added = ctx.inventory.addItem('letter', 1);
        if (added) {
          mail.letterTaken = true;
          if (ctx.scene && ctx.scene.userData && ctx.scene.userData.world) {
            ctx.scene.userData.world.take('letter');
          }
        }
      }
    }
    if (group.userData.open && mail && typeof mail.onOpen === 'function') mail.onOpen(ctx);
    if (group.userData.open && typeof onOpen === 'function') onOpen(ctx);
    return group.userData.open;
  };
  return group;
}

export function updatePickups(list, delta) {
  if (!list || !list.length) return;
  const step = MAILBOX_ANIM_SPEED * Math.max(0, delta || 0);
  for (let i = 0; i < list.length; i++) {
    const obj = list[i] && (list[i].object || list[i]);
    if (!obj || !obj.userData || !obj.userData.isMailbox) continue;
    const lid = obj.getObjectByName('mailbox-lid');
    if (!lid) continue;
    const target = obj.userData.open ? MAILBOX_OPEN_ANGLE : 0;
    const cur = lid.rotation.x;
    const diff = target - cur;
    if (Math.abs(diff) <= 1e-4) lid.rotation.x = target;
    else if (step <= 0 || Math.abs(diff) <= step) lid.rotation.x = target;
    else lid.rotation.x = cur + Math.sign(diff) * step;
  }
}

export function mailboxCollider(mailbox) {
  mailbox.updateMatrixWorld(true);
  mailbox.getWorldPosition(_tmp);
  return {
    id: 'mailbox',
    x: _tmp.x,
    z: _tmp.z,
    width: MAILBOX_SIZE.width,
    depth: MAILBOX_SIZE.depth,
    rotY: mailbox.rotation.y
  };
}
