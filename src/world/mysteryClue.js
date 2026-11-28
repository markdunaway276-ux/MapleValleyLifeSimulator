import * as THREE from 'three';
import { SURFACE_Y } from './street.js';
import { isNightHour } from '../systems/mysteryChapter3.js';

/**
 * 3D East Creek Stone Cairn & Brass Time Capsule clue at the north-east bank
 * of Maple Lane Park Pond for Mystery Chapter 3. Pulses with a warm amber
 * reflection at night so players can spot it with Walt's Field Flashlight.
 */

export const EAST_CREEK_CLUE_POS = Object.freeze({ x: 93.8, z: 39.2 });

export function buildMysteryClue(scene, quality, mysteryChapter3) {
  const shadows = !!(quality && quality.shadows);
  const group = new THREE.Group();
  group.name = 'ch3-east-creek-clue';
  group.position.set(EAST_CREEK_CLUE_POS.x, SURFACE_Y.grass, EAST_CREEK_CLUE_POS.z);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7b7871, roughness: 0.94 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a64a,
    emissive: 0xffb84d,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.78
  });

  // Small 3-stone cairn
  const s1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneMat);
  s1.position.set(0, 0.14, 0);
  s1.scale.set(1.25, 0.72, 1.1);
  s1.castShadow = s1.receiveShadow = shadows;

  const s2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), stoneMat);
  s2.position.set(0.03, 0.33, -0.02);
  s2.scale.set(1.15, 0.75, 1.0);
  s2.castShadow = shadows;

  const s3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), stoneMat);
  s3.position.set(-0.02, 0.47, 0.01);
  s3.castShadow = shadows;

  // Brass-capped time capsule tucked beside the base stone
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 10), brassMat);
  capsule.position.set(0.22, 0.08, 0.14);
  capsule.rotation.set(0.3, 0.4, Math.PI / 2 - 0.2);
  capsule.castShadow = shadows;

  group.add(s1, s2, s3, capsule);

  group.userData.kind = 'mystery-clue';
  group.userData.id = 'ch3-east-creek-clue';
  group.userData.interactLocal = new THREE.Vector3(0, 0.35, 0);
  group.userData.getPrompt = (isMobile) =>
    `${isMobile ? 'Tap' : 'Press E'} to inspect East Creek cairn`;
  group.userData.interact = () => mysteryChapter3.inspectNightClue();

  if (!scene.userData.interactables) scene.userData.interactables = [];
  scene.userData.interactables = scene.userData.interactables.filter((e) => e.id !== 'ch3-east-creek-clue');
  scene.userData.interactables.push({
    id: 'ch3-east-creek-clue',
    kind: 'mystery-clue',
    object: group,
    range: 2.6,
    enabled: () => mysteryChapter3.stage === 'night-clue'
  });

  scene.add(group);

  let pulseT = 0;
  function update(dt, minutes) {
    const active = mysteryChapter3.stage === 'night-clue';
    group.visible = active || mysteryChapter3.stage === 'walt';
    capsule.visible = active;
    if (!active) return;
    pulseT += Math.min(0.1, Number(dt) || 0.016);
    const night = isNightHour(minutes);
    brassMat.emissiveIntensity = night ? (0.55 + Math.sin(pulseT * 3.5) * 0.35) : 0.08;
  }

  scene.userData.mysteryClue = { group, update };
  return { group, update };
}
