import * as THREE from 'three';
import { getNpc } from '../data/npcs.js';

/**
 * Reusable cinematic cutscene & neighbor introduction system.
 *
 * When you meet a neighbour for the first time (or trigger a story beat),
 * the camera smoothly glides from first-person into a medium 3/4 shot framing
 * the character, slides in letterbox bars and a gritty character title card,
 * then hands off to dialogue while holding the framed shot. When dialogue
 * closes, the camera glides cleanly back to first-person.
 */

const STYLE_ID = 'maple-cutscene-css';
const INTRO_DURATION = 1.75;
const EXIT_DURATION = 0.45;

const CSS = `
.cutscene-bar {
  position: fixed;
  left: 0;
  right: 0;
  height: 9vh;
  max-height: 76px;
  min-height: 36px;
  background: #07080a;
  z-index: 48;
  pointer-events: none;
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}
.cutscene-bar.top { top: 0; transform: translateY(-105%); }
.cutscene-bar.bottom { bottom: 0; transform: translateY(105%); }
.cutscene-bar.is-open { transform: translateY(0); }

.cutscene-card {
  position: fixed;
  left: max(24px, 5vw);
  bottom: calc(min(76px, max(36px, 9vh)) + 26px);
  z-index: 49;
  pointer-events: none;
  padding: 12px 18px 12px 16px;
  background: rgba(14, 16, 19, 0.86);
  border-left: 4px solid #d4943a;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  color: #f3efe6;
  font-family: system-ui, -apple-system, sans-serif;
  opacity: 0;
  transform: translateX(-28px);
  transition: opacity 0.32s ease, transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}
.cutscene-card.is-visible {
  opacity: 1;
  transform: translateX(0);
}
.cutscene-card-name {
  margin: 0;
  font: 800 clamp(22px, 3.2vw, 32px)/1.05 system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}
.cutscene-card-role {
  margin: 5px 0 0;
  font: 600 13px/1.2 system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d6b682;
}
.cutscene-skip {
  position: fixed;
  right: max(18px, 3.5vw);
  bottom: calc(min(76px, max(36px, 9vh)) + 16px);
  z-index: 49;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(12, 14, 17, 0.72);
  color: rgba(240, 236, 226, 0.85);
  font: 600 12px/1 system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.cutscene-skip.is-visible {
  opacity: 1;
  pointer-events: auto;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * Computes a clean medium-shot camera pose framing an NPC from the player's
 * side so the shot never clips behind a counter or wall.
 */
export function computeIntroShot(npcPos, playerPos) {
  const nx = npcPos.x;
  const ny = npcPos.y || 0;
  const nz = npcPos.z;
  let dx = playerPos.x - nx;
  let dz = playerPos.z - nz;
  const len = Math.hypot(dx, dz);
  if (len > 1e-4) {
    dx /= len;
    dz /= len;
  } else {
    dx = 0;
    dz = 1;
  }
  // Slight right-hand 3/4 cinematic offset, staying on the player's side of the NPC.
  const rightX = -dz;
  const rightZ = dx;
  const dist = Math.max(1.35, Math.min(2.05, len > 0.5 ? len * 0.82 : 1.85));
  const camPos = new THREE.Vector3(
    nx + dx * dist + rightX * 0.32,
    ny + 1.54,
    nz + dz * dist + rightZ * 0.32
  );
  const lookAt = new THREE.Vector3(nx, ny + 1.44, nz);
  // Cameras look down -Z (unlike Object3D.lookAt which aims +Z), so use Matrix4.lookAt
  // to build a true camera quaternion pointing straight at the NPC's face.
  const lookMat = new THREE.Matrix4().lookAt(camPos, lookAt, new THREE.Vector3(0, 1, 0));
  const quat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
  return { pos: camPos, quat, lookAt };
}

export function createCutscene({
  camera,
  player,
  npcs,
  dialogue,
  sfx = null,
  isMobile = false,
  hasSeenIntro = null,
  onIntroSeen = null
} = {}) {
  ensureStyles();

  let topBar = null;
  let bottomBar = null;
  let card = null;
  let cardName = null;
  let cardRole = null;
  let skipBtn = null;

  if (typeof document !== 'undefined') {
    topBar = document.createElement('div');
    topBar.className = 'cutscene-bar top';
    bottomBar = document.createElement('div');
    bottomBar.className = 'cutscene-bar bottom';

    card = document.createElement('div');
    card.className = 'cutscene-card';
    cardName = document.createElement('h2');
    cardName.className = 'cutscene-card-name';
    cardRole = document.createElement('p');
    cardRole.className = 'cutscene-card-role';
    card.append(cardName, cardRole);

    skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'cutscene-skip';
    skipBtn.textContent = isMobile ? 'Tap to skip' : 'Space to skip';
    skipBtn.addEventListener('click', () => skipIntroBeat());

    document.body.append(topBar, bottomBar, card, skipBtn);
  }

  let state = 'idle'; // 'idle' | 'intro' | 'dialogue' | 'exit'
  let activeNpcId = null;
  let activeNpc = null;
  let elapsed = 0;
  let fromPos = new THREE.Vector3();
  let fromQuat = new THREE.Quaternion();
  let shot = null;
  let afterDialogue = null;

  function setBars(open) {
    if (topBar) topBar.classList.toggle('is-open', open);
    if (bottomBar) bottomBar.classList.toggle('is-open', open);
  }

  function setCard(visible, name = '', role = '') {
    if (!card) return;
    if (visible) {
      cardName.textContent = name;
      cardRole.textContent = role;
    }
    card.classList.toggle('is-visible', visible);
    if (skipBtn) skipBtn.classList.toggle('is-visible', visible);
  }

  function findNpc(id) {
    if (!npcs || !Array.isArray(npcs.list)) return null;
    return npcs.list.find((n) => n && n.id === id) || null;
  }

  function enterDialoguePhase() {
    if (state !== 'intro') return;
    state = 'dialogue';
    setCard(false);
    const opened = dialogue && typeof dialogue.open === 'function' ? dialogue.open(activeNpcId) : false;
    if (!opened) beginExit();
  }

  function beginExit() {
    if (state === 'idle' || state === 'exit') return;
    // Keep the player facing the NPC they just talked to instead of turning away.
    if (activeNpc && activeNpc.position && player && player.position) {
      const dx = activeNpc.position.x - player.position.x;
      const dz = activeNpc.position.z - player.position.z;
      if (Math.hypot(dx, dz) > 0.05) {
        const faceYaw = Math.atan2(-dx, -dz);
        if (player.rotation) {
          player.rotation.y = faceYaw;
          player.rotation.x = 0;
          fromQuat.setFromEuler(player.rotation);
        } else {
          fromQuat.setFromEuler(new THREE.Euler(0, faceYaw, 0, 'YXZ'));
        }
      }
    }
    state = 'exit';
    elapsed = 0;
    setCard(false);
    setBars(false);
  }

  function finishCutscene() {
    const cb = afterDialogue;
    state = 'idle';
    activeNpcId = null;
    activeNpc = null;
    shot = null;
    afterDialogue = null;
    if (camera && player) {
      camera.position.copy(player.position);
      camera.quaternion.copy(fromQuat);
      if ('mouseX' in player) player.mouseX = 0;
      if ('mouseY' in player) player.mouseY = 0;
    }
    if (typeof cb === 'function') cb();
  }

  function skipIntroBeat() {
    if (state === 'intro') enterDialoguePhase();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (state !== 'intro') return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        skipIntroBeat();
      }
    });
  }

  function playIntro(npcId, { onComplete = null } = {}) {
    if (state !== 'idle') return false;
    const def = getNpc(npcId);
    const npc = findNpc(npcId);
    if (!def || !npc || !camera || !player) {
      if (dialogue && typeof dialogue.open === 'function') return dialogue.open(npcId);
      return false;
    }

    activeNpcId = npcId;
    activeNpc = npc;
    afterDialogue = onComplete;
    elapsed = 0;
    state = 'intro';

    fromPos.copy(camera.position);
    fromQuat.copy(camera.quaternion);
    shot = computeIntroShot(npc.position, player.position);

    if (typeof onIntroSeen === 'function') onIntroSeen(npcId);
    setBars(true);
    setCard(true, def.name || npcId, def.tagline || def.role || 'Maple Lane');
    if (sfx && typeof sfx.play === 'function') sfx.play('pickup');
    return true;
  }

  function talkWithIntro(npcId, opts = {}) {
    const seen = typeof hasSeenIntro === 'function' ? !!hasSeenIntro(npcId) : false;
    if (!seen) return playIntro(npcId, opts);
    return dialogue && typeof dialogue.open === 'function' ? dialogue.open(npcId) : false;
  }

  function update(delta) {
    if (state === 'idle' || !camera || !shot) return;
    elapsed += Math.max(0, Number(delta) || 0);

    if (state === 'intro') {
      const t = smooth(Math.min(1, elapsed / 0.85));
      camera.position.lerpVectors(fromPos, shot.pos, t);
      camera.quaternion.slerpQuaternions(fromQuat, shot.quat, t);
      if (activeNpc && typeof activeNpc.wave === 'function') {
        activeNpc.wave(Math.max(0, 1 - elapsed / INTRO_DURATION), elapsed);
      }
      if (elapsed >= INTRO_DURATION) enterDialoguePhase();
      return;
    }

    if (state === 'dialogue') {
      // Hold gentle subtle breathing drift on the framed NPC while dialogue is open.
      const drift = Math.sin(elapsed * 0.9) * 0.025;
      camera.position.set(shot.pos.x + drift, shot.pos.y, shot.pos.z);
      camera.quaternion.copy(shot.quat);
      if (!dialogue || !dialogue.isOpen()) beginExit();
      return;
    }

    if (state === 'exit') {
      const t = smooth(Math.min(1, elapsed / EXIT_DURATION));
      const targetPos = player ? player.position : fromPos;
      camera.position.lerpVectors(shot.pos, targetPos, t);
      camera.quaternion.slerpQuaternions(shot.quat, fromQuat, t);
      if (elapsed >= EXIT_DURATION) finishCutscene();
    }
  }

  return {
    playIntro,
    talkWithIntro,
    skipIntroBeat,
    update,
    isActive: () => state !== 'idle',
    isIntroRunning: () => state === 'intro' || state === 'exit',
    currentNpc: () => activeNpcId,
    get state() { return state; }
  };
}
